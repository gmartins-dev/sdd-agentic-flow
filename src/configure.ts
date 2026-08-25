import os from 'node:os';
import {
  type AdoptionMode,
  adoptionModeForScope,
  applyAdoption,
  inspectAdoption,
} from './adoption';
import {
  DEFAULT_USER_TARGETS,
  defaultInstallConfig,
  type InstallConfig,
  type InstallProjectProfile,
  readInstallConfig,
  repositoryKey,
  writeInstallConfig,
} from './install-domain';

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
  adoptionMode?: AdoptionMode | undefined;
  plan?: boolean;
};

type ConfigureIntentResult = {
  before: InstallConfig['user'] | InstallProjectProfile;
  after: InstallConfig['user'] | InstallProjectProfile;
  wrote: boolean;
  adoptionMode?: AdoptionMode;
};

function applyProjectSharing(cwd: string, sharing: string): SharingResult {
  const result = applyAdoption(cwd, sharing === 'local' ? 'personal' : 'team', os.homedir());
  return { changed: result.changed, ...(result.warning ? { warning: result.warning } : {}) };
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
    profile: config.projects[key] || { root: cwd, packs: [] },
  };
}

function configureIntent({
  homeDir,
  cwd,
  scope = 'user',
  packs,
  targets,
  adoptionMode,
  plan = false,
}: ConfigureIntentInput): ConfigureIntentResult {
  if (adoptionMode && adoptionModeForScope(adoptionMode) !== scope)
    throw new Error(
      `adoption mode ${adoptionMode} requires scope ${adoptionModeForScope(adoptionMode)}`,
    );
  const config = readInstallConfig(homeDir) || defaultInstallConfig();
  const resolved = resolveProfile(config, { scope, cwd });
  const projectKey = repositoryKey(cwd);
  if (adoptionMode) {
    const inspection = inspectAdoption(cwd, homeDir);
    if (inspection.specsRoot === '(invalid)')
      throw new Error(inspection.warning || 'invalid specs.root');
  }
  if (resolved.kind === 'user') {
    const next: InstallConfig['user'] = { ...resolved.profile };
    if (packs?.length) next.packs = [...new Set(packs)];
    if (targets?.length) next.targets = [...new Set(targets)];
    if (!next.targets.length) next.targets = [...DEFAULT_USER_TARGETS];
    if (!plan) {
      config.user = next;
      if (adoptionMode) {
        config.projects[projectKey] = {
          ...(config.projects[projectKey] || { packs: [] }),
          root: cwd,
          packs: adoptionMode === 'team' ? config.projects[projectKey]?.packs || [] : [],
          adoption_mode: adoptionMode,
        };
        applyAdoption(cwd, adoptionMode, homeDir);
      }
      writeInstallConfig(config, homeDir);
    }
    return {
      before: resolved.profile,
      after: next,
      wrote: !plan,
      ...(adoptionMode ? { adoptionMode } : {}),
    };
  }
  const next: InstallProjectProfile = { ...resolved.profile };
  if (packs?.length) next.packs = [...new Set(packs)];
  next.root = cwd;
  if (adoptionMode) next.adoption_mode = adoptionMode;
  if (!plan) {
    config.projects[resolved.key] = next;
    writeInstallConfig(config, homeDir);
    if (adoptionMode) applyAdoption(cwd, adoptionMode, homeDir);
  }
  return {
    before: resolved.profile,
    after: next,
    wrote: !plan,
    ...(adoptionMode ? { adoptionMode } : {}),
  };
}

export type { ConfigureIntentInput, ConfigureIntentResult, SharingResult };
export { applyProjectSharing, configureIntent };
