import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import {
  type CleanUpgradeSession,
  inspectCleanUpgrade,
  prepareCleanUpgrade,
} from './clean-upgrade';
import { applyProjectSharing, type ConfigureIntentResult, configureIntent } from './configure';
import { languageReport, setDoctorInstallPlanResolver, setDoctorSmokeDeps } from './doctor';
import type { InstallConfig, InstallProjectProfile } from './install-domain';
import {
  AGENT_TO_TARGETS,
  classifyInstallIntent,
  DEFAULT_USER_TARGETS,
  defaultInstallConfig,
  parseTargetSelection,
  readInstallConfig,
  repositoryKey,
  writeInstallConfig,
} from './install-domain';
import {
  applyInstallPlan,
  buildInstallPlan,
  type InstallPlan,
  isPlanEmpty,
  type TargetReport,
  targetLabelFor,
  USER_TARGET_LABELS,
} from './install-preflight';
import { resolveLocale, t, translateText } from './messages';
import {
  KNOWN_AGENTS,
  PACKAGE_ROOT,
  PACKS_DIR,
  SDD_PATHS,
  USAGE_GUIDE_URL,
  userSkillsDirsForTargets,
  VERSION,
} from './paths';
import { type SelectionResult, select } from './selector';
import { init } from './setup';
import { OFFICIAL_SKILLS } from './skill-identity';
import {
  type DisplayMode,
  didYouMean,
  isRich,
  outputMode,
  renderStep,
  shortenPath,
  styleStatus,
} from './ui';
import { type PresetLike, writeInstallProvenance } from './upgrade';

type InstallCommandOptions = {
  mode?: DisplayMode | undefined;
  quiet?: boolean | undefined;
  ascii?: boolean | undefined;
  homeDir?: string | undefined;
  plan?: boolean | undefined;
  scope?: string | undefined;
  agent?: string | undefined;
  targets?: string[] | undefined;
  projectLocalExclude?: boolean | undefined;
  [key: string]: unknown;
};

type PlanForInstallProfileInput = {
  cwd: string;
  homeDir: string;
  scope: string;
  profile: Record<string, unknown>;
};

type ConfigureInteractiveResult =
  | ConfigureIntentResult
  | { cancelled: true; error?: never; after?: never }
  | { error: string; cancelled?: never; after?: never };

type SmokeInit = (
  cwd: string,
  options: { profile?: string; quiet?: boolean },
) => boolean | undefined;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string';
}

function localeFor(cwd: string, explicit?: string) {
  return resolveLocale({ explicit, configured: languageReport(cwd).profile });
}

function resolveMode(flags: InstallCommandOptions = {}): DisplayMode {
  return outputMode({ stdout: process.stdout, stdin: process.stdin }, process.env, {
    ascii:
      Boolean(flags.ascii) || process.argv.includes('--ascii') || process.env.SDD_ASCII === '1',
    quiet: Boolean(flags.quiet),
  });
}

function log(status: string, message: string, explicitLocale?: string) {
  const locale = explicitLocale || localeFor(process.cwd());
  process.stdout.write(
    `${styleStatus(status, process.stdout)} ${translateText(locale, message)}\n`,
  );
}

function fail(
  message: string,
  codeOrOptions: number | { code?: number; reason?: string | null; try?: string[] } = 1,
) {
  let code = 1;
  let reason = null;
  let tryLines: string[] = [];
  if (typeof codeOrOptions === 'number') code = codeOrOptions;
  else if (codeOrOptions && typeof codeOrOptions === 'object') {
    code = codeOrOptions.code ?? 1;
    reason = codeOrOptions.reason ?? null;
    tryLines = codeOrOptions.try ?? [];
  }
  let out = `${styleStatus('FAIL', process.stderr)} ${message}\n`;
  if (reason) out += `\nReason:\n  ${reason}\n`;
  if (tryLines.length) out += `\nTry:\n${tryLines.map((line: string) => `  ${line}`).join('\n')}\n`;
  process.stderr.write(out);
  process.exitCode = code;
  return false;
}

function didYouMeanTry(input: string, candidates: string[]) {
  const match = didYouMean(input, candidates);
  return match ? `Did you mean \`${match}\`?` : null;
}

function nextStep(line: string | string[], options: InstallCommandOptions = {}) {
  if (options.quiet) return;
  const mode = options.mode ?? resolveMode(options);
  if (mode === 'machine') return;
  const list = (Array.isArray(line) ? line : [line]).filter(Boolean);
  if (!list.length) return;
  const locale = localeFor(process.cwd());
  process.stdout.write(
    `\n${t(locale, 'init.next')}\n${list.map((entry: string) => `  ${entry}`).join('\n')}\n`,
  );
}

function logPassLine(message: string, options: InstallCommandOptions = {}) {
  const mode = options.mode ?? resolveMode(options);
  if (isRich(mode)) {
    process.stdout.write(`│\n`);
    process.stdout.write(`${styleStatus('PASS', process.stdout)} ${message}\n`);
    return;
  }
  log('PASS', message);
}

function printUsageGuidePointer(cwd: string) {
  const localExists = fs.existsSync(path.join(cwd, SDD_PATHS.usage));
  if (localExists)
    return (
      `Skills usage guide (local stub, regenerable):\n  ${SDD_PATHS.usage}\n` +
      `Canonical guide:\n  ${USAGE_GUIDE_URL}\n`
    );
  return `Skills usage guide:\n  ${USAGE_GUIDE_URL}\n`;
}

function selectionString(result: SelectionResult): string | undefined {
  return typeof result.value === 'string' ? result.value : undefined;
}

function selectionStrings(result: SelectionResult): string[] {
  return Array.isArray(result.value)
    ? result.value.filter((value): value is string => typeof value === 'string')
    : typeof result.value === 'string'
      ? [result.value]
      : [];
}

function readPreset(name: string): PresetLike | null {
  const filename = path.join(PACKS_DIR, `${name}.json`);
  if (!fs.existsSync(filename)) return null;
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as PresetLike;
}

function presetNames(): string[] {
  return fs
    .readdirSync(PACKS_DIR)
    .filter((file: string) => file.endsWith('.json'))
    .map((file: string) => file.replace(/\.json$/, ''))
    .sort();
}

function list(): void {
  const packs = fs
    .readdirSync(PACKS_DIR)
    .filter((file: string) => file.endsWith('.json'))
    .sort();
  for (const file of packs) {
    const preset = JSON.parse(fs.readFileSync(path.join(PACKS_DIR, file), 'utf8'));
    log(
      'PACK',
      `${preset.name} (${preset.status}) — ${preset.skills.join(', ') || 'shared guidance only'}`,
    );
  }
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
  return 'root' in profile || 'sharing' in profile;
}

function planForInstallProfile({
  cwd,
  homeDir,
  scope,
  profile,
}: PlanForInstallProfileInput): InstallPlan {
  const profileData = profile as { packs?: string[]; targets?: string[] };
  const desiredPacks = profileData.packs || [];
  const desiredSkills = [
    ...new Set(desiredPacks.flatMap((name: string) => readPreset(name)?.skills || [])),
  ];
  const targetIds =
    scope === 'project'
      ? ['project-agents']
      : profileData.targets?.length
        ? profileData.targets
        : [...DEFAULT_USER_TARGETS];
  return buildInstallPlan({
    packageRoot: PACKAGE_ROOT,
    preset: { ...readPreset('full'), skills: desiredSkills },
    targets:
      scope === 'project'
        ? [path.join(cwd, '.agents', 'skills')]
        : userSkillsDirsForTargets(targetIds, homeDir),
    officialSkills: OFFICIAL_SKILLS,
    scope: scope as 'user' | 'project',
    modeLabel: scope === 'project' ? 'Project / Team' : 'Local / User',
    desiredPacks,
    targetIds,
  });
}

function installApplyCommand(plan: InstallPlan) {
  return `sdd-agentic-flow install ${plan.desiredPacks[0] || 'full'} --scope ${plan.scope}`;
}

function configureCommand(scope: string, profile: InstallConfig['user'] | InstallProjectProfile) {
  const parts = ['sdd-agentic-flow config', 'installation', '--scope', scope];
  for (const pack of profile.packs || []) parts.push('--pack', pack);
  if (scope === 'user' && isUserInstallProfile(profile)) {
    for (const target of profile.targets || DEFAULT_USER_TARGETS) parts.push('--target', target);
  } else if (isProjectInstallProfile(profile)) {
    parts.push('--sharing', profile.sharing || 'shared');
  }
  return parts.join(' ');
}

function printInstallPlanReport(
  plan: InstallPlan,
  _mode: DisplayMode | undefined,
  cwd: string,
  { applyCommand }: { applyCommand?: string } = {},
) {
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
      skills: [
        ...new Set(plan.desiredPacks.flatMap((name: string) => readPreset(name)?.skills || [])),
      ].length,
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
      'Partial skill tree detected — re-run install full or upgrade --skills-only to repair',
    );
  }
  if (plan.totals.BLOCKED) {
    log('WARN', 'BLOCKED — legacy installation detected (< 3.0). Remove it, then reinstall.');
  }
  if (isPlanEmpty(plan)) log('PASS', 'Already up to date.');
}

function printInstallNextSteps(cwd: string, options: InstallCommandOptions = {}) {
  const mode = options.mode ?? resolveMode(options);
  nextStep('npx sdd-agentic-flow doctor', {
    quiet: options.quiet,
    mode,
    ascii: Boolean(options.ascii),
  });
  if (options.quiet) return;
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

function install(pack: string, cwd: string, options: InstallCommandOptions = {}) {
  const mode = resolveMode({ quiet: options.quiet, ascii: Boolean(options.ascii) });
  const preset = readPreset(pack);
  if (!preset) {
    const hint = didYouMeanTry(pack, presetNames());
    return fail(`unknown pack: ${pack}.`, {
      reason: `Pack \`${pack}\` does not exist.`,
      try: ['sdd-agentic-flow list', ...(hint ? [hint] : [])],
    });
  }
  const homeDir = options.homeDir || os.homedir();
  const intentState = classifyInstallIntent(homeDir);
  if (intentState.kind === 'future' || intentState.kind === 'unknown') {
    return fail('unsupported installation state; clean upgrade stopped before writes', {
      reason: `The installation intent schema is ${intentState.schema}. This CLI only understands saf-install-intent/v2.`,
      try: [
        'sdd-agentic-flow install full --plan',
        'Use the latest SAF CLI to manage this installation',
      ],
    });
  }
  const installConfig =
    intentState.kind === 'current'
      ? readInstallConfig(homeDir) || defaultInstallConfig()
      : defaultInstallConfig();
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
  if (options.agent && !KNOWN_AGENTS.includes(asString(options.agent))) {
    const agentName = asString(options.agent);
    const hint = didYouMeanTry(agentName, KNOWN_AGENTS);
    return fail(`unknown agent: ${agentName}.`, {
      reason: `Supported agents: ${KNOWN_AGENTS.join(', ')}.`,
      try: hint ? [hint] : [`sdd-agentic-flow install ${pack} --target agents`],
    });
  }
  if (options.targets && options.targets.length === 0) {
    return fail('at least one installation target is required', {
      reason: 'Select one or more user-scope targets.',
      try: ['sdd-agentic-flow install full --interactive'],
    });
  }

  const profile = scope === 'project' ? storedProject : installConfig.user;
  const configuredPacks = profile?.packs || [];
  const unsupportedPack = configuredPacks.find((name) => !readPreset(name));
  if (unsupportedPack) {
    return fail('unsupported installation intent; clean upgrade stopped before writes', {
      reason: `The current intent references removed pack \`${unsupportedPack}\`. Reinitialize the v6 installation before installing another pack.`,
      try: ['sdd-agentic-flow init', 'sdd-agentic-flow install full --plan'],
    });
  }
  const desiredPacks = [...new Set([...(profile?.packs || []), pack])];
  const desiredSkills = [
    ...new Set(desiredPacks.flatMap((name: string) => readPreset(name)?.skills || [])),
  ];
  const effectivePreset = { ...preset, skills: desiredSkills };
  let targets: string[] = [];
  let selectedTargetIds: string[] = [...DEFAULT_USER_TARGETS];
  if (scope === 'project') {
    targets = [path.join(cwd, '.agents', 'skills')];
  } else {
    const userProfile = installConfig.user;
    const configuredTargets = userProfile.targets?.length
      ? userProfile.targets
      : [...DEFAULT_USER_TARGETS];
    const agentName = asString(options.agent);
    const selectedTargets =
      agentName && Object.hasOwn(AGENT_TO_TARGETS, agentName)
        ? [...AGENT_TO_TARGETS[agentName as keyof typeof AGENT_TO_TARGETS]]
        : options.targets?.length
          ? options.targets
          : configuredTargets;
    selectedTargetIds = selectedTargets;
    targets = userSkillsDirsForTargets(selectedTargets, homeDir);
  }

  const cleanupInspection = inspectCleanUpgrade({ cwd, homeDir, targetRoots: targets });
  if (cleanupInspection.state === 'future' || cleanupInspection.state === 'unknown') {
    return fail('clean upgrade blocked before writes', {
      reason: cleanupInspection.blockedReason || 'unknown installation ownership state',
      try: ['sdd-agentic-flow install full --plan'],
    });
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
        : asString(options.agent) && Object.hasOwn(AGENT_TO_TARGETS, asString(options.agent))
          ? [...AGENT_TO_TARGETS[asString(options.agent) as keyof typeof AGENT_TO_TARGETS]]
          : selectedTargetIds,
  });

  if (options.plan) {
    printInstallPlanReport(plan, mode, cwd);
    if (cleanupInspection.state === 'legacy')
      log('INFO', 'A recognized older SAF installation will be replaced after confirmation.');
    return true;
  }

  if (plan.blocked) {
    const legacy =
      plan.targets.some((target: TargetReport) => target.legacy) &&
      cleanupInspection.state !== 'legacy';
    return fail(
      legacy
        ? 'install blocked: legacy installation detected'
        : 'install blocked: foreign skill collision detected',
      {
        reason: legacy
          ? 'The previous installation could not be proven as SAF-managed. Remove it explicitly, then reinstall.'
          : 'Existing same-name skills are not managed by sdd-agentic-flow.',
        try: [
          'sdd-agentic-flow install full --plan',
          'sdd-agentic-flow upgrade --skills-only',
          'Remove or rename conflicting directories manually, then retry',
        ],
      },
    );
  }

  if (isPlanEmpty(plan) && cleanupInspection.state !== 'legacy') {
    if (scope === 'project') {
      installConfig.projects[projectKey] = {
        root: cwd,
        packs: desiredPacks,
        sharing: storedProject?.sharing || 'shared',
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
    } catch (error: unknown) {
      if (!isNodeError(error) || (error.code !== 'EACCES' && error.code !== 'EROFS')) throw error;
      log('WARN', 'installation is current but user-local intent could not be saved');
    }
    logPassLine(`Already up to date; ${plan.totals.PRESERVE} managed files preserved.`, {
      mode,
      quiet: options.quiet,
    });
    return true;
  }

  let cleanUpgrade: CleanUpgradeSession | null = null;
  const totals = { installed: 0, updated: 0, preserved: 0, removed: 0 };
  try {
    if (cleanupInspection.state === 'legacy') {
      cleanUpgrade = prepareCleanUpgrade(cleanupInspection);
      if (cleanupInspection.legacyConfig) init(cwd, { quiet: true });
    }
    for (const targetRoot of targets) {
      writeInstallProvenance(targetRoot, {
        packageVersion: VERSION,
        scope,
        target: scope === 'project' ? 'project-agents' : targetLabelFor(targetRoot),
        packs: desiredPacks,
        managedSkills: desiredSkills,
        managedPaths: desiredSkills,
        applyState: 'applying',
      });
      const result = applyInstallPlan(PACKAGE_ROOT, effectivePreset, targetRoot, {
        officialSkills: OFFICIAL_SKILLS,
      });
      if (result.blocked) {
        cleanUpgrade?.rollback();
        cleanUpgrade = null;
        return fail('install blocked: foreign skill collision detected', {
          reason: `Collision at ${targetRoot}`,
          try: ['sdd-agentic-flow install full --plan'],
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
        managedPaths: desiredSkills,
        applyState: 'complete',
      });
    }

    const projectSharing = options.projectLocalExclude
      ? 'local'
      : scope === 'project'
        ? storedProject?.sharing || 'shared'
        : 'shared';
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
      } catch (error: unknown) {
        if (!isNodeError(error) || (error.code !== 'EACCES' && error.code !== 'EROFS')) throw error;
        log('WARN', 'installation completed but user-local intent could not be saved');
      }
    }

    cleanUpgrade?.commit();

    const locale = localeFor(cwd);
    let installationMessage =
      scope === 'project'
        ? t(locale, 'install.installed', { pack, files: totals.installed })
        : t(locale, 'install.installedUser', {
            pack,
            targets: targets.length,
            files: totals.installed,
          });
    if (totals.updated)
      installationMessage += `, ${t(locale, 'install.updated')} ${totals.updated}`;
    if (totals.removed)
      installationMessage += `, ${t(locale, 'install.removed')} ${totals.removed}`;
    logPassLine(installationMessage, { mode, quiet: options.quiet });
    if (totals.preserved) log('WARN', t(locale, 'install.preserved', { files: totals.preserved }));
    if (scope === 'user')
      logPassLine(t(locale, 'install.repositoryNone'), { mode, quiet: options.quiet });
    if (!options.quiet) printInstallNextSteps(cwd, { ...options, mode });
    return true;
  } catch (error) {
    cleanUpgrade?.rollback();
    throw error;
  }
}

async function installInteractive(pack: string, cwd: string, options: InstallCommandOptions = {}) {
  const mode = resolveMode({ quiet: options.quiet, ascii: Boolean(options.ascii) });
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
    { ascii: Boolean(options.ascii) },
  );
  if (model.cancelled) return log('INFO', t(locale, 'install.cancelled'));
  const scope = selectionString(model);
  if (!scope) return log('INFO', t(locale, 'install.cancelled'));
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
      { ascii: Boolean(options.ascii) },
    );
    if (sharing.cancelled) return log('INFO', t(locale, 'install.cancelled'));
    projectLocalExclude = selectionString(sharing) === 'local';
  }
  let selectedTargets: string[] | undefined;
  if (scope === 'user') {
    const targets = await select(
      t(locale, 'install.targets'),
      Object.entries(USER_TARGET_LABELS).map(([id, label]) => ({
        value: id,
        label,
        selected: (DEFAULT_USER_TARGETS as readonly string[]).includes(id),
      })),
      { multiple: true, ascii: Boolean(options.ascii) },
    );
    if (targets.cancelled) return log('INFO', t(locale, 'install.cancelled'));
    selectedTargets = selectionStrings(targets);
    if (!selectedTargets.length) return fail('at least one installation target is required');
  }
  process.stdout.write(
    `\n${renderStep(3, 4, t(locale, 'install.preflight'), mode, t(locale, 'step')).join('\n')}\n`,
  );
  install(pack, cwd, {
    ...options,
    scope,
    plan: true,
    ...(selectedTargets ? { targets: selectedTargets } : {}),
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
    { ascii: Boolean(options.ascii) },
  );
  if (confirmation.cancelled || confirmation.value !== 'apply') {
    log('INFO', t(locale, 'install.cancelled'));
    return;
  }
  install(pack, cwd, {
    ...options,
    scope,
    ...(selectedTargets ? { targets: selectedTargets } : {}),
    projectLocalExclude,
  });
}

async function configureInteractive(
  cwd: string,
  homeDir: string,
): Promise<ConfigureInteractiveResult> {
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
      ? (selectionString(scopeChoice) ?? 'user')
      : await rl?.question('Installation model [Local / User]: ');
    const scope: 'user' | 'project' = /project/i.test(scopeAnswer.trim()) ? 'project' : 'user';
    const existing = readInstallConfig(homeDir) || defaultInstallConfig();
    const profile =
      scope === 'project'
        ? existing.projects[repositoryKey(cwd)] || { packs: [], sharing: 'shared' }
        : existing.user;
    const packsAnswer = await rl.question(
      `Packs [${(profile.packs || []).join(', ') || 'full'}]: `,
    );
    const packs = (packsAnswer || profile.packs.join(', ') || 'full')
      .split(',')
      .map((value: string) => value.trim())
      .filter(Boolean);
    let targets: string[] = [];
    let sharing: string | null = null;
    if (scope === 'user') {
      for (const [id, label] of Object.entries(USER_TARGET_LABELS))
        process.stdout.write(`  ${id} — ${label}\n`);
      const targetsAnswer = await rl.question(
        `Targets [${(isUserInstallProfile(profile) ? profile.targets || DEFAULT_USER_TARGETS : DEFAULT_USER_TARGETS).join(', ')}]: `,
      );
      const profileTargets = isUserInstallProfile(profile)
        ? profile.targets || DEFAULT_USER_TARGETS
        : DEFAULT_USER_TARGETS;
      const parsed = parseTargetSelection(targetsAnswer, profileTargets);
      if (!parsed.ok) return { error: parsed.message ?? 'invalid targets' };
      targets = parsed.targets;
    } else {
      const sharingAnswer = await rl.question(
        `Project sharing [${isProjectInstallProfile(profile) ? profile.sharing || 'shared' : 'shared'}]: `,
      );
      sharing = /local/i.test(sharingAnswer)
        ? 'local'
        : isProjectInstallProfile(profile)
          ? profile.sharing || 'shared'
          : 'shared';
    }
    process.stdout.write(`\n${t(locale, 'configure.review')}\n`);
    process.stdout.write(`  Scope: ${scope}\n  Packs: ${packs.join(', ')}\n`);
    process.stdout.write(
      scope === 'user' ? `  Targets: ${targets.join(', ')}\n` : `  Sharing: ${sharing}\n`,
    );
    process.stdout.write(`  ${t(locale, 'configure.savesIntent')}\n`);
    const save = await rl.question(t(locale, 'configure.save'));
    if (/^n(o)?$/i.test(save.trim())) return { cancelled: true };
    return configureIntent({
      homeDir,
      cwd,
      scope,
      packs,
      targets,
      ...(sharing ? { sharing } : {}),
    });
  } finally {
    if (rl) rl.close();
  }
}

function wireDoctorInstallSmokeDeps(init: SmokeInit): void {
  setDoctorInstallPlanResolver(planForInstallProfile);
  setDoctorSmokeDeps({ init, install });
}

export type { ConfigureInteractiveResult, PlanForInstallProfileInput };
export {
  configureCommand,
  configureInteractive,
  install,
  installApplyCommand,
  installInteractive,
  isConfigureCancelled,
  isConfigureError,
  isProjectInstallProfile,
  isUserInstallProfile,
  list,
  planForInstallProfile,
  presetNames,
  printInstallPlanReport,
  readPreset,
  wireDoctorInstallSmokeDeps,
};
