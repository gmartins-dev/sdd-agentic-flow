import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveGitContext } from './git-context';
import { compareVersions } from './version-compat';

const USER_TARGETS = Object.freeze({
  agents: ['.agents', 'skills'],
  cursor: ['.cursor', 'skills'],
  claude: ['.claude', 'skills'],
  copilot: ['.copilot', 'skills'],
} as const);
type UserTargetId = keyof typeof USER_TARGETS;
const DEFAULT_USER_TARGETS = Object.freeze(['agents', 'claude', 'copilot'] as const);
const AGENT_TO_TARGETS = Object.freeze({
  codex: ['agents'],
  cursor: ['agents', 'cursor'],
  'claude-code': ['claude'],
  'vscode-copilot': ['copilot'],
} as const);
const USER_TARGET_ALIASES = Object.freeze({
  agents: 'agents',
  'shared agent skills': 'agents',
  cursor: 'cursor',
  claude: 'claude',
  'claude code': 'claude',
  copilot: 'copilot',
  'github copilot': 'copilot',
} as const);
type TargetAlias = keyof typeof USER_TARGET_ALIASES;

type InstallProjectProfile = {
  git_common_dir: string;
  project_relative_path: string;
  adoption_mode: 'personal' | 'specs-shared' | 'team';
  specs_visibility?: 'local' | 'shared';
};
type InstallConfig = {
  schema: 'saf-install-intent/v3' | 'saf-install-intent/v4';
  user: { targets: string[] };
  projects: Record<string, InstallProjectProfile>;
};
type ParseTargetResult = { ok: true; targets: string[] } | { ok: false; message: string };
type InstallIntentState =
  | { kind: 'none'; schema: null }
  | { kind: 'current'; schema: 'saf-install-intent/v3' | 'saf-install-intent/v4' }
  | { kind: 'legacy'; schema: string }
  | { kind: 'future' | 'unknown'; schema: string };
type InstallationKind = 'none' | 'current' | 'legacy' | 'future' | 'unknown';
type ReconciliationState =
  | 'in_sync'
  | 'needs_apply'
  | 'safe_migration'
  | 'blocked_collision'
  | 'blocked_future_contract'
  | 'blocked_unknown_ownership';
type FailureClass = 'none' | 'retryable' | 'fatal';
type ProvenanceVersionRelation = 'older' | 'current' | 'newer' | 'unknown';
type InstallationState = {
  installationKind: InstallationKind;
  reconciliationState: ReconciliationState;
  failureClass: FailureClass;
};
type InteractiveInstallInput = {
  stdinIsTTY?: boolean;
  stdoutIsTTY?: boolean;
  ci?: boolean;
  plan?: boolean;
  quiet?: boolean;
  nonInteractive?: boolean;
  machine?: boolean;
};

function parseTargetSelection(
  input: unknown,
  defaults: readonly string[] = DEFAULT_USER_TARGETS,
): ParseTargetResult {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: true, targets: [...defaults] };
  if (raw.toLowerCase() === 'all') return { ok: true, targets: Object.keys(USER_TARGETS) };
  const supplied = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const targets = supplied
    .map((value) => USER_TARGET_ALIASES[value.toLowerCase() as TargetAlias])
    .filter(Boolean);
  if (!targets.length || targets.length !== supplied.length)
    return { ok: false, message: `Unknown installation target: ${raw}` };
  return { ok: true, targets: [...new Set(targets)] };
}

function installConfigPath(homeDir: string = os.homedir()): string {
  return path.join(homeDir, '.sdd-agentic-flow', 'install.yml');
}

function classifyInstallIntent(homeDir: string = os.homedir()): InstallIntentState {
  const file = installConfigPath(homeDir);
  if (!fs.existsSync(file)) return { kind: 'none', schema: null };
  const firstLine = fs.readFileSync(file, 'utf8').split(/\r?\n/, 1)[0] || '';
  const schema = firstLine.replace(/^schema:\s*/, '').trim();
  if (schema === 'saf-install-intent/v3' || schema === 'saf-install-intent/v4')
    return { kind: 'current', schema };
  if (schema === 'saf-install-intent/v1' || schema === 'saf-install-intent/v2')
    return { kind: 'legacy', schema };
  if (/^saf-install-intent\/v\d+$/.test(schema)) return { kind: 'future', schema };
  return { kind: 'unknown', schema: schema || '(missing)' };
}

function schemaGenerationFor(schema: string | null, prefix: string): number | null {
  if (!schema?.startsWith(`${prefix}/v`)) return null;
  const generation = Number(schema.slice(`${prefix}/v`.length));
  return Number.isInteger(generation) && generation > 0 ? generation : null;
}

function classifyProvenanceVersion(
  installed: string | null | undefined,
  running: string,
): ProvenanceVersionRelation {
  if (!installed) return 'unknown';
  const comparison = compareVersions(installed, running);
  if (comparison === null) return 'unknown';
  if (comparison < 0) return 'older';
  if (comparison > 0) return 'newer';
  return 'current';
}

function classifyInstallationState({
  intentKind,
  targetKinds = [],
  reconciliationState,
  failureClass = 'none',
}: {
  intentKind: InstallationKind;
  targetKinds?: readonly InstallationKind[];
  reconciliationState: ReconciliationState;
  failureClass?: FailureClass;
}): InstallationState {
  const kinds = [intentKind, ...targetKinds];
  const installationKind = kinds.includes('future')
    ? 'future'
    : kinds.includes('unknown')
      ? 'unknown'
      : kinds.includes('legacy')
        ? 'legacy'
        : kinds.includes('current')
          ? 'current'
          : 'none';
  return { installationKind, reconciliationState, failureClass };
}

function repositoryKey(root: string): string {
  const resolved = resolveGitContext(root);
  if (!resolved.ok) throw new Error(resolved.error);
  return resolved.context.adoptionKey;
}

function defaultInstallConfig(): InstallConfig {
  return { schema: 'saf-install-intent/v4', user: { targets: [] }, projects: {} };
}

function yamlList(lines: string[], indent: number, values: string[]): void {
  for (const value of values) lines.push(`${' '.repeat(indent)}- ${value}`);
}

function serializeInstallConfig(config: InstallConfig): string {
  const lines = ['schema: saf-install-intent/v4', '', 'user:', '  targets:'];
  yamlList(lines, 4, config.user.targets || []);
  lines.push('', 'projects:');
  for (const [key, profile] of Object.entries(config.projects || {})) {
    lines.push(
      `  "${key}":`,
      `    git_common_dir: "${profile.git_common_dir}"`,
      `    project_relative_path: "${profile.project_relative_path}"`,
      `    adoption_mode: ${profile.adoption_mode}`,
      ...(profile.specs_visibility ? [`    specs_visibility: ${profile.specs_visibility}`] : []),
    );
  }
  return `${lines.join('\n')}\n`;
}

function readInstallConfig(homeDir: string): InstallConfig | null {
  const file = installConfigPath(homeDir);
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const schemaLine = lines[0];
  const schema = schemaLine?.replace(/^schema:\s*/, '').trim();
  if (schema !== 'saf-install-intent/v3' && schema !== 'saf-install-intent/v4')
    throw new Error('unsupported installation intent; clean reinstall required');
  const config: InstallConfig = {
    schema: schema as InstallConfig['schema'],
    user: { targets: [] },
    projects: {},
  };
  let section: 'user' | 'projects' | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line === 'user:') section = 'user';
    else if (line === 'projects:') section = 'projects';
    else if (section === 'user' && line === '  targets:') {
      for (index += 1; /^ {4}- /.test(lines[index] ?? ''); index += 1)
        config.user.targets.push((lines[index] ?? '').trim().slice(2));
      index -= 1;
    } else if (section === 'projects' && /^ {2}"[^"]+":$/.test(line)) {
      const key = line.trim().slice(1, -2);
      const values: Record<string, string> = {};
      for (index += 1; /^ {4}[a-z_]+: /.test(lines[index] ?? ''); index += 1) {
        const child = (lines[index] ?? '').trim();
        const separator = child.indexOf(':');
        values[child.slice(0, separator)] = child
          .slice(separator + 1)
          .trim()
          .replace(/^"|"$/g, '');
      }
      index -= 1;
      if (
        values.git_common_dir &&
        values.project_relative_path !== undefined &&
        ['personal', 'specs-shared', 'team'].includes(values.adoption_mode ?? '')
      ) {
        config.projects[key] = {
          git_common_dir: values.git_common_dir,
          project_relative_path: values.project_relative_path,
          adoption_mode: values.adoption_mode as InstallProjectProfile['adoption_mode'],
          ...(values.specs_visibility === 'local' || values.specs_visibility === 'shared'
            ? { specs_visibility: values.specs_visibility }
            : {}),
        };
      }
    }
  }
  return config;
}

function writeInstallConfig(config: InstallConfig, homeDir: string): void {
  const file = installConfigPath(homeDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, serializeInstallConfig(config), 'utf8');
  fs.renameSync(temporary, file);
}

function shouldUseInteractiveInstall({
  stdinIsTTY,
  stdoutIsTTY,
  ci,
  plan,
  quiet,
  nonInteractive,
  machine,
}: InteractiveInstallInput): boolean {
  return Boolean(
    stdinIsTTY && stdoutIsTTY && !ci && !plan && !quiet && !nonInteractive && !machine,
  );
}

export type {
  FailureClass,
  InstallationKind,
  InstallationState,
  InstallConfig,
  InstallIntentState,
  InstallProjectProfile,
  ProvenanceVersionRelation,
  ReconciliationState,
  UserTargetId,
};
export {
  AGENT_TO_TARGETS,
  classifyInstallationState,
  classifyInstallIntent,
  classifyProvenanceVersion,
  DEFAULT_USER_TARGETS,
  defaultInstallConfig,
  installConfigPath,
  parseTargetSelection,
  readInstallConfig,
  repositoryKey,
  schemaGenerationFor,
  serializeInstallConfig,
  shouldUseInteractiveInstall,
  USER_TARGETS,
  writeInstallConfig,
};
