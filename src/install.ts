import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';

import { type AdoptionMode, adoptionModeForScope, applyAdoption, isAdoptionMode } from './adoption';
import { inspectCleanUpgrade, prepareCleanUpgrade } from './clean-upgrade';
import { renderCliCommand } from './cli-command';
import { type ConfigureIntentResult, configureIntent } from './configure';
import { setDoctorInstallPlanResolver, setDoctorSmokeDeps } from './doctor';
import { resolveGitContext } from './git-context';
import type { InstallConfig, InstallProjectProfile } from './install-domain';
import {
  classifyInstallIntent,
  DEFAULT_USER_TARGETS,
  defaultInstallConfig,
  readInstallConfig,
  writeInstallConfig,
} from './install-domain';
import { applyInstallPlan, buildInstallPlan, type InstallPlan } from './install-preflight';
import { PACKAGE_ROOT, userSkillsDirsForTargets, VERSION } from './paths';
import { OFFICIAL_SKILLS } from './skill-identity';
import type { DisplayMode } from './ui';
import { readInstallProvenance, writeInstallProvenance } from './upgrade';

type InstallCommandOptions = {
  mode?: DisplayMode | undefined;
  quiet?: boolean | undefined;
  ascii?: boolean | undefined;
  homeDir?: string | undefined;
  plan?: boolean | undefined;
  scope?: string | undefined;
  targets?: string[] | undefined;
  adoptionMode?: AdoptionMode | undefined;
  overwriteDiffers?: boolean | undefined;
  resolvedPlan?: InstallPlan | undefined;
  yes?: boolean | undefined;
  [key: string]: unknown;
};

type PlanForInstallProfileInput = {
  cwd: string;
  homeDir: string;
  scope: string;
  profile: InstallConfig['user'] | InstallProjectProfile;
};

type ConfigureInteractiveResult =
  | ConfigureIntentResult
  | { cancelled: true; error?: never; after?: never }
  | { error: string; cancelled?: never; after?: never };

type SmokeInit = (
  _cwd: string,
  options: { profile?: string; quiet?: boolean },
) => boolean | undefined;

function fail(message: string): false {
  process.stderr.write(`FAIL ${message}\n`);
  process.exitCode = 1;
  return false;
}

function isConfigureCancelled(result: ConfigureInteractiveResult): result is { cancelled: true } {
  return 'cancelled' in result && result.cancelled === true;
}

function isConfigureError(result: ConfigureInteractiveResult): result is { error: string } {
  return 'error' in result && typeof result.error === 'string';
}

function isUserInstallProfile(
  profile: InstallConfig['user'] | InstallProjectProfile,
): profile is InstallConfig['user'] {
  return 'targets' in profile;
}

function isProjectInstallProfile(
  profile: InstallConfig['user'] | InstallProjectProfile,
): profile is InstallProjectProfile {
  return 'adoption_mode' in profile;
}

function planForInstallProfile({
  cwd,
  homeDir,
  scope,
  profile,
}: PlanForInstallProfileInput): InstallPlan {
  const targetIds =
    scope === 'project'
      ? ['project-agents']
      : isUserInstallProfile(profile) && profile.targets.length
        ? profile.targets
        : [...DEFAULT_USER_TARGETS];
  return buildInstallPlan({
    packageRoot: PACKAGE_ROOT,
    skills: OFFICIAL_SKILLS,
    targets:
      scope === 'project'
        ? [path.join(cwd, '.agents', 'skills')]
        : userSkillsDirsForTargets(targetIds, homeDir),
    officialSkills: OFFICIAL_SKILLS,
    scope: scope === 'project' ? 'project' : 'user',
    modeLabel: scope === 'project' ? 'Project / Team' : 'Local / User',
    targetIds,
  });
}

function installApplyCommand(plan: InstallPlan): string {
  return renderCliCommand('install', '--scope', plan.scope);
}

function configureCommand(
  scope: string,
  profile: InstallConfig['user'] | InstallProjectProfile,
): string {
  const parts = [renderCliCommand('config', 'installation'), '--scope', scope];
  if (isUserInstallProfile(profile))
    for (const target of profile.targets) parts.push('--target', target);
  else parts.push('--adoption-mode', profile.adoption_mode);
  return parts.join(' ');
}

function printInstallPlanReport(
  plan: InstallPlan,
  _mode: DisplayMode | undefined,
  _cwd: string,
  { applyCommand }: { applyCommand?: string } = {},
): void {
  const lines = [
    'Installation plan',
    '',
    `Scope: ${plan.requestedScope || plan.scope} (${plan.modeLabel})`,
    `Targets: ${plan.targetIds.join(', ') || '(unresolved)'}`,
    `Official skills: ${OFFICIAL_SKILLS.length} + shared layer`,
    '',
    `Create: ${plan.totals.CREATE}`,
    `Update: ${plan.totals.UPDATE}`,
    `Remove: ${plan.totals.REMOVE}`,
    `Preserve: ${plan.totals.PRESERVE}`,
    `Collisions: ${plan.totals.COLLISION}`,
  ];
  for (const target of plan.targets) lines.push(`Target: ${target.targetRoot}`);
  if (plan.applicability === 'blocked')
    lines.push('', `Blocked: ${plan.blockerReason || 'unsafe installation state'}`);
  else lines.push('', `Apply: ${applyCommand || installApplyCommand(plan)}`);
  lines.push('', 'No changes were made.');
  process.stdout.write(`${lines.join('\n')}\n`);
}

function blockedPlan(schema: string): InstallPlan {
  const totals = {
    CREATE: 0,
    UPDATE: 0,
    PRESERVE: 0,
    REMOVE: 0,
    COLLISION: 0,
    MANAGED_MODIFIED: 0,
    PARTIAL: 0,
    BLOCKED: 1,
  };
  return {
    modeLabel: 'Persisted installation not interpreted',
    scope: 'user',
    requestedScope: 'unresolved',
    targetIds: [],
    targets: [],
    totals,
    blocked: true,
    applicability: 'blocked',
    blockerReason: `Installation state ${schema} requires a clean v7 reinstall.`,
    repositoryChanges: [],
  };
}

function install(cwd: string, options: InstallCommandOptions = {}): boolean {
  const homeDir = options.homeDir || os.homedir();
  const historicalRoots = [
    path.join(cwd, '.agents', 'skills'),
    ...userSkillsDirsForTargets(['agents', 'cursor', 'claude', 'copilot'], homeDir),
  ];
  const reset = inspectCleanUpgrade({ cwd, homeDir, targetRoots: historicalRoots });
  if (reset.state === 'future' || reset.state === 'unknown') {
    if (options.plan) {
      printInstallPlanReport(
        blockedPlan(reset.blockedReason || 'future or unknown installation state is preserved'),
        options.mode,
        cwd,
      );
      return false;
    }
    return fail(reset.blockedReason || 'future or unknown installation state is preserved');
  }
  if (reset.state === 'legacy') {
    const resetPaths = [
      ...reset.legacyTargets.flatMap((target) => [
        ...target.managedSkills.map((skill) => path.join(target.root, skill)),
        ...(target.shared ? [path.join(target.root, 'sdd-agentic-flow-shared')] : []),
      ]),
      ...(reset.legacyIntent && reset.intentPath ? [reset.intentPath] : []),
      ...reset.projectFiles,
    ];
    process.stdout.write(
      `Pre-v7 reset plan\n${resetPaths.map((file) => `Remove: ${file}`).join('\n')}\n`,
    );
    if (options.plan) return false;
    if (!options.yes) return fail('pre-v7 reset requires explicit confirmation with --yes');
    prepareCleanUpgrade(reset).commit();
  }
  const intentState = classifyInstallIntent(homeDir);
  if (intentState.kind !== 'none' && intentState.kind !== 'current') {
    if (options.plan) {
      printInstallPlanReport(blockedPlan(intentState.schema), options.mode, cwd);
      return false;
    }
    return fail(`installation state ${intentState.schema} requires a clean v7 reinstall`);
  }
  const config =
    intentState.kind === 'current'
      ? readInstallConfig(homeDir) || defaultInstallConfig()
      : defaultInstallConfig();
  if (options.adoptionMode && !isAdoptionMode(options.adoptionMode))
    return fail('unknown adoption mode: use personal, specs-shared, or team');
  const git = resolveGitContext(cwd);
  const storedProject = git.ok ? config.projects[git.context.adoptionKey] : undefined;
  const adoptionMode = options.adoptionMode || storedProject?.adoption_mode;
  const scope =
    options.scope ||
    (adoptionMode ? adoptionModeForScope(adoptionMode) : storedProject ? 'project' : 'user');
  if (scope !== 'user' && scope !== 'project')
    return fail('unknown scope: use --scope user or --scope project');
  if (adoptionMode && adoptionModeForScope(adoptionMode) !== scope)
    return fail(
      `adoption mode ${adoptionMode} requires --scope ${adoptionModeForScope(adoptionMode)}`,
    );
  if ((scope === 'project' || adoptionMode) && !git.ok) return fail(git.error);
  const targets =
    scope === 'project'
      ? [path.join(cwd, '.agents', 'skills')]
      : options.targets?.length
        ? options.targets
        : config.user.targets.length
          ? config.user.targets
          : [...DEFAULT_USER_TARGETS];
  if (
    scope === 'user' &&
    targets.some((target) => !['agents', 'cursor', 'claude', 'copilot'].includes(target))
  )
    return fail('unknown installation target');

  const profile =
    scope === 'user'
      ? { targets }
      : storedProject || {
          git_common_dir: git.ok ? git.context.gitCommonDir : '',
          project_relative_path: git.ok ? git.context.projectRelativePath : '.',
          adoption_mode: adoptionMode || 'team',
        };
  const plan = options.resolvedPlan || planForInstallProfile({ cwd, homeDir, scope, profile });
  if (options.plan) {
    printInstallPlanReport(plan, options.mode, cwd);
    return plan.applicability === 'applicable';
  }
  if (plan.blocked) return fail(plan.blockerReason || 'installation is blocked');
  if (plan.totals.MANAGED_MODIFIED && !options.overwriteDiffers)
    return fail(
      'managed assets differ; inspect install --plan and confirm overwrite interactively',
    );

  for (let index = 0; index < plan.targets.length; index += 1) {
    const target = plan.targets[index];
    if (!target) continue;
    const previous = readInstallProvenance(target.targetRoot);
    if (previous?.schema && previous.schema !== 'saf-install-provenance/v3')
      return fail(`provenance ${previous.schema} requires a clean v7 reinstall`);
    writeInstallProvenance(target.targetRoot, {
      packageVersion: VERSION,
      scope,
      target: plan.targetIds[index] || 'project-agents',
      managedSkills: [...OFFICIAL_SKILLS],
      managedPaths: target.pairs.map((pair) => pair.rel),
      applyState: 'applying',
    });
    const applied = applyInstallPlan(PACKAGE_ROOT, OFFICIAL_SKILLS, target.targetRoot, {
      officialSkills: OFFICIAL_SKILLS,
    });
    if (!applied.ok) return fail('installation apply failed');
    writeInstallProvenance(target.targetRoot, {
      packageVersion: VERSION,
      scope,
      target: plan.targetIds[index] || 'project-agents',
      managedSkills: [...OFFICIAL_SKILLS],
      managedPaths: target.pairs.map((pair) => pair.rel),
      applyState: 'complete',
    });
  }
  if (scope === 'user') config.user.targets = targets;
  else {
    const project = profile as InstallProjectProfile;
    if (!git.ok) return fail(git.error);
    config.projects[git.context.adoptionKey] = project;
  }
  writeInstallConfig(config, homeDir);
  if (adoptionMode) applyAdoption(cwd, adoptionMode, homeDir);
  if (!options.quiet)
    process.stdout.write(
      `PASS installed ${OFFICIAL_SKILLS.length} official skills + shared layer\n`,
    );
  return true;
}

async function installInteractive(
  cwd: string,
  options: InstallCommandOptions = {},
): Promise<boolean> {
  const preview = planForInstallProfile({
    cwd,
    homeDir: options.homeDir || os.homedir(),
    scope: options.scope || 'user',
    profile: {
      targets: options.targets?.length ? options.targets : [...DEFAULT_USER_TARGETS],
    },
  });
  printInstallPlanReport(preview, options.mode, cwd);
  if (preview.blocked) return false;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('Apply this installation? [y/N] ');
    if (!/^y(es)?$/i.test(answer.trim())) return false;
    return install(cwd, { ...options, overwriteDiffers: true });
  } finally {
    rl.close();
  }
}

async function configureInteractive(
  cwd: string,
  homeDir = os.homedir(),
  { persist = true }: { persist?: boolean } = {},
): Promise<ConfigureInteractiveResult> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('Adoption mode [personal/specs-shared/team]: ');
    const adoptionMode = answer.trim() as AdoptionMode;
    if (!isAdoptionMode(adoptionMode)) return { error: 'unknown adoption mode' };
    const scope = adoptionModeForScope(adoptionMode);
    return configureIntent({
      homeDir,
      cwd,
      scope,
      adoptionMode,
      ...(scope === 'user' ? { targets: [...DEFAULT_USER_TARGETS] } : {}),
      plan: !persist,
    });
  } finally {
    rl.close();
  }
}

async function changeInstallationInteractive(cwd: string, homeDir = os.homedir()) {
  const configured = await configureInteractive(cwd, homeDir);
  if (isConfigureCancelled(configured) || isConfigureError(configured)) return configured;
  const applied = await install(cwd, {
    homeDir,
    scope: configured.scope,
    ...(isUserInstallProfile(configured.after) ? { targets: configured.after.targets } : {}),
    ...(configured.adoptionMode ? { adoptionMode: configured.adoptionMode } : {}),
  });
  return applied ? { ...configured, wrote: true } : { error: 'installation apply failed' };
}

function wireDoctorInstallSmokeDeps(initFn: SmokeInit): void {
  setDoctorInstallPlanResolver(planForInstallProfile);
  setDoctorSmokeDeps({ init: initFn, install });
}

export type { ConfigureInteractiveResult, InstallCommandOptions, PlanForInstallProfileInput };
export {
  changeInstallationInteractive,
  configureCommand,
  configureInteractive,
  install,
  installApplyCommand,
  installInteractive,
  isConfigureCancelled,
  isConfigureError,
  isProjectInstallProfile,
  isUserInstallProfile,
  planForInstallProfile,
  printInstallPlanReport,
  wireDoctorInstallSmokeDeps,
};
