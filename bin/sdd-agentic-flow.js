#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline/promises');
const { execFileSync } = require('node:child_process');
const { validateContractReferences, parseContractArray } = require('./contract-graph');
const { satisfiesRange } = require('./version-compat');
const {
  styleStatus,
  didYouMean,
  outputMode,
  isRich,
  symbol,
  writeBrand,
  doctorFooterLines,
} = require('./ui');
const { shouldShowInteractiveMenu, menuActionsFor, resolveMenuSelection } = require('./menu');
const { checkForUpdate } = require('./update-check');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const VERSION = JSON.parse(
  fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'),
).version;
const PRESETS_DIR = path.join(PACKAGE_ROOT, 'presets');
const LANGUAGE_PROFILES = ['en-US', 'pt-BR'];
const FEATURE_PROFILES = ['small_fix', 'medium_feature', 'large_feature', 'epic'];
const EXECUTION_MODES = ['plan', 'guided', 'apply', 'review', 'full'];
const AUTONOMY_LEVELS = ['manual', 'supervised', 'autonomous'];
// v1.8.0: autonomy_level is a new axis orthogonal to execution_mode (docs/execution-modes.md,
// shared/references/autonomy-guardrails.md) — `plan`/`guided` never combine with `autonomous`:
// a plan-only workflow has nothing to auto-advance into, and step-by-step confirmation is the
// entire point of `guided`.
const INVALID_AUTONOMY_COMBOS = new Set(['plan:autonomous', 'guided:autonomous']);
function autonomyComboValid(executionMode, autonomyLevel) {
  return !INVALID_AUTONOMY_COMBOS.has(`${executionMode}:${autonomyLevel}`);
}
const OFFICIAL_SKILLS = [
  'setup-sdd-agentic-flow',
  'sdd-route',
  'sdd-brainstorm',
  'sdd-create-specs',
  'sdd-explain-me',
  'sdd-create-prompts',
  'sdd-implement-task',
  'sdd-implement-multi',
  'sdd-task-check',
  'sdd-create-pr',
  'sdd-pr-review',
  'sdd-pr-fix',
  'sdd-validation',
  'sdd-release',
];
const REQUIRED_CONTRACT_FIELDS = [
  'extends',
  'requires',
  'consumes',
  'produces',
  'baseline',
  'compatible_with',
];
const OPTIONAL_CONTRACT_FIELDS = ['depends_on', 'conflicts', 'requires_cli'];

// v1.10.0: toolkit state lives under .sdd-agentic-flow/ (not the legacy .sdd/ short name).
const SDD_ROOT = '.sdd-agentic-flow';
const LEGACY_SDD_ROOT = '.sdd';
const SDD_PATHS = {
  config: `${SDD_ROOT}/config.yml`,
  contextDir: `${SDD_ROOT}/context`,
  projectContext: `${SDD_ROOT}/context/project-context.md`,
  autonomyDir: `${SDD_ROOT}/autonomy`,
  loopState: `${SDD_ROOT}/autonomy/loop-state.md`,
  snapshots: `${SDD_ROOT}/snapshots`,
  reports: `${SDD_ROOT}/reports`,
  usage: `${SDD_ROOT}/usage.md`,
};
const USAGE_GUIDE_URL =
  'https://github.com/gmartins-dev/sdd-agentic-flow/blob/main/docs/sdd-skills-usage-guide.md';
const LOCAL_GIT_EXCLUDE_COMMENT = '# sdd-agentic-flow init --local-git-exclude';
const LOCAL_GIT_EXCLUDE_ENTRY = `${SDD_ROOT}/`;

function sddJoin(cwd, ...segments) {
  return path.join(cwd, SDD_ROOT, ...segments);
}

function legacySddJoin(cwd, ...segments) {
  return path.join(cwd, LEGACY_SDD_ROOT, ...segments);
}

// Agent Integration Layer (Milestone 1): user-scope (global, per-agent) skill directories,
// each verified against the agent's own documentation (see docs/installation-scope.md).
// Segments are joined onto a home directory, never hardcoded as absolute paths, so this
// stays cross-platform (Milestone 2) — the only place in the CLI that resolves os.homedir().
const AGENT_USER_DIR_SEGMENTS = {
  codex: [['.agents', 'skills']],
  cursor: [
    ['.agents', 'skills'],
    ['.cursor', 'skills'],
  ],
  'claude-code': [['.claude', 'skills']],
  'vscode-copilot': [['.copilot', 'skills']],
};
const KNOWN_AGENTS = Object.keys(AGENT_USER_DIR_SEGMENTS);
// Default (no --agent): the 3 fixed targets documented in docs/installation-scope.md —
// covers Codex CLI + Cursor (+ Copilot's `.agents/skills` fallback), Claude Code, and
// GitHub Copilot's own `.copilot/skills` convention.
const DEFAULT_USER_DIR_SEGMENTS = [
  ['.agents', 'skills'],
  ['.claude', 'skills'],
  ['.copilot', 'skills'],
];

function userSkillsDirsFor(agent, homeDir = os.homedir()) {
  if (agent && !KNOWN_AGENTS.includes(agent)) return null;
  const segments = agent ? AGENT_USER_DIR_SEGMENTS[agent] : DEFAULT_USER_DIR_SEGMENTS;
  const seen = new Set();
  const dirs = [];
  for (const parts of segments) {
    const dir = path.join(homeDir, ...parts);
    if (seen.has(dir)) continue;
    seen.add(dir);
    dirs.push(dir);
  }
  return dirs;
}

// Milestone 2 (Platform Abstraction): the only place that reads process.env for shell
// detection. Informational only — never used to decide CLI behavior, only surfaced via
// `doctor`'s Platform section (see docs/environment-compatibility.md).
function detectShellInfo(env = process.env) {
  if (env.SHELL) return path.basename(env.SHELL);
  if (env.PSModulePath) return 'powershell';
  if (env.ComSpec) return path.basename(env.ComSpec);
  return 'unknown';
}

function filesystemWritable() {
  const probe = path.join(
    os.tmpdir(),
    `.sdd-agentic-flow-write-check-${process.pid}-${Date.now()}`,
  );
  try {
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

function gitAvailable() {
  try {
    execFileSync('git', ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

const PRIVATE_PATTERNS = [
  'QmVyZXNoaXQ=',
  'QmFtYXE=',
  'TU1CUQ==',
  'Z3VpbGhlcm1lLm1pcmFuZGE=',
  'd29ya3NwYWNlL2Rldi9sb2NhbA==',
  'LmxvY2FsL2JlcmVzaGl0',
  'Zm9ybWFsaXphdGlvbg==',
  'Y3JlZGl0LXNpbXVsYXRpb24=',
  'Y3JlZGl0LWZvcm1hbGl6YXRpb24=',
  'U2FsZXNmb3JjZQ==',
  'Q0FG',
].map((value) => Buffer.from(value, 'base64').toString('utf8'));

function configFor(options = {}) {
  const profile = options.profile || options.language || 'en-US';
  return `version: 1

project:
  name: ${options.name || 'example-project'}
  default_branch: ${options.branch || 'main'}

agent:
  target: ${options.agent || 'generic'}

language:
  profile: ${profile}
  human_outputs: ${profile}
  technical_tokens: canonical
  bilingual_mode: technical-canonical

specs:
  root: .specs/features
  files:
    - context.md
    - spec.md
    - design.md
    - tasks.md

source:
  type: ${options.source || 'local-files'}
  snapshots_dir: .sdd-agentic-flow/snapshots

workflow:
  default_flow: ${options.flow || 'single'}
  feature_profile: ${options.featureProfile || 'medium_feature'}
  allow_multi_worktree: ${options.multiWorktree || false}
  allow_stacked_prs: ${options.stackedPrs || false}
  commit_policy: manual
  execution_mode: ${options.executionMode || 'guided'}
  autonomy_level: ${options.autonomyLevel || 'manual'}

  autonomy_budget:
    max_iterations: 50
    max_tokens: 500000
    max_runtime_hours: 4
    pause_on_warning: true

quality:
  tlc_baseline_required: true
  require_tdd: true
  require_independent_check: true
  require_evidence_before_completion: true

safety:
  no_commit_by_default: true
  no_push_by_default: true
  no_merge_or_deploy: true
`;
}

function configValue(content, key) {
  const match = content.match(new RegExp(`^\\s+${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
}

function resolveConfiguredAgent(cwd) {
  const configPath = sddJoin(cwd, 'config.yml');
  if (!fs.existsSync(configPath)) return null;
  const target = configValue(fs.readFileSync(configPath, 'utf8'), 'target');
  return target && KNOWN_AGENTS.includes(target) ? target : null;
}

function languageProfilePath(cwd, profile, isPackage) {
  return isPackage
    ? path.join(PACKAGE_ROOT, 'shared', 'language-profiles', `${profile}.md`)
    : path.join(
        resolveSkillsRoot(cwd),
        'sdd-agentic-flow-shared',
        'language-profiles',
        `${profile}.md`,
      );
}

function languageReport(cwd) {
  const configPath = sddJoin(cwd, 'config.yml');
  const isPackage = (() => {
    try {
      return (
        JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).name ===
        'sdd-agentic-flow'
      );
    } catch {
      return false;
    }
  })();
  const content = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf8')
    : isPackage
      ? configFor()
      : null;
  if (!content) {
    return {
      status: 'WARN',
      profile: null,
      human_outputs: null,
      technical_tokens: null,
      bilingual_mode: null,
      message: 'language profile is not configured',
    };
  }
  const profile = configValue(content, 'profile');
  const humanOutputs = configValue(content, 'human_outputs');
  const technicalTokens = configValue(content, 'technical_tokens');
  const bilingualMode = configValue(content, 'bilingual_mode');
  if (!profile) {
    return {
      status: 'WARN',
      profile: null,
      human_outputs: humanOutputs,
      technical_tokens: technicalTokens,
      bilingual_mode: bilingualMode,
      message: 'language.profile is missing; using legacy language settings',
    };
  }
  const valid =
    LANGUAGE_PROFILES.includes(profile) &&
    humanOutputs === profile &&
    technicalTokens === 'canonical' &&
    bilingualMode === 'technical-canonical';
  const profileFile = languageProfilePath(cwd, profile, isPackage);
  const installed = fs.existsSync(profileFile);
  const status = valid && installed ? 'PASS' : valid ? 'WARN' : 'FAIL';
  return {
    status,
    profile,
    human_outputs: humanOutputs,
    technical_tokens: technicalTokens,
    bilingual_mode: bilingualMode,
    message: !valid
      ? 'language profile values are invalid'
      : installed
        ? 'language profile is valid'
        : 'language profile is configured but not installed',
  };
}

function log(status, message) {
  process.stdout.write(`${styleStatus(status, process.stdout)} ${message}\n`);
}

function resolveMode(flags = {}) {
  return outputMode({ stdout: process.stdout, stdin: process.stdin }, process.env, {
    ascii:
      Boolean(flags.ascii) || process.argv.includes('--ascii') || process.env.SDD_ASCII === '1',
    quiet: Boolean(flags.quiet),
    json: Boolean(flags.json),
  });
}

function stripAsciiFlag(args) {
  return args.filter((arg) => arg !== '--ascii');
}

// Structured stderr errors (What / Reason / Try). Second arg may be an exit code (legacy) or
// `{ code, reason, try }`. Did-you-mean suggestions belong in Try — never auto-executed.
function fail(message, codeOrOptions = 1) {
  let code = 1;
  let reason = null;
  let tryLines = [];
  if (typeof codeOrOptions === 'number') code = codeOrOptions;
  else if (codeOrOptions && typeof codeOrOptions === 'object') {
    code = codeOrOptions.code ?? 1;
    reason = codeOrOptions.reason ?? null;
    tryLines = codeOrOptions.try ?? [];
  }
  let out = `${styleStatus('FAIL', process.stderr)} ${message}\n`;
  if (reason) out += `\nReason:\n  ${reason}\n`;
  if (tryLines.length) out += `\nTry:\n${tryLines.map((line) => `  ${line}`).join('\n')}\n`;
  process.stderr.write(out);
  process.exitCode = code;
}

function didYouMeanTry(input, candidates) {
  const match = didYouMean(input, candidates);
  return match ? `Did you mean \`${match}\`?` : null;
}

// Suggested-next-step block for human-rich / human-plain only. Suppressed by --quiet and
// by machine mode (pipe/CI/non-TTY/`--json`). Welcome's machine screen prints its own
// contextual next line inline — that is status prose, not this helper.
function nextStep(lines, options = {}) {
  if (options.quiet) return;
  const mode = options.mode ?? resolveMode(options);
  if (mode === 'machine') return;
  const list = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
  if (!list.length) return;
  process.stdout.write(`\nSuggested next step\n${list.map((line) => `  ${line}`).join('\n')}\n`);
}

function logPassLine(message, options = {}) {
  const mode = options.mode ?? resolveMode(options);
  if (isRich(mode)) {
    process.stdout.write(`│\n`);
    process.stdout.write(`${styleStatus('PASS', process.stdout)} ${message}\n`);
    return;
  }
  log('PASS', message);
}

function readPreset(name) {
  const filename = path.join(PRESETS_DIR, `${name}.json`);
  if (!fs.existsSync(filename)) return null;
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function presetNames() {
  return fs
    .readdirSync(PRESETS_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace(/\.json$/, ''))
    .sort();
}

function list() {
  const presets = fs
    .readdirSync(PRESETS_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort();
  for (const file of presets) {
    const preset = JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, file), 'utf8'));
    log(
      'PACK',
      `${preset.name} (${preset.status}) — ${preset.skills.join(', ') || 'shared guidance only'}`,
    );
  }
}

function writeUsageGuide(cwd) {
  const source = path.join(PACKAGE_ROOT, 'shared', 'templates', 'usage.template.md');
  const destination = sddJoin(cwd, 'usage.md');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  log('PASS', `wrote ${SDD_PATHS.usage}`);
}

function applyLocalGitExclude(cwd) {
  const gitDir = path.join(cwd, '.git');
  if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
    log('WARN', 'init --local-git-exclude: no .git directory; skipped (Git is optional)');
    return;
  }
  const infoDir = path.join(gitDir, 'info');
  const excludePath = path.join(infoDir, 'exclude');
  fs.mkdirSync(infoDir, { recursive: true });
  const existing = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
  const alreadyListed = existing.split(/\r?\n/).some((line) => {
    const trimmed = line.trim();
    return trimmed === LOCAL_GIT_EXCLUDE_ENTRY || trimmed === SDD_ROOT;
  });
  if (alreadyListed) {
    log('PASS', `local git exclude already lists ${LOCAL_GIT_EXCLUDE_ENTRY}`);
    return;
  }
  const prefix = existing === '' || existing.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(
    excludePath,
    `${prefix}${LOCAL_GIT_EXCLUDE_COMMENT}\n${LOCAL_GIT_EXCLUDE_ENTRY}\n`,
  );
  log('PASS', `appended ${LOCAL_GIT_EXCLUDE_ENTRY} to .git/info/exclude`);
}

function applyInitSideEffects(cwd, options = {}) {
  writeUsageGuide(cwd);
  if (options.localGitExclude) applyLocalGitExclude(cwd);
}

function printUsageGuidePointer(cwd) {
  const localExists = fs.existsSync(path.join(cwd, SDD_PATHS.usage));
  if (localExists)
    return (
      `Skills usage guide (local stub, regenerable):\n  ${SDD_PATHS.usage}\n` +
      `Canonical guide:\n  ${USAGE_GUIDE_URL}\n`
    );
  return `Skills usage guide:\n  ${USAGE_GUIDE_URL}\n`;
}

function init(cwd, options = {}) {
  const mode = resolveMode({ quiet: options.quiet, ascii: options.ascii });
  applyInitSideEffects(cwd, options);
  const configPath = sddJoin(cwd, 'config.yml');
  if (fs.existsSync(configPath)) {
    log('WARN', `preserved existing ${SDD_PATHS.config}`);
    return false;
  }
  for (const relative of [SDD_PATHS.snapshots, SDD_PATHS.reports, '.specs/features']) {
    fs.mkdirSync(path.join(cwd, relative), { recursive: true });
  }
  fs.writeFileSync(configPath, configFor(options), 'utf8');
  logPassLine(`created ${SDD_PATHS.config}`, { mode, quiet: options.quiet });
  logPassLine('initialized local SDD directories', { mode, quiet: options.quiet });
  discoverProject(cwd, { force: false, quiet: true, ascii: options.ascii });
  if (!options.quiet) {
    nextStep('npx sdd-agentic-flow install core', { quiet: options.quiet, mode });
    process.stdout.write(`\n${printUsageGuidePointer(cwd)}`);
  }
  return true;
}

function existingPaths(cwd, names) {
  return names.filter((name) => fs.existsSync(path.join(cwd, name)));
}

function gitInfo(cwd) {
  const runGit = (args) => {
    try {
      return execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return null;
    }
  };
  return {
    revision: runGit(['rev-parse', 'HEAD']),
    branch: runGit(['rev-parse', '--abbrev-ref', 'HEAD']),
  };
}

function scanProjectSignals(cwd) {
  let packageJson = null;
  try {
    packageJson = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  } catch {
    packageJson = null;
  }
  return {
    readme: fs.existsSync(path.join(cwd, 'README.md')),
    aiInstructionFiles: existingPaths(cwd, ['AGENTS.md', 'CLAUDE.md', 'CODEX.md', 'GEMINI.md']),
    docsDir: fs.existsSync(path.join(cwd, 'docs')),
    adrDirs: existingPaths(cwd, ['adr', 'docs/adr']),
    packageName: packageJson?.name || null,
    packageDescription: packageJson?.description || null,
    workspaces: Boolean(packageJson?.workspaces),
    workspaceConfigs: existingPaths(cwd, [
      'pnpm-workspace.yaml',
      'turbo.json',
      'nx.json',
      'lerna.json',
    ]),
    testConfigs: existingPaths(cwd, [
      'jest.config.js',
      'jest.config.ts',
      'jest.config.mjs',
      'vitest.config.js',
      'vitest.config.ts',
      'pytest.ini',
      'pyproject.toml',
    ]),
    architecturalFolders: existingPaths(cwd, [
      'domain',
      'src/domain',
      'hexagonal',
      'src/hexagonal',
      'ports',
      'src/ports',
      'adapters',
      'src/adapters',
    ]),
    ciConfigs: existingPaths(cwd, ['.github/workflows', '.gitlab-ci.yml', '.circleci']),
    ormConfigs: existingPaths(cwd, [
      'prisma/schema.prisma',
      'drizzle.config.ts',
      'drizzle.config.js',
    ]),
    featureFlagConfigs: existingPaths(cwd, ['.launchdarkly.yml', 'unleash.yml']),
  };
}

function projectContextFor(signals, provenance) {
  const bullets = (items, empty) =>
    items.length ? items.map((item) => `- ${item}`).join('\n') : `- ${empty}`;
  return `# Project context (auto-discovered)

This file is generated by \`sdd-agentic-flow discover\` (also run automatically by
\`init\`). It records signals found in this repository so skills can load relevant
context without guessing. Treat the discovered sections as read-only output;
re-run \`npx sdd-agentic-flow discover --force\` or \`npx sdd-agentic-flow context refresh\`
to refresh them after the project changes. Both rewrite the whole file, so copy out any
manual notes first. Run \`npx sdd-agentic-flow context status\` to check what this file
reflects without regenerating it.

> Generated by sdd-agentic-flow ${VERSION}
> Generated at: ${provenance.generatedAt}
> Repository revision: ${provenance.revision || 'not a git repository'}
> Branch: ${provenance.branch || 'unknown'}

## Project identity

- Package name: ${signals.packageName || 'not detected'}
- Package description: ${signals.packageDescription || 'not detected'}
- README present: ${signals.readme ? 'yes' : 'no'}

## Documentation found

${bullets(signals.aiInstructionFiles, 'no AI instruction files found (AGENTS.md, CLAUDE.md, CODEX.md, GEMINI.md)')}
- docs/ directory: ${signals.docsDir ? 'present' : 'not found'}
- ADR directory: ${signals.adrDirs.length ? signals.adrDirs.join(', ') : 'not found'}

## Workspace / monorepo signals

- Declares workspaces in package.json: ${signals.workspaces ? 'yes' : 'no'}
${bullets(signals.workspaceConfigs, 'no monorepo tooling config found (pnpm-workspace.yaml, turbo.json, nx.json, lerna.json)')}

## Testing signals

${bullets(signals.testConfigs, 'no known test config found')}

## Architecture signals

${bullets(signals.architecturalFolders, 'no domain/hexagonal/ports/adapters folder naming found')}

## CI/CD signals

${bullets(signals.ciConfigs, 'no CI configuration found (.github/workflows, .gitlab-ci.yml, .circleci)')}

## Platform signals

${bullets(signals.ormConfigs, 'no ORM config found (prisma/schema.prisma, drizzle.config.*)')}
${bullets(signals.featureFlagConfigs, 'no feature-flag config found (.launchdarkly.yml, unleash.yml)')}

## Notes

<!-- Add manual context here. -->
`;
}

function discoverProject(cwd, options = {}) {
  const contextPath = sddJoin(cwd, 'context', 'project-context.md');
  if (fs.existsSync(contextPath) && !options.force) {
    log('WARN', `preserved existing ${SDD_PATHS.projectContext}`);
    return false;
  }
  const provenance = { generatedAt: new Date().toISOString(), ...gitInfo(cwd) };
  fs.mkdirSync(path.dirname(contextPath), { recursive: true });
  fs.writeFileSync(contextPath, projectContextFor(scanProjectSignals(cwd), provenance), 'utf8');
  log('PASS', `created ${SDD_PATHS.projectContext}`);
  if (!options.quiet) nextStep('npx sdd-agentic-flow doctor', { quiet: options.quiet });
  return true;
}

function parseProvenance(content) {
  const match = (label) => {
    const found = content.match(new RegExp(`^> ${label}: (.+)$`, 'm'));
    return found ? found[1].trim() : null;
  };
  return {
    generatedAt: match('Generated at'),
    revision: match('Repository revision'),
    branch: match('Branch'),
  };
}

function contextStatus(cwd) {
  const contextPath = sddJoin(cwd, 'context', 'project-context.md');
  if (!fs.existsSync(contextPath)) {
    log(
      'WARN',
      `status: not found; run \`init\` or \`discover\` to create ${SDD_PATHS.projectContext}`,
    );
    return;
  }
  const provenance = parseProvenance(fs.readFileSync(contextPath, 'utf8'));
  log('PASS', 'status: available');
  log('INFO', `artifact: ${SDD_PATHS.projectContext}`);
  log('INFO', `generated at: ${provenance.generatedAt || 'unknown'}`);
  log('INFO', `repository revision: ${provenance.revision || 'not a git repository'}`);
  log('INFO', `branch: ${provenance.branch || 'unknown'}`);
  const current = gitInfo(cwd);
  if (provenance.revision && current.revision && provenance.revision !== current.revision) {
    log('INFO', 'Repository has changed since context generation.');
    log('INFO', 'Recommendation: run `sdd-agentic-flow context refresh`.');
  }
}

function contextRefresh(cwd, options = {}) {
  discoverProject(cwd, { force: true, quiet: options.quiet, ascii: options.ascii });
}

// `context autonomy-state`: read-only report of .sdd-agentic-flow/config.yml's workflow.execution_mode /
// autonomy_level plus the last recorded .sdd-agentic-flow/autonomy/loop-state.md, if any. Never mutates
// anything — `autonomous-resume` is the command that acts on a blocked/paused state.
function autonomyStateReport(cwd) {
  const configPath = sddJoin(cwd, 'config.yml');
  const content = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : null;
  const executionMode = (content && configValue(content, 'execution_mode')) || 'guided';
  const autonomyLevel = (content && configValue(content, 'autonomy_level')) || 'manual';
  log('INFO', `execution_mode: ${executionMode}`);
  log('INFO', `autonomy_level: ${autonomyLevel}`);
  const state = readLoopState(cwd);
  if (!state) {
    log(
      'WARN',
      `status: no ${LOOP_STATE_RELATIVE} found; it is created by an agent the first time it runs a supervised/autonomous workflow`,
    );
    return;
  }
  log('PASS', 'status: available');
  log('INFO', `artifact: ${LOOP_STATE_RELATIVE}`);
  log('INFO', `current skill: ${state.skill || 'unknown'}`);
  log('INFO', `status: ${state.status || 'unknown'}`);
  log('INFO', `next: ${state.next || 'none'}`);
  log('INFO', `guardrails: ${state.guardrails || 'unknown'}`);
  if (state.stop)
    log('WARN', 'human override: stop=true — resolve the blocker, then run `autonomous-resume`');
  else if (state.pause)
    log('WARN', 'human override: pause=true — run `autonomous-resume` to continue');
  else log('PASS', 'human override: none');
}

// `autonomous-resume`: clears a pause=true/stop=true recorded in .sdd-agentic-flow/autonomy/loop-state.md and
// appends an audited log entry, so the invoking agent can re-check guardrails and continue.
// This CLI has no orchestration engine — it does not itself re-invoke the next skill (see the
// "Scope" note in shared/references/autonomy-guardrails.md); it only clears the gate and prints
// the recorded next-skill guidance for the agent to act on.
function autonomousResume(cwd, options = {}) {
  const state = readLoopState(cwd);
  if (!state) {
    fail(
      `no ${LOOP_STATE_RELATIVE} found; nothing to resume. It is created by an agent the first time it runs a supervised/autonomous workflow.`,
    );
    return;
  }
  if (!state.pause && !state.stop && !options.force && !options.overrideGuard) {
    log('PASS', `no active pause/stop recorded at skill '${state.skill}'; nothing to resume`);
    return;
  }
  const timestamp = new Date().toISOString();
  const entry = options.overrideGuard
    ? `- ${timestamp}: guardrail ${options.overrideGuard} overridden by human. Reason: ${options.reason}`
    : `- ${timestamp}: resumed via \`autonomous-resume${options.force ? ' --force' : ''}\`.`;
  let content = clearLastHumanOverride(state.content);
  content = /^## Override Log$/m.test(content)
    ? `${content.trimEnd()}\n${entry}\n`
    : `${content.trimEnd()}\n\n## Override Log\n\n${entry}\n`;
  fs.writeFileSync(state.file, content, 'utf8');
  log('PASS', `resumed: cleared human override recorded at skill '${state.skill}'`);
  log('INFO', `next skill: ${state.next || `unknown — inspect ${SDD_PATHS.loopState}`}`);
  log('INFO', 'the invoking agent re-checks all 7 guardrails before advancing to it.');
  if (state.next) nextStep(`invoke the ${state.next} skill`, { quiet: options.quiet });
  else nextStep('invoke the sdd-route skill', { quiet: options.quiet });
}

function validValue(value, allowed) {
  return allowed.includes(value) ? value : null;
}

async function initInteractive(
  cwd,
  languageDefault = 'en-US',
  featureProfileDefault = 'medium_feature',
  quiet = false,
  executionModeDefault = 'guided',
  autonomyLevelDefault = 'manual',
  localGitExclude = false,
) {
  if (fs.existsSync(sddJoin(cwd, 'config.yml'))) {
    log('WARN', `${SDD_PATHS.config} already exists; interactive init will not overwrite it`);
    applyInitSideEffects(cwd, { localGitExclude });
    return;
  }
  const pipedAnswers = process.stdin.isTTY ? null : fs.readFileSync(0, 'utf8').split(/\r?\n/);
  let answerIndex = 0;
  const rl = pipedAnswers
    ? null
    : readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (label, fallback, allowed) => {
    const prompt = `${label} [${fallback}]: `;
    let raw;
    if (pipedAnswers) {
      process.stdout.write(prompt);
      raw = pipedAnswers[answerIndex++];
    } else {
      raw = await rl.question(prompt);
    }
    const answer = (raw || '').trim() || fallback;
    if (allowed && !validValue(answer, allowed))
      throw new Error(`${label} must be one of: ${allowed.join(', ')}`);
    if (!allowed) {
      const valid =
        label === 'Default branch'
          ? /^[A-Za-z0-9][A-Za-z0-9._/-]*$/
          : /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/;
      if (!valid.test(answer)) throw new Error(`${label} contains unsupported characters`);
    }
    return answer;
  };
  try {
    const options = {
      name: await ask('Project name', 'example-project'),
      branch: await ask('Default branch', 'main'),
      agent: await ask('Agent target', 'generic', ['generic', 'codex', 'cursor', 'claude-code']),
      language: await ask('Human output language', languageDefault, LANGUAGE_PROFILES),
      source: await ask('Source type', 'local-files', ['local-files', 'github-guidance']),
      flow: await ask('Default flow', 'single', ['single', 'multi']),
      featureProfile: await ask('Feature profile', featureProfileDefault, FEATURE_PROFILES),
      multiWorktree: (await ask('Allow multi-worktree', 'false', ['true', 'false'])) === 'true',
      stackedPrs: (await ask('Allow stacked PRs', 'false', ['true', 'false'])) === 'true',
      executionMode: await ask('Execution mode', executionModeDefault, EXECUTION_MODES),
      autonomyLevel: await ask('Autonomy level', autonomyLevelDefault, AUTONOMY_LEVELS),
    };
    if (!autonomyComboValid(options.executionMode, options.autonomyLevel))
      throw new Error(
        `Execution mode ${options.executionMode} cannot combine with autonomy level ${options.autonomyLevel}`,
      );
    init(cwd, { ...options, quiet, localGitExclude });
  } catch (error) {
    // Invalid interactive input is a validation failure, exit 1 — same as every other bad-input
    // case in this CLI — not the generic exit-2 bucket main()'s own top-level catch reserves for
    // genuinely unexpected/internal errors.
    fail(error.message, 1);
  } finally {
    if (rl) rl.close();
  }
}

function copyIfMissing(source, destination, summary, options = {}) {
  if (fs.existsSync(destination)) {
    summary.preserved += 1;
    return;
  }
  summary.installed += 1;
  if (options.planned) options.planned.push(destination);
  if (options.dryRun) return;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyTree(source, destination, summary, options = {}) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyTree(from, to, summary, options);
    else copyIfMissing(from, to, summary, options);
  }
}

function installPresetToTarget(preset, target, summary, options = {}) {
  for (const skill of preset.skills)
    copyTree(path.join(PACKAGE_ROOT, 'skills', skill), path.join(target, skill), summary, options);
  if (preset.shared)
    copyTree(
      path.join(PACKAGE_ROOT, 'shared'),
      path.join(target, 'sdd-agentic-flow-shared'),
      summary,
      options,
    );
  if (preset.adapter)
    copyIfMissing(
      path.join(PACKAGE_ROOT, 'docs', 'adapters.md'),
      path.join(target, 'sdd-agentic-flow-shared', 'docs', 'adapters.md'),
      summary,
      options,
    );
}

function printInstallNextSteps(cwd, options = {}) {
  const mode = options.mode ?? resolveMode(options);
  nextStep('npx sdd-agentic-flow doctor', { quiet: options.quiet, mode, ascii: options.ascii });
  if (options.quiet) return;
  // Machine: keep the resolvable usage pointer (v1.11.0 contract); omit decorative prose.
  if (mode === 'machine') {
    process.stdout.write(`\n${printUsageGuidePointer(cwd)}`);
    return;
  }
  process.stdout.write(
    '\nThen ask your coding agent to run the `sdd-route` skill whenever the next step is\n' +
      'unclear — it recommends one skill from the main flow (Plan -> Prompt -> Implement ->\n' +
      'Check -> PR -> Review -> Fix -> Validate) without changing files.\n\n' +
      printUsageGuidePointer(cwd),
  );
}

function install(pack, cwd, options = {}) {
  const mode = resolveMode({ quiet: options.quiet, ascii: options.ascii });
  const preset = readPreset(pack);
  if (!preset) {
    const hint = didYouMeanTry(pack, presetNames());
    return fail(`unknown pack: ${pack}.`, {
      reason: `Pack \`${pack}\` does not exist.`,
      try: ['sdd-agentic-flow list', ...(hint ? [hint] : [])],
    });
  }
  const scope = options.scope || 'user';
  if (scope !== 'user' && scope !== 'project')
    return fail('unknown scope: use --scope user or --scope project', {
      reason: 'Only user and project scopes are supported.',
      try: [
        'sdd-agentic-flow install <pack> --scope user',
        'sdd-agentic-flow install <pack> --scope project',
      ],
    });
  if (options.agent && !KNOWN_AGENTS.includes(options.agent)) {
    const hint = didYouMeanTry(options.agent, KNOWN_AGENTS);
    return fail(`unknown agent: ${options.agent}.`, {
      reason: `Supported agents: ${KNOWN_AGENTS.join(', ')}.`,
      try: hint ? [hint] : [`sdd-agentic-flow install ${pack} --agent ${KNOWN_AGENTS[0]}`],
    });
  }

  if (scope === 'project') {
    const target = path.join(cwd, '.agents', 'skills');
    if (options.plan) {
      const planned = [];
      installPresetToTarget(
        preset,
        target,
        { installed: 0, preserved: 0 },
        { dryRun: true, planned },
      );
      log('PLAN', 'scope: project');
      if (!planned.length) log('PLAN', 'no new files (already installed)');
      for (const file of planned) log('PLAN', `create ${path.relative(cwd, file)}`);
      return;
    }
    const summary = { installed: 0, preserved: 0 };
    installPresetToTarget(preset, target, summary);
    logPassLine(`installed ${pack}: ${summary.installed} files`, { mode, quiet: options.quiet });
    if (summary.preserved) log('WARN', `preserved ${summary.preserved} existing files`);
    if (!options.quiet) printInstallNextSteps(cwd, { ...options, mode });
    return;
  }

  // scope: user — never touches the consumer project (docs/installation-scope.md).
  const agent = options.agent || resolveConfiguredAgent(cwd);
  const targets = userSkillsDirsFor(agent, options.homeDir);
  if (options.plan) {
    log('PLAN', 'scope: user');
    log('PLAN', 'Repository changes: none');
    for (const target of targets) {
      const planned = [];
      installPresetToTarget(
        preset,
        target,
        { installed: 0, preserved: 0 },
        { dryRun: true, planned },
      );
      log('PLAN', `target: ${target}`);
      if (!planned.length) log('PLAN', '  no new files (already installed)');
      for (const file of planned) log('PLAN', `  create ${file}`);
    }
    return;
  }
  const totals = { installed: 0, preserved: 0 };
  for (const target of targets) {
    const summary = { installed: 0, preserved: 0 };
    installPresetToTarget(preset, target, summary);
    totals.installed += summary.installed;
    totals.preserved += summary.preserved;
  }
  logPassLine(
    `installed ${pack} to ${targets.length} user-scope target(s): ${totals.installed} files`,
    { mode, quiet: options.quiet },
  );
  if (totals.preserved) log('WARN', `preserved ${totals.preserved} existing files`);
  logPassLine('Repository changes: none', { mode, quiet: options.quiet });
  if (!options.quiet) printInstallNextSteps(cwd, { ...options, mode });
}

function installationStatus(target) {
  if (!fs.existsSync(target)) return false;
  // A shared skills directory (e.g. `~/.agents/skills`) can hold unrelated skills from other
  // tools — only report an installation when one of *this* package's own official skill names
  // is present with a valid SKILL.md, or the shared reference layer is present, never on any
  // directory that merely looks skill-shaped.
  return (
    OFFICIAL_SKILLS.some((name) => fs.existsSync(path.join(target, name, 'SKILL.md'))) ||
    fs.existsSync(path.join(target, 'sdd-agentic-flow-shared', 'references', 'tlc-baseline.md'))
  );
}

const CORE_SKILLS = [
  'setup-sdd-agentic-flow',
  'sdd-create-specs',
  'sdd-implement-task',
  'sdd-task-check',
  'sdd-validation',
];

function hasCoreSkillsAt(root) {
  return CORE_SKILLS.every((skill) => fs.existsSync(path.join(root, skill, 'SKILL.md')));
}

// Distinguishes "none installed" from "interrupted/partial install" — deliberately scoped to
// CORE_SKILLS (the atomic install unit), not the full OFFICIAL_SKILLS list: checking against
// every official skill would false-positive-WARN any user who installed a smaller, valid pack.
function coreSkillsPresence(root) {
  const present = CORE_SKILLS.filter((skill) => fs.existsSync(path.join(root, skill, 'SKILL.md')));
  return { present, missing: CORE_SKILLS.filter((skill) => !present.includes(skill)) };
}

// doctor's project-local checks (skills/shared_layer/tdd-baseline/baseline-compliance) must
// agree with where `install` actually wrote files — project scope by default only under
// --scope project, otherwise the resolved user-scope target(s) — or they contradict doctor's
// own Installation section for the default (recommended) install flow.
function resolveSkillsRoot(cwd) {
  const projectRoot = path.join(cwd, '.agents', 'skills');
  if (hasCoreSkillsAt(projectRoot)) return projectRoot;
  for (const dir of userSkillsDirsFor(resolveConfiguredAgent(cwd)))
    if (hasCoreSkillsAt(dir)) return dir;
  return projectRoot;
}

function filesIn(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(target) : [target];
  });
}

function hasPrivateContext(paths) {
  return paths.flatMap(filesIn).some((file) => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      return PRIVATE_PATTERNS.some((pattern) => content.includes(pattern));
    } catch {
      return false;
    }
  });
}

function severity(checks) {
  if (checks.some((check) => check.status === 'FAIL')) return 'FAIL';
  if (checks.some((check) => check.status === 'WARN')) return 'WARN';
  return 'PASS';
}

function doctorChecks(cwd) {
  const checks = [];
  const add = (name, status, message, section) => checks.push({ name, status, message, section });
  const isPackage =
    fs.existsSync(path.join(cwd, 'package.json')) &&
    (() => {
      try {
        return (
          JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).name ===
          'sdd-agentic-flow'
        );
      } catch {
        return false;
      }
    })();
  const configPath = sddJoin(cwd, 'config.yml');
  const safetyConfig = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf8')
    : configFor();
  const language = languageReport(cwd);
  const skillsRoot = isPackage ? null : resolveSkillsRoot(cwd);
  const tddBaseline = isPackage
    ? path.join(cwd, 'shared', 'references', 'tdd-baseline.md')
    : path.join(skillsRoot, 'sdd-agentic-flow-shared', 'references', 'tdd-baseline.md');

  if (isPackage) {
    const manifest = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    const packageOk =
      fs.existsSync(path.join(cwd, 'bin/sdd-agentic-flow.js')) &&
      Object.keys(manifest.dependencies || {}).length === 0;
    add(
      'package_integrity',
      packageOk ? 'PASS' : 'FAIL',
      packageOk
        ? 'CLI present and no runtime dependencies'
        : 'CLI missing or runtime dependencies found',
      'Package integrity',
    );
    add(
      'private_context',
      !hasPrivateContext([
        path.join(cwd, 'bin'),
        path.join(cwd, 'skills'),
        path.join(cwd, 'shared'),
        path.join(cwd, 'presets'),
        path.join(cwd, 'examples'),
        path.join(cwd, 'docs'),
      ])
        ? 'PASS'
        : 'FAIL',
      'publishable content has no blocked private context',
      'Safety',
    );
    add(
      'licensing',
      fs.existsSync(path.join(cwd, 'NOTICE')) && fs.existsSync(path.join(cwd, 'LICENSING.md'))
        ? 'PASS'
        : 'FAIL',
      'NOTICE and licensing map present',
      'Licensing',
    );
    add(
      'presets',
      fs.existsSync(PRESETS_DIR) ? 'PASS' : 'FAIL',
      'installable presets present',
      'Presets',
    );
    add(
      'agent_compatibility',
      fs.existsSync(path.join(cwd, 'docs', 'agent-compatibility.md')) ? 'PASS' : 'FAIL',
      'agent compatibility documentation present',
      'Agent compatibility',
    );
    add(
      'postinstall',
      !Object.hasOwn(manifest.scripts || {}, 'postinstall') ? 'PASS' : 'FAIL',
      'no postinstall script',
      'Safety',
    );
  } else {
    add(
      'config',
      fs.existsSync(configPath) ? 'PASS' : 'WARN',
      fs.existsSync(configPath) ? `${SDD_PATHS.config} found` : `${SDD_PATHS.config} not found`,
      'Config',
    );
    (() => {
      const legacyPath = legacySddJoin(cwd);
      const newRootPath = path.join(cwd, SDD_ROOT);
      if (fs.existsSync(legacyPath) && !fs.existsSync(newRootPath)) {
        add(
          'legacy_sdd_root',
          'WARN',
          `${LEGACY_SDD_ROOT}/ found without ${SDD_ROOT}/ — run \`sdd-agentic-flow migrate --apply\``,
          'Config',
        );
      } else if (fs.existsSync(legacyPath) && fs.existsSync(newRootPath)) {
        add(
          'legacy_sdd_root',
          'WARN',
          `both ${LEGACY_SDD_ROOT}/ and ${SDD_ROOT}/ exist — remove or merge ${LEGACY_SDD_ROOT}/ manually`,
          'Config',
        );
      }
    })();
    (() => {
      const presence = coreSkillsPresence(skillsRoot);
      const skillsMessage =
        presence.missing.length === 0
          ? 'core skills installed'
          : presence.present.length === 0
            ? 'core skills not fully installed'
            : `partial core skill install detected (${presence.present.length}/${CORE_SKILLS.length} present; missing: ${presence.missing.join(', ')}) — re-run \`sdd-agentic-flow install core\` to repair`;
      add('skills', presence.missing.length === 0 ? 'PASS' : 'WARN', skillsMessage, 'Skills');
    })();
    add(
      'shared_layer',
      fs.existsSync(
        path.join(skillsRoot, 'sdd-agentic-flow-shared', 'references', 'tlc-baseline.md'),
      )
        ? 'PASS'
        : 'WARN',
      fs.existsSync(path.join(skillsRoot, 'sdd-agentic-flow-shared'))
        ? 'shared layer installed'
        : 'shared layer not installed',
      'Shared layer',
    );
    add(
      'project_readiness',
      fs.existsSync(configPath) && hasCoreSkillsAt(skillsRoot) ? 'PASS' : 'WARN',
      'project readiness is based on config and core skills',
      'Project readiness',
    );
    {
      const contextArtifactPath = sddJoin(cwd, 'context', 'project-context.md');
      const contextArtifactExists = fs.existsSync(contextArtifactPath);
      let contextMessage = contextArtifactExists
        ? `${SDD_PATHS.projectContext} found`
        : `${SDD_PATHS.projectContext} not found; run \`discover\``;
      if (contextArtifactExists) {
        const provenance = parseProvenance(fs.readFileSync(contextArtifactPath, 'utf8'));
        const current = gitInfo(cwd);
        if (provenance.revision && current.revision && provenance.revision !== current.revision) {
          contextMessage +=
            ' (repository has changed since generation; consider `sdd-agentic-flow context refresh`)';
        }
      }
      add(
        'project_context',
        contextArtifactExists ? 'PASS' : 'WARN',
        contextMessage,
        'Project context',
      );
    }
  }
  add(
    'tdd-baseline',
    fs.existsSync(tddBaseline) ? 'PASS' : isPackage ? 'FAIL' : 'WARN',
    fs.existsSync(tddBaseline)
      ? 'shared/references/tdd-baseline.md found'
      : 'shared/references/tdd-baseline.md not found',
    'TDD baseline',
  );
  const sharedRef = (name) =>
    isPackage
      ? path.join(cwd, 'shared', 'references', name)
      : path.join(skillsRoot, 'sdd-agentic-flow-shared', 'references', name);
  const tlcBaseline = sharedRef('tlc-baseline.md');
  add(
    'baseline-tlc',
    fs.existsSync(tlcBaseline) ? 'PASS' : isPackage ? 'FAIL' : 'WARN',
    fs.existsSync(tlcBaseline)
      ? 'TLC baseline preserved'
      : 'shared/references/tlc-baseline.md not found',
    'Baseline compliance',
  );
  const featureProfilesRef = sharedRef('feature-profiles.md');
  const declaresFeatureProfile = /feature_profile:\s*\S+/.test(safetyConfig);
  add(
    'adaptive-sizing',
    fs.existsSync(featureProfilesRef)
      ? declaresFeatureProfile
        ? 'PASS'
        : 'WARN'
      : isPackage
        ? 'FAIL'
        : 'WARN',
    fs.existsSync(featureProfilesRef)
      ? declaresFeatureProfile
        ? 'adaptive sizing guidance present and configured'
        : 'adaptive sizing guidance present; workflow.feature_profile not set in config'
      : 'shared/references/feature-profiles.md not found',
    'Baseline compliance',
  );
  const taskSlicingRef = sharedRef('task-slicing.md');
  add(
    'traceability',
    fs.existsSync(taskSlicingRef) ? 'PASS' : isPackage ? 'FAIL' : 'WARN',
    fs.existsSync(taskSlicingRef)
      ? 'traceability guidance present'
      : 'shared/references/task-slicing.md not found',
    'Baseline compliance',
  );
  const artifactContractsRef = sharedRef('artifact-contracts.md');
  add(
    'artifact-contracts',
    fs.existsSync(artifactContractsRef) ? 'PASS' : isPackage ? 'FAIL' : 'WARN',
    fs.existsSync(artifactContractsRef)
      ? 'artifact contracts guidance present'
      : 'shared/references/artifact-contracts.md not found',
    'Baseline compliance',
  );
  const requiresEvidence = /require_evidence_before_completion:\s*true/.test(safetyConfig);
  add(
    'evidence-first',
    requiresEvidence ? 'PASS' : 'WARN',
    requiresEvidence
      ? 'evidence-first policy required'
      : 'quality.require_evidence_before_completion is not set to true',
    'Baseline compliance',
  );
  add('language_profile', language.status, language.message, 'Language');
  const safe =
    /no_commit_by_default:\s*true/.test(safetyConfig) &&
    /no_push_by_default:\s*true/.test(safetyConfig) &&
    /no_merge_or_deploy:\s*true/.test(safetyConfig);
  add(
    'safety',
    safe ? 'PASS' : 'FAIL',
    safe ? 'offline, no-commit safety is the default' : 'required safety defaults are missing',
    'Safety',
  );
  {
    add('platform_os', 'PASS', `OS: ${process.platform}, Node ${process.version}`, 'Platform');
    const writable = filesystemWritable();
    add(
      'platform_filesystem',
      writable ? 'PASS' : 'FAIL',
      writable ? 'Filesystem writable' : 'Filesystem not writable',
      'Platform',
    );
    add('platform_shell', 'INFO', `Shell: ${detectShellInfo()}`, 'Platform');
    const git = gitAvailable();
    add(
      'platform_git',
      git ? 'PASS' : 'INFO',
      git ? 'Git: available' : 'Git: not available',
      'Platform',
    );
  }
  {
    const projectTarget = path.join(cwd, '.agents', 'skills');
    const projectInstalled = installationStatus(projectTarget);
    add(
      'installation_project',
      projectInstalled ? 'PASS' : 'INFO',
      projectInstalled
        ? `project-scope installation found at ${path.relative(cwd, projectTarget) || '.'}`
        : 'no project-scope installation found (opt in with `install <pack> --scope project`)',
      'Installation',
    );
    for (const target of userSkillsDirsFor(null)) {
      const installed = installationStatus(target);
      add(
        `installation_user_${target}`,
        installed ? 'PASS' : 'INFO',
        installed
          ? `user-scope installation found at ${target}`
          : `no user-scope installation found at ${target}`,
        'Installation',
      );
    }
    if (!projectInstalled)
      add(
        'installation_no_project_footprint',
        'PASS',
        'No project files created by installation',
        'Installation',
      );
  }
  return checks;
}

function frontmatterOf(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

function installedSkillDirs(root) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'sdd-agentic-flow-shared')
    .map((entry) => entry.name);
}

function parseScalarField(frontmatter, field) {
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(\\S+)\\s*$`, 'm'));
  if (!match || match[1] === 'null') return null;
  return match[1].replace(/^['"]|['"]$/g, '');
}

function contractsCheck(cwd) {
  const root = resolveSkillsRoot(cwd);
  const skills = installedSkillDirs(root);
  if (!skills.length) {
    return {
      name: 'capability_contracts',
      status: 'WARN',
      message: 'no installed skills found under .agents/skills to validate',
      section: 'Capability contracts',
    };
  }
  const failures = [];
  const warnings = [];
  const parsed = [];
  for (const skill of skills) {
    const skillPath = path.join(root, skill, 'SKILL.md');
    const content = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, 'utf8') : null;
    const frontmatter = content ? frontmatterOf(content) : null;
    if (!frontmatter) {
      failures.push(`${skill}: SKILL.md missing or has no frontmatter`);
      continue;
    }
    for (const field of REQUIRED_CONTRACT_FIELDS)
      if (!new RegExp(`^${field}:`, 'm').test(frontmatter))
        failures.push(`${skill}: missing required field '${field}'`);
    for (const field of OPTIONAL_CONTRACT_FIELDS)
      if (!new RegExp(`^${field}:`, 'm').test(frontmatter))
        warnings.push(`${skill}: optional field '${field}' absent`);
    parsed.push({ name: skill, frontmatter });
  }
  if (parsed.length) {
    const registryPath = path.join(root, 'sdd-agentic-flow-shared', 'baselines', 'registry.yml');
    const knownBaselineIds = fs.existsSync(registryPath)
      ? [...fs.readFileSync(registryPath, 'utf8').matchAll(/^\s*-\s*id:\s*(\S+)\s*$/gm)].map(
          (match) => match[1],
        )
      : null;
    if (knownBaselineIds === null)
      warnings.push(
        'could not read sdd-agentic-flow-shared/baselines/registry.yml to validate baseline references',
      );

    const { failures: refFailures, cycles } = validateContractReferences(parsed, {
      knownBaselineIds,
    });
    failures.push(...refFailures);
    for (const cycle of cycles) failures.push(`contract cycle detected: ${cycle.join(' -> ')}`);

    const installedSet = new Set(parsed.map((skill) => skill.name));
    for (const { name, frontmatter } of parsed) {
      for (const target of parseContractArray(frontmatter, 'conflicts') || []) {
        if (!OFFICIAL_SKILLS.includes(target))
          failures.push(`${name}: conflicts references unknown skill '${target}'`);
        else if (installedSet.has(target))
          failures.push(`${name} and ${target} declare a conflict but are both installed`);
      }
    }

    for (const { name, frontmatter } of parsed) {
      const requiresCli = parseScalarField(frontmatter, 'requires_cli');
      if (requiresCli && !satisfiesRange(VERSION, requiresCli))
        failures.push(`${name}: requires CLI ${requiresCli}, installed CLI is ${VERSION}`);
    }
  }
  if (failures.length)
    return {
      name: 'capability_contracts',
      status: 'FAIL',
      message: `contract corruption: ${failures.join('; ')}`,
      section: 'Capability contracts',
    };
  if (warnings.length)
    return {
      name: 'capability_contracts',
      status: 'WARN',
      message: `optional fields absent: ${warnings.join('; ')}`,
      section: 'Capability contracts',
    };
  return {
    name: 'capability_contracts',
    status: 'PASS',
    message: `capability contracts valid for ${skills.length} installed skill(s)`,
    section: 'Capability contracts',
  };
}

// v1.8.0: .sdd-agentic-flow/autonomy/loop-state.md is the execution-state file an agent maintains while
// running a workflow under autonomy_level supervised/autonomous (shared/references/
// autonomy-guardrails.md). This CLI never runs skills itself — it only reads/writes this file
// so `doctor --autonomy`, `context autonomy-state`, and `autonomous-resume` can report and act
// on state an agent already recorded.
//
// A literal forward-slash string, deliberately not built with path.join — every other
// generated-artifact path already displayed in this file (e.g. '.sdd-agentic-flow/context/project-context.md')
// is a literal string for exactly this reason: path.join would produce backslashes in
// user-facing text on Windows, unlike the actual filesystem access below (loopStatePath), which
// does use path.join.
const LOOP_STATE_RELATIVE = SDD_PATHS.loopState;

function loopStatePath(cwd) {
  return sddJoin(cwd, 'autonomy', 'loop-state.md');
}

// An agent appends a new "## Current State" block after each skill completes and never rewrites
// history (shared/references/autonomy-guardrails.md) — so the per-skill fields below must come
// from the LAST such block, not the first `.match()` hit over the whole file. Only "Execution
// mode"/"Autonomy level" are declared once, at the top, so those still search the full content.
function latestCurrentStateSection(content) {
  const blocks = content.split(/^## Current State$/m);
  if (blocks.length < 2) return content;
  return blocks[blocks.length - 1].split(/^## /m)[0];
}

// Clears the human override recorded in the LAST "- Human override:" line only — with multiple
// "## Current State" blocks, a plain non-global `.replace()` would silently clear the first
// (stale) one instead, leaving the actually-current override untouched.
function clearLastHumanOverride(content) {
  const regex = /^- Human override:.*$/gm;
  let lastMatch = null;
  let match = regex.exec(content);
  while (match) {
    lastMatch = match;
    match = regex.exec(content);
  }
  if (!lastMatch) return content;
  const start = lastMatch.index;
  const end = start + lastMatch[0].length;
  return `${content.slice(0, start)}- Human override: pause=false, stop=false${content.slice(end)}`;
}

function parseLoopState(content) {
  const latest = latestCurrentStateSection(content);
  const field = (label) => {
    const match = latest.match(new RegExp(`^- ${label}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim() : null;
  };
  const overrideRaw = field('Human override') || '';
  return {
    executionMode: content.match(/^Execution mode:\s*(.+)$/m)?.[1] ?? null,
    autonomyLevel: content.match(/^Autonomy level:\s*(.+)$/m)?.[1] ?? null,
    skill: field('Skill'),
    status: field('Status'),
    next: field('Next'),
    guardrails: field('Guardrails'),
    pause: /pause\s*=\s*true/.test(overrideRaw),
    stop: /stop\s*=\s*true/.test(overrideRaw),
  };
}

function readLoopState(cwd) {
  const file = loopStatePath(cwd);
  if (!fs.existsSync(file)) return null;
  return {
    file,
    content: fs.readFileSync(file, 'utf8'),
    ...parseLoopState(fs.readFileSync(file, 'utf8')),
  };
}

const AUTONOMY_GUARDRAILS = [
  ['guardrail_1_completion', 'Completion status — skill reports PASS/DONE, not IN_PROGRESS/FAIL'],
  [
    'guardrail_2_evidence',
    'Evidence validation — every autonomy_profile.evidence_required artifact exists',
  ],
  ['guardrail_3_verification', "Verification gates — the skill's own required checks all pass"],
  ['guardrail_4_scope', 'Scope boundary — work stays within the declared task scope'],
  [
    'guardrail_5_transition',
    'Skill transition validity — next skill is on the authorized workflow path',
  ],
  ['guardrail_6_resources', 'Resource sufficiency — workflow.autonomy_budget is not exhausted'],
  ['guardrail_7_human_gate', 'Human override gate — no pause/stop recorded in loop-state.md'],
];

// Reads workflow.skill_overrides.<skill>.autonomy_level from raw .sdd-agentic-flow/config.yml text — same
// lightweight, zero-dependency regex style as configValue()/parseScalarField(), matching the
// documented shape (docs/autonomy-levels.md):
//   workflow:
//     skill_overrides:
//       <skill>:
//         autonomy_level: <level>
function skillOverrideLevel(content, skill) {
  if (!content) return null;
  const match = content.match(new RegExp(`${skill}:\\s*\\n\\s*autonomy_level:\\s*(\\S+)`));
  return match ? match[1].trim() : null;
}

// `doctor --autonomy`: validates the *static* setup for autonomy_level (config, skill contracts,
// budget) plus the last recorded .sdd-agentic-flow/autonomy/loop-state.md, if any. There is no orchestration
// engine in this CLI to validate live — see the "Scope" note in shared/references/
// autonomy-guardrails.md.
function autonomyCheck(cwd, options = {}) {
  const checks = [];
  const add = (name, status, message, section = 'Autonomy') =>
    checks.push({ name, status, message, section });

  const configPath = sddJoin(cwd, 'config.yml');
  const configExists = fs.existsSync(configPath);
  const content = configExists ? fs.readFileSync(configPath, 'utf8') : null;
  const executionMode = content ? configValue(content, 'execution_mode') : null;
  const autonomyLevel = content ? configValue(content, 'autonomy_level') : null;

  let explicitlyInvalid = false;
  if (!configExists) {
    add(
      'autonomy_config',
      'WARN',
      `${SDD_PATHS.config} not found; run \`init\` to set workflow.execution_mode/autonomy_level`,
    );
  } else if (!executionMode || !autonomyLevel) {
    add(
      'autonomy_config',
      'WARN',
      `workflow.execution_mode/autonomy_level not set in ${SDD_PATHS.config}; defaulting to guided/manual (pre-v1.8.0 config, still fully supported)`,
    );
  } else if (!EXECUTION_MODES.includes(executionMode) || !AUTONOMY_LEVELS.includes(autonomyLevel)) {
    explicitlyInvalid = true;
    add(
      'autonomy_config',
      'FAIL',
      `workflow.execution_mode/autonomy_level has an invalid value (execution_mode=${executionMode}, autonomy_level=${autonomyLevel})`,
    );
  } else {
    add(
      'autonomy_config',
      'PASS',
      `execution_mode=${executionMode}, autonomy_level=${autonomyLevel}`,
    );
  }

  const effectiveExecutionMode =
    executionMode && EXECUTION_MODES.includes(executionMode) ? executionMode : 'guided';
  const effectiveAutonomyLevel =
    autonomyLevel && AUTONOMY_LEVELS.includes(autonomyLevel) ? autonomyLevel : 'manual';
  // When autonomy_config is FAIL because of an invalid *explicit* value, evaluating the combo
  // against the silently-substituted guided/manual defaults would report a misleading PASS —
  // fix workflow.execution_mode/autonomy_level first instead.
  if (explicitlyInvalid) {
    add(
      'autonomy_combo',
      'FAIL',
      'not evaluated — workflow.execution_mode/autonomy_level has an invalid value, fix autonomy_config first',
    );
  } else if (!autonomyComboValid(effectiveExecutionMode, effectiveAutonomyLevel)) {
    add(
      'autonomy_combo',
      'FAIL',
      `execution_mode=${effectiveExecutionMode} cannot combine with autonomy_level=${effectiveAutonomyLevel} (see docs/autonomy-levels.md)`,
    );
  } else {
    add('autonomy_combo', 'PASS', 'execution_mode × autonomy_level combination is valid');
  }

  const root = resolveSkillsRoot(cwd);
  const skills = installedSkillDirs(root);
  if (!skills.length) {
    add('autonomy_skills', 'WARN', 'no installed skills found under .agents/skills to validate');
  } else {
    const missingProfile = [];
    const unsupported = [];
    for (const skill of skills) {
      const skillPath = path.join(root, skill, 'SKILL.md');
      const skillContent = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, 'utf8') : null;
      const frontmatter = skillContent ? frontmatterOf(skillContent) : null;
      if (!frontmatter || !/^autonomy_profile:/m.test(frontmatter)) {
        missingProfile.push(skill);
        continue;
      }
      const supportedLevels = parseContractArray(frontmatter, 'supported_levels') || [];
      const overrideLevel = skillOverrideLevel(content, skill);
      const levelForSkill =
        overrideLevel && AUTONOMY_LEVELS.includes(overrideLevel)
          ? overrideLevel
          : effectiveAutonomyLevel;
      if (levelForSkill !== 'manual' && !supportedLevels.includes(levelForSkill))
        unsupported.push(
          overrideLevel ? `${skill} (workflow.skill_overrides: ${levelForSkill})` : skill,
        );
    }
    if (missingProfile.length) {
      add(
        'autonomy_skills',
        'FAIL',
        `skill(s) missing autonomy_profile: ${missingProfile.join(', ')}`,
      );
    } else if (unsupported.length) {
      add(
        'autonomy_skills',
        'WARN',
        `skill(s) do not support their effective autonomy_level (workflow default: ${effectiveAutonomyLevel}): ${unsupported.join(', ')} — set workflow.skill_overrides or keep them at manual/supervised`,
      );
    } else {
      add(
        'autonomy_skills',
        'PASS',
        `all ${skills.length} installed skill(s) support autonomy_level=${effectiveAutonomyLevel}`,
      );
    }
  }

  if (content) {
    const maxIterations = configValue(content, 'max_iterations');
    if (effectiveAutonomyLevel === 'autonomous' && !maxIterations) {
      add(
        'autonomy_budget',
        'WARN',
        'workflow.autonomy_budget not set; an autonomous run has no resource guardrail (guardrail 6)',
      );
    } else if (maxIterations) {
      add(
        'autonomy_budget',
        'PASS',
        `budget: max_iterations=${maxIterations}, max_tokens=${configValue(content, 'max_tokens')}, max_runtime_hours=${configValue(content, 'max_runtime_hours')}`,
      );
    } else {
      add(
        'autonomy_budget',
        'INFO',
        'workflow.autonomy_budget not set (not required outside autonomous mode)',
      );
    }
  }

  const loopState = readLoopState(cwd);
  if (!loopState) {
    add(
      'autonomy_loop_state',
      'INFO',
      `no ${SDD_PATHS.loopState} yet; an agent creates it the first time it runs a supervised/autonomous workflow`,
    );
  } else if (loopState.stop) {
    add(
      'autonomy_loop_state',
      'WARN',
      `loop state recorded stop=true at skill '${loopState.skill}'; resolve the blocker, then run \`autonomous-resume\``,
    );
  } else if (loopState.pause) {
    add(
      'autonomy_loop_state',
      'WARN',
      `loop state recorded pause=true at skill '${loopState.skill}'; run \`autonomous-resume\` to continue`,
    );
  } else {
    add(
      'autonomy_loop_state',
      'PASS',
      `last recorded skill '${loopState.skill}' → ${loopState.status || 'unknown'}; next: ${loopState.next || 'none'}`,
    );
  }

  if (options.verbose)
    for (const [name, message] of AUTONOMY_GUARDRAILS)
      add(name, 'INFO', message, 'Autonomy guardrails');

  return checks;
}

// Only checks whose fix is a single, unambiguous command get a hint — checks that already
// embed their fix instruction directly in the message text (project_context, the
// installation_* rows, baseline-compliance) are left untouched to avoid duplication.
const FIX_HINTS = {
  config: 'sdd-agentic-flow init',
  skills: 'sdd-agentic-flow install core',
  shared_layer: 'sdd-agentic-flow install core',
  language_profile: 'sdd-agentic-flow init --language <profile>',
};

function renderDoctorFooter(checks, mode) {
  // Plan: doctor Fix/Next footer is human-rich presentation only — not machine/plain/json.
  if (mode !== 'human-rich') return;
  const lines = doctorFooterLines(checks);
  if (!lines.length) return;
  process.stdout.write(`\n${lines.join('\n')}\n`);
}

function renderDoctor(checks, options = {}) {
  const mode = options.mode ?? resolveMode({ json: options.json, ascii: options.ascii });
  let section = null;
  for (const check of checks) {
    if (check.section !== section) {
      section = check.section;
      process.stdout.write(`\n${section}\n`);
    }
    const message =
      check.name === 'installation_no_project_footprint'
        ? `${symbol('success', mode)} ${check.message}`
        : check.message;
    log(check.status, message);
    if ((check.status === 'WARN' || check.status === 'FAIL') && FIX_HINTS[check.name])
      process.stdout.write(`  fix: ${FIX_HINTS[check.name]}\n`);
  }
  renderDoctorFooter(checks, mode);
}

function smokeCheck() {
  let temporary;
  try {
    for (const profile of LANGUAGE_PROFILES) {
      temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-smoke-'));
      init(temporary, { profile, quiet: true });
      install('core', temporary, { scope: 'project', quiet: true });
      init(temporary, { profile, quiet: true });
      install('core', temporary, { scope: 'project', quiet: true });
      const required = [
        SDD_PATHS.config,
        SDD_PATHS.projectContext,
        '.agents/skills',
        '.agents/skills/sdd-agentic-flow-shared',
        `.agents/skills/sdd-agentic-flow-shared/language-profiles/${profile}.md`,
        '.specs/features',
      ].every((relative) => fs.existsSync(path.join(temporary, relative)));
      const state = severity(doctorChecks(temporary));
      if (!required || state === 'FAIL' || languageReport(temporary).profile !== profile)
        throw new Error(`expected ${profile} files or project checks are missing`);
      fs.rmSync(temporary, { recursive: true, force: true });
      temporary = null;
    }
    return {
      name: 'smoke',
      status: 'PASS',
      message: 'isolated init, install, preservation, and doctor checks passed',
      section: 'Project readiness',
    };
  } catch (error) {
    return {
      name: 'smoke',
      status: 'FAIL',
      message: `smoke failed; preserved for debugging: ${temporary} (${error.message})`,
      section: 'Project readiness',
    };
  }
}

async function doctor(cwd, options = {}) {
  const checks = doctorChecks(cwd);
  if (options.smoke) checks.push(smokeCheck());
  if (options.contracts) checks.push(contractsCheck(cwd));
  if (options.autonomy) checks.push(...autonomyCheck(cwd, { verbose: options.verbose }));
  if (options.checkUpdates) checks.push(await checkForUpdate({ currentVersion: VERSION }));
  const result = {
    status: severity(checks),
    version: VERSION,
    checks: checks.map(({ section, ...check }) => check),
    language: languageReport(cwd),
  };
  if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else renderDoctor(checks, { mode: resolveMode({ json: options.json, ascii: options.ascii }) });
  if (result.status === 'FAIL') process.exitCode = 1;
}

function describePath(cwd, target) {
  const relative = path.relative(cwd, target);
  return relative.startsWith('..') || path.isAbsolute(relative) ? target : relative;
}

function migrateSddRoot(args, cwd) {
  const quiet = args.includes('--quiet');
  const plan = args.includes('--plan');
  const apply = args.includes('--apply');
  const rest = args.filter(
    (arg) => !['--plan', '--apply', '--help', '--quiet', '--ascii'].includes(arg),
  );
  if (rest.length || plan === apply) return fail(USAGE.migrate);

  const legacyPath = legacySddJoin(cwd);
  const newRootPath = path.join(cwd, SDD_ROOT);

  if (!fs.existsSync(legacyPath)) {
    log('WARN', `nothing to migrate — ${LEGACY_SDD_ROOT}/ not found`);
    return;
  }
  if (fs.existsSync(newRootPath)) {
    return fail(`${SDD_ROOT}/ already exists.`, {
      reason: `Resolve the conflict manually before migrating from ${LEGACY_SDD_ROOT}/.`,
      try: [
        `Merge any needed files from ${LEGACY_SDD_ROOT}/ into ${SDD_ROOT}/, then remove ${LEGACY_SDD_ROOT}/`,
      ],
    });
  }

  if (plan) {
    log('PLAN', `move ${LEGACY_SDD_ROOT}/ → ${SDD_ROOT}/`);
    return;
  }

  fs.renameSync(legacyPath, newRootPath);
  log('PASS', `migrated ${LEGACY_SDD_ROOT}/ → ${SDD_ROOT}/`);
  nextStep('npx sdd-agentic-flow doctor', { quiet });
}

function uninstall(args, cwd) {
  const usage = USAGE.uninstall;
  const plan = args.includes('--plan');
  const apply = args.includes('--apply');
  const full = args.includes('--full');
  const includeConfig = args.includes('--include-config') || full;
  const quiet = args.includes('--quiet');
  let scope = null;
  let agent = null;
  const rest = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (['--plan', '--apply', '--include-config', '--full', '--quiet'].includes(arg)) continue;
    if (arg === '--scope' && ['user', 'project'].includes(args[index + 1])) {
      scope = args[index + 1];
      index += 1;
    } else if (arg === '--agent' && KNOWN_AGENTS.includes(args[index + 1])) {
      agent = args[index + 1];
      index += 1;
    } else rest.push(arg);
  }
  if (plan === apply || rest.length || ((includeConfig || full) && !apply))
    return fail(
      plan === apply && !plan
        ? `${usage} — run \`sdd-agentic-flow uninstall --plan\` first; it never removes anything.`
        : usage,
    );
  const scopes = scope ? [scope] : ['project', 'user'];
  const roots = [];
  if (scopes.includes('project')) roots.push(path.join(cwd, '.agents', 'skills'));
  if (scopes.includes('user')) roots.push(...userSkillsDirsFor(agent));
  const targets = roots.flatMap((root) => [
    ...OFFICIAL_SKILLS.map((skill) => path.join(root, skill)),
    path.join(root, 'sdd-agentic-flow-shared'),
  ]);
  if (includeConfig) targets.push(sddJoin(cwd, 'config.yml'));
  // --full additionally clears regenerable local state (context, snapshots, reports, usage.md).
  // .specs/features is never a target here, in any mode: it holds hand-authored specs, the
  // same "preserved like source code" invariant documented throughout uninstall.md/upgrading.md.
  if (full) {
    targets.push(
      sddJoin(cwd, 'context', 'project-context.md'),
      sddJoin(cwd, 'snapshots'),
      sddJoin(cwd, 'reports'),
      sddJoin(cwd, 'usage.md'),
    );
  }
  const existing = targets.filter((target) => fs.existsSync(target));
  if (plan) {
    for (const target of existing) log('PLAN', `remove ${describePath(cwd, target)}`);
    if (!existing.length) log('PLAN', 'nothing installed by sdd-agentic-flow was found');
    if (!quiet)
      log(
        'PLAN',
        full
          ? 'preserves .specs/features, source code, and unknown paths'
          : `preserves .specs/features, ${SDD_PATHS.reports}, ${SDD_PATHS.snapshots}, source code, and unknown paths`,
      );
    return;
  }
  for (const target of existing) {
    fs.rmSync(target, { recursive: true, force: true });
    log('PASS', `removed ${describePath(cwd, target)}`);
  }
  if (!existing.length) log('WARN', 'nothing installed by sdd-agentic-flow was found');
  if (!quiet)
    log(
      'PASS',
      full
        ? 'preserved project specs, source code, and unknown paths'
        : 'preserved project specs, reports, snapshots, source code, and unknown paths',
    );
}

// Single source of truth for each command's one-line usage string, referenced both by main()'s
// fail(usage) calls and by the matching COMMAND_HELP entry's USAGE block below — introduced
// alongside --quiet (v1.4.0) specifically because it lands in 4 of these strings at once, which
// is exactly the kind of change that causes hand-duplicated copies to drift.
const USAGE = {
  init: 'usage: init [--interactive] [--language en-US|pt-BR | --en | --br] [--feature-profile small_fix|medium_feature|large_feature|epic] [--execution-mode plan|guided|apply|review|full] [--autonomy-level manual|supervised|autonomous] [--local-git-exclude] [--quiet]',
  install:
    'usage: install <pack> [--scope user|project] [--agent codex|cursor|claude-code|vscode-copilot] [--plan] [--quiet]',
  doctor:
    'usage: doctor [--json] [--smoke] [--contracts] [--autonomy] [--verbose] [--check-updates]',
  uninstall:
    'usage: uninstall --plan | uninstall --apply [--include-config] [--full] [--scope user|project] [--agent codex|cursor|claude-code|vscode-copilot] [--quiet]',
  discover: 'usage: discover [--force] [--quiet]',
  context: 'usage: context [status|refresh|autonomy-state]',
  'autonomous-resume':
    'usage: autonomous-resume [--force] | autonomous-resume --override-guard=<1-7> --reason="..."',
  migrate: 'usage: migrate --plan | migrate --apply',
};

const KNOWN_COMMANDS = [
  'list',
  'init',
  'discover',
  'context',
  'install',
  'doctor',
  'autonomous-resume',
  'migrate',
  'uninstall',
  'help',
  'version',
];

const COMMAND_HELP = {
  init: `sdd-agentic-flow init

Create local SDD configuration for the current project (${SDD_PATHS.config},
${SDD_PATHS.projectContext}, ${SDD_PATHS.snapshots}, ${SDD_PATHS.reports},
${SDD_PATHS.usage}, .specs/features).
Existing ${SDD_PATHS.config} is preserved; init never overwrites it. ${SDD_PATHS.usage}
is regenerable toolkit state and is refreshed on every init.

USAGE
  sdd-agentic-flow init [--interactive] [--language en-US|pt-BR | --en | --br]
                         [--feature-profile small_fix|medium_feature|large_feature|epic]
                         [--execution-mode plan|guided|apply|review|full]
                         [--autonomy-level manual|supervised|autonomous]
                         [--local-git-exclude] [--quiet] [--ascii]

OPTIONS
  --interactive          Prompt for project name, agent target, language, source type,
                         flow, feature profile, execution mode, and autonomy level
                         instead of using defaults.
  --language <profile>   Human-facing output language: en-US or pt-BR.
  --en                   Alias for --language en-US.
  --br                   Alias for --language pt-BR.
  --feature-profile <p>  Adaptive sizing: small_fix | medium_feature | large_feature | epic.
  --execution-mode <m>   What a skill is authorized to do: plan | guided | apply | review |
                         full. Default: guided. See docs/execution-modes.md.
  --autonomy-level <l>   How a workflow advances between skills: manual | supervised |
                         autonomous. Default: manual. plan/guided never combine with
                         autonomous. See docs/autonomy-levels.md.
  --local-git-exclude    Opt-in: append ${SDD_ROOT}/ to .git/info/exclude so toolkit
                         state stays out of git status. Does not edit .gitignore and
                         does not exclude .specs/. No-ops with WARN when Git is absent.
  --quiet                Suppress the "Suggested next step" line on success.
  --ascii                Force ASCII symbols (also via SDD_ASCII=1). Presentation only.

Useful when:
  Starting a project with this toolkit for the first time, or regenerating
  .sdd-agentic-flow/usage.md without touching an existing config.yml.

EXAMPLES
  sdd-agentic-flow init
  sdd-agentic-flow init --br
  sdd-agentic-flow init --interactive
  sdd-agentic-flow init --execution-mode full --autonomy-level supervised
  sdd-agentic-flow init --local-git-exclude
`,
  install: `sdd-agentic-flow install <pack>

Install a skill pack. Defaults to --scope user: writes only to per-agent global
skill directories (e.g. ~/.claude/skills) and creates zero files in the project.
Pass --scope project to install into .agents/skills/ inside the project instead.

USAGE
  sdd-agentic-flow install <pack> [--scope user|project]
                                   [--agent codex|cursor|claude-code|vscode-copilot]
                                   [--plan] [--quiet] [--ascii]

OPTIONS
  --scope user|project  Install target: global per-agent dirs (default) or the project.
  --agent <name>         Restrict a user-scope install to a single agent's directory.
  --plan                 Print what would be installed without writing any file.
  --quiet                Suppress the "Suggested next step" line on success.
  --ascii                Force ASCII symbols (also via SDD_ASCII=1). Presentation only.

Useful when:
  You have run init and need the core (or another) skill pack available to your
  coding agent before planning or implementing work.

EXAMPLES
  sdd-agentic-flow install core
  sdd-agentic-flow install core --plan
  sdd-agentic-flow install core --scope project
  sdd-agentic-flow install core --agent codex

Run \`sdd-agentic-flow list\` to see available packs.
`,
  doctor: `sdd-agentic-flow doctor

Validate local setup: configuration, installed skills (project and user scope),
baselines, language profile, safety defaults, and platform/environment.

USAGE
  sdd-agentic-flow doctor [--json] [--smoke] [--contracts] [--autonomy] [--verbose]
                          [--check-updates] [--ascii]

OPTIONS
  --json           Print machine-readable JSON only (no human-readable report).
  --smoke          Also run an isolated init/install/doctor smoke test in a temp dir.
  --contracts      Also validate installed skills' capability contracts.
  --autonomy       Also validate workflow.execution_mode/autonomy_level, the
                   execution_mode × autonomy_level matrix, each installed skill's
                   autonomy_profile support, workflow.autonomy_budget, and the last
                   recorded .sdd-agentic-flow/autonomy/loop-state.md. See docs/autonomy-levels.md.
  --verbose        With --autonomy, also list all 7 guardrails and what each one gates.
  --check-updates  Make one request to the npm registry to check for a newer version.
                   The sole, explicit, opt-in exception to "no outbound network access
                   by default" (see docs/trust-model.md) — never run automatically.
  --ascii          Force ASCII symbols (also via SDD_ASCII=1). Presentation only.

Useful when:
  You want a read-only health check of config, skills, and safety defaults before
  (or after) an SDD step — or an opt-in npm update check via --check-updates.

EXAMPLES
  sdd-agentic-flow doctor
  sdd-agentic-flow doctor --json
  sdd-agentic-flow doctor --smoke --contracts
  sdd-agentic-flow doctor --autonomy --verbose
  sdd-agentic-flow doctor --check-updates
`,
  uninstall: `sdd-agentic-flow uninstall

Remove toolkit assets installed by this package. Always preserves
.specs/features, source code, and unknown paths — never removed by any flag.
Requires an explicit --plan or --apply; running with neither fails.

USAGE
  sdd-agentic-flow uninstall --plan
  sdd-agentic-flow uninstall --apply [--include-config] [--full]
                                      [--scope user|project]
                                      [--agent codex|cursor|claude-code|vscode-copilot]
                                      [--quiet]

OPTIONS
  --plan                Show only what would be removed; makes no changes.
  --apply                Actually remove the listed assets.
  --include-config       Also remove .sdd-agentic-flow/config.yml (--apply only).
  --full                 Full/clean-reinstall reset (--apply only): also removes
                         .sdd-agentic-flow/context/project-context.md, .sdd-agentic-flow/snapshots, and
                         .sdd-agentic-flow/reports (regenerable state). Implies --include-config.
                         Never removes .specs/features.
  --scope user|project  Limit to one scope (default: both).
  --agent <name>         Limit user-scope removal to a single agent's directory.
  --quiet                Suppress the trailing "preserves ..." explanatory line.

EXAMPLES
  sdd-agentic-flow uninstall --plan
  sdd-agentic-flow uninstall --apply
  sdd-agentic-flow uninstall --apply --include-config
  sdd-agentic-flow uninstall --apply --full
`,
  discover: `sdd-agentic-flow discover

Auto-discover project signals (README, AI instruction files, docs/adr, monorepo
tooling, test/CI/ORM/feature-flag config) into .sdd-agentic-flow/context/project-context.md.
Also run automatically by init. Preserves an existing file unless --force is given.

USAGE
  sdd-agentic-flow discover [--force] [--quiet]

OPTIONS
  --force   Regenerate .sdd-agentic-flow/context/project-context.md even if it already exists.
  --quiet   Accepted for symmetry with the other commands; discover currently has
            no decorative output to suppress.

EXAMPLES
  sdd-agentic-flow discover
  sdd-agentic-flow discover --force
`,
  context: `sdd-agentic-flow context [status|refresh|autonomy-state]

Inspect or refresh the generated project-context artifact's provenance
(when it was generated, at which repository revision/branch), or inspect the
last recorded .sdd-agentic-flow/autonomy/loop-state.md (autonomy_level supervised/autonomous runs).

USAGE
  sdd-agentic-flow context
  sdd-agentic-flow context status
  sdd-agentic-flow context refresh
  sdd-agentic-flow context autonomy-state

Useful when:
  You need to know whether project-context.md is stale after git moves, or to
  inspect the last autonomy loop-state without mutating anything.

EXAMPLES
  sdd-agentic-flow context status
  sdd-agentic-flow context refresh
  sdd-agentic-flow context autonomy-state
`,
  list: `sdd-agentic-flow list

List available skill packs and their status.

USAGE
  sdd-agentic-flow list
`,
  'autonomous-resume': `sdd-agentic-flow autonomous-resume

Resume an autonomy_level supervised/autonomous workflow paused or stopped at a
guardrail. Reads .sdd-agentic-flow/autonomy/loop-state.md, clears any recorded pause=true/
stop=true, and appends an audited log entry. Never re-invokes a skill itself —
this CLI has no orchestration engine; it prints the recorded next skill for the
invoking agent to act on. See docs/autonomy-levels.md.

USAGE
  sdd-agentic-flow autonomous-resume [--force]
  sdd-agentic-flow autonomous-resume --override-guard=<1-7> --reason="..."

OPTIONS
  --force                  Resume without a specific guardrail reference; logs a
                           generic resume entry.
  --override-guard=<1-7>   Reference the specific guardrail (1-7, see
                           docs/autonomy-guardrails.md) being bypassed. Requires --reason.
  --reason="..."           Required with --override-guard: why the override is safe.

EXAMPLES
  sdd-agentic-flow autonomous-resume
  sdd-agentic-flow autonomous-resume --force
  sdd-agentic-flow autonomous-resume --override-guard=3 --reason="flaky test, verified manually"
`,
  migrate: `sdd-agentic-flow migrate

Move legacy toolkit state from .sdd/ to .sdd-agentic-flow/ (v1.10.0+ canonical path).
Never merges when both directories exist — resolve conflicts manually first.

USAGE
  sdd-agentic-flow migrate --plan
  sdd-agentic-flow migrate --apply

OPTIONS
  --plan   Show what would be moved; makes no changes.
  --apply  Move ${LEGACY_SDD_ROOT}/ → ${SDD_ROOT}/ atomically.

Useful when:
  An older checkout still has toolkit state under .sdd/ and you need a one-shot
  rename to .sdd-agentic-flow/ before doctor/install will see it.

EXAMPLES
  sdd-agentic-flow migrate --plan
  sdd-agentic-flow migrate --apply
`,
};

function help(command) {
  if (command) {
    const topic = COMMAND_HELP[command];
    if (!topic) {
      const hint = didYouMeanTry(command, KNOWN_COMMANDS);
      return fail(`unknown command: ${command}.`, {
        reason: 'That name is not a CLI command topic.',
        try: ['sdd-agentic-flow help', ...(hint ? [hint] : [])],
      });
    }
    process.stdout.write(topic);
    return;
  }
  process.stdout.write(
    `sdd-agentic-flow ${VERSION}

Spec Driven Development toolkit for AI coding agents.

QUICK START
  npx sdd-agentic-flow
  npx sdd-agentic-flow init
  npx sdd-agentic-flow install core
  npx sdd-agentic-flow doctor

COMMANDS
  list                                   List packs
  init [--interactive] [--language en-US|pt-BR | --en | --br] [--feature-profile ...] [--execution-mode ...] [--autonomy-level ...] [--local-git-exclude] [--quiet]  Create local configuration
  discover [--force] [--quiet]           Refresh auto-discovered project context
  context [status|refresh|autonomy-state]  Show or refresh project context provenance, or autonomy loop state
  install <pack> [--scope user|project] [--agent ...] [--plan] [--quiet]  Install a pack (default: user scope, zero project footprint)
  doctor [--json] [--smoke] [--contracts] [--autonomy] [--verbose] [--check-updates]  Validate package or project setup
  autonomous-resume [--force] [--override-guard=N --reason=...]  Resume an autonomous workflow paused at a guardrail
  migrate --plan | migrate --apply  Move legacy .sdd/ toolkit state to .sdd-agentic-flow/
  uninstall --plan | --apply [--include-config] [--full] [--scope user|project] [--agent ...] [--quiet]  Remove installed toolkit assets
  help [command]                         Show this reference, or detailed help for one command
  version                                Show CLI version

MORE HELP
  npx sdd-agentic-flow help <command>
  npx sdd-agentic-flow <command> --help
`,
  );
}

// Bare `npx sdd-agentic-flow` (no command) always prints this read-only status screen first —
// it detects state and points at exactly one next command, and never mutates anything on its
// own. When the process is genuinely interactive (both stdout and stdin are a real TTY, and
// process.env.CI is not set — see bin/menu.js's shouldShowInteractiveMenu), main() additionally
// offers a numbered menu below this screen (runInteractiveMenu); selecting an entry runs the
// exact same runCommand() the equivalent explicit CLI command uses, never a second, weaker
// implementation, and the destructive-adjacent "uninstall" entry only ever runs `--plan`,
// explaining afterward how to run `--apply` explicitly. In every other case — piped, scripted,
// CI, agent-invoked, or an explicit `help`/`--help`/`-h`/any explicit command — behavior is
// unchanged from before v1.4.0: this screen only, no prompt, no implicit action, exit 0.
async function welcome(cwd, options = {}) {
  const mode = options.mode ?? resolveMode(options);
  const configPath = sddJoin(cwd, 'config.yml');
  const configFound = fs.existsSync(configPath);
  const projectScopeRoot = path.join(cwd, '.agents', 'skills');
  const skillsRoot = resolveSkillsRoot(cwd);
  const presence = coreSkillsPresence(skillsRoot);
  const skillsInstalled = presence.missing.length === 0;
  const skillsPartial = !skillsInstalled && presence.present.length > 0;
  const contextFound = fs.existsSync(sddJoin(cwd, 'context', 'project-context.md'));

  if (mode === 'human-rich' || mode === 'human-plain') {
    // Full embedded chevron art — human TTY only; never machine/pipe/CI.
    // human-rich: left→right band reveal (~60ms); plain / SDD_BRAND_ANIMATE=0: instant.
    await writeBrand(mode, process.stdout, process.env, { quiet: options.quiet });
    process.stdout.write(
      `sdd-agentic-flow ${VERSION}\n\n` +
        '  Spec-driven agent harness for human-guided workflows.\n\n',
    );
  } else {
    process.stdout.write(
      `sdd-agentic-flow ${VERSION}\n` +
        'A local-first, zero-dependency Spec Driven Development toolkit for coding-agent workflows.\n\n' +
        'Status\n',
    );
  }

  const configLabel = configFound ? `${SDD_PATHS.config} found` : `${SDD_PATHS.config} not found`;
  const skillsLabel = skillsInstalled
    ? `core skills installed (${skillsRoot === projectScopeRoot ? 'project' : 'user'} scope: ${skillsRoot})`
    : skillsPartial
      ? `partial core skill install detected (${presence.present.length}/${CORE_SKILLS.length} present) — re-run \`sdd-agentic-flow install core\` to repair`
      : 'no skills installed yet (project or user scope)';
  const contextLabel = contextFound
    ? 'project context generated'
    : 'project context not generated yet';

  if (mode === 'human-rich' || mode === 'human-plain') {
    log(configFound ? 'PASS' : 'INFO', configFound ? 'config found' : 'config not found');
    log(
      skillsInstalled ? 'PASS' : skillsPartial ? 'WARN' : 'INFO',
      skillsInstalled
        ? 'core skills installed'
        : skillsPartial
          ? skillsLabel
          : 'no skills installed yet',
    );
    if (contextFound) log('PASS', 'project context generated');
  } else {
    log(configFound ? 'PASS' : 'INFO', configLabel);
    log(skillsInstalled ? 'PASS' : skillsPartial ? 'WARN' : 'INFO', skillsLabel);
    log(contextFound ? 'PASS' : 'INFO', contextLabel);
  }

  const suggested = !configFound
    ? 'npx sdd-agentic-flow init'
    : !skillsInstalled
      ? 'npx sdd-agentic-flow install core'
      : 'npx sdd-agentic-flow doctor';
  if (mode === 'machine') {
    // Compact status screen (CLI-001): contextual next + quick commands; not nextStep().
    process.stdout.write(
      '\nSuggested next step\n' +
        `  ${suggested}\n\n` +
        'Quick commands\n' +
        '  npx sdd-agentic-flow init              Create local configuration\n' +
        '  npx sdd-agentic-flow install core       Install the core skill pack\n' +
        '  npx sdd-agentic-flow doctor             Validate local setup\n' +
        '  npx sdd-agentic-flow uninstall --plan   Preview what would be removed\n\n' +
        'Run `npx sdd-agentic-flow help` for the full command reference.\n\n' +
        'To check for a newer version (opt-in, one npm request):\n' +
        '  npx sdd-agentic-flow doctor --check-updates\n',
    );
  } else {
    nextStep(suggested, { quiet: options.quiet, mode });
    process.stdout.write(
      '\nTo check for a newer version (opt-in, one npm request):\n' +
        '  npx sdd-agentic-flow doctor --check-updates\n',
    );
  }
}

// The command dispatch body, extracted verbatim from main() (v1.4.0) so the interactive menu
// (see runInteractiveMenu below) can route a numbered selection through the exact same code
// path a typed command uses — never a second, weaker implementation of command behavior.
async function runCommand(command, rawArgs, cwd) {
  const args = stripAsciiFlag(rawArgs);
  const ascii = rawArgs.includes('--ascii') || process.env.SDD_ASCII === '1';
  if (command === 'list') {
    if (args.includes('--help')) process.stdout.write(COMMAND_HELP.list);
    else list();
  } else if (command === 'init') {
    const usage = USAGE.init;
    if (args.includes('--help')) process.stdout.write(`${COMMAND_HELP.init}`);
    else {
      let interactive = false;
      let language = 'en-US';
      let featureProfile = 'medium_feature';
      let executionMode = 'guided';
      let autonomyLevel = 'manual';
      let quiet = false;
      let localGitExclude = false;
      for (let index = 0; index < args.length; index += 1) {
        if (args[index] === '--interactive') interactive = true;
        else if (args[index] === '--en') language = 'en-US';
        else if (args[index] === '--br') language = 'pt-BR';
        else if (args[index] === '--quiet') quiet = true;
        else if (args[index] === '--local-git-exclude') localGitExclude = true;
        else if (args[index] === '--language' && LANGUAGE_PROFILES.includes(args[index + 1])) {
          language = args[index + 1];
          index += 1;
        } else if (
          args[index] === '--feature-profile' &&
          FEATURE_PROFILES.includes(args[index + 1])
        ) {
          featureProfile = args[index + 1];
          index += 1;
        } else if (
          args[index] === '--execution-mode' &&
          EXECUTION_MODES.includes(args[index + 1])
        ) {
          executionMode = args[index + 1];
          index += 1;
        } else if (
          args[index] === '--autonomy-level' &&
          AUTONOMY_LEVELS.includes(args[index + 1])
        ) {
          autonomyLevel = args[index + 1];
          index += 1;
        } else return fail(usage);
      }
      if (!autonomyComboValid(executionMode, autonomyLevel))
        return fail(
          `--execution-mode ${executionMode} cannot combine with --autonomy-level ${autonomyLevel} (see docs/autonomy-levels.md).`,
        );
      if (interactive)
        await initInteractive(
          cwd,
          language,
          featureProfile,
          quiet,
          executionMode,
          autonomyLevel,
          localGitExclude,
        );
      else
        init(cwd, {
          profile: language,
          featureProfile,
          executionMode,
          autonomyLevel,
          quiet,
          localGitExclude,
          ascii,
        });
    }
  } else if (command === 'discover') {
    if (args.includes('--help')) process.stdout.write(COMMAND_HELP.discover);
    else if (!args.every((arg) => arg === '--force' || arg === '--quiet'))
      return fail(USAGE.discover);
    else
      discoverProject(cwd, {
        force: args.includes('--force'),
        quiet: args.includes('--quiet'),
        ascii,
      });
  } else if (command === 'context') {
    if (args.includes('--help')) process.stdout.write(COMMAND_HELP.context);
    else {
      const sub = args[0] || 'status';
      if (args.length > 1 || !['status', 'refresh', 'autonomy-state'].includes(sub))
        return fail('usage: context [status|refresh|autonomy-state]', {
          reason: 'Only status, refresh, and autonomy-state subcommands are supported.',
          try: [
            'sdd-agentic-flow context status',
            'sdd-agentic-flow context refresh',
            'sdd-agentic-flow context autonomy-state',
          ],
        });
      if (sub === 'status') contextStatus(cwd);
      else if (sub === 'refresh') contextRefresh(cwd, { ascii });
      else autonomyStateReport(cwd);
    }
  } else if (command === 'install') {
    const usage = USAGE.install;
    if (args.includes('--help')) return process.stdout.write(COMMAND_HELP.install);
    let pack = null;
    let scope = 'user';
    let agent = null;
    let plan = false;
    let quiet = false;
    let valid = true;
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === '--plan') plan = true;
      else if (arg === '--quiet') quiet = true;
      else if (arg === '--scope' && ['user', 'project'].includes(args[index + 1])) {
        scope = args[index + 1];
        index += 1;
      } else if (arg === '--agent' && args[index + 1] !== undefined) {
        // Deferred to install() itself (like `pack`) so an invalid value produces the more
        // specific, did-you-mean-enabled "unknown agent" message instead of the generic usage
        // failure below.
        agent = args[index + 1];
        index += 1;
      } else if (!arg.startsWith('--') && pack === null) pack = arg;
      else valid = false;
    }
    if (!valid || !pack) return fail(usage);
    install(pack, cwd, { scope, agent, plan, quiet, ascii });
  } else if (command === 'doctor') {
    if (args.includes('--help')) return process.stdout.write(COMMAND_HELP.doctor);
    const valid = args.every(
      (arg) =>
        arg === '--json' ||
        arg === '--smoke' ||
        arg === '--contracts' ||
        arg === '--autonomy' ||
        arg === '--verbose' ||
        arg === '--check-updates',
    );
    if (!valid) {
      if (args.includes('--json')) {
        process.stdout.write(
          `${JSON.stringify({ status: 'FAIL', version: VERSION, checks: [{ name: 'arguments', status: 'FAIL', message: USAGE.doctor }] })}\n`,
        );
        process.exitCode = 1;
      } else fail(USAGE.doctor);
    } else
      await doctor(cwd, {
        json: args.includes('--json'),
        smoke: args.includes('--smoke'),
        contracts: args.includes('--contracts'),
        autonomy: args.includes('--autonomy'),
        verbose: args.includes('--verbose'),
        checkUpdates: args.includes('--check-updates'),
        ascii,
      });
  } else if (command === 'autonomous-resume') {
    const usage = USAGE['autonomous-resume'];
    if (args.includes('--help')) return process.stdout.write(COMMAND_HELP['autonomous-resume']);
    let force = false;
    let overrideGuard = null;
    let reason = null;
    let valid = true;
    for (const arg of args) {
      if (arg === '--force') force = true;
      else if (arg.startsWith('--override-guard='))
        overrideGuard = arg.slice('--override-guard='.length);
      else if (arg.startsWith('--reason=')) reason = arg.slice('--reason='.length);
      else valid = false;
    }
    if (!valid || (overrideGuard && !/^[1-7]$/.test(overrideGuard))) return fail(usage);
    if (overrideGuard && !reason)
      return fail('--override-guard requires --reason="...".', {
        reason: 'Overrides must be audited with an explicit human reason.',
        try: ['sdd-agentic-flow autonomous-resume --override-guard=3 --reason="..."'],
      });
    autonomousResume(cwd, { force, overrideGuard, reason });
  } else if (command === 'migrate') {
    if (args.includes('--help')) return process.stdout.write(COMMAND_HELP.migrate);
    migrateSddRoot(args, cwd);
  } else if (command === 'uninstall') {
    if (args.includes('--help')) process.stdout.write(COMMAND_HELP.uninstall);
    else uninstall(args, cwd);
  } else if (command === 'help' || command === '--help' || command === '-h') help(args[0]);
  else if (command === 'version' || command === '--version' || command === '-v')
    process.stdout.write(`${VERSION}\n`);
  else {
    const hint = didYouMeanTry(command, KNOWN_COMMANDS);
    fail(`unknown command: ${command}.`, {
      reason: 'That name is not a CLI command.',
      try: ['sdd-agentic-flow help', ...(hint ? [hint] : [])],
    });
  }
}

// Only offered when the process is genuinely interactive on both streams and process.env.CI is
// unset (see bin/menu.js's shouldShowInteractiveMenu) — inert under CI, pipes, scripts, and
// agent invocations, where main() never gets here. Selecting an entry runs the exact same
// runCommand() a typed command uses; the "uninstall" entry is structurally --plan only (see
// bin/menu.js's MENU_ACTIONS), so the menu can never trigger a destructive action directly.
async function runInteractiveMenu(cwd) {
  const configFound = fs.existsSync(sddJoin(cwd, 'config.yml'));
  const skillsInstalled = coreSkillsPresence(resolveSkillsRoot(cwd)).missing.length === 0;
  const actions = menuActionsFor({ hasConfig: configFound, hasSkills: skillsInstalled });
  process.stdout.write('\nWhat would you like to do?\n');
  actions.forEach((action, index) => {
    log('INFO', `${index + 1}. ${action.label}`);
  });
  process.stdout.write('  0. Exit (press Enter, 0, or q)\n\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let raw;
  try {
    raw = await rl.question('Select an option: ');
  } finally {
    rl.close();
  }
  const selection = resolveMenuSelection(raw, actions);
  if (!selection) return;
  process.stdout.write(`\nRunning: sdd-agentic-flow ${selection.command.join(' ')}\n\n`);
  await runCommand(selection.command[0], selection.command.slice(1), cwd);
  if (selection.command[0] === 'uninstall')
    process.stdout.write(
      '\nTo actually remove these, run `sdd-agentic-flow uninstall --apply` explicitly.\n',
    );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const cwd = process.cwd();
  if (!command || command === '--ascii') {
    const rest = stripAsciiFlag(command ? [command, ...args] : args);
    if (rest.length) return runCommand(rest[0], rest.slice(1), cwd);
    await welcome(cwd, {
      ascii: process.argv.includes('--ascii') || process.env.SDD_ASCII === '1',
    });
    if (shouldShowInteractiveMenu({ stdout: process.stdout, stdin: process.stdin }, process.env))
      return runInteractiveMenu(cwd);
    return;
  }
  return runCommand(command, args, cwd);
}

main().catch((error) => fail(error.message, 2));
