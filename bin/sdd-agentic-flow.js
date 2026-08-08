#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline/promises');
const { execFileSync } = require('node:child_process');
const { validateContractReferences, parseContractArray } = require('./contract-graph');
const { satisfiesRange } = require('./version-compat');

const VERSION = '1.0.0';
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PRESETS_DIR = path.join(PACKAGE_ROOT, 'presets');
const LANGUAGE_PROFILES = ['en-US', 'pt-BR'];
const FEATURE_PROFILES = ['small_fix', 'medium_feature', 'large_feature', 'epic'];
const OFFICIAL_SKILLS = [
  'setup-sdd-agentic-flow',
  'sdd-route',
  'sdd-create-specs',
  'sdd-create-prompts',
  'sdd-implement-task',
  'sdd-implement-multi',
  'sdd-task-check',
  'sdd-create-pr',
  'sdd-pr-review',
  'sdd-pr-fix',
  'sdd-validation',
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
  snapshots_dir: .sdd/snapshots

workflow:
  default_flow: ${options.flow || 'single'}
  feature_profile: ${options.featureProfile || 'medium_feature'}
  allow_multi_worktree: ${options.multiWorktree || false}
  allow_stacked_prs: ${options.stackedPrs || false}
  commit_policy: manual

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
  const configPath = path.join(cwd, '.sdd', 'config.yml');
  if (!fs.existsSync(configPath)) return null;
  const target = configValue(fs.readFileSync(configPath, 'utf8'), 'target');
  return target && KNOWN_AGENTS.includes(target) ? target : null;
}

function languageProfilePath(cwd, profile, isPackage) {
  return isPackage
    ? path.join(PACKAGE_ROOT, 'shared', 'language-profiles', `${profile}.md`)
    : path.join(
        cwd,
        '.agents',
        'skills',
        'sdd-agentic-flow-shared',
        'language-profiles',
        `${profile}.md`,
      );
}

function languageReport(cwd) {
  const configPath = path.join(cwd, '.sdd', 'config.yml');
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
  process.stdout.write(`${status} ${message}\n`);
}

function fail(message, code = 1) {
  process.stderr.write(`FAIL ${message}\n`);
  process.exitCode = code;
}

function readPreset(name) {
  const filename = path.join(PRESETS_DIR, `${name}.json`);
  if (!fs.existsSync(filename)) return null;
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
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

function init(cwd, options = {}) {
  const configPath = path.join(cwd, '.sdd', 'config.yml');
  if (fs.existsSync(configPath)) {
    log('WARN', 'preserved existing .sdd/config.yml');
    return false;
  }
  for (const relative of ['.sdd/snapshots', '.sdd/reports', '.specs/features']) {
    fs.mkdirSync(path.join(cwd, relative), { recursive: true });
  }
  fs.writeFileSync(configPath, configFor(options), 'utf8');
  log('PASS', 'created .sdd/config.yml');
  log('PASS', 'initialized local SDD directories');
  discoverProject(cwd, { force: false });
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
  const contextPath = path.join(cwd, '.sdd', 'context', 'project-context.md');
  if (fs.existsSync(contextPath) && !options.force) {
    log('WARN', 'preserved existing .sdd/context/project-context.md');
    return false;
  }
  const provenance = { generatedAt: new Date().toISOString(), ...gitInfo(cwd) };
  fs.mkdirSync(path.dirname(contextPath), { recursive: true });
  fs.writeFileSync(contextPath, projectContextFor(scanProjectSignals(cwd), provenance), 'utf8');
  log('PASS', 'created .sdd/context/project-context.md');
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
  const contextPath = path.join(cwd, '.sdd', 'context', 'project-context.md');
  if (!fs.existsSync(contextPath)) {
    log(
      'WARN',
      'status: not found; run `init` or `discover` to create .sdd/context/project-context.md',
    );
    return;
  }
  const provenance = parseProvenance(fs.readFileSync(contextPath, 'utf8'));
  log('PASS', 'status: available');
  log('INFO', 'artifact: .sdd/context/project-context.md');
  log('INFO', `generated at: ${provenance.generatedAt || 'unknown'}`);
  log('INFO', `repository revision: ${provenance.revision || 'not a git repository'}`);
  log('INFO', `branch: ${provenance.branch || 'unknown'}`);
  const current = gitInfo(cwd);
  if (provenance.revision && current.revision && provenance.revision !== current.revision) {
    log('INFO', 'Repository has changed since context generation.');
    log('INFO', 'Recommendation: run `sdd-agentic-flow context refresh`.');
  }
}

function contextRefresh(cwd) {
  discoverProject(cwd, { force: true });
}

function validValue(value, allowed) {
  return allowed.includes(value) ? value : null;
}

async function initInteractive(
  cwd,
  languageDefault = 'en-US',
  featureProfileDefault = 'medium_feature',
) {
  if (fs.existsSync(path.join(cwd, '.sdd', 'config.yml'))) {
    log('WARN', '.sdd/config.yml already exists; interactive init will not overwrite it');
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
    };
    init(cwd, options);
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

function install(pack, cwd, options = {}) {
  const preset = readPreset(pack);
  if (!preset) return fail(`unknown pack: ${pack}. Run \`sdd-agentic-flow list\`.`);
  const scope = options.scope || 'user';
  if (scope !== 'user' && scope !== 'project')
    return fail('unknown scope: use --scope user or --scope project');
  if (options.agent && !KNOWN_AGENTS.includes(options.agent))
    return fail(`unknown agent: ${options.agent}. Supported: ${KNOWN_AGENTS.join(', ')}.`);

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
    log('PASS', `installed ${pack}: ${summary.installed} files`);
    if (summary.preserved) log('WARN', `preserved ${summary.preserved} existing files`);
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
  log(
    'PASS',
    `installed ${pack} to ${targets.length} user-scope target(s): ${totals.installed} files`,
  );
  if (totals.preserved) log('WARN', `preserved ${totals.preserved} existing files`);
  log('PASS', 'Repository changes: none');
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

function hasCoreSkills(cwd) {
  return [
    'setup-sdd-agentic-flow',
    'sdd-create-specs',
    'sdd-implement-task',
    'sdd-task-check',
    'sdd-validation',
  ].every((skill) => fs.existsSync(path.join(cwd, '.agents', 'skills', skill, 'SKILL.md')));
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
  const configPath = path.join(cwd, '.sdd', 'config.yml');
  const safetyConfig = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf8')
    : configFor();
  const language = languageReport(cwd);
  const tddBaseline = isPackage
    ? path.join(cwd, 'shared', 'references', 'tdd-baseline.md')
    : path.join(
        cwd,
        '.agents',
        'skills',
        'sdd-agentic-flow-shared',
        'references',
        'tdd-baseline.md',
      );

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
      fs.existsSync(configPath) ? '.sdd/config.yml found' : '.sdd/config.yml not found',
      'Config',
    );
    add(
      'skills',
      fs.existsSync(path.join(cwd, '.agents', 'skills')) && hasCoreSkills(cwd) ? 'PASS' : 'WARN',
      hasCoreSkills(cwd) ? 'core skills installed' : 'core skills not fully installed',
      'Skills',
    );
    add(
      'shared_layer',
      fs.existsSync(
        path.join(cwd, '.agents/skills/sdd-agentic-flow-shared/references/tlc-baseline.md'),
      )
        ? 'PASS'
        : 'WARN',
      fs.existsSync(path.join(cwd, '.agents/skills/sdd-agentic-flow-shared'))
        ? 'shared layer installed'
        : 'shared layer not installed',
      'Shared layer',
    );
    add(
      'project_readiness',
      fs.existsSync(configPath) && hasCoreSkills(cwd) ? 'PASS' : 'WARN',
      'project readiness is based on config and core skills',
      'Project readiness',
    );
    {
      const contextArtifactPath = path.join(cwd, '.sdd', 'context', 'project-context.md');
      const contextArtifactExists = fs.existsSync(contextArtifactPath);
      let contextMessage = contextArtifactExists
        ? '.sdd/context/project-context.md found'
        : '.sdd/context/project-context.md not found; run `discover`';
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
      : path.join(cwd, '.agents', 'skills', 'sdd-agentic-flow-shared', 'references', name);
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
        '✓ No project files created by installation',
        'Installation',
      );
  }
  return checks;
}

function frontmatterOf(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

function installedSkillDirs(cwd) {
  const root = path.join(cwd, '.agents', 'skills');
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
  const skills = installedSkillDirs(cwd);
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
    const skillPath = path.join(cwd, '.agents', 'skills', skill, 'SKILL.md');
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
    const registryPath = path.join(
      cwd,
      '.agents',
      'skills',
      'sdd-agentic-flow-shared',
      'baselines',
      'registry.yml',
    );
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

function renderDoctor(checks) {
  let section = null;
  for (const check of checks) {
    if (check.section !== section) {
      section = check.section;
      process.stdout.write(`\n${section}\n`);
    }
    log(check.status, check.message);
  }
}

function smokeCheck() {
  let temporary;
  try {
    for (const profile of LANGUAGE_PROFILES) {
      temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-smoke-'));
      init(temporary, { profile });
      install('core', temporary, { scope: 'project' });
      init(temporary, { profile });
      install('core', temporary, { scope: 'project' });
      const required = [
        '.sdd/config.yml',
        '.sdd/context/project-context.md',
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

function doctor(cwd, options = {}) {
  const checks = doctorChecks(cwd);
  if (options.smoke) checks.push(smokeCheck());
  if (options.contracts) checks.push(contractsCheck(cwd));
  const result = {
    status: severity(checks),
    version: VERSION,
    checks: checks.map(({ section, ...check }) => check),
    language: languageReport(cwd),
  };
  if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else renderDoctor(checks);
  if (result.status === 'FAIL') process.exitCode = 1;
}

function describePath(cwd, target) {
  const relative = path.relative(cwd, target);
  return relative.startsWith('..') || path.isAbsolute(relative) ? target : relative;
}

function uninstall(args, cwd) {
  const usage =
    'usage: uninstall --plan | uninstall --apply [--include-config] [--scope user|project] [--agent codex|cursor|claude-code|vscode-copilot]';
  const plan = args.includes('--plan');
  const apply = args.includes('--apply');
  const includeConfig = args.includes('--include-config');
  let scope = null;
  let agent = null;
  const rest = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (['--plan', '--apply', '--include-config'].includes(arg)) continue;
    if (arg === '--scope' && ['user', 'project'].includes(args[index + 1])) {
      scope = args[index + 1];
      index += 1;
    } else if (arg === '--agent' && KNOWN_AGENTS.includes(args[index + 1])) {
      agent = args[index + 1];
      index += 1;
    } else rest.push(arg);
  }
  if (plan === apply || rest.length || (includeConfig && !apply)) return fail(usage);
  const scopes = scope ? [scope] : ['project', 'user'];
  const roots = [];
  if (scopes.includes('project')) roots.push(path.join(cwd, '.agents', 'skills'));
  if (scopes.includes('user')) roots.push(...userSkillsDirsFor(agent));
  const targets = roots.flatMap((root) => [
    ...OFFICIAL_SKILLS.map((skill) => path.join(root, skill)),
    path.join(root, 'sdd-agentic-flow-shared'),
  ]);
  if (includeConfig) targets.push(path.join(cwd, '.sdd', 'config.yml'));
  const existing = targets.filter((target) => fs.existsSync(target));
  if (plan) {
    for (const target of existing) log('PLAN', `remove ${describePath(cwd, target)}`);
    if (!existing.length) log('PLAN', 'nothing installed by sdd-agentic-flow was found');
    log(
      'PLAN',
      'preserves .specs/features, .sdd/reports, .sdd/snapshots, source code, and unknown paths',
    );
    return;
  }
  for (const target of existing) {
    fs.rmSync(target, { recursive: true, force: true });
    log('PASS', `removed ${describePath(cwd, target)}`);
  }
  if (!existing.length) log('WARN', 'nothing installed by sdd-agentic-flow was found');
  log('PASS', 'preserved project specs, reports, snapshots, source code, and unknown paths');
}

function help() {
  process.stdout.write(
    `sdd-agentic-flow ${VERSION}\n\nCommands:\n  list\n  init [--interactive] [--language en-US|pt-BR] [--feature-profile small_fix|medium_feature|large_feature|epic]\n  discover [--force]\n  context [status|refresh]\n  install <pack> [--scope user|project] [--agent codex|cursor|claude-code|vscode-copilot] [--plan]\n  doctor [--json] [--smoke] [--contracts]\n  uninstall --plan | --apply [--include-config] [--scope user|project] [--agent codex|cursor|claude-code|vscode-copilot]\n  help\n  version\n`,
  );
}

async function main() {
  const [command = 'help', ...args] = process.argv.slice(2);
  if (command === 'list') list();
  else if (command === 'init') {
    const usage =
      'usage: init [--interactive] [--language en-US|pt-BR] [--feature-profile small_fix|medium_feature|large_feature|epic]';
    if (args.includes('--help')) process.stdout.write(`${usage}\n`);
    else {
      let interactive = false;
      let language = 'en-US';
      let featureProfile = 'medium_feature';
      for (let index = 0; index < args.length; index += 1) {
        if (args[index] === '--interactive') interactive = true;
        else if (args[index] === '--language' && LANGUAGE_PROFILES.includes(args[index + 1])) {
          language = args[index + 1];
          index += 1;
        } else if (
          args[index] === '--feature-profile' &&
          FEATURE_PROFILES.includes(args[index + 1])
        ) {
          featureProfile = args[index + 1];
          index += 1;
        } else return fail(usage);
      }
      if (interactive) await initInteractive(process.cwd(), language, featureProfile);
      else init(process.cwd(), { profile: language, featureProfile });
    }
  } else if (command === 'discover') {
    if (!args.every((arg) => arg === '--force')) return fail('usage: discover [--force]');
    discoverProject(process.cwd(), { force: args.includes('--force') });
  } else if (command === 'context') {
    const sub = args[0] || 'status';
    if (args.length > 1 || (sub !== 'status' && sub !== 'refresh'))
      return fail('usage: context [status|refresh]');
    if (sub === 'status') contextStatus(process.cwd());
    else contextRefresh(process.cwd());
  } else if (command === 'install') {
    const usage =
      'usage: install <pack> [--scope user|project] [--agent codex|cursor|claude-code|vscode-copilot] [--plan]';
    let pack = null;
    let scope = 'user';
    let agent = null;
    let plan = false;
    let valid = true;
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === '--plan') plan = true;
      else if (arg === '--scope' && ['user', 'project'].includes(args[index + 1])) {
        scope = args[index + 1];
        index += 1;
      } else if (arg === '--agent' && KNOWN_AGENTS.includes(args[index + 1])) {
        agent = args[index + 1];
        index += 1;
      } else if (!arg.startsWith('--') && pack === null) pack = arg;
      else valid = false;
    }
    if (!valid || !pack) return fail(usage);
    install(pack, process.cwd(), { scope, agent, plan });
  } else if (command === 'doctor') {
    const valid = args.every(
      (arg) => arg === '--json' || arg === '--smoke' || arg === '--contracts',
    );
    if (!valid) {
      if (args.includes('--json'))
        process.stdout.write(
          `${JSON.stringify({ status: 'FAIL', version: VERSION, checks: [{ name: 'arguments', status: 'FAIL', message: 'usage: doctor [--json] [--smoke] [--contracts]' }] })}\n`,
        );
      else fail('usage: doctor [--json] [--smoke] [--contracts]');
    } else
      doctor(process.cwd(), {
        json: args.includes('--json'),
        smoke: args.includes('--smoke'),
        contracts: args.includes('--contracts'),
      });
  } else if (command === 'uninstall') uninstall(args, process.cwd());
  else if (command === 'help' || command === '--help' || command === '-h') help();
  else if (command === 'version' || command === '--version' || command === '-v')
    process.stdout.write(`${VERSION}\n`);
  else fail(`unknown command: ${command}`);
}

main().catch((error) => fail(error.message, 2));
