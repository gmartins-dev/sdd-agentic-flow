import { type AdoptionMode, applyAdoption } from './adoption';
import { resolveGitContext } from './git-context';
import {
  DEFAULT_USER_TARGETS,
  defaultInstallConfig,
  type InstallConfig,
  type InstallProjectProfile,
  readInstallConfig,
  repositoryKey,
  writeInstallConfig,
} from './install-domain';

type ResolvedProfile =
  | { kind: 'user'; profile: InstallConfig['user'] }
  | { kind: 'project'; key: string; profile: InstallProjectProfile | undefined };

type ConfigureIntentInput = {
  homeDir: string;
  cwd: string;
  scope: 'user' | 'project';
  targets?: string[];
  adoptionMode?: AdoptionMode;
  plan?: boolean;
  [key: string]: unknown;
};

type ConfigureIntentResult = {
  before: InstallConfig['user'] | InstallProjectProfile | null;
  after: InstallConfig['user'] | InstallProjectProfile;
  scope: 'user' | 'project';
  adoptionMode?: AdoptionMode;
  wrote: boolean;
};

function resolveProfile(
  config: InstallConfig,
  scope: 'user' | 'project',
  cwd: string,
): ResolvedProfile {
  if (scope === 'user') return { kind: 'user', profile: config.user };
  const key = repositoryKey(cwd);
  return { kind: 'project', key, profile: config.projects[key] };
}

function configureIntent({
  homeDir,
  cwd,
  scope,
  targets,
  adoptionMode,
  plan = false,
}: ConfigureIntentInput): ConfigureIntentResult {
  const git = adoptionMode || scope === 'project' ? resolveGitContext(cwd) : null;
  if (git && !git.ok) throw new Error(git.error);
  const config = readInstallConfig(homeDir) || defaultInstallConfig();
  const resolved = resolveProfile(config, scope, cwd);
  const before = resolved.profile ? structuredClone(resolved.profile) : null;
  if (resolved.kind === 'user') {
    const after = {
      targets: targets?.length
        ? [...new Set(targets)]
        : resolved.profile.targets.length
          ? resolved.profile.targets
          : [...DEFAULT_USER_TARGETS],
    };
    if (!plan) {
      config.user = after;
      if (adoptionMode) {
        config.projects[repositoryKey(cwd)] = {
          git_common_dir: git?.ok ? git.context.gitCommonDir : '',
          project_relative_path: git?.ok ? git.context.projectRelativePath : '.',
          adoption_mode: adoptionMode,
        };
      }
      writeInstallConfig(config, homeDir);
    }
    if (adoptionMode && !plan) applyAdoption(cwd, adoptionMode, homeDir);
    return { before, after, scope, ...(adoptionMode ? { adoptionMode } : {}), wrote: !plan };
  }
  const mode = adoptionMode || resolved.profile?.adoption_mode;
  if (!mode) throw new Error('project installation intent requires adoption_mode');
  const after: InstallProjectProfile = {
    git_common_dir: git?.ok ? git.context.gitCommonDir : resolved.profile?.git_common_dir || '',
    project_relative_path: git?.ok
      ? git.context.projectRelativePath
      : resolved.profile?.project_relative_path || '.',
    adoption_mode: mode,
  };
  if (!plan) {
    config.projects[resolved.key] = after;
    writeInstallConfig(config, homeDir);
    applyAdoption(cwd, mode, homeDir);
  }
  return { before, after, scope, adoptionMode: mode, wrote: !plan };
}

export type { ConfigureIntentResult };
export { configureIntent };
