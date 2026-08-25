import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_USER_TARGETS,
  defaultInstallConfig,
  type InstallConfig,
  type InstallProjectProfile,
  readInstallConfig,
  repositoryKey,
  writeInstallConfig,
} from './install-domain';
import { gitInfoExcludePath } from './paths';

const EXCLUDE_BLOCK = '# sdd-agentic-flow project-local skills\n.agents/skills/\n';

type SharingResult = {
  changed: boolean;
  warning?: string;
};

type ResolvedUserProfile = { kind: 'user'; profile: InstallConfig['user'] };
type ResolvedProjectProfile = { kind: 'project'; key: string; profile: InstallProjectProfile };
type ResolvedProfile = ResolvedUserProfile | ResolvedProjectProfile;

type ConfigureIntentInput = {
  homeDir: string;
  cwd: string;
  scope?: 'user' | 'project';
  packs?: string[];
  targets?: string[];
  sharing?: string | undefined;
  plan?: boolean;
};

type ConfigureIntentResult = {
  before: InstallConfig['user'] | InstallProjectProfile;
  after: InstallConfig['user'] | InstallProjectProfile;
  wrote: boolean;
};

function applyProjectSharing(cwd: string, sharing: string): SharingResult {
  const exclude = gitInfoExcludePath(cwd);
  if (!exclude) return { changed: false, warning: 'Git directory unavailable' };
  const current = fs.existsSync(exclude) ? fs.readFileSync(exclude, 'utf8') : '';
  const next =
    sharing === 'local'
      ? current.includes(EXCLUDE_BLOCK)
        ? current
        : `${current}${current && !current.endsWith('\n') ? '\n' : ''}${EXCLUDE_BLOCK}`
      : current.replace(EXCLUDE_BLOCK, '');
  if (next !== current) {
    fs.mkdirSync(path.dirname(exclude), { recursive: true });
    fs.writeFileSync(exclude, next, 'utf8');
  }
  return { changed: next !== current };
}

function resolveProfile(
  config: InstallConfig,
  { scope = 'user', cwd }: { scope?: 'user' | 'project'; cwd: string },
): ResolvedProfile {
  if (scope === 'user') return { kind: 'user', profile: config.user };
  const key = repositoryKey(cwd);
  return {
    kind: 'project',
    key,
    profile: config.projects[key] || { root: cwd, packs: [], sharing: 'shared' },
  };
}

function configureIntent({
  homeDir,
  cwd,
  scope = 'user',
  packs,
  targets,
  sharing,
  plan = false,
}: ConfigureIntentInput): ConfigureIntentResult {
  const config = readInstallConfig(homeDir) || defaultInstallConfig();
  const resolved = resolveProfile(config, { scope, cwd });
  if (resolved.kind === 'user') {
    const next: InstallConfig['user'] = { ...resolved.profile };
    if (packs?.length) next.packs = [...new Set(packs)];
    if (targets?.length) next.targets = [...new Set(targets)];
    if (!next.targets.length) next.targets = [...DEFAULT_USER_TARGETS];
    if (!plan) {
      config.user = next;
      writeInstallConfig(config, homeDir);
    }
    return { before: resolved.profile, after: next, wrote: !plan };
  }
  const next: InstallProjectProfile = { ...resolved.profile };
  if (packs?.length) next.packs = [...new Set(packs)];
  next.root = cwd;
  next.sharing = sharing || next.sharing || 'shared';
  if (!plan) {
    config.projects[resolved.key] = next;
    writeInstallConfig(config, homeDir);
    if (sharing) applyProjectSharing(cwd, next.sharing);
  }
  return { before: resolved.profile, after: next, wrote: !plan };
}

export type { ConfigureIntentInput, ConfigureIntentResult, SharingResult };
export { applyProjectSharing, configureIntent };
