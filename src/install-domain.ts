import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
  root?: string;
  packs: string[];
  sharing: string;
};

type InstallConfig = {
  schema: string;
  user: {
    packs: string[];
    targets: string[];
  };
  projects: Record<string, InstallProjectProfile>;
};

type ParseTargetResult = { ok: true; targets: string[] } | { ok: false; message: string };

type InstallIntentState =
  | { kind: 'none'; schema: null }
  | { kind: 'current'; schema: 'saf-install-intent/v2' }
  | { kind: 'legacy'; schema: 'saf-install-intent/v1' }
  | { kind: 'future' | 'unknown'; schema: string };

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
  if (schema === 'saf-install-intent/v2') return { kind: 'current', schema };
  if (schema === 'saf-install-intent/v1') return { kind: 'legacy', schema };
  if (/^saf-install-intent\/v\d+$/.test(schema)) return { kind: 'future', schema };
  return { kind: 'unknown', schema: schema || '(missing)' };
}

function repositoryKey(root: string): string {
  return crypto.createHash('sha256').update(fs.realpathSync(root)).digest('hex').slice(0, 16);
}

function defaultInstallConfig(): InstallConfig {
  return { schema: 'saf-install-intent/v2', user: { packs: [], targets: [] }, projects: {} };
}

function yamlList(lines: string[], indent: number, values: string[]): void {
  for (const value of values) lines.push(`${' '.repeat(indent)}- ${value}`);
}

function serializeInstallConfig(config: InstallConfig): string {
  const lines = ['schema: saf-install-intent/v2', '', 'user:', '  packs:'];
  yamlList(lines, 4, config.user?.packs || []);
  lines.push('  targets:');
  yamlList(lines, 4, config.user?.targets || []);
  lines.push('', 'projects:');
  for (const [key, profile] of Object.entries(config.projects || {})) {
    lines.push(`  "${key}":`, `    root: "${profile.root}"`, '    packs:');
    yamlList(lines, 6, profile.packs || []);
    lines.push(`    sharing: ${profile.sharing || 'shared'}`);
  }
  return `${lines.join('\n')}\n`;
}

function parseList(
  lines: string[],
  start: number,
  indent: number,
): { values: string[]; index: number } {
  const values: string[] = [];
  let index = start;
  while (index < lines.length) {
    const current = lines[index];
    if (!current?.startsWith(`${' '.repeat(indent)}- `)) break;
    values.push(current.trim().slice(2));
    index += 1;
  }
  return { values, index };
}

function readInstallConfig(homeDir: string): InstallConfig | null {
  const file = installConfigPath(homeDir);
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  if (lines[0] !== 'schema: saf-install-intent/v2')
    throw new Error(
      'unsupported installation intent; reinstall the current skills to create saf-install-intent/v2',
    );
  const config = defaultInstallConfig();
  let section: 'user' | 'projects' | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line === 'user:') section = 'user';
    else if (line === 'projects:') section = 'projects';
    else if (section === 'user' && /^ {2}(packs|targets):$/.test(line)) {
      const key = line.trim().slice(0, -1) as 'packs' | 'targets';
      const parsed = parseList(lines, index + 1, 4);
      config.user[key] = parsed.values;
      index = parsed.index - 1;
    } else if (section === 'projects' && /^ {2}"[^"]+":$/.test(line)) {
      const key = line.trim().slice(1, -2);
      const profile: InstallProjectProfile = { packs: [], sharing: 'shared' };
      for (index += 1; index < lines.length && lines[index]?.startsWith('    '); index += 1) {
        const child = lines[index]?.trim() ?? '';
        if (!child) continue;
        if (child.startsWith('root: ')) profile.root = child.slice(6).replace(/^"|"$/g, '');
        else if (child === 'packs:') {
          const parsed = parseList(lines, index + 1, 6);
          profile.packs = parsed.values;
          index = parsed.index - 1;
        } else if (child.startsWith('sharing: ')) profile.sharing = child.slice(9);
      }
      config.projects[key] = profile;
      index -= 1;
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

type PresetLike = { skills?: string[] };

function desiredSkillsForPacks(
  packs: string[],
  packRegistry: Record<string, PresetLike>,
): string[] {
  return [...new Set(packs.flatMap((pack) => packRegistry[pack]?.skills || []))].sort();
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

export type { InstallConfig, InstallIntentState, InstallProjectProfile, UserTargetId };
export {
  AGENT_TO_TARGETS,
  classifyInstallIntent,
  DEFAULT_USER_TARGETS,
  defaultInstallConfig,
  desiredSkillsForPacks,
  installConfigPath,
  parseTargetSelection,
  readInstallConfig,
  repositoryKey,
  serializeInstallConfig,
  shouldUseInteractiveInstall,
  USER_TARGETS,
  writeInstallConfig,
};
