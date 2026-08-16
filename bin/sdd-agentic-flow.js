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
  writeBrand,
  renderSection,
  renderKeyValue,
  renderStep,
  shortenPath,
} = require('./ui');
const { shouldShowInteractiveMenu, menuActionsFor } = require('./menu');
const { resolveOnboardingState } = require('./onboarding');
const { select } = require('./selector');
const { checkForUpdate } = require('./update-check');
const { runConfigCommand, renderPolicySummary } = require('./config');
const { readConfig } = require('./config-domain');
const { resolveLocale, t, translateText } = require('./messages');
const { buildDoctorView } = require('./doctor-view');
const { applyProjectSharing, configureIntent } = require('./configure');
const {
  AGENT_TO_TARGETS,
  DEFAULT_USER_TARGETS,
  USER_TARGETS,
  defaultInstallConfig,
  readInstallConfig,
  repositoryKey,
  parseTargetSelection,
  shouldUseInteractiveInstall,
  writeInstallConfig,
} = require('./install-domain');
const { CORE_SKILLS, OFFICIAL_SKILLS, isLegacySkillName } = require('./skill-identity');
const {
  buildInstallPlan,
  applyInstallPlan,
  isPlanEmpty,
  USER_TARGET_LABELS,
  targetLabelFor,
} = require('./install-preflight');
const {
  detectExecutionMode,
  writeInstallProvenance,
  readInstallProvenance,
  collectManagedPairs,
  classifyManagedPairs,
  applyManagedPairs,
  detectInstalledPacks,
  runNpmGlobalInstall,
  formatCheckReport,
} = require('./upgrade');

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

// Operating presets are UX over the two existing fields. Not a third stored axis.
// Aliases are input sugar for --preset and --autonomy-level only.
const OPERATING_PRESETS = {
  manual: { executionMode: 'guided', autonomyLevel: 'manual' },
  supervised: { executionMode: 'apply', autonomyLevel: 'supervised' },
  autonomous: { executionMode: 'full', autonomyLevel: 'autonomous' },
};
const AUTONOMY_ALIASES = {
  man: 'manual',
  assist: 'supervised',
  assisted: 'supervised',
  auto: 'autonomous',
};
const OPERATING_PRESET_HELP = 'manual|supervised|autonomous (aliases: man, assist|assisted, auto)';

function resolveAutonomyToken(token) {
  if (!token || String(token).startsWith('--')) return null;
  if (AUTONOMY_LEVELS.includes(token)) return token;
  return AUTONOMY_ALIASES[token] || null;
}

function resolveOperatingPreset(token) {
  const canonical = resolveAutonomyToken(token);
  if (!canonical || !OPERATING_PRESETS[canonical]) return null;
  return {
    name: canonical,
    alias: token === canonical ? null : token,
    ...OPERATING_PRESETS[canonical],
  };
}
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

function userSkillsDirsForTargets(targets, homeDir) {
  return [...new Set(targets.map((target) => path.join(homeDir, ...USER_TARGETS[target])))];
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

function localeFor(cwd, explicit) {
  return resolveLocale({ explicit, configured: languageReport(cwd).profile });
}

function log(status, message, explicitLocale) {
  const locale = explicitLocale || localeFor(process.cwd());
  process.stdout.write(
    `${styleStatus(status, process.stdout)} ${translateText(locale, message)}\n`,
  );
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
  return false;
}

function didYouMeanTry(input, candidates) {
  const match = didYouMean(input, candidates);
  return match ? `Did you mean \`${match}\`?` : null;
}

async function askYesNo(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const raw = await rl.question(question);
    const trimmed = String(raw ?? '')
      .trim()
      .toLowerCase();
    return trimmed === 'y' || trimmed === 'yes';
  } finally {
    rl.close();
  }
}

function canPromptInteractively(mode = resolveMode()) {
  return (
    mode !== 'machine' &&
    shouldShowInteractiveMenu({ stdout: process.stdout, stdin: process.stdin }, process.env)
  );
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
  const locale = localeFor(process.cwd());
  process.stdout.write(
    `\n${t(locale, 'init.next')}\n${list.map((line) => `  ${line}`).join('\n')}\n`,
  );
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

function writeUsageGuide(cwd, locale) {
  const source = path.join(PACKAGE_ROOT, 'shared', 'templates', 'usage.template.md');
  const destination = sddJoin(cwd, 'usage.md');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  log('PASS', `wrote ${SDD_PATHS.usage}`, locale);
}

function applyLocalGitExclude(cwd, locale) {
  const gitDir = path.join(cwd, '.git');
  if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
    log('WARN', 'init --local-git-exclude: no .git directory; skipped (Git is optional)', locale);
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
    log('PASS', `local git exclude already lists ${LOCAL_GIT_EXCLUDE_ENTRY}`, locale);
    return;
  }
  const prefix = existing === '' || existing.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(
    excludePath,
    `${prefix}${LOCAL_GIT_EXCLUDE_COMMENT}\n${LOCAL_GIT_EXCLUDE_ENTRY}\n`,
  );
  log('PASS', `appended ${LOCAL_GIT_EXCLUDE_ENTRY} to .git/info/exclude`, locale);
}

function applyInitSideEffects(cwd, options = {}) {
  writeUsageGuide(cwd, options.locale);
  if (options.localGitExclude) applyLocalGitExclude(cwd, options.locale);
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
  const locale = localeFor(cwd, options.profile || options.language);
  applyInitSideEffects(cwd, { ...options, locale });
  const configPath = sddJoin(cwd, 'config.yml');
  if (fs.existsSync(configPath)) {
    log('WARN', `preserved existing ${SDD_PATHS.config}`);
    return false;
  }
  for (const relative of [SDD_PATHS.snapshots, SDD_PATHS.reports, '.specs/features']) {
    fs.mkdirSync(path.join(cwd, relative), { recursive: true });
  }
  fs.writeFileSync(configPath, configFor(options), 'utf8');
  logPassLine(t(locale, 'init.createdConfig', { path: SDD_PATHS.config }), {
    mode,
    quiet: options.quiet,
  });
  logPassLine(t(locale, 'init.createdDirectories'), { mode, quiet: options.quiet });
  if (options.presetName) {
    const aliasNote = options.presetAlias ? ` (alias: ${options.presetAlias})` : '';
    log('INFO', `preset ${options.presetName}${aliasNote}`);
    log('INFO', `execution_mode: ${options.executionMode || 'guided'}`);
    log('INFO', `autonomy_level: ${options.autonomyLevel || 'manual'}`);
  }
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
  else nextStep('invoke the saf-route skill', { quiet: options.quiet });
}

function validValue(value, allowed) {
  return allowed.includes(value) ? value : null;
}

function onboardingStateFor(cwd) {
  const skillsRoot = resolveSkillsRoot(cwd);
  return resolveOnboardingState({
    hasConfig: fs.existsSync(sddJoin(cwd, 'config.yml')),
    hasSkills: coreSkillsPresence(skillsRoot).missing.length === 0,
    hasContext: fs.existsSync(sddJoin(cwd, 'context', 'project-context.md')),
    doctorStatus: severity(doctorChecks(cwd)),
  });
}

function savedSetupProfile(cwd) {
  const saved = readInstallConfig(os.homedir()) || defaultInstallConfig();
  const project = saved.projects[repositoryKey(cwd)];
  if (project?.packs?.length) return { scope: 'project', profile: project };
  if (saved.user?.packs?.length) return { scope: 'user', profile: saved.user };
  return null;
}

function setupDraft(cwd, state) {
  const saved = savedSetupProfile(cwd);
  return {
    install: state !== 'NEW_PROJECT',
    scope: saved?.scope || 'user',
    pack: saved?.profile.packs?.[0] || 'full',
    targets: saved?.profile.targets || [...DEFAULT_USER_TARGETS],
    projectLocalExclude: saved?.profile.sharing === 'local',
    saved,
  };
}

function printSetupStages(locale, active, complete = [], options = {}) {
  const stages = ['project', 'skills', 'context', 'validation'];
  const rich = isRich(resolveMode({ ascii: options.ascii }));
  process.stdout.write(`\n${t(locale, 'setup.title')}\n\n`);
  for (const stage of stages) {
    const marker = complete.includes(stage)
      ? rich
        ? '✓'
        : 'OK'
      : stage === active
        ? rich
          ? '●'
          : '>'
        : rich
          ? '○'
          : 'o';
    process.stdout.write(`${marker} ${t(locale, `setup.${stage}`)}\n`);
  }
}

function setupLocationLabel(pack, scope, options = {}) {
  return `${pack} ${isRich(resolveMode({ ascii: options.ascii })) ? '·' : '-'} ${scope}`;
}

function printSetupReview(draft, locale, options = {}) {
  process.stdout.write(`\n${t(locale, 'setup.review')}\n\n`);
  process.stdout.write(`  ${t(locale, 'setup.project')}      ${SDD_PATHS.config}\n`);
  if (!draft.install) {
    process.stdout.write(
      `  ${t(locale, 'setup.location')}       ${t(locale, 'setup.existingUser')}\n`,
    );
    return;
  }
  process.stdout.write(
    `  ${t(locale, 'setup.location')}       ${setupLocationLabel(draft.pack, draft.scope, options)}\n`,
  );
  if (draft.scope === 'user')
    process.stdout.write(`  ${t(locale, 'install.targets')}      ${draft.targets.join(', ')}\n`);
  else
    process.stdout.write(
      `  ${t(locale, 'install.projectSharing')}   ${draft.projectLocalExclude ? t(locale, 'setup.local') : t(locale, 'setup.shared')}\n`,
    );
  process.stdout.write(`  ${t(locale, 'setup.context')}      ${SDD_PATHS.projectContext}\n`);
}

function printCurrentSetup(cwd, locale) {
  const config = readConfig(sddJoin(cwd, 'config.yml'));
  const saved = savedSetupProfile(cwd);
  const state = onboardingStateFor(cwd);
  const workflow = config.ok ? config.policy.executionMode : 'guided';
  const location = saved
    ? setupLocationLabel(saved.profile.packs.join(', '), saved.scope)
    : t(locale, 'setup.missing');
  const context = fs.existsSync(sddJoin(cwd, 'context', 'project-context.md'))
    ? t(locale, 'setup.ready')
    : t(locale, 'setup.missing');
  const health =
    state === 'READY'
      ? t(locale, 'setup.ready')
      : state === 'PARTIAL'
        ? t(locale, 'setup.partial')
        : t(locale, 'setup.attention');
  process.stdout.write(
    `\n${t(locale, 'setup.current')}\n\n` +
      `  ${t(locale, 'setup.workflow')}     ${workflow}\n` +
      `  ${t(locale, 'setup.location')}       ${location}\n` +
      `  ${t(locale, 'setup.context')}      ${context}\n` +
      `  ${t(locale, 'setup.health')}       ${health}\n`,
  );
}

async function customizeSetup(draft, locale, options) {
  const pack = await select(
    t(locale, 'setup.pack'),
    ['full', ...presetNames().filter((name) => name !== 'full')].map((value) => ({
      value,
      label: value,
    })),
    { ascii: options.ascii, cancelValues: ['q', '0'], locale },
  );
  if (pack.cancelled) return null;
  const scope = await select(
    t(locale, 'setup.scope'),
    [
      { value: 'user', label: t(locale, 'setup.scopeUser') },
      { value: 'project', label: t(locale, 'setup.scopeProject') },
    ],
    { ascii: options.ascii, cancelValues: ['q', '0'], locale },
  );
  if (scope.cancelled) return null;
  const next = { ...draft, install: true, pack: pack.value, scope: scope.value };
  if (next.scope === 'user') {
    const targets = await select(
      t(locale, 'setup.targets'),
      Object.entries(USER_TARGETS).map(([value, target]) => ({
        value,
        label: target[0] === '.agents' ? 'Shared Agent Skills' : USER_TARGET_LABELS[value],
        selected: next.targets.includes(value),
      })),
      { multiple: true, ascii: options.ascii, cancelValues: ['q', '0'], locale },
    );
    if (targets.cancelled || !targets.value.length) return null;
    next.targets = targets.value;
  } else {
    const sharing = await select(
      t(locale, 'setup.sharing'),
      [
        { value: 'shared', label: t(locale, 'setup.shared') },
        { value: 'local', label: t(locale, 'setup.local') },
      ],
      { ascii: options.ascii, cancelValues: ['q', '0'], locale },
    );
    if (sharing.cancelled) return null;
    next.projectLocalExclude = sharing.value === 'local';
  }
  return next;
}

async function applySetup(cwd, draft, options, locale) {
  // A successful retry must not inherit the exit code from a handled prior attempt.
  process.exitCode = undefined;
  printSetupStages(locale, 'validation', ['project', 'skills', 'context'], options);
  process.stdout.write(`\n${t(locale, 'setup.apply')}\n`);
  init(cwd, {
    profile: options.language,
    featureProfile: options.featureProfile,
    executionMode: options.executionMode,
    autonomyLevel: options.autonomyLevel,
    presetName: options.presetName,
    presetAlias: options.presetAlias,
    quiet: true,
    localGitExclude: options.localGitExclude,
    ascii: options.ascii,
  });
  if (draft.install) {
    configureIntent({
      homeDir: os.homedir(),
      cwd,
      scope: draft.scope,
      packs: [draft.pack],
      targets: draft.scope === 'user' ? draft.targets : undefined,
      sharing:
        draft.scope === 'project' ? (draft.projectLocalExclude ? 'local' : 'shared') : undefined,
    });
    if (
      !install(draft.pack, cwd, {
        scope: draft.scope,
        targets: draft.targets,
        projectLocalExclude: draft.projectLocalExclude,
        quiet: true,
        ascii: options.ascii,
      })
    )
      return false;
  }
  const result = await doctor(cwd, { ascii: options.ascii });
  if (result.status === 'PASS') {
    log('PASS', t(locale, 'setup.ready'), locale);
    return true;
  }
  return false;
}

async function guidedInit(cwd, options = {}) {
  const state = onboardingStateFor(cwd);
  const locale = localeFor(cwd, options.language);
  if (state === 'READY' || state === 'NEEDS_ATTENTION') {
    printCurrentSetup(cwd, locale);
    const action = await select(
      t(locale, 'menu.question'),
      [
        { value: 'keep', label: t(locale, 'menu.keep') },
        { value: 'updates', label: t(locale, 'menu.updates') },
        { value: 'change', label: t(locale, 'menu.change') },
        { value: 'validate', label: t(locale, 'menu.validate') },
        { value: 'more', label: t(locale, 'menu.more') },
      ],
      { ascii: options.ascii, cancelValues: ['q', '0'], locale },
    );
    if (action.cancelled || action.value === 'keep') return;
    if (action.value === 'updates') return upgradeCommand(cwd, { ascii: options.ascii });
    if (action.value === 'change') return runCommand('configure', ['--interactive'], cwd);
    if (action.value === 'validate') return doctor(cwd, { ascii: options.ascii });
    return runInteractiveMenu(cwd, { showSummary: false });
  }

  for (;;) {
    let draft = setupDraft(cwd, state);
    printSetupStages(locale, 'project', [], options);
    process.stdout.write(
      `\n${state === 'NEW_PROJECT' ? t(locale, 'setup.existingUser') : t(locale, 'setup.settings')}\n`,
    );
    const path = await select(
      t(locale, 'setup.path'),
      [
        ...(draft.saved && state === 'PARTIAL'
          ? [{ value: 'resume', label: t(locale, 'setup.resume') }]
          : [{ value: 'recommended', label: t(locale, 'setup.recommended') }]),
        { value: 'customize', label: t(locale, 'setup.customize') },
      ],
      { ascii: options.ascii, cancelValues: ['q', '0'], locale },
    );
    if (path.cancelled) return log('INFO', t(locale, 'setup.cancelled'), locale);
    if (path.value === 'customize') {
      draft = await customizeSetup(draft, locale, options);
      if (!draft) return log('INFO', t(locale, 'setup.cancelled'), locale);
    }
    printSetupStages(locale, 'skills', ['project'], options);
    printSetupReview(draft, locale, options);
    const review = await select(
      t(locale, 'setup.review'),
      [
        { value: 'continue', label: t(locale, 'setup.continue') },
        { value: 'back', label: t(locale, 'setup.back') },
        { value: 'cancel', label: t(locale, 'setup.cancel') },
      ],
      { ascii: options.ascii, cancelValues: ['q', '0'], locale },
    );
    if (review.cancelled || review.value === 'cancel')
      return log('INFO', t(locale, 'setup.cancelled'), locale);
    if (review.value === 'back') continue;
    for (;;) {
      if (await applySetup(cwd, draft, options, locale)) return;
      process.stdout.write(`\n${t(locale, 'setup.failed')}\n`);
      const recovery = await select(
        t(locale, 'menu.question'),
        [
          { value: 'retry', label: t(locale, 'setup.retry') },
          { value: 'change', label: t(locale, 'setup.changeChoices') },
          { value: 'validate', label: t(locale, 'menu.validate') },
          { value: 'exit', label: t(locale, 'setup.exit') },
        ],
        { ascii: options.ascii, cancelValues: ['q', '0'], locale },
      );
      if (recovery.cancelled || recovery.value === 'exit') return;
      if (recovery.value === 'change') break;
      if (recovery.value === 'validate') await doctor(cwd, { ascii: options.ascii });
    }
  }
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
  const configPath = sddJoin(cwd, 'config.yml');
  const mode = resolveMode({ quiet });
  if (fs.existsSync(configPath)) {
    log('WARN', `${SDD_PATHS.config} already exists; init will not overwrite it`);
    const config = readConfig(configPath);
    if (config.ok) process.stdout.write(`\n${renderPolicySummary(config, mode)}\n`);
    process.stdout.write(
      '\nChange operating policy with: npx sdd-agentic-flow config policy\n' +
        'Install skills with: npx sdd-agentic-flow install core\n',
    );
    applyInitSideEffects(cwd, { localGitExclude });
    return;
  }
  const pipedAnswers = process.stdin.isTTY ? null : fs.readFileSync(0, 'utf8').split(/\r?\n/);
  let answerIndex = 0;
  const rl = pipedAnswers
    ? null
    : readline.createInterface({ input: process.stdin, output: process.stdout });
  let locale = resolveLocale({ explicit: languageDefault });
  const ask = async (label, fallback, allowed, kind = 'text') => {
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
        kind === 'branch' ? /^[A-Za-z0-9][A-Za-z0-9._/-]*$/ : /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/;
      if (!valid.test(answer)) throw new Error(`${label} contains unsupported characters`);
    }
    return answer;
  };
  try {
    process.stdout.write(
      `\n${renderStep(1, 7, t(locale, 'init.language'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    process.stdout.write(
      '  en-US — English human output\n  pt-BR — Saída humana em português do Brasil\n',
    );
    const language = await ask(
      t(locale, 'init.languagePrompt'),
      languageDefault,
      LANGUAGE_PROFILES,
    );
    locale = resolveLocale({ explicit: language });
    const options = {
      language,
      executionMode: executionModeDefault,
      autonomyLevel: autonomyLevelDefault,
    };

    process.stdout.write(
      `\n${renderStep(2, 7, t(locale, 'init.identity'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    options.name = await ask(t(locale, 'init.projectName'), 'example-project');
    options.branch = await ask(t(locale, 'init.defaultBranch'), 'main', null, 'branch');

    process.stdout.write(
      `\n${renderStep(3, 7, t(locale, 'init.agent'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    process.stdout.write(`  ${t(locale, 'init.agentHint')}\n`);
    options.agent = await ask(t(locale, 'init.agentPrompt'), 'generic', [
      'generic',
      'codex',
      'cursor',
      'claude-code',
      'vscode-copilot',
    ]);

    process.stdout.write(
      `\n${renderStep(4, 7, t(locale, 'init.profile'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    process.stdout.write(`  ${FEATURE_PROFILES.join(', ')}\n`);
    options.featureProfile = await ask(
      t(locale, 'init.featurePrompt'),
      featureProfileDefault,
      FEATURE_PROFILES,
    );

    process.stdout.write(
      `\n${renderStep(5, 7, t(locale, 'init.policy'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    for (const [name, preset] of Object.entries(OPERATING_PRESETS)) {
      process.stdout.write(`  ${name}: ${preset.executionMode} + ${preset.autonomyLevel}\n`);
    }
    const presetPrompt = `${t(locale, 'init.presetPrompt')} [manual]: `;
    let presetRaw;
    if (pipedAnswers) {
      process.stdout.write(presetPrompt);
      presetRaw = pipedAnswers[answerIndex++];
    } else {
      presetRaw = await rl.question(presetPrompt);
    }
    const presetChoice = (presetRaw || 'manual').trim();
    if (presetChoice === 'advanced') {
      options.executionMode = await ask('Execution mode', executionModeDefault, EXECUTION_MODES);
      options.autonomyLevel = await ask('Autonomy level', autonomyLevelDefault, AUTONOMY_LEVELS);
    } else {
      const resolved = resolveOperatingPreset(presetChoice || 'manual');
      if (!resolved) throw new Error(`Unknown operating preset: ${presetChoice}`);
      options.executionMode = resolved.executionMode;
      options.autonomyLevel = resolved.autonomyLevel;
    }
    process.stdout.write(
      `\n${renderStep(6, 7, t(locale, 'init.workflow'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    options.source = await ask(t(locale, 'init.sourcePrompt'), 'local-files', [
      'local-files',
      'github-guidance',
    ]);
    options.flow = await ask(t(locale, 'init.flowPrompt'), 'single', ['single', 'multi']);
    options.multiWorktree =
      (await ask(t(locale, 'init.worktreePrompt'), 'false', ['true', 'false'])) === 'true';
    options.stackedPrs =
      (await ask(t(locale, 'init.stackedPrompt'), 'false', ['true', 'false'])) === 'true';
    process.stdout.write(
      `\n${renderStep(7, 7, t(locale, 'init.review'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    process.stdout.write(
      `  ${t(locale, 'init.reviewProject')}: ${options.name}\n` +
        `  ${t(locale, 'init.reviewBranch')}: ${options.branch}\n` +
        `  ${t(locale, 'init.reviewAgent')}: ${options.agent}\n` +
        `  ${t(locale, 'init.reviewLanguage')}: ${options.language}\n` +
        `  ${t(locale, 'init.reviewProfile')}: ${options.featureProfile}\n` +
        `  ${t(locale, 'init.reviewPolicy')}: ${options.executionMode} + ${options.autonomyLevel}\n` +
        `  ${t(locale, 'init.reviewSource')}: ${options.source}\n` +
        `  ${t(locale, 'init.reviewFlow')}: ${options.flow}\n` +
        `  ${t(locale, 'init.reviewWorktree')}: ${options.multiWorktree}\n` +
        `  ${t(locale, 'init.reviewStacked')}: ${options.stackedPrs}\n`,
    );
    if (!autonomyComboValid(options.executionMode, options.autonomyLevel))
      throw new Error(
        `Execution mode ${options.executionMode} cannot combine with autonomy level ${options.autonomyLevel}`,
      );
    const confirmPrompt = t(locale, 'init.confirm');
    let confirmRaw;
    if (pipedAnswers) {
      process.stdout.write(confirmPrompt);
      confirmRaw = pipedAnswers[answerIndex++];
    } else {
      confirmRaw = await rl.question(confirmPrompt);
    }
    if (/^(no|n)$/i.test(String(confirmRaw || '').trim())) {
      log('INFO', t(locale, 'init.cancelled'));
      return;
    }
    init(cwd, { ...options, profile: options.language, quiet, localGitExclude });
  } catch (error) {
    fail(error.message, 1);
  } finally {
    if (rl) rl.close();
  }
}

function renderInstallationSummaryBlock(summary, mode, locale = 'en-US') {
  const lines = [];
  lines.push(...renderSection(locale === 'pt-BR' ? 'Instalação' : 'Installation', mode));
  lines.push(...renderKeyValue(locale === 'pt-BR' ? 'Modelo' : 'Mode', summary.mode, mode));
  lines.push(
    ...renderKeyValue(
      locale === 'pt-BR' ? 'Destinos' : 'Targets',
      summary.targets.length ? summary.targets.join(', ') : '(none detected)',
      mode,
    ),
  );
  return lines.join('\n');
}

function renderPolicySummaryBlock(config, mode, locale = 'en-US') {
  return renderPolicySummary(config, mode, locale);
}

function installationSummaryForWelcome(cwd) {
  const projectScopeRoot = path.join(cwd, '.agents', 'skills');
  const skillsRoot = resolveSkillsRoot(cwd);
  const mode =
    skillsRoot === projectScopeRoot && fs.existsSync(projectScopeRoot)
      ? 'Project / Team'
      : 'Local / User';
  const targets = [];
  for (const dir of userSkillsDirsFor(resolveConfiguredAgent(cwd))) {
    if (installationStatus(dir)) targets.push(targetLabelFor(dir));
  }
  if (mode === 'Project / Team' && installationStatus(projectScopeRoot)) {
    targets.push('Project .agents/skills');
  }
  return { mode, targets: [...new Set(targets)] };
}

function planForInstallProfile({ cwd, homeDir, scope, profile }) {
  const desiredPacks = profile?.packs || [];
  const desiredSkills = [
    ...new Set(desiredPacks.flatMap((name) => readPreset(name)?.skills || [])),
  ];
  const targetIds =
    scope === 'project'
      ? ['project-agents']
      : profile?.targets?.length
        ? profile.targets
        : DEFAULT_USER_TARGETS;
  return buildInstallPlan({
    packageRoot: PACKAGE_ROOT,
    preset: { ...readPreset('core'), skills: desiredSkills },
    targets:
      scope === 'project'
        ? [path.join(cwd, '.agents', 'skills')]
        : userSkillsDirsForTargets(targetIds, homeDir),
    officialSkills: OFFICIAL_SKILLS,
    scope,
    modeLabel: scope === 'project' ? 'Project / Team' : 'Local / User',
    desiredPacks,
    targetIds,
  });
}

function installApplyCommand(plan) {
  return `sdd-agentic-flow install ${plan.desiredPacks[0] || 'core'} --scope ${plan.scope}`;
}

function configureCommand(scope, profile) {
  const parts = ['sdd-agentic-flow configure', '--scope', scope];
  for (const pack of profile.packs || []) parts.push('--pack', pack);
  if (scope === 'user') {
    for (const target of profile.targets || DEFAULT_USER_TARGETS) parts.push('--target', target);
  } else parts.push('--sharing', profile.sharing || 'shared');
  return parts.join(' ');
}

function printInstallPlanReport(plan, _mode, cwd, { applyCommand } = {}) {
  const locale = localeFor(cwd);
  const lines = [];
  lines.push(`${t(locale, 'plan.title')}\n`);
  lines.push(t(locale, 'plan.intent'));
  lines.push(`  ${t(locale, 'plan.scope')}       ${plan.scope} (${plan.modeLabel})`);
  lines.push(`  ${t(locale, 'plan.packs')}       ${plan.desiredPacks.join(', ') || '(none)'}`);
  lines.push(`  ${t(locale, 'plan.targets')}     ${plan.targetIds.join(', ') || '(none)'}`);
  lines.push(`\n${t(locale, 'plan.selectedTargets')}`);
  for (const [index, target] of plan.targets.entries()) {
    lines.push(`  ${target.label} (${plan.targetIds[index] || 'project-agents'})`);
    lines.push(`    ${shortenPath(target.targetRoot, { homeDir: os.homedir(), cwd })}`);
    if (target.summary.COLLISION || target.legacy) {
      lines.push(
        `    ${t(locale, 'plan.blocked', {
          details: target.foreignSkills.length
            ? target.foreignSkills.join(', ')
            : locale === 'pt-BR'
              ? 'instalação legada'
              : 'legacy installation',
          path: target.targetRoot,
        })}`,
      );
    }
  }
  lines.push(`\n${t(locale, 'plan.managedContent')}`);
  lines.push(
    `  ${t(locale, 'plan.skillsSupport', {
      skills: [...new Set(plan.desiredPacks.flatMap((name) => readPreset(name)?.skills || []))]
        .length,
    })}`,
  );
  lines.push(
    `  ${t(locale, 'plan.filesTargets', {
      files: plan.totals.CREATE + plan.totals.UPDATE + plan.totals.PRESERVE,
      targets: plan.targets.length,
    })}`,
  );
  lines.push(`\n${t(locale, 'plan.fileOperations')}`);
  lines.push(`  ${t(locale, 'plan.createFiles')}     ${plan.totals.CREATE}`);
  lines.push(`  ${t(locale, 'plan.updateFiles')}     ${plan.totals.UPDATE}`);
  lines.push(`  ${t(locale, 'plan.removeFiles')}     ${plan.totals.REMOVE}`);
  lines.push(`  ${t(locale, 'plan.preserveFiles')}   ${plan.totals.PRESERVE}`);
  lines.push(`  ${t(locale, 'plan.collisions')}       ${plan.totals.COLLISION}`);
  if (plan.totals.PARTIAL) {
    lines.push(`  ${t(locale, 'plan.partialTrees')}    ${plan.totals.PARTIAL}`);
  }
  lines.push(`\n${t(locale, 'plan.repositoryFootprint')}`);
  lines.push(
    plan.scope === 'project'
      ? `  ${t(locale, 'plan.projectFootprint')}`
      : `  ${t(locale, 'plan.userFootprint')}`,
  );
  lines.push(`\n${t(locale, 'plan.noChanges')}`);
  lines.push(`${t(locale, 'plan.apply')}: ${applyCommand || installApplyCommand(plan)}`);
  process.stdout.write(`${lines.join('\n')}\n`);
  if (plan.totals.MANAGED_MODIFIED)
    log('INFO', 'Managed skills differ from package and will be updated after confirmation.');
  if (plan.totals.PARTIAL) {
    log(
      'WARN',
      'Partial skill tree detected — re-run install core or upgrade --skills-only to repair',
    );
  }
  if (plan.totals.BLOCKED) {
    log('WARN', 'BLOCKED — legacy installation detected (< 3.0). Remove it, then reinstall.');
  }
  if (isPlanEmpty(plan)) log('PASS', 'Already up to date.');
}

function learnSdd(cwd) {
  const docPath = path.join(PACKAGE_ROOT, 'docs', 'what-is-sdd.md');
  const relative = fs.existsSync(docPath) ? 'docs/what-is-sdd.md' : null;
  const locale = localeFor(cwd);
  process.stdout.write(
    `${t(locale, 'learn.body')}\n\n` +
      `${t(locale, 'learn.controlPlane')}\n\n` +
      (relative
        ? `${t(locale, 'learn.readMore')}: ${relative}\n`
        : `${t(locale, 'learn.readMore')}: docs/what-is-sdd.md\n`) +
      `\n${t(locale, 'learn.workflowGuide')}: ${USAGE_GUIDE_URL}\n`,
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
    `\n${t(localeFor(cwd), 'next.then')}\n` +
      `${t(localeFor(cwd), 'next.validate')}\n\n` +
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
  const homeDir = options.homeDir || os.homedir();
  const installConfig = readInstallConfig(homeDir) || defaultInstallConfig();
  const projectKey = repositoryKey(cwd);
  const storedProject = installConfig.projects[projectKey];
  const scope = options.scope || (storedProject ? 'project' : 'user');
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
  if (options.targets && options.targets.length === 0) {
    return fail('at least one installation target is required', {
      reason: 'Select one or more user-scope targets.',
      try: ['sdd-agentic-flow install core --interactive'],
    });
  }

  const profile = scope === 'project' ? storedProject : installConfig.user;
  const desiredPacks = [...new Set([...(profile?.packs || []), pack])];
  const desiredSkills = [
    ...new Set(desiredPacks.flatMap((name) => readPreset(name)?.skills || [])),
  ];
  const effectivePreset = { ...preset, skills: desiredSkills };
  let targets = [];
  let selectedTargetIds = null;
  if (scope === 'project') {
    targets = [path.join(cwd, '.agents', 'skills')];
  } else {
    const configuredTargets = profile?.targets?.length ? profile.targets : DEFAULT_USER_TARGETS;
    const selectedTargets = options.agent
      ? AGENT_TO_TARGETS[options.agent]
      : options.targets?.length
        ? options.targets
        : configuredTargets;
    selectedTargetIds = selectedTargets;
    targets = userSkillsDirsForTargets(selectedTargets, homeDir);
  }

  const plan = buildInstallPlan({
    packageRoot: PACKAGE_ROOT,
    preset: effectivePreset,
    targets,
    officialSkills: OFFICIAL_SKILLS,
    scope,
    modeLabel: scope === 'project' ? 'Project / Team' : 'Local / User',
    desiredPacks,
    targetIds:
      scope === 'project'
        ? ['project-agents']
        : options.agent
          ? AGENT_TO_TARGETS[options.agent]
          : selectedTargetIds || DEFAULT_USER_TARGETS,
  });

  if (options.plan) {
    printInstallPlanReport(plan, mode, cwd);
    return true;
  }

  if (plan.blocked) {
    const legacy = plan.targets.some((target) => target.legacy);
    return fail(
      legacy
        ? 'install blocked: legacy installation detected'
        : 'install blocked: foreign skill collision detected',
      {
        reason: legacy
          ? 'v3 does not migrate v2 installations automatically. Remove the previous installation, then reinstall.'
          : 'Existing same-name skills are not managed by sdd-agentic-flow.',
        try: [
          'sdd-agentic-flow install core --plan',
          'sdd-agentic-flow upgrade --skills-only',
          'Remove or rename conflicting directories manually, then retry',
        ],
      },
    );
  }

  if (isPlanEmpty(plan)) {
    if (scope === 'project') {
      installConfig.projects[projectKey] = {
        root: cwd,
        packs: desiredPacks,
        sharing: profile?.sharing || 'shared',
      };
    } else {
      installConfig.user = {
        ...installConfig.user,
        packs: desiredPacks,
        targets: selectedTargetIds || DEFAULT_USER_TARGETS,
      };
    }
    try {
      writeInstallConfig(installConfig, homeDir);
    } catch (error) {
      if (error.code !== 'EACCES' && error.code !== 'EROFS') throw error;
      log('WARN', 'installation is current but user-local intent could not be saved');
    }
    logPassLine(`Already up to date; ${plan.totals.PRESERVE} managed files preserved.`, {
      mode,
      quiet: options.quiet,
    });
    return true;
  }

  const totals = { installed: 0, updated: 0, preserved: 0, removed: 0 };
  for (const targetRoot of targets) {
    const result = applyInstallPlan(PACKAGE_ROOT, effectivePreset, targetRoot, {
      officialSkills: OFFICIAL_SKILLS,
    });
    if (result.blocked) {
      return fail('install blocked: foreign skill collision detected', {
        reason: `Collision at ${targetRoot}`,
        try: ['sdd-agentic-flow install core --plan'],
      });
    }
    totals.installed += result.summary.installed;
    totals.updated += result.summary.updated;
    totals.preserved += result.summary.preserved;
    totals.removed += result.summary.removed;
    writeInstallProvenance(targetRoot, {
      packageVersion: VERSION,
      scope,
      target: scope === 'project' ? 'project-agents' : targetLabelFor(targetRoot),
      packs: desiredPacks,
      managedSkills: desiredSkills,
    });
  }

  const projectSharing = options.projectLocalExclude ? 'local' : profile?.sharing || 'shared';
  if (scope === 'project') {
    const sharingResult = applyProjectSharing(cwd, projectSharing);
    if (sharingResult.warning) log('WARN', sharingResult.warning);
  }

  if (!options.plan) {
    if (scope === 'project') {
      installConfig.projects[projectKey] = {
        root: cwd,
        packs: desiredPacks,
        sharing: projectSharing,
      };
    } else {
      installConfig.user = {
        ...installConfig.user,
        packs: desiredPacks,
        targets: selectedTargetIds || DEFAULT_USER_TARGETS,
      };
    }
    try {
      writeInstallConfig(installConfig, homeDir);
    } catch (error) {
      if (error.code !== 'EACCES' && error.code !== 'EROFS') throw error;
      log('WARN', 'installation completed but user-local intent could not be saved');
    }
  }

  const locale = localeFor(cwd);
  let installationMessage =
    scope === 'project'
      ? t(locale, 'install.installed', { pack, files: totals.installed })
      : t(locale, 'install.installedUser', {
          pack,
          targets: targets.length,
          files: totals.installed,
        });
  if (totals.updated) installationMessage += `, ${t(locale, 'install.updated')} ${totals.updated}`;
  if (totals.removed) installationMessage += `, ${t(locale, 'install.removed')} ${totals.removed}`;
  logPassLine(installationMessage, { mode, quiet: options.quiet });
  if (totals.preserved) log('WARN', t(locale, 'install.preserved', { files: totals.preserved }));
  if (scope === 'user')
    logPassLine(t(locale, 'install.repositoryNone'), { mode, quiet: options.quiet });
  if (!options.quiet) printInstallNextSteps(cwd, { ...options, mode });
  return true;
}

async function installInteractive(pack, cwd, options = {}) {
  const mode = resolveMode({ quiet: options.quiet, ascii: options.ascii });
  const locale = localeFor(cwd);
  process.stdout.write(
    `${renderStep(1, 4, t(locale, 'install.scope'), mode, t(locale, 'step')).join('\n')}\n`,
  );
  const model = await select(
    t(locale, 'install.model'),
    [
      { value: 'user', label: t(locale, 'install.localUser') },
      { value: 'project', label: t(locale, 'install.projectRepository') },
    ],
    { ascii: options.ascii },
  );
  if (model.cancelled) return log('INFO', t(locale, 'install.cancelled'));
  const scope = model.value;
  let projectLocalExclude = false;
  process.stdout.write(
    `\n${renderStep(2, 4, t(locale, 'install.details'), mode, t(locale, 'step')).join('\n')}\n`,
  );
  if (scope === 'project') {
    const sharing = await select(
      t(locale, 'install.projectSharing'),
      [
        { value: 'shared', label: t(locale, 'install.sharedTeam') },
        { value: 'local', label: t(locale, 'install.localRepository') },
      ],
      { ascii: options.ascii },
    );
    if (sharing.cancelled) return log('INFO', t(locale, 'install.cancelled'));
    projectLocalExclude = sharing.value === 'local';
  }
  let selectedTargets = null;
  if (scope === 'user') {
    const targets = await select(
      t(locale, 'install.targets'),
      Object.entries(USER_TARGET_LABELS).map(([id, label]) => ({
        value: id,
        label,
        selected: DEFAULT_USER_TARGETS.includes(id),
      })),
      { multiple: true, ascii: options.ascii },
    );
    if (targets.cancelled) return log('INFO', t(locale, 'install.cancelled'));
    if (!targets.value.length) return fail('at least one installation target is required');
    selectedTargets = targets.value;
  }
  process.stdout.write(
    `\n${renderStep(3, 4, t(locale, 'install.preflight'), mode, t(locale, 'step')).join('\n')}\n`,
  );
  install(pack, cwd, {
    ...options,
    scope,
    plan: true,
    targets: selectedTargets,
    projectLocalExclude,
  });
  process.stdout.write(
    `\n${renderStep(4, 4, t(locale, 'install.confirm'), mode, t(locale, 'step')).join('\n')}\n`,
  );
  const confirmation = await select(
    t(locale, 'install.apply'),
    [
      { value: 'apply', label: 'Continue' },
      { value: 'cancel', label: 'Cancel' },
    ],
    { ascii: options.ascii },
  );
  if (confirmation.cancelled || confirmation.value !== 'apply') {
    log('INFO', t(locale, 'install.cancelled'));
    return;
  }
  install(pack, cwd, {
    ...options,
    scope,
    targets: selectedTargets,
    projectLocalExclude,
  });
}

async function configureInteractive(cwd, homeDir) {
  const locale = localeFor(cwd);
  let rl = null;
  try {
    const scopeChoice = process.stdin.isTTY
      ? await select('Installation model', [
          { value: 'user', label: 'Local / User' },
          { value: 'project', label: 'Project / Team' },
        ])
      : null;
    if (scopeChoice?.cancelled) return { cancelled: true };
    if (!rl) rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const scopeAnswer = scopeChoice
      ? scopeChoice.value
      : await rl.question('Installation model [Local / User]: ');
    const scope = /project/i.test(scopeAnswer.trim()) ? 'project' : 'user';
    const existing = readInstallConfig(homeDir) || defaultInstallConfig();
    const profile =
      scope === 'project'
        ? existing.projects[repositoryKey(cwd)] || { packs: [], sharing: 'shared' }
        : existing.user;
    const packsAnswer = await rl.question(
      `Packs [${(profile.packs || []).join(', ') || 'core'}]: `,
    );
    const packs = (packsAnswer || profile.packs.join(', ') || 'core')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    let targets = [];
    let sharing = null;
    if (scope === 'user') {
      for (const [id, label] of Object.entries(USER_TARGET_LABELS))
        process.stdout.write(`  ${id} — ${label}\n`);
      const targetsAnswer = await rl.question(
        `Targets [${(profile.targets || DEFAULT_USER_TARGETS).join(', ')}]: `,
      );
      const parsed = parseTargetSelection(targetsAnswer, profile.targets || DEFAULT_USER_TARGETS);
      if (!parsed.ok) return { error: parsed.message };
      targets = parsed.targets;
    } else {
      const sharingAnswer = await rl.question(`Project sharing [${profile.sharing || 'shared'}]: `);
      sharing = /local/i.test(sharingAnswer) ? 'local' : profile.sharing || 'shared';
    }
    process.stdout.write(`\n${t(locale, 'configure.review')}\n`);
    process.stdout.write(`  Scope: ${scope}\n  Packs: ${packs.join(', ')}\n`);
    process.stdout.write(
      scope === 'user' ? `  Targets: ${targets.join(', ')}\n` : `  Sharing: ${sharing}\n`,
    );
    process.stdout.write(`  ${t(locale, 'configure.savesIntent')}\n`);
    const save = await rl.question(t(locale, 'configure.save'));
    if (/^n(o)?$/i.test(save.trim())) return { cancelled: true };
    return configureIntent({ homeDir, cwd, scope, packs, targets, sharing });
  } finally {
    if (rl) rl.close();
  }
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
  (() => {
    const roots = [path.join(cwd, '.agents', 'skills')];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const provenance = readInstallProvenance(root);
      const legacy =
        Boolean(provenance?.package === 'sdd-agentic-flow' && provenance.schema !== 2) ||
        fs
          .readdirSync(root)
          .some((name) => name !== 'sdd-agentic-flow-shared' && isLegacySkillName(name));
      if (legacy) {
        add(
          'legacy_installation',
          'WARN',
          'legacy installation detected (< 3.0); remove it manually, then reinstall',
          'Installation',
        );
      }
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
          `${LEGACY_SDD_ROOT}/ found without ${SDD_ROOT}/ — rename ${LEGACY_SDD_ROOT}/ to ${SDD_ROOT}/ yourself`,
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
      const installConfig = readInstallConfig(os.homedir());
      const key = repositoryKey(cwd);
      const profile = installConfig?.projects[key] || installConfig?.user;
      const scope = installConfig?.projects[key] ? 'project' : 'user';
      if (!profile?.packs?.length) return;
      const plan = planForInstallProfile({ cwd, homeDir: os.homedir(), scope, profile });
      const status = plan.blocked || !isPlanEmpty(plan) ? 'WARN' : 'PASS';
      add(
        'installation_intent',
        status,
        isPlanEmpty(plan)
          ? `installation intent is synchronized (${profile.packs.join(', ')})`
          : `installation intent has pending reconciliation (${profile.packs.join(', ')})`,
        'Installation',
      );
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
    for (const [targetId, segments] of Object.entries(USER_TARGETS)) {
      const target = path.join(os.homedir(), ...segments);
      const installed = installationStatus(target);
      add(
        `installation_user_${targetId}`,
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
    if (!isPackage && skillsRoot) {
      const provenance = readInstallProvenance(skillsRoot);
      if (provenance?.packageVersion) {
        const stale = provenance.packageVersion !== VERSION;
        add(
          'installation_provenance',
          stale ? 'WARN' : 'PASS',
          stale
            ? `skills provenance ${provenance.packageVersion} (running CLI ${VERSION}) — run \`sdd-agentic-flow upgrade --skills-only\` after upgrading the CLI`
            : `skills provenance ${provenance.packageVersion} matches running CLI`,
          'Installation',
        );
      }
    }
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

function renderDoctor(checks, options = {}) {
  const view = buildDoctorView(checks, { verbose: options.verbose, locale: options.locale });
  process.stdout.write(
    `\n${view.title}${view.hasProblems ? '' : ` — ${t(options.locale, 'doctor.passed')}`}\n`,
  );
  process.stdout.write(
    `${t(options.locale, 'doctor.summary', {
      pass: view.counts.PASS,
      info: view.counts.INFO,
      warn: view.counts.WARN,
      fail: view.counts.FAIL,
    })}\n`,
  );
  if (view.primaryFix)
    process.stdout.write(`\n${t(options.locale, 'doctor.primaryFix')}\n  ${view.primaryFix}\n`);
  if (view.shown.length) {
    process.stdout.write(
      `\n${view.hasProblems ? t(options.locale, 'doctor.related') : t(options.locale, 'doctor.checks')}\n`,
    );
    for (const check of view.shown) log(check.status, check.message);
  }
  if (!view.hasProblems)
    process.stdout.write(
      `\n${t(options.locale, 'doctor.next')}\n  ${t(options.locale, 'ready.next')}\n`,
    );
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
  else
    renderDoctor(checks, {
      mode: resolveMode({ json: options.json, ascii: options.ascii }),
      verbose: options.verbose,
      locale: resolveLocale({ configured: languageReport(cwd).profile }),
    });
  if (result.status === 'FAIL') process.exitCode = 1;
  return result;
}

function describePath(cwd, target) {
  const relative = path.relative(cwd, target);
  return relative.startsWith('..') || path.isAbsolute(relative) ? target : relative;
}

function uninstall(args, cwd) {
  const usage = USAGE.uninstall;
  const plan = args.includes('--plan');
  const apply = args.includes('--apply');
  const full = args.includes('--full');
  const includeConfig = args.includes('--include-config') || full;
  const quiet = args.includes('--quiet');
  const verbose = args.includes('--verbose');
  let scope = null;
  let agent = null;
  const rest = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (['--plan', '--apply', '--include-config', '--full', '--verbose', '--quiet'].includes(arg))
      continue;
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
  const targets = roots.flatMap((root) => {
    const hasOwnedSkill = OFFICIAL_SKILLS.some((skill) =>
      fs.existsSync(path.join(root, skill, 'SKILL.md')),
    );
    if (!hasOwnedSkill && scope !== 'project' && root !== path.join(cwd, '.agents', 'skills'))
      return [];
    return [
      ...OFFICIAL_SKILLS.map((skill) => path.join(root, skill)),
      path.join(root, 'sdd-agentic-flow-shared'),
    ];
  });
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
  const locale = localeFor(cwd);
  if (plan) {
    const grouped = new Map();
    for (const target of existing) {
      const root =
        roots.find(
          (candidate) => target === candidate || target.startsWith(`${candidate}${path.sep}`),
        ) || path.dirname(target);
      if (!grouped.has(root)) grouped.set(root, []);
      grouped.get(root).push(target);
    }
    process.stdout.write(`${t(locale, 'uninstall.plan')}\n\n`);
    for (const [root, paths] of grouped) {
      process.stdout.write(
        `${targetLabelFor(root)} (${shortenPath(root, { homeDir: os.homedir(), cwd })})\n`,
      );
      const skills = paths.filter((entry) => path.basename(entry).startsWith('saf-')).length;
      const shared = paths.some((entry) => path.basename(entry) === 'sdd-agentic-flow-shared');
      process.stdout.write(`  ${skills} managed skills${shared ? ' + shared support' : ''}\n`);
      if (verbose)
        for (const target of paths) process.stdout.write(`  ${describePath(cwd, target)}\n`);
      process.stdout.write('\n');
    }
    process.stdout.write(
      `${t(locale, 'uninstall.summary')}\n  ${existing.length} managed paths\n\n`,
    );
    if (!existing.length) process.stdout.write(`  ${t(locale, 'uninstall.nothing')}\n\n`);
    process.stdout.write(
      `${t(locale, 'uninstall.preserved')}\n  .specs/features/**, source code, unknown/unmanaged paths\n\n${t(locale, 'plan.noChanges')}\n${t(locale, 'uninstall.apply')}: sdd-agentic-flow uninstall --apply\n`,
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
  init: 'usage: init [--interactive|--non-interactive] [--language en-US|pt-BR | --en | --br] [--feature-profile small_fix|medium_feature|large_feature|epic] [--preset manual|supervised|autonomous] [--execution-mode plan|guided|apply|review|full] [--autonomy-level manual|supervised|autonomous] [--local-git-exclude] [--quiet]',
  install:
    'usage: install <pack> [--scope user|project] [--agent codex|cursor|claude-code|vscode-copilot] [--plan] [--interactive|--non-interactive] [--quiet]',
  config: 'usage: config [show|policy [--plan] [--yes] [--preset manual|supervised|autonomous]]',
  configure:
    'usage: configure [--scope user|project] [--pack <pack>] [--target agents|cursor|claude|copilot] [--sharing shared|local] [--plan]',
  doctor:
    'usage: doctor [--json] [--smoke] [--contracts] [--autonomy] [--verbose] [--check-updates]',
  uninstall:
    'usage: uninstall --plan | uninstall --apply [--include-config] [--full] [--scope user|project] [--agent codex|cursor|claude-code|vscode-copilot] [--verbose] [--quiet]',
  discover: 'usage: discover [--force] [--quiet]',
  context: 'usage: context [status|refresh|autonomy-state]',
  'autonomous-resume':
    'usage: autonomous-resume [--force] | autonomous-resume --override-guard=<1-7> --reason="..."',
  upgrade: 'usage: upgrade [--check|--plan|--skills-only]',
};

const KNOWN_COMMANDS = [
  'list',
  'init',
  'discover',
  'context',
  'config',
  'configure',
  'install',
  'doctor',
  'upgrade',
  'autonomous-resume',
  'uninstall',
  'learn-sdd',
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
  sdd-agentic-flow init [--interactive|--non-interactive] [--language en-US|pt-BR | --en | --br]
                         [--feature-profile small_fix|medium_feature|large_feature|epic]
                         [--preset manual|supervised|autonomous]
                         [--execution-mode plan|guided|apply|review|full]
                         [--autonomy-level manual|supervised|autonomous]
                         [--local-git-exclude] [--quiet] [--ascii]

OPTIONS
  --interactive          Explicitly start guided onboarding (the default in a real TTY).
  --non-interactive      Never prompt; use supplied values and documented defaults.
  --language <profile>   Human-facing output language: en-US or pt-BR.
  --en                   Alias for --language en-US.
  --br                   Alias for --language pt-BR.
  --feature-profile <p>  Adaptive sizing: small_fix | medium_feature | large_feature | epic.
  --preset <p>           Operating policy: manual | supervised | autonomous
                         (aliases: man, assist|assisted, auto).
                         Writes execution_mode and autonomy_level. Cannot combine
                         with --execution-mode or --autonomy-level.
  --execution-mode <m>   What a skill is authorized to do: plan | guided | apply | review |
                         full. Default: guided. See docs/execution-modes.md.
                         Does not accept auto as a synonym of full.
  --autonomy-level <l>   How a workflow advances between skills: manual | supervised |
                         autonomous (aliases: man, assist|assisted, auto).
                         Default: manual. plan/guided never combine with
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
  sdd-agentic-flow init --preset autonomous
  sdd-agentic-flow init --preset auto
  sdd-agentic-flow init --execution-mode full --autonomy-level supervised
  sdd-agentic-flow init --local-git-exclude
`,
  config: `sdd-agentic-flow config

Inspect or change operating policy (workflow.execution_mode and workflow.autonomy_level only).

USAGE
  sdd-agentic-flow config [show]
  sdd-agentic-flow config policy [--plan] [--yes] [--preset manual|supervised|autonomous]
                                   [--execution-mode plan|guided|apply|review|full]
                                   [--autonomy-level manual|supervised|autonomous]

OPTIONS
  show                 Read-only policy summary (default when no subcommand).
  policy               Change operating policy interactively or with flags.
  --plan               Preview only; never writes.
  --yes                Required for non-interactive mutation.
  --preset <p>         manual | supervised | autonomous

EXAMPLES
  sdd-agentic-flow config show
  sdd-agentic-flow config policy --plan --preset supervised
  sdd-agentic-flow config policy --yes --preset manual
`,
  configure: `sdd-agentic-flow configure

Save installation intent. Unlike \`config\`, which changes only workflow operating
policy, \`configure\` changes the packs, user targets, or project sharing that a later
\`install\` will reconcile. It never installs skills by itself.

USAGE
  sdd-agentic-flow configure [--scope user|project] [--pack <pack>]
                                  [--target agents|cursor|claude|copilot]
                                  [--sharing shared|local] [--plan] [--interactive]

OPTIONS
  --scope user|project  Save user-wide targets or this repository's sharing intent.
  --pack <pack>         Desired pack; repeat for more packs.
  --target <id>         User target: agents, cursor, claude, or copilot; repeatable.
  --sharing shared|local  Project skills are Git-visible or locally excluded.
  --plan                Preview intent and reconciliation; never writes.
  --interactive         Review and edit the saved installation intent.

Useful when:
  You need to change where or how SAF skills are installed before reconciling them.

EXAMPLES
  sdd-agentic-flow configure --pack core --target agents
  sdd-agentic-flow configure --scope project --sharing local
  sdd-agentic-flow configure --plan --pack core
`,
  install: `sdd-agentic-flow install <pack>

Install a skill pack. Defaults to --scope user: writes only to per-agent global
skill directories (e.g. ~/.claude/skills) and creates zero files in the project.
Pass --scope project to install into .agents/skills/ inside the project instead.

USAGE
  sdd-agentic-flow install <pack> [--scope user|project]
                                   [--agent codex|cursor|claude-code|vscode-copilot]
                                   [--plan] [--interactive|--non-interactive] [--quiet] [--ascii]

OPTIONS
  --scope user|project  Install target: global per-agent dirs (default) or the project.
  --agent <name>         Restrict a user-scope install to a single agent's directory.
  --plan                 Print installation plan with preflight summary; no writes.
  --interactive          Guided installation model, targets, preflight, and confirm.
  --non-interactive      Never prompt; use saved intent or documented defaults.
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
  --check-updates  Make one request to the npm registry to check for a newer version
                   as part of the doctor diagnostic report (read-only). Prefer
                   \`upgrade --check\` for an upgrade-specific read-only check, or
                   \`upgrade\` to install after confirms. See docs/trust-model.md.
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
  upgrade: `sdd-agentic-flow upgrade

Check the npm registry for a newer CLI version and, in an interactive TTY, confirm
before upgrading the global CLI package and/or refreshing managed skills from the
currently executing package. Never silent; never uses --yes.

USAGE
  sdd-agentic-flow upgrade
  sdd-agentic-flow upgrade --check
  sdd-agentic-flow upgrade --plan
  sdd-agentic-flow upgrade --skills-only

OPTIONS
  --check         Upgrade-specific read-only registry check. Never prompts. Never mutates.
  --plan          May access the registry. Prints the concrete CLI + skill plan.
                  Never mutates. Never installs packages. Never overwrites files.
  --skills-only   Never checks the registry. Never changes the CLI package. Refreshes
                  managed skills from the currently executing package only (diff-safe).
  --ascii         Force ASCII symbols (also via SDD_ASCII=1). Presentation only.

Useful when:
  You want to update the toolkit after a new release, or refresh skills after
  \`npx sdd-agentic-flow@latest\` without a silent overwrite of local edits.

EXAMPLES
  sdd-agentic-flow upgrade --check
  sdd-agentic-flow upgrade --plan
  sdd-agentic-flow upgrade
  npx sdd-agentic-flow@latest upgrade --skills-only
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
                                      [--verbose] [--quiet]

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
  --verbose               List every exact removal path after the grouped summary.
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

START
  init [--interactive|--non-interactive] [--language en-US|pt-BR | --en | --br] [--feature-profile ...] [--preset ...] [--execution-mode ...] [--autonomy-level ...] [--local-git-exclude] [--quiet]  Guided setup or local configuration
  configure [--scope user|project] [--pack ...] [--target ...] [--plan]  Save installation intent
  discover [--force] [--quiet]           Refresh auto-discovered project context
  install <pack> [--scope user|project] [--agent ...] [--plan] [--interactive] [--quiet]  Install a pack (default: user scope, zero project footprint)
  doctor [--json] [--smoke] [--contracts] [--autonomy] [--verbose] [--check-updates]  Validate package or project setup

OPERATE
  config [show|policy]                   Inspect or change operating policy
  context [status|refresh|autonomy-state]  Show or refresh project context provenance, or autonomy loop state
  discover [--force] [--quiet]           Refresh auto-discovered project context
  upgrade [--check|--plan|--skills-only] Check for / apply CLI and skills updates (confirm-gated)
  autonomous-resume [--force] [--override-guard=N --reason=...]  Resume an autonomous workflow paused at a guardrail

INSPECT / LEARN
  list                                   List packs
  learn-sdd                              One-screen SDD summary
  help [command]                         Show this reference, or detailed help for one command
  version                                Show CLI version

REMOVE
  uninstall --plan | --apply [--include-config] [--full] [--scope user|project] [--agent ...] [--quiet]  Remove installed toolkit assets

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
  const locale = localeFor(cwd);
  const configPath = sddJoin(cwd, 'config.yml');
  const configFound = fs.existsSync(configPath);
  const projectScopeRoot = path.join(cwd, '.agents', 'skills');
  const skillsRoot = resolveSkillsRoot(cwd);
  const presence = coreSkillsPresence(skillsRoot);
  const skillsInstalled = presence.missing.length === 0;
  const skillsPartial = !skillsInstalled && presence.present.length > 0;
  const contextFound = fs.existsSync(sddJoin(cwd, 'context', 'project-context.md'));

  if (mode === 'human-rich') {
    // Full embedded chevron art — human TTY only; never machine/pipe/CI.
    // human-rich: left→right band reveal (~160ms); plain / SDD_BRAND_ANIMATE=0: instant.
    await writeBrand(mode, process.stdout, process.env, { quiet: options.quiet });
    process.stdout.write(
      `sdd-agentic-flow ${VERSION}\n\n` +
        `  ${locale === 'pt-BR' ? 'Harness orientado a especificações para fluxos guiados por humanos.' : 'Spec-driven agent harness for human-guided workflows.'}\n\n`,
    );
  } else {
    process.stdout.write(
      `sdd-agentic-flow ${VERSION}\n` +
        `${t(locale, 'welcome.description')}\n\n${t(locale, 'welcome.status')}\n`,
    );
  }

  const configLabel = configFound
    ? `${SDD_PATHS.config} ${t(locale, 'welcome.configFound')}`
    : `${SDD_PATHS.config} ${t(locale, 'welcome.configMissing')}`;
  const skillsLabel = skillsInstalled
    ? `${t(locale, 'welcome.skillsInstalled')} (${skillsRoot === projectScopeRoot ? 'project' : 'user'} scope: ${skillsRoot})`
    : skillsPartial
      ? `partial core skill install detected (${presence.present.length}/${CORE_SKILLS.length} present) — re-run \`sdd-agentic-flow install core\` to repair`
      : `${t(locale, 'welcome.noSkills')} (project or user scope)`;
  const contextLabel = contextFound
    ? t(locale, 'welcome.contextGenerated')
    : t(locale, 'welcome.contextMissing');

  if (mode === 'human-rich') {
    log(
      configFound ? 'PASS' : 'INFO',
      configFound ? t(locale, 'welcome.configFound') : t(locale, 'welcome.configMissing'),
    );
    log(
      skillsInstalled ? 'PASS' : skillsPartial ? 'WARN' : 'INFO',
      skillsInstalled
        ? t(locale, 'welcome.skillsInstalled')
        : skillsPartial
          ? skillsLabel
          : t(locale, 'welcome.noSkills'),
    );
    if (contextFound) log('PASS', t(locale, 'welcome.contextGenerated'));
    if (configFound) {
      const config = readConfig(configPath);
      if (config.ok) {
        process.stdout.write(`\n${renderPolicySummaryBlock(config, mode, locale)}\n`);
      }
      if (skillsInstalled || skillsPartial) {
        const installSummary = installationSummaryForWelcome(cwd);
        process.stdout.write(`\n${renderInstallationSummaryBlock(installSummary, mode, locale)}\n`);
      }
    }
  } else {
    log(configFound ? 'PASS' : 'INFO', configLabel);
    log(skillsInstalled ? 'PASS' : skillsPartial ? 'WARN' : 'INFO', skillsLabel);
    log(contextFound ? 'PASS' : 'INFO', contextLabel);
  }

  const suggested = !configFound
    ? 'npx sdd-agentic-flow init'
    : !skillsInstalled
      ? 'npx sdd-agentic-flow install core'
      : 'Use your coding agent with the installed SAF workflow.';
  if (mode === 'machine') {
    // Compact status screen (CLI-001): contextual next + quick commands; not nextStep().
    process.stdout.write(
      `\n${t(locale, 'init.next')}\n` +
        `  ${suggested}\n\n` +
        `${t(locale, 'welcome.quickCommands')}\n` +
        (!configFound
          ? '  npx sdd-agentic-flow init              Create local configuration\n  npx sdd-agentic-flow learn-sdd         Learn the workflow\n'
          : !skillsInstalled
            ? '  npx sdd-agentic-flow install core       Install the core skill pack\n  npx sdd-agentic-flow configure          Change installation intent\n  npx sdd-agentic-flow doctor             Validate local setup\n'
            : '  npx sdd-agentic-flow doctor             Validate local setup\n  npx sdd-agentic-flow config policy      Change operating policy\n  npx sdd-agentic-flow uninstall --plan   Preview what would be removed\n') +
        '\n' +
        `${t(locale, 'welcome.help')}\n\n` +
        `${t(locale, 'welcome.update')}\n` +
        '  npx sdd-agentic-flow upgrade\n' +
        '  (read-only: doctor --check-updates / upgrade --check)\n',
    );
  } else {
    nextStep(suggested, { quiet: options.quiet, mode });
    process.stdout.write(
      !configFound
        ? `\n${t(locale, 'welcome.quickCommands')}\n  npx sdd-agentic-flow learn-sdd\n  npx sdd-agentic-flow help\n`
        : !skillsInstalled
          ? `\n${t(locale, 'welcome.quickCommands')}\n  npx sdd-agentic-flow install core --plan\n  npx sdd-agentic-flow configure\n  npx sdd-agentic-flow doctor\n`
          : `\n${t(locale, 'welcome.optionalMaintenance')}\n  npx sdd-agentic-flow doctor\n  npx sdd-agentic-flow config policy\n  npx sdd-agentic-flow discover --force\n  npx sdd-agentic-flow upgrade\n  npx sdd-agentic-flow uninstall --plan\n`,
    );
    process.stdout.write(
      `\n${t(locale, 'welcome.update')}\n` +
        '  npx sdd-agentic-flow upgrade\n' +
        '  (read-only: doctor --check-updates / upgrade --check)\n',
    );
  }
}

function refreshSkillsAtTarget(target, packs, { overwriteDiffers = false } = {}) {
  const totals = {
    installed: 0,
    refreshed: 0,
    skippedIdentical: 0,
    skippedDiffers: 0,
    differs: [],
  };
  for (const pack of packs) {
    const preset = readPreset(pack);
    if (!preset) continue;
    const pairs = collectManagedPairs(PACKAGE_ROOT, preset, target);
    const classified = classifyManagedPairs(pairs);
    totals.differs.push(...classified.differs.map((pair) => pair.rel));
    totals.skippedIdentical += classified.identical.length;
    const missingSummary = applyManagedPairs(classified.missing, { overwriteDiffers: true });
    totals.installed += missingSummary.installed;
    if (overwriteDiffers) {
      const diffSummary = applyManagedPairs(classified.differs, { overwriteDiffers: true });
      totals.refreshed += diffSummary.refreshed;
    } else {
      totals.skippedDiffers += classified.differs.length;
    }
  }
  if (totals.installed + totals.refreshed > 0) writeInstallProvenance(target, VERSION);
  return totals;
}

async function refreshInstalledSkills(cwd, options = {}) {
  const mode = options.mode ?? resolveMode(options);
  const interactive = Boolean(options.interactive && canPromptInteractively(mode));
  const skillsRoot = resolveSkillsRoot(cwd);
  const packs = detectInstalledPacks(skillsRoot, PRESETS_DIR);
  if (!packs.length) {
    log('WARN', 'no installed packs detected to refresh');
    process.stdout.write('No changes were made.\n');
    return { ok: true, skipped: true };
  }

  const projectRoot = path.join(cwd, '.agents', 'skills');
  const targets = [];
  if (hasCoreSkillsAt(projectRoot) || installationStatus(projectRoot)) targets.push(projectRoot);
  for (const dir of userSkillsDirsFor(resolveConfiguredAgent(cwd), options.homeDir)) {
    if (installationStatus(dir) && !targets.includes(dir)) targets.push(dir);
  }
  if (!targets.length) targets.push(skillsRoot);

  let allDiffers = [];
  for (const target of targets) {
    for (const pack of packs) {
      const preset = readPreset(pack);
      if (!preset) continue;
      const classified = classifyManagedPairs(collectManagedPairs(PACKAGE_ROOT, preset, target));
      allDiffers = allDiffers.concat(classified.differs.map((pair) => `${target}: ${pair.rel}`));
    }
  }

  let overwriteDiffers = false;
  if (allDiffers.length) {
    log('WARN', `${allDiffers.length} managed file(s) differ from the bundled package`);
    for (const line of allDiffers.slice(0, 20)) process.stdout.write(`  ${line}\n`);
    if (allDiffers.length > 20) process.stdout.write(`  … and ${allDiffers.length - 20} more\n`);
    if (interactive) {
      overwriteDiffers = await askYesNo(
        'Overwrite differing managed files with the bundled package? [y/N] ',
      );
      if (!overwriteDiffers) {
        log('WARN', 'skipped differing files (no silent overwrite)');
      }
    } else {
      log('WARN', 'non-interactive: never overwriting differing managed files');
    }
  }

  let wrote = 0;
  let skippedDiffers = 0;
  for (const target of targets) {
    const summary = refreshSkillsAtTarget(target, packs, { overwriteDiffers });
    wrote += summary.installed + summary.refreshed;
    skippedDiffers += summary.skippedDiffers;
    log(
      'PASS',
      `refreshed ${packs.join(', ')} at ${target}: ${summary.installed} new, ${summary.refreshed} updated, ${summary.skippedIdentical} identical, ${summary.skippedDiffers} differed (skipped)`,
    );
  }

  if (!wrote && skippedDiffers) {
    log('WARN', 'no skill files refreshed (all candidates differed or were identical)');
    process.stdout.write('Recovery:\n  sdd-agentic-flow upgrade --skills-only\n');
  }
  return { ok: true, wrote, skippedDiffers, packs };
}

async function upgradeCommand(cwd, options = {}) {
  const mode = resolveMode({ quiet: options.quiet, ascii: options.ascii });
  const interactive = canPromptInteractively(mode) && !options.check && !options.plan;
  const execMode = detectExecutionMode(PACKAGE_ROOT);

  if (options.skillsOnly) {
    if (options.plan) {
      const skillsRoot = resolveSkillsRoot(cwd);
      const packs = detectInstalledPacks(skillsRoot, PRESETS_DIR);
      process.stdout.write(
        `Execution mode: ${execMode}\n` +
          `Registry check: none (--skills-only)\n` +
          `CLI package: unchanged\n` +
          `Plan:\n  1. Refresh installed packs from the currently executing package (${VERSION})\n` +
          `     packs: ${packs.length ? packs.join(', ') : '(none detected)'}\n\n` +
          'Mutations (if applied):\n  managed skill files (after confirms / diff rules)\n\n' +
          'No changes were made.\n',
      );
      return;
    }
    await refreshInstalledSkills(cwd, { mode, interactive, homeDir: options.homeDir });
    return;
  }

  const result = await checkForUpdate({ currentVersion: VERSION });

  if (options.check || (!interactive && !options.plan)) {
    process.stdout.write(formatCheckReport(result));
    if (!result.reachable) {
      process.stdout.write('\nNo changes were made.\n\nTo retry:\n  sdd-agentic-flow upgrade\n');
      process.exitCode = 1;
      return;
    }
    if (!options.check && result.updateAvailable) {
      process.stdout.write(
        '\nThis invocation is non-interactive; no mutations were performed.\n' +
          'Run `sdd-agentic-flow upgrade` in a TTY to confirm CLI/skills updates.\n',
      );
    }
    return;
  }

  if (options.plan) {
    const skillsRoot = resolveSkillsRoot(cwd);
    const packs = detectInstalledPacks(skillsRoot, PRESETS_DIR);
    if (!result.reachable) {
      log('WARN', 'unable to check for updates');
      process.stdout.write(
        '\nReason:\n  network unavailable or registry unreachable\n\nNo changes were made.\n\nTo retry:\n  sdd-agentic-flow upgrade --plan\n',
      );
      process.exitCode = 1;
      return;
    }
    process.stdout.write(
      `Current CLI: ${VERSION}\n` +
        `Latest CLI: ${result.latest}\n` +
        `Execution mode: ${execMode}\n\n` +
        'Plan:\n',
    );
    if (result.updateAvailable) {
      if (execMode === 'global')
        process.stdout.write(`  1. Upgrade CLI → ${result.latest} (npm install -g)\n`);
      else
        process.stdout.write(
          `  1. Re-run via npx/local: npx sdd-agentic-flow@latest (no in-process self-replace)\n`,
        );
      process.stdout.write(
        `  2. Refresh installed packs: ${packs.length ? packs.join(', ') : '(none detected)'}\n`,
      );
    } else {
      process.stdout.write('  1. CLI already up to date — no package install\n');
      process.stdout.write(
        `  2. Optional skills refresh from current package: ${packs.length ? packs.join(', ') : '(none detected)'}\n`,
      );
    }
    process.stdout.write(
      '\nMutations (if applied):\n  npm global installation (global mode only)\n' +
        '  managed skill files (after confirms / diff rules)\n\nNo changes were made.\n',
    );
    return;
  }

  // Interactive path
  if (!result.reachable) {
    log('WARN', 'unable to check for updates');
    process.stdout.write(
      '\nReason:\n  network unavailable or registry unreachable\n\nNo changes were made.\n\nTo retry:\n  sdd-agentic-flow upgrade\n',
    );
    return;
  }

  if (!result.updateAvailable) {
    log('PASS', `up to date (${VERSION})`);
    const refreshAnyway = await askYesNo(
      'Refresh installed skills from this package anyway? [y/N] ',
    );
    if (refreshAnyway) await refreshInstalledSkills(cwd, { mode, interactive: true });
    return;
  }

  log('WARN', `update available: ${VERSION} -> ${result.latest}`);
  let cliOk = null;
  const upgradeCli = await askYesNo(`Upgrade CLI to ${result.latest} now? [y/N] `);
  if (upgradeCli) {
    if (execMode === 'global') {
      try {
        process.stdout.write(`Running: npm install -g sdd-agentic-flow@latest\n`);
        runNpmGlobalInstall();
        log('PASS', `CLI upgraded toward ${result.latest}`);
        cliOk = true;
      } catch (error) {
        cliOk = false;
        fail(`CLI upgrade failed: ${error.message}`, {
          reason: 'npm install -g exited non-zero.',
          try: ['npm install -g sdd-agentic-flow@latest', 'sdd-agentic-flow upgrade --skills-only'],
        });
      }
    } else {
      process.stdout.write(
        '\nThis session is running via npx/local, so the CLI cannot self-replace in-place.\n\n' +
          'Run:\n  npx sdd-agentic-flow@latest\n\n' +
          'Then, if you want skills refreshed from that newer package:\n' +
          '  npx sdd-agentic-flow@latest upgrade --skills-only\n',
      );
      return;
    }
  }

  const refreshSkills = await askYesNo('Refresh installed skills from this package? [y/N] ');
  let skillsOk = null;
  if (refreshSkills) {
    try {
      await refreshInstalledSkills(cwd, { mode, interactive: true });
      skillsOk = true;
    } catch (error) {
      skillsOk = false;
      log('FAIL', `skill refresh failed: ${error.message}`);
    }
  }

  if (cliOk === true && skillsOk === false) {
    process.stdout.write(
      '\nCLI upgrade succeeded.\nSkill refresh failed.\n\n' +
        `Result:\n  CLI: toward ${result.latest}\n  skills: previous / partial\n\n` +
        'No automatic rollback was attempted.\n\nRecovery:\n  sdd-agentic-flow upgrade --skills-only\n',
    );
    process.exitCode = 1;
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
      if (
        args.includes('--preset') &&
        (args.includes('--execution-mode') || args.includes('--autonomy-level'))
      ) {
        return fail('init --preset cannot combine with --execution-mode or --autonomy-level.', {
          reason: 'Choose a preset or set the two fields explicitly, not both.',
          try: [
            'sdd-agentic-flow init --preset manual',
            'sdd-agentic-flow init --execution-mode full --autonomy-level supervised',
          ],
        });
      }
      let interactive = false;
      let nonInteractive = false;
      let language = 'en-US';
      let featureProfile = 'medium_feature';
      let executionMode = 'guided';
      let autonomyLevel = 'manual';
      let quiet = false;
      let localGitExclude = false;
      let presetName = null;
      let presetAlias = null;
      for (let index = 0; index < args.length; index += 1) {
        if (args[index] === '--interactive') interactive = true;
        else if (args[index] === '--non-interactive') nonInteractive = true;
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
        } else if (args[index] === '--preset') {
          const resolved = resolveOperatingPreset(args[index + 1]);
          if (!resolved) {
            return fail(`unknown --preset ${args[index + 1] || '(missing)'}.`, {
              reason: `Presets are ${OPERATING_PRESET_HELP}.`,
              try: [
                'sdd-agentic-flow init --preset manual',
                'sdd-agentic-flow init --preset supervised',
                'sdd-agentic-flow init --preset autonomous',
              ],
            });
          }
          presetName = resolved.name;
          presetAlias = resolved.alias;
          executionMode = resolved.executionMode;
          autonomyLevel = resolved.autonomyLevel;
          index += 1;
        } else if (args[index] === '--execution-mode') {
          if (!EXECUTION_MODES.includes(args[index + 1])) {
            return fail(usage, {
              reason: args[index + 1]
                ? `Unknown --execution-mode: ${args[index + 1]}`
                : 'Missing --execution-mode value.',
              try: ['sdd-agentic-flow init --execution-mode guided'],
            });
          }
          executionMode = args[index + 1];
          index += 1;
        } else if (args[index] === '--autonomy-level') {
          const resolved = resolveAutonomyToken(args[index + 1]);
          if (!resolved) {
            return fail(usage, {
              reason: args[index + 1]
                ? `Unknown --autonomy-level: ${args[index + 1]}`
                : 'Missing --autonomy-level value.',
              try: ['sdd-agentic-flow init --autonomy-level manual'],
            });
          }
          autonomyLevel = resolved;
          index += 1;
        } else return fail(usage);
      }
      if (interactive && nonInteractive)
        return fail('init --interactive cannot combine with --non-interactive');
      if (!autonomyComboValid(executionMode, autonomyLevel))
        return fail(
          `--execution-mode ${executionMode} cannot combine with --autonomy-level ${autonomyLevel} (see docs/autonomy-levels.md).`,
        );
      const canOnboard = shouldUseInteractiveInstall({
        stdinIsTTY: process.stdin.isTTY,
        stdoutIsTTY: process.stdout.isTTY,
        ci: Boolean(process.env.CI),
        plan: false,
        quiet,
        nonInteractive,
        machine: resolveMode({ quiet, ascii }) === 'machine',
      });
      const initOptions = {
        language,
        featureProfile,
        executionMode,
        autonomyLevel,
        presetName,
        presetAlias,
        quiet,
        localGitExclude,
        ascii,
      };
      if (canOnboard) await guidedInit(cwd, initOptions);
      else if (interactive)
        await initInteractive(
          cwd,
          language,
          featureProfile,
          quiet,
          executionMode,
          autonomyLevel,
          localGitExclude,
        );
      else init(cwd, { ...initOptions, profile: language });
    }
  } else if (command === 'discover') {
    if (args.includes('--help')) process.stdout.write(COMMAND_HELP.discover);
    else if (!args.every((arg) => arg === '--force' || arg === '--quiet')) {
      const bad = args.find((arg) => arg !== '--force' && arg !== '--quiet');
      const hint = didYouMeanTry(bad, ['--force', '--quiet']);
      return fail(USAGE.discover, {
        reason: bad ? `Unknown argument: ${bad}` : 'Invalid arguments.',
        try: ['sdd-agentic-flow discover --force', ...(hint ? [hint] : [])],
      });
    } else
      discoverProject(cwd, {
        force: args.includes('--force'),
        quiet: args.includes('--quiet'),
        ascii,
      });
  } else if (command === 'context') {
    if (args.includes('--help')) process.stdout.write(COMMAND_HELP.context);
    else {
      const sub = args[0] || 'status';
      if (args.length > 1 || !['status', 'refresh', 'autonomy-state'].includes(sub)) {
        const hint = didYouMeanTry(sub, ['status', 'refresh', 'autonomy-state']);
        return fail('usage: context [status|refresh|autonomy-state]', {
          reason: 'Only status, refresh, and autonomy-state subcommands are supported.',
          try: [
            'sdd-agentic-flow context status',
            'sdd-agentic-flow context refresh',
            'sdd-agentic-flow context autonomy-state',
            ...(hint ? [hint] : []),
          ],
        });
      }
      if (sub === 'status') contextStatus(cwd);
      else if (sub === 'refresh') contextRefresh(cwd, { ascii });
      else autonomyStateReport(cwd);
    }
  } else if (command === 'config') {
    const configPath = sddJoin(cwd, 'config.yml');
    if (args.includes('--help')) {
      process.stdout.write(COMMAND_HELP.config || 'usage: config [show|policy]\n');
      return;
    }
    const result = await runConfigCommand(configPath, args, { ascii });
    if (!result.ok) {
      return fail(result.message || 'config command failed', {
        try: result.try || [
          'sdd-agentic-flow config show',
          'sdd-agentic-flow config policy --plan',
        ],
      });
    }
  } else if (command === 'configure') {
    if (args.includes('--help')) return process.stdout.write(COMMAND_HELP.configure);
    let scope = 'user';
    let sharing = null;
    let plan = false;
    let interactive = false;
    const packs = [];
    const targets = [];
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === '--plan') plan = true;
      else if (arg === '--interactive') interactive = true;
      else if (arg === '--scope' && ['user', 'project'].includes(args[index + 1]))
        scope = args[++index];
      else if (arg === '--pack' && args[index + 1]) packs.push(args[++index]);
      else if (arg === '--target' && Object.hasOwn(USER_TARGETS, args[index + 1]))
        targets.push(args[++index]);
      else if (arg === '--sharing' && ['shared', 'local'].includes(args[index + 1]))
        sharing = args[++index];
      else return fail(USAGE.configure);
    }
    if (!packs.every((pack) => readPreset(pack))) return fail('unknown pack in configure');
    if (interactive && plan) return fail('configure --interactive cannot combine with --plan');
    const canInteract = shouldUseInteractiveInstall({
      stdinIsTTY: process.stdin.isTTY,
      stdoutIsTTY: process.stdout.isTTY,
      ci: Boolean(process.env.CI),
      plan,
      quiet: false,
      nonInteractive: false,
      machine: false,
    });
    if (interactive || (args.length === 0 && canInteract)) {
      const result = await configureInteractive(cwd, os.homedir());
      if (result.cancelled) return log('INFO', t(localeFor(cwd), 'configure.cancelled'));
      if (result.error)
        return fail(result.error, {
          reason: 'Use valid pack and target IDs.',
          try: ['sdd-agentic-flow configure --interactive'],
        });
      log('PASS', 'saved installation intent');
      const reconcilePlan = planForInstallProfile({
        cwd,
        homeDir: os.homedir(),
        scope: result.after.root ? 'project' : 'user',
        profile: result.after,
      });
      log(
        'INFO',
        `${t(localeFor(cwd), 'configure.savedOnly')} Run \`${installApplyCommand(reconcilePlan)}\`.`,
      );
      return;
    }
    const result = configureIntent({
      homeDir: os.homedir(),
      cwd,
      scope,
      packs,
      targets,
      sharing,
      plan,
    });
    if (plan) {
      process.stdout.write(
        `${t(localeFor(cwd), 'configure.intentPreview')}\n  Scope       ${scope}\n  Packs       ${(result.after.packs || []).join(', ') || '(none)'}\n` +
          (scope === 'user'
            ? `  Targets     ${(result.after.targets || DEFAULT_USER_TARGETS).join(', ')}\n`
            : `  Sharing     ${result.after.sharing || 'shared'}\n`) +
          `\n${t(localeFor(cwd), 'configure.reconciliationPreview')}\n`,
      );
    } else log('PASS', `saved ${scope} installation intent`);
    const reconcilePlan = planForInstallProfile({
      cwd,
      homeDir: os.homedir(),
      scope,
      profile: result.after,
    });
    printInstallPlanReport(reconcilePlan, resolveMode({}), cwd, {
      applyCommand: installApplyCommand(reconcilePlan),
    });
    if (plan)
      process.stdout.write(
        `${t(localeFor(cwd), 'configure.saveIntent')}: ${configureCommand(scope, result.after)}\n${t(localeFor(cwd), 'configure.reconcile')}:   ${installApplyCommand(reconcilePlan)}\n`,
      );
    else
      log(
        'INFO',
        `${t(localeFor(cwd), 'configure.savedOnly')} Run \`${installApplyCommand(reconcilePlan)}\`.`,
      );
  } else if (command === 'learn-sdd') {
    learnSdd(cwd);
  } else if (command === 'install') {
    const usage = USAGE.install;
    if (args.includes('--help')) return process.stdout.write(COMMAND_HELP.install);
    let pack = null;
    let scope = null;
    let agent = null;
    let plan = false;
    let quiet = false;
    let interactive = false;
    let nonInteractive = false;
    let valid = true;
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === '--plan') plan = true;
      else if (arg === '--quiet') quiet = true;
      else if (arg === '--interactive') interactive = true;
      else if (arg === '--non-interactive') nonInteractive = true;
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
    if (!valid || !pack || (interactive && nonInteractive)) return fail(usage);
    const automaticInteractive = shouldUseInteractiveInstall({
      stdinIsTTY: process.stdin.isTTY,
      stdoutIsTTY: process.stdout.isTTY,
      ci: Boolean(process.env.CI),
      plan,
      quiet,
      nonInteractive,
      machine: resolveMode({ quiet, ascii }) === 'machine',
    });
    if (interactive || automaticInteractive)
      await installInteractive(pack, cwd, { scope, agent, quiet, ascii });
    else install(pack, cwd, { scope, agent, plan, quiet, ascii });
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
  } else if (command === 'upgrade') {
    if (args.includes('--help')) return process.stdout.write(COMMAND_HELP.upgrade);
    const flags = new Set(['--check', '--plan', '--skills-only', '--quiet']);
    const unknown = args.filter((arg) => !flags.has(arg));
    if (unknown.length) {
      const hint = didYouMeanTry(unknown[0], [...flags]);
      return fail(USAGE.upgrade, {
        reason: `Unknown argument: ${unknown[0]}`,
        try: ['sdd-agentic-flow upgrade --check', ...(hint ? [hint] : [])],
      });
    }
    if (args.includes('--check') && args.includes('--skills-only'))
      return fail(USAGE.upgrade, {
        reason: '--check and --skills-only cannot be combined.',
        try: ['sdd-agentic-flow upgrade --check', 'sdd-agentic-flow upgrade --skills-only'],
      });
    await upgradeCommand(cwd, {
      check: args.includes('--check'),
      plan: args.includes('--plan'),
      skillsOnly: args.includes('--skills-only'),
      quiet: args.includes('--quiet'),
      ascii,
    });
  } else if (command === 'autonomous-resume') {
    const usage = USAGE['autonomous-resume'];
    if (args.includes('--help')) return process.stdout.write(COMMAND_HELP['autonomous-resume']);
    let force = false;
    let overrideGuard = null;
    let reason = null;
    let valid = true;
    let badArg = null;
    for (const arg of args) {
      if (arg === '--force') force = true;
      else if (arg.startsWith('--override-guard='))
        overrideGuard = arg.slice('--override-guard='.length);
      else if (arg.startsWith('--reason=')) reason = arg.slice('--reason='.length);
      else {
        valid = false;
        badArg = arg;
      }
    }
    if (!valid || (overrideGuard && !/^[1-7]$/.test(overrideGuard))) {
      const hint = badArg
        ? didYouMeanTry(badArg, ['--force', '--override-guard=3', '--reason=...'])
        : null;
      return fail(usage, {
        reason: badArg ? `Unknown argument: ${badArg}` : 'Invalid arguments.',
        try: [
          'sdd-agentic-flow autonomous-resume --force',
          'sdd-agentic-flow autonomous-resume --override-guard=3 --reason="..."',
          ...(hint ? [hint] : []),
        ],
      });
    }
    if (overrideGuard && !reason)
      return fail('--override-guard requires --reason="...".', {
        reason: 'Overrides must be audited with an explicit human reason.',
        try: ['sdd-agentic-flow autonomous-resume --override-guard=3 --reason="..."'],
      });
    autonomousResume(cwd, { force, overrideGuard, reason });
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
async function runInteractiveMenu(cwd, options = {}) {
  const locale = localeFor(cwd);
  for (;;) {
    const configFound = fs.existsSync(sddJoin(cwd, 'config.yml'));
    const skillsInstalled = coreSkillsPresence(resolveSkillsRoot(cwd)).missing.length === 0;
    const onboardingState = onboardingStateFor(cwd);
    if (options.showSummary !== false && ['READY', 'NEEDS_ATTENTION'].includes(onboardingState))
      printCurrentSetup(cwd, locale);
    const actions = menuActionsFor({
      hasConfig: configFound,
      hasSkills: skillsInstalled,
      onboardingState,
    });
    process.stdout.write(`\n${t(locale, 'menu.question')}\n`);
    const choice = await select(
      t(locale, 'menu.select'),
      actions.map((action) => {
        const key =
          action.command[0] === 'upgrade'
            ? 'menu.updates'
            : action.command[0] === 'configure'
              ? 'menu.change'
              : action.command[0] === 'doctor'
                ? 'menu.validate'
                : action.command[0] === 'help'
                  ? 'menu.more'
                  : action.command.length === 0
                    ? 'menu.keep'
                    : null;
        return { value: action, label: key ? t(locale, key) : action.label };
      }),
      { cancelValues: ['q', '0'], locale },
    );
    if (choice.cancelled) return;
    const selection = choice.value;
    if (!selection.command.length) return;
    process.stdout.write(
      `\n${t(locale, 'menu.running')}: sdd-agentic-flow ${selection.command.join(' ')}\n\n`,
    );
    await runCommand(selection.command[0], selection.command.slice(1), cwd);
    if (selection.command[0] === 'uninstall')
      process.stdout.write(
        '\nTo actually remove these, run `sdd-agentic-flow uninstall --apply` explicitly.\n',
      );
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const cwd = process.cwd();
  if (!command || command === '--ascii') {
    const rest = stripAsciiFlag(command ? [command, ...args] : args);
    if (rest.length) return runCommand(rest[0], rest.slice(1), cwd);
    const welcomeAscii = process.argv.includes('--ascii') || process.env.SDD_ASCII === '1';
    await welcome(cwd, { ascii: welcomeAscii });
    const mode = resolveMode({ ascii: welcomeAscii });
    const interactive = shouldShowInteractiveMenu(
      { stdout: process.stdout, stdin: process.stdin },
      process.env,
    );
    const onboardingState = onboardingStateFor(cwd);
    if (interactive && ['FIRST_USE', 'NEW_PROJECT', 'PARTIAL'].includes(onboardingState))
      return guidedInit(cwd, { ascii: welcomeAscii });
    // Trust-model exception: human-rich TTY only — ask before any registry request (default N).
    if (
      mode === 'human-rich' &&
      interactive &&
      process.env.SDD_NO_UPDATE_PROMPT !== '1' &&
      !process.env.CI
    ) {
      const wantsCheck = await askYesNo('Check for updates? [y/N] ');
      if (wantsCheck) await upgradeCommand(cwd, { ascii: welcomeAscii });
    }
    if (interactive) return runInteractiveMenu(cwd);
    return;
  }
  return runCommand(command, args, cwd);
}

main().catch((error) => fail(error.message, 2));
