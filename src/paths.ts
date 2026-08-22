import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { USER_TARGETS } from './install-domain';

type PackageJson = { version: string };

export const PACKAGE_ROOT = path.resolve(__dirname, '..');
export const VERSION = (
  JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as PackageJson
).version;
export const PRESETS_DIR = path.join(PACKAGE_ROOT, 'presets');
export const LANGUAGE_PROFILES = ['en-US', 'pt-BR'];
export const FEATURE_PROFILES = ['small_fix', 'medium_feature', 'large_feature', 'epic'];
export const EXECUTION_MODES = ['plan', 'guided', 'apply', 'review', 'full'];
export const AUTONOMY_LEVELS = ['manual', 'supervised', 'autonomous'];
// v1.8.0: autonomy_level is a new axis orthogonal to execution_mode (docs/execution-modes.md,
// shared/references/autonomy-guardrails.md) — `plan`/`guided` never combine with `autonomous`:
// a plan-only workflow has nothing to auto-advance into, and step-by-step confirmation is the
// entire point of `guided`.
export const INVALID_AUTONOMY_COMBOS = new Set(['plan:autonomous', 'guided:autonomous']);

export function autonomyComboValid(executionMode: string, autonomyLevel: string) {
  return !INVALID_AUTONOMY_COMBOS.has(`${executionMode}:${autonomyLevel}`);
}

// Operating presets are UX over the two existing fields. Not a third stored axis.
// Aliases are input sugar for --preset and --autonomy-level only.
export const OPERATING_PRESETS: Record<string, { executionMode: string; autonomyLevel: string }> = {
  manual: { executionMode: 'guided', autonomyLevel: 'manual' },
  supervised: { executionMode: 'apply', autonomyLevel: 'supervised' },
  autonomous: { executionMode: 'full', autonomyLevel: 'autonomous' },
};
export const AUTONOMY_ALIASES: Record<string, string> = {
  man: 'manual',
  assist: 'supervised',
  assisted: 'supervised',
  auto: 'autonomous',
};
export const OPERATING_PRESET_HELP =
  'manual|supervised|autonomous (aliases: man, assist|assisted, auto)';

export function resolveAutonomyToken(token: string) {
  if (!token || String(token).startsWith('--')) return null;
  if (AUTONOMY_LEVELS.includes(token)) return token;
  return AUTONOMY_ALIASES[token] || null;
}

export function resolveOperatingPreset(token: string) {
  const canonical = resolveAutonomyToken(token);
  if (!canonical || !OPERATING_PRESETS[canonical]) return null;
  return {
    name: canonical,
    alias: token === canonical ? null : token,
    ...OPERATING_PRESETS[canonical],
  };
}

export const REQUIRED_CONTRACT_FIELDS = [
  'extends',
  'requires',
  'consumes',
  'produces',
  'baseline',
  'packs',
];
export const OPTIONAL_CONTRACT_FIELDS = ['depends_on', 'conflicts', 'requires_cli'];

// v1.10.0: toolkit state lives under .sdd-agentic-flow/ (not the legacy .sdd/ short name).
export const SDD_ROOT = '.sdd-agentic-flow';
export const LEGACY_SDD_ROOT = '.sdd';
export const SDD_PATHS = {
  config: `${SDD_ROOT}/config.yml`,
  contextDir: `${SDD_ROOT}/context`,
  projectContext: `${SDD_ROOT}/context/project-context.md`,
  autonomyDir: `${SDD_ROOT}/autonomy`,
  loopState: `${SDD_ROOT}/autonomy/loop-state.md`,
  snapshots: `${SDD_ROOT}/snapshots`,
  reports: `${SDD_ROOT}/reports`,
  usage: `${SDD_ROOT}/usage.md`,
  explanationsDir: `${SDD_ROOT}/explanations`,
  usageGuideEn: `${SDD_ROOT}/saf-skills-usage-guide.md`,
  usageGuidePtBr: `${SDD_ROOT}/saf-skills-usage-guide.pt-BR.md`,
};
export const USAGE_GUIDE_URL =
  'https://github.com/gmartins-dev/sdd-agentic-flow/blob/main/docs/saf-skills-usage-guide.md';
export const USAGE_GUIDE_PT_BR_URL =
  'https://github.com/gmartins-dev/sdd-agentic-flow/blob/main/docs/saf-skills-usage-guide.pt-BR.md';
export const LOCAL_GIT_EXCLUDE_COMMENT = '# sdd-agentic-flow init --local-git-exclude';
export const LOCAL_GIT_EXCLUDE_ENTRY = `${SDD_ROOT}/`;
export const USER_INSTALL_CONFIG = `${SDD_ROOT}/install.yml`;

export function userInstallConfigPath(homeDir: string = os.homedir()) {
  return path.join(homeDir, USER_INSTALL_CONFIG);
}

export function projectSddRoot(cwd: string) {
  return path.join(cwd, SDD_ROOT);
}

export function defaultSpecsRoot(cwd: string) {
  return path.join(cwd, '.specs', 'features');
}

export function sddJoin(cwd: string, ...segments: string[]) {
  return path.join(cwd, SDD_ROOT, ...segments);
}

export function explanationPath(cwd: string, featureSlug: string) {
  return sddJoin(cwd, 'explanations', `${featureSlug}.md`);
}

export function explanationRelativePath(featureSlug: string) {
  return `${SDD_PATHS.explanationsDir}/${featureSlug}.md`;
}

export function legacySddJoin(cwd: string, ...segments: string[]) {
  return path.join(cwd, LEGACY_SDD_ROOT, ...segments);
}

// Agent Integration Layer (Milestone 1): user-scope (global, per-agent) skill directories,
// each verified against the agent's own documentation (see docs/installation-scope.md).
// Segments are joined onto a home directory, never hardcoded as absolute paths, so this
// stays cross-platform (Milestone 2) — the only place in the CLI that resolves os.homedir().
export const AGENT_USER_DIR_SEGMENTS: Record<string, string[][]> = {
  codex: [['.agents', 'skills']],
  cursor: [
    ['.agents', 'skills'],
    ['.cursor', 'skills'],
  ],
  'claude-code': [['.claude', 'skills']],
  'vscode-copilot': [['.copilot', 'skills']],
};
export const KNOWN_AGENTS = Object.keys(AGENT_USER_DIR_SEGMENTS);
// Default (no --agent): the 3 fixed targets documented in docs/installation-scope.md —
// covers Codex CLI + Cursor (+ Copilot's `.agents/skills` fallback), Claude Code, and
// GitHub Copilot's own `.copilot/skills` convention.
export const DEFAULT_USER_DIR_SEGMENTS = [
  ['.agents', 'skills'],
  ['.claude', 'skills'],
  ['.copilot', 'skills'],
];

export function userSkillsDirsFor(agent?: string | null, homeDir: string = os.homedir()) {
  if (agent && !KNOWN_AGENTS.includes(agent)) return null;
  const segments = agent ? AGENT_USER_DIR_SEGMENTS[agent] : DEFAULT_USER_DIR_SEGMENTS;
  const seen = new Set<string>();
  const dirs: string[] = [];
  for (const parts of segments ?? []) {
    const dir = path.join(homeDir, ...parts);
    if (seen.has(dir)) continue;
    seen.add(dir);
    dirs.push(dir);
  }
  return dirs;
}

export function userSkillsDirsForTargets(targets: string[], homeDir: string) {
  return [
    ...new Set(
      targets.map((target: string) =>
        path.join(homeDir, ...USER_TARGETS[target as keyof typeof USER_TARGETS]),
      ),
    ),
  ];
}

// Milestone 2 (Platform Abstraction): the only place that reads process.env for shell
// detection. Informational only — never used to decide CLI behavior, only surfaced via
// `doctor`'s Platform section (see docs/environment-compatibility.md).
export function detectShellInfo(env: NodeJS.ProcessEnv = process.env) {
  if (env.SHELL) return path.basename(env.SHELL);
  if (env.PSModulePath) return 'powershell';
  if (env.ComSpec) return path.basename(env.ComSpec);
  return 'unknown';
}

export function filesystemWritable() {
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

export function gitAvailable() {
  try {
    execFileSync('git', ['--version'], { stdio: ['ignore', 'ignore', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

export const PRIVATE_PATTERNS = [
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
].map((value: string) => Buffer.from(value, 'base64').toString('utf8'));
