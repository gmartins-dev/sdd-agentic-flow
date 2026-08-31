import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { type AdoptionMode, adoptionModeForScope } from './adoption';
import { renderCliCommand } from './cli-command';
import { renderPolicySummary } from './config';
import {
  AUTONOMY_LEVELS,
  defaultOnboardingPolicy,
  EXECUTION_MODES,
  ONBOARDING_DEFAULT_PRESET,
  onboardingPresetOrder,
  policyDisplayTitle,
  readConfig,
  type SetupPolicyDraft,
  setupPolicyFromPair,
  setupPolicyFromPreset,
} from './config-domain';
import { doctor, languageReport } from './doctor';
import { resolveGitContext } from './git-context';
import { inferInitDefaults } from './init-defaults';
import {
  AGENT_TO_TARGETS,
  defaultInstallConfig,
  readInstallConfig,
  repositoryKey,
} from './install-domain';
import { resolveLocale, t, translateText } from './messages';
import {
  autonomyComboValid,
  gitInfoExcludePath,
  LANGUAGE_PROFILES,
  LOCAL_GIT_EXCLUDE_COMMENT,
  LOCAL_GIT_EXCLUDE_ENTRY,
  PACKAGE_ROOT,
  resolveOperatingPreset,
  SDD_PATHS,
  SDD_ROOT,
  sddJoin,
  USAGE_GUIDE_PT_BR_URL,
  USAGE_GUIDE_URL,
  VERSION,
} from './paths';
import { select } from './selector';
import {
  detectSetupHosts,
  resolveSetupPlan,
  type SetupIntent,
  type SetupPlan,
  setupPlanIsCurrent,
  setupPrecondition,
  targetsForHosts,
} from './setup-plan';
import { inspectSetupState, inspectUserInstallation, type SetupStateSnapshot } from './setup-state';
import { terminalLog, terminalNote } from './terminal-ui';
import {
  clearViewport,
  type DisplayMode,
  isRich,
  outputMode,
  renderStep,
  styleStatus,
  symbol,
  writeBrand,
} from './ui';
import {
  applyWorkspaceInitialization,
  planWorkspaceInitialization,
  type WorkspaceInitializationPlan,
} from './workspace';

type InitOptions = {
  profile?: string;
  language?: string;
  name?: string;
  branch?: string;
  agent?: string;
  source?: string;
  flow?: string;
  featureProfile?: string;
  multiWorktree?: boolean;
  stackedPrs?: boolean;
  executionMode?: string;
  autonomyLevel?: string;
  workspacePlan?: WorkspaceInitializationPlan;
};

type SetupDraft = {
  install?: boolean | undefined;
  scope?: string | undefined;
  targets?: string[] | undefined;
  adoptionMode?: AdoptionMode | undefined;
  specsVisibility?: 'local' | 'shared' | undefined;
  path?: string | undefined;
  projectLocalExclude?: boolean | undefined;
  saved?: Record<string, unknown> | null | undefined;
  policy?: SetupPolicyDraft | undefined;
  precondition?: string | undefined;
};

type InitInteractiveState = {
  language?: string;
  name?: string;
  branch?: string;
  agent?: string;
  featureProfile?: string;
  source?: string;
  flow?: string;
  multiWorktree?: boolean;
  stackedPrs?: boolean;
  executionMode?: string;
  autonomyLevel?: string;
  presetName?: string;
  presetAlias?: string;
};

type SetupCommandOptions = {
  mode?: DisplayMode | undefined;
  quiet?: boolean | undefined;
  ascii?: boolean | undefined;
  locale?: string | undefined;
  language?: string | undefined;
  featureProfile?: string | undefined;
  executionMode?: string | undefined;
  autonomyLevel?: string | undefined;
  presetName?: string | null | undefined;
  presetAlias?: string | null | undefined;
  policyFromCli?: boolean | undefined;
  localGitExclude?: boolean | undefined;
  showSummary?: boolean | undefined;
  [key: string]: unknown;
};

type NextStepOptions = SetupCommandOptions & {
  mode?: DisplayMode | undefined;
  quiet?: boolean | undefined;
};

type InstallFn = (cwd: string, options: SetupCommandOptions) => boolean | Promise<boolean>;

type SetupCommandDeps = {
  install: InstallFn;
  upgradeCommand: (cwd: string, options: SetupCommandOptions) => Promise<unknown>;
  runCommand: (command: string, args: string[], cwd: string) => Promise<unknown>;
  runInteractiveMenu: (cwd: string, options: SetupCommandOptions) => Promise<unknown>;
  changeInstallation: (cwd: string) => Promise<unknown>;
  purgeKnownSafState?: (
    cwd: string,
    homeDir: string,
    options?: { quiet?: boolean },
  ) => { ok: boolean; removed: string[]; remaining: string[] };
};

let commandDeps: SetupCommandDeps | null = null;

function setSetupCommandDeps(deps: SetupCommandDeps): void {
  commandDeps = deps;
}

function requireCommandDeps(): SetupCommandDeps {
  if (!commandDeps) {
    throw new Error('setup command dependencies are not configured');
  }
  return commandDeps;
}

function localeFor(cwd: string, explicit?: string) {
  return resolveLocale({ explicit, configured: languageReport(cwd).profile });
}

function resolveMode(flags: SetupCommandOptions = {}) {
  return outputMode({ stdout: process.stdout, stdin: process.stdin }, process.env, {
    ascii:
      Boolean(flags.ascii) || process.argv.includes('--ascii') || process.env.SDD_ASCII === '1',
    quiet: Boolean(flags.quiet),
    json: Boolean(flags.json),
  });
}

function log(status: string, message: string, explicitLocale?: string) {
  const locale = explicitLocale || localeFor(process.cwd());
  terminalLog(status, translateText(locale, message), { mode: resolveMode() });
}

function fail(message: string, codeOrOptions: number | { code?: number } = 1) {
  const code = typeof codeOrOptions === 'number' ? codeOrOptions : (codeOrOptions.code ?? 1);
  process.stderr.write(`${styleStatus('FAIL', process.stderr)} ${message}\n`);
  process.exitCode = code;
  return false;
}

function logPassLine(message: string, options: SetupCommandOptions = {}) {
  const mode = options.mode ?? resolveMode(options);
  if (isRich(mode)) {
    terminalLog('PASS', message, { mode });
    return;
  }
  log('PASS', message);
}

function nextStep(line: string | string[], options: NextStepOptions = {}) {
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

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function configFor(cwd: string, options: InitOptions & SetupCommandOptions = {}) {
  const inferred = inferInitDefaults(cwd);
  const profile = options.profile || options.language || 'en-US';
  const featureProfile = options.featureProfile
    ? `  feature_profile: ${options.featureProfile}\n`
    : '';
  return `schema: saf-config/v3

project:
  name: ${options.name || inferred.name}
  default_branch: ${options.branch || inferred.branch}

agent:
  target: ${options.agent || inferred.agent}

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
${featureProfile}  allow_multi_worktree: ${options.multiWorktree || false}
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

function usageGuideLinks(locale: string): string {
  if (locale === 'pt-BR') {
    return (
      `- [Guia completo](saf-skills-usage-guide.pt-BR.md) — referência local completa do fluxo.\n` +
      `- GitHub (canônico): \`${USAGE_GUIDE_PT_BR_URL}\`\n` +
      `- Outro idioma: [Full guide](saf-skills-usage-guide.md)`
    );
  }
  return (
    `- [Full guide](saf-skills-usage-guide.md) — complete local workflow reference.\n` +
    `- GitHub (canonical): \`${USAGE_GUIDE_URL}\`\n` +
    `- Other locale: [Guia completo](saf-skills-usage-guide.pt-BR.md)`
  );
}

function writeUsageGuide(cwd: string, locale: string) {
  const resolvedLocale = resolveLocale({ configured: locale });
  const templateName = resolvedLocale === 'pt-BR' ? 'usage.template.pt-BR.md' : 'usage.template.md';
  const templatePath = path.join(PACKAGE_ROOT, 'shared', 'templates', templateName);
  const mermaidPath = path.join(PACKAGE_ROOT, 'shared', 'templates', 'workflow-diagram.mmd');
  const mermaid = fs.readFileSync(mermaidPath, 'utf8').trim();
  const stub = fs
    .readFileSync(templatePath, 'utf8')
    .replace('{{WORKFLOW_DIAGRAM_SECTION}}', `\`\`\`mermaid\n${mermaid}\n\`\`\``)
    .replace('{{FULL_GUIDE_LINKS}}', usageGuideLinks(resolvedLocale));

  const destination = sddJoin(cwd, 'usage.md');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, stub, 'utf8');

  const activeGuide =
    resolvedLocale === 'pt-BR'
      ? ([
          [
            'saf-skills-usage-guide.pt-BR.md',
            path.join(PACKAGE_ROOT, 'docs', 'saf-skills-usage-guide.pt-BR.md'),
          ],
        ] as const)
      : ([
          [
            'saf-skills-usage-guide.md',
            path.join(PACKAGE_ROOT, 'docs', 'saf-skills-usage-guide.md'),
          ],
        ] as const);
  for (const [name, source] of activeGuide) {
    fs.copyFileSync(source, sddJoin(cwd, name));
  }

  log('PASS', `wrote ${SDD_PATHS.usage}`, locale);
  log('PASS', `wrote ${activeGuide[0][0]}`, locale);
}

function resolveLocalGitExclude(options: SetupCommandOptions = {}): boolean {
  return Boolean(options.localGitExclude);
}

function applyLocalGitExclude(cwd: string, locale: string) {
  const excludePath = gitInfoExcludePath(cwd);
  if (!excludePath) {
    log('WARN', 'init --local-git-exclude: no .git directory; skipped (Git is optional)', locale);
    return;
  }
  fs.mkdirSync(path.dirname(excludePath), { recursive: true });
  const existing = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
  const alreadyListed = existing.split(/\r?\n/).some((line: string) => {
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

function applyInitSideEffects(cwd: string, options: SetupCommandOptions = {}) {
  const locale = asString(options.locale, localeFor(cwd));
  writeUsageGuide(cwd, locale);
  if (resolveLocalGitExclude(options)) applyLocalGitExclude(cwd, locale);
}

function printUsageGuidePointer(cwd: string, locale = 'en-US') {
  const resolvedLocale = resolveLocale({ configured: locale });
  const localGuide = resolvedLocale === 'pt-BR' ? SDD_PATHS.usageGuidePtBr : SDD_PATHS.usageGuideEn;
  const localExists = fs.existsSync(path.join(cwd, SDD_PATHS.usage));
  if (localExists) {
    return (
      `Skills usage guide (local stub, regenerable):\n  ${SDD_PATHS.usage}\n` +
      `Full guide (local copy):\n  ${localGuide}\n` +
      `Canonical guide (GitHub):\n  ${USAGE_GUIDE_URL}\n`
    );
  }
  return `Skills usage guide:\n  ${USAGE_GUIDE_URL}\n`;
}

function init(cwd: string, options: InitOptions & SetupCommandOptions = {}) {
  const mode = resolveMode({ quiet: options.quiet, ascii: Boolean(options.ascii) });
  const homeDir = asString(options.homeDir, os.homedir());
  const plan = options.workspacePlan ?? planWorkspaceInitialization(cwd, homeDir);
  if (!plan.ok) return fail(plan.error || 'workspace initialization failed', 1);
  const applied = applyWorkspaceInitialization(plan, homeDir);
  if (!applied.ok) return fail(applied.error || 'workspace initialization failed', 1);
  logPassLine(`initialized ${plan.git?.projectRoot}`, { mode, quiet: options.quiet });
  if (!options.quiet) nextStep(renderCliCommand('doctor'), { quiet: options.quiet, mode });
  return true;
}

function validValue(value: string, allowed: readonly string[]) {
  return allowed.includes(value) ? value : null;
}

function onboardingStateFor(cwd: string) {
  const state = inspectSetupState(cwd).state;
  return state === 'Fresh'
    ? 'FIRST_USE'
    : state === 'Ready'
      ? 'READY'
      : state === 'Attention'
        ? 'NEEDS_ATTENTION'
        : state === 'Blocked'
          ? 'NEEDS_ATTENTION'
          : 'PARTIAL';
}

function savedSetupProfile(cwd: string, homeDir = os.homedir()): Record<string, unknown> | null {
  const saved = readInstallConfig(homeDir) || defaultInstallConfig();
  const project = saved.projects[repositoryKey(cwd)];
  if (project?.adoption_mode === 'team')
    return { scope: 'project', profile: project as Record<string, unknown> };
  if (project?.adoption_mode)
    return {
      scope: 'user',
      profile: { ...saved.user, adoption_mode: project.adoption_mode } as Record<string, unknown>,
    };
  if (saved.user.targets.length) return { scope: 'user', profile: saved.user };
  return null;
}

function printSetupStages(
  locale: string,
  active: string,
  complete: string[] = [],
  options: SetupCommandOptions = {},
) {
  const stages = ['project', 'skills', 'context', 'validation'];
  const rich = isRich(options.mode ?? resolveMode({ ascii: Boolean(options.ascii) }));
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

function resolvePolicyFromCommandOptions(options: SetupCommandOptions): SetupPolicyDraft | null {
  if (options.presetName) {
    return setupPolicyFromPreset(options.presetName);
  }
  if (options.policyFromCli && options.executionMode && options.autonomyLevel) {
    return setupPolicyFromPair(options.executionMode, options.autonomyLevel);
  }
  return null;
}

function policyReviewTitle(draft: SetupPolicyDraft, locale: string): string {
  if (draft.kind === 'custom' || !draft.presetName) {
    return t(locale, 'setup.policyCustom');
  }
  return policyDisplayTitle(draft);
}

function printPolicyLines(draft: SetupPolicyDraft, locale: string, indent = '  ') {
  process.stdout.write(
    `${indent}${t(locale, 'setup.policy')}        ${policyReviewTitle(draft, locale)}\n`,
  );
  process.stdout.write(`${indent}                ${policyReviewTitle(draft, locale)}\n`);
}

function policyFromConfig(
  config: ReturnType<typeof readConfig>,
  _locale: string,
): SetupPolicyDraft {
  const executionMode = config.policy?.executionMode ?? 'guided';
  const autonomyLevel = config.policy?.autonomyLevel ?? 'manual';
  return (
    setupPolicyFromPair(executionMode, autonomyLevel) ?? {
      kind: 'custom',
      presetName: null,
      executionMode: 'guided',
      autonomyLevel: 'manual',
    }
  );
}

function printCurrentSetup(cwd: string, locale: string, homeDir = os.homedir()) {
  const config = readConfig(sddJoin(cwd, 'config.yml'));
  const saved = savedSetupProfile(cwd, homeDir);
  const state = inspectSetupState(cwd, homeDir);
  const profile = saved?.profile;
  const adoption =
    profile && typeof profile === 'object' && 'adoption_mode' in profile
      ? String(profile.adoption_mode)
      : null;
  const targets =
    profile && typeof profile === 'object' && 'targets' in profile && Array.isArray(profile.targets)
      ? profile.targets
      : [];
  const targetLabels = (targets as string[]).map(
    (target) =>
      ({
        agents:
          locale === 'pt-BR' ? 'Skills compatíveis com agentes' : 'Shared agent-compatible skills',
        cursor: 'Cursor',
        claude: 'Claude Code',
        copilot: locale === 'pt-BR' ? 'GitHub Copilot' : 'GitHub Copilot',
      })[target] || target,
  );
  process.stdout.write(`\n${t(locale, 'setup.current')}\n\n`);
  process.stdout.write(`  ${locale === 'pt-BR' ? 'Status' : 'Status'}     ${state.state}\n`);
  if (adoption)
    process.stdout.write(
      `  ${locale === 'pt-BR' ? 'Compartilhamento' : 'Sharing'}  ${
        adoption === 'personal'
          ? locale === 'pt-BR'
            ? 'Apenas para mim'
            : 'Just for me'
          : adoption === 'team'
            ? (locale === 'pt-BR' ? 'Com a equipe' : 'With the team')
            : (locale === 'pt-BR' ? 'Specs compartilhadas' : 'Specs shared')
      }\n`,
    );
  if (targetLabels.length)
    process.stdout.write(
      `  ${locale === 'pt-BR' ? 'Agentes' : 'Agents'}     ${targetLabels.join(', ')}\n`,
    );
  if (config.ok) {
    const policy = policyFromConfig(config, locale);
    process.stdout.write(
      `  ${locale === 'pt-BR' ? 'Fluxo' : 'Workflow'}    ${policyReviewTitle(policy, locale)}\n`,
    );
    process.stdout.write(
      `  ${locale === 'pt-BR' ? 'Idioma' : 'Language'}    ${config.languageProfile === 'pt-BR' ? 'Português (Brasil)' : 'English'}\n`,
    );
  }
}

async function applySetup(
  cwd: string,
  draft: SetupDraft,
  options: SetupCommandOptions,
  locale: string,
  plan?: SetupPlan,
) {
  const { install } = requireCommandDeps();
  const homeDir = asString(options.homeDir, os.homedir());
  process.exitCode = undefined;
  if (plan && !setupPlanIsCurrent(cwd, plan, homeDir)) {
    log('WARN', 'setup changed after review; render a new plan before applying');
    return false;
  }
  if (!plan && draft.precondition && draft.precondition !== setupPrecondition(cwd, homeDir)) {
    log('WARN', 'setup changed after review; render a new plan before applying');
    return false;
  }
  const installRequested = plan ? plan.installRequired : Boolean(draft.install);
  if (installRequested && !plan && !(await preflightSetup(cwd, draft, options))) return false;
  if (installRequested && plan && plan.installationPlan.applicability !== 'applicable')
    return false;
  printSetupStages(locale, 'validation', ['project', 'skills', 'context'], options);
  process.stdout.write(`\n${t(locale, 'setup.apply')}\n`);
  const policy =
    draft.policy ?? resolvePolicyFromCommandOptions(options) ?? defaultOnboardingPolicy();
  if (installRequested) {
    if (
      !(await install(cwd, {
        ...(draft.scope ? { scope: draft.scope } : {}),
        ...(draft.targets ? { targets: draft.targets } : {}),
        ...(draft.adoptionMode ? { adoptionMode: draft.adoptionMode } : {}),
        ...(draft.specsVisibility ? { specsVisibility: draft.specsVisibility } : {}),
        ...(plan?.installationPlan ? { resolvedPlan: plan.installationPlan } : {}),
        homeDir,
        quiet: true,
        ascii: Boolean(options.ascii),
        mode: options.mode,
      }))
    )
      return false;
  }
  if (!plan || plan.workspacePlan.applicability === 'applicable') {
    init(cwd, {
      ...(options.language ? { profile: options.language } : {}),
      ...(options.featureProfile ? { featureProfile: options.featureProfile } : {}),
      executionMode: policy.executionMode,
      autonomyLevel: policy.autonomyLevel,
      ...(policy.presetName ? { presetName: policy.presetName } : {}),
      ...(plan?.workspacePlan ? { workspacePlan: plan.workspacePlan } : {}),
      ...(options.presetAlias ? { presetAlias: options.presetAlias } : {}),
      quiet: true,
      homeDir,
      scope: draft.scope,
      localGitExclude: Boolean(options.localGitExclude),
      ascii: Boolean(options.ascii),
    });
  }
  if (plan?.operation === 'user-install') {
    log('PASS', t(locale, 'setup.userReady'), locale);
    process.stdout.write(`\n${t(locale, 'setup.userReadyNext')}\n`);
    return true;
  }
  const result = await doctor(cwd, { ascii: Boolean(options.ascii), homeDir });
  if ('status' in result && result.status === 'PASS') {
    log('PASS', t(locale, 'setup.ready'), locale);
    process.stdout.write(
      `\n${t(locale, 'setup.policyReady', {
        preset: policyReviewTitle(policy, locale),
      })}\n${t(locale, 'setup.policyChangeHint')}\n`,
    );
    return true;
  }
  return false;
}

type SetupIntentResult = SetupIntent | { cancelled: true };

type PersistedSetupIntent = {
  sharing?: SetupIntent['sharing'];
  selectedHosts?: SetupIntent['selectedHosts'];
  workflow?: SetupIntent['workflow'];
  executionMode?: SetupIntent['executionMode'];
  autonomyLevel?: SetupIntent['autonomyLevel'];
  language?: SetupIntent['language'];
  specsVisibility?: SetupIntent['specsVisibility'];
};

function persistedSetupIntent(cwd: string, homeDir: string): PersistedSetupIntent {
  let saved: ReturnType<typeof readInstallConfig> = null;
  try {
    saved = readInstallConfig(homeDir);
  } catch {
    return {};
  }
  const profile = (() => {
    try {
      return saved?.projects[repositoryKey(cwd)];
    } catch {
      return undefined;
    }
  })();
  const sharing = profile?.adoption_mode;
  const targets = profile?.adoption_mode === 'team' ? [] : (saved?.user.targets ?? []);
  const allHosts = Object.keys(AGENT_TO_TARGETS) as SetupIntent['selectedHosts'][number][];
  const combinations: SetupIntent['selectedHosts'][] = [[]];
  for (const host of allHosts) {
    for (const set of combinations.slice()) combinations.push([...set, host]);
  }
  const matchingHosts = combinations.filter(
    (set) =>
      set.length > 0 &&
      JSON.stringify([...targetsForHosts(set)].sort()) === JSON.stringify([...targets].sort()),
  );
  const selectedHosts = matchingHosts.length === 1 ? matchingHosts[0] : undefined;
  const config = readConfig(sddJoin(cwd, 'config.yml'));
  const workflow =
    config.state === 'valid' && config.policy?.executionMode && config.policy.autonomyLevel
      ? setupPolicyFromPair(config.policy.executionMode, config.policy.autonomyLevel)
      : null;
  const presetWorkflow = workflow?.presetName;
  return {
    ...(sharing ? { sharing } : {}),
    ...(profile?.specs_visibility ? { specsVisibility: profile.specs_visibility } : {}),
    ...(selectedHosts ? { selectedHosts } : {}),
    ...(workflow
      ? {
          workflow:
            presetWorkflow === 'manual' ||
            presetWorkflow === 'supervised' ||
            presetWorkflow === 'autonomous'
              ? presetWorkflow
              : 'custom',
          ...(workflow.kind === 'custom'
            ? { executionMode: workflow.executionMode, autonomyLevel: workflow.autonomyLevel }
            : {}),
        }
      : {}),
    ...(config.state === 'valid' && LANGUAGE_PROFILES.includes(config.languageProfile ?? '')
      ? { language: config.languageProfile as SetupIntent['language'] }
      : {}),
  };
}

async function collectSetupIntent(
  cwd: string,
  locale: string,
  options: SetupCommandOptions,
  homeDir: string,
): Promise<SetupIntentResult> {
  const choose = async (
    label: string,
    values: Array<{ value: string; label: string; selected?: boolean }>,
    multiple = false,
  ) =>
    select(label, values, {
      multiple,
      ascii: Boolean(options.ascii),
      cancelValues: ['q', '0'],
      locale,
    });
  const persisted = persistedSetupIntent(cwd, homeDir);
  const gitAvailable = resolveGitContext(cwd).ok;
  const sharing = !gitAvailable
    ? { value: 'personal' }
    : persisted.sharing
      ? { value: persisted.sharing }
      : await choose(t(locale, 'install.sharingPrompt'), [
          { value: 'personal', label: t(locale, 'install.adoptionPersonal'), selected: true },
          { value: 'specs-shared', label: t(locale, 'install.adoptionSpecsShared') },
          { value: 'team', label: t(locale, 'install.adoptionTeam') },
        ]);
  if (('cancelled' in sharing && sharing.cancelled) || typeof sharing.value !== 'string')
    return { cancelled: true };

  const specsVisibility =
    gitAvailable && sharing.value === 'team'
      ? persisted.specsVisibility
        ? { value: persisted.specsVisibility }
        : await choose(t(locale, 'setup.featureSpecs'), [
            { value: 'local', label: t(locale, 'setup.keepSpecsLocal'), selected: true },
            { value: 'shared', label: t(locale, 'setup.shareSpecs') },
          ])
      : null;
  if (specsVisibility && 'cancelled' in specsVisibility && specsVisibility.cancelled)
    return { cancelled: true };

  const hints = detectSetupHosts({ cwd, homeDir });
  const hostLabels: Record<string, string> = {
    codex: 'Codex',
    cursor: 'Cursor',
    'claude-code': 'Claude Code',
    'vscode-copilot': 'GitHub Copilot',
  };
  let selectedHosts: SetupIntent['selectedHosts'] = persisted.selectedHosts ?? [];
  if (!selectedHosts.length) {
    for (;;) {
      const hosts = await choose(
        t(locale, 'install.agentsPrompt'),
        hints.map((hint) => ({
          value: hint.host,
          label: `${hostLabels[hint.host] || hint.host}${hint.detected ? ' (detected)' : ''}`,
          selected: hint.detected,
        })),
        true,
      );
      if (hosts.cancelled) return { cancelled: true };
      selectedHosts = (Array.isArray(hosts.value) ? hosts.value : []).filter(
        (host): host is SetupIntent['selectedHosts'][number] =>
          ['codex', 'cursor', 'claude-code', 'vscode-copilot'].includes(host),
      );
      if (selectedHosts.length) break;
      log('WARN', 'No coding-agent host selected; choose at least one host explicitly', locale);
    }
  }

  const workflow = !gitAvailable
    ? { value: 'supervised' }
    : persisted.workflow
      ? { value: persisted.workflow }
      : await choose(t(locale, 'setup.workflow'), [
          { value: 'supervised', label: t(locale, 'setup.policySupervised'), selected: true },
          { value: 'manual', label: t(locale, 'setup.policyManual') },
          { value: 'autonomous', label: t(locale, 'setup.policyAutonomous') },
          { value: 'custom', label: t(locale, 'setup.policyAdvanced') },
        ]);
  if (('cancelled' in workflow && workflow.cancelled) || typeof workflow.value !== 'string')
    return { cancelled: true };
  let executionMode: SetupIntent['executionMode'] = persisted.executionMode;
  let autonomyLevel: SetupIntent['autonomyLevel'] = persisted.autonomyLevel;
  if (workflow.value === 'custom' && (!executionMode || !autonomyLevel)) {
    const mode = await choose(
      'Execution mode',
      EXECUTION_MODES.map((value) => ({ value, label: value, selected: value === 'apply' })),
    );
    if (mode.cancelled || typeof mode.value !== 'string') return { cancelled: true };
    const selectedExecutionMode = mode.value;
    const autonomy = await choose(
      'Autonomy level',
      AUTONOMY_LEVELS.filter((value) => autonomyComboValid(selectedExecutionMode, value)).map(
        (value) => ({
          value,
          label: value,
          selected: value === 'supervised',
        }),
      ),
    );
    if (autonomy.cancelled || typeof autonomy.value !== 'string') return { cancelled: true };
    executionMode = selectedExecutionMode as SetupIntent['executionMode'];
    autonomyLevel = autonomy.value as SetupIntent['autonomyLevel'];
  }
  const language = options.language
    ? { value: options.language }
    : persisted.language
      ? { value: persisted.language }
      : { value: locale };
  if (('cancelled' in language && language.cancelled) || typeof language.value !== 'string')
    return { cancelled: true };
  return {
    sharing: sharing.value as SetupIntent['sharing'],
    selectedHosts,
    workflow: workflow.value as SetupIntent['workflow'],
    ...(executionMode ? { executionMode } : {}),
    ...(autonomyLevel ? { autonomyLevel } : {}),
    ...(specsVisibility && (specsVisibility.value === 'local' || specsVisibility.value === 'shared')
      ? { specsVisibility: specsVisibility.value }
      : {}),
    language: language.value as SetupIntent['language'],
  };
}

function printSetupPlan(
  plan: SetupPlan,
  locale = 'en-US',
  mode: DisplayMode = 'human-plain',
): void {
  const sharing = plan.intent?.sharing;
  const sharingLabel =
    sharing === 'personal'
      ? locale === 'pt-BR'
        ? 'Apenas para mim'
        : 'Just for me'
      : sharing === 'team'
        ? locale === 'pt-BR'
          ? 'Com a equipe'
          : 'With the team'
        : locale === 'pt-BR'
          ? 'Specs compartilhadas com a equipe'
          : 'Specs shared with the team';
  const targetLabels = plan.targets.map((target) =>
    target === 'agents'
      ? t(locale, 'install.targetShared')
      : target === 'claude'
        ? t(locale, 'install.targetClaude')
        : target === 'copilot'
          ? t(locale, 'install.targetCopilot')
          : target === 'cursor'
            ? 'Cursor'
            : target,
  );
  if (mode === 'human-rich') {
    const operations = [
      ...plan.cleanupActions,
      ...plan.installationIntent,
      ...plan.targetReconciliation,
      ...plan.adoptionChanges,
      ...plan.configMutation,
      ...plan.workspaceInitialization,
    ];
    terminalNote(
      t(locale, 'setup.review'),
      [
        [t(locale, 'install.sharingPrompt'), sharingLabel],
        [t(locale, 'install.agentsPrompt'), targetLabels.join(', ') || '(none)'],
        ...(sharing === 'team'
          ? [
              [
                t(locale, 'setup.featureSpecs'),
                plan.intent?.specsVisibility === 'shared'
                  ? t(locale, 'setup.shareSpecs')
                  : t(locale, 'setup.keepSpecsLocal'),
              ] as const,
            ]
          : []),
        [
          t(locale, 'plan.scope'),
          plan.scope === 'project' ? t(locale, 'setup.scopeProject') : t(locale, 'setup.scopeUser'),
        ],
        [
          t(locale, 'plan.fileOperations'),
          operations.map((item) => item.detail).join('\n') || 'None',
        ],
        ...(plan.warnings.length
          ? [[t(locale, 'doctor.related'), plan.warnings.join('\n')] as const]
          : []),
        ...(plan.blockers.length
          ? [[t(locale, 'plan.blocked'), plan.blockers.join('\n')] as const]
          : []),
      ],
      { mode },
    );
    return;
  }
  process.stdout.write(`\n${t(locale, 'setup.review')}\n\n`);
  process.stdout.write(`  ${t(locale, 'install.sharingPrompt')}  ${sharingLabel}\n`);
  process.stdout.write(
    `  ${t(locale, 'install.agentsPrompt')}   ${targetLabels.join(', ') || '(none)'}\n`,
  );
  if (sharing === 'team')
    process.stdout.write(
      `  ${t(locale, 'setup.featureSpecs')}  ${plan.intent?.specsVisibility === 'shared' ? t(locale, 'setup.shareSpecs') : t(locale, 'setup.keepSpecsLocal')}\n`,
    );
  process.stdout.write(
    `  ${t(locale, 'plan.scope')}    ${plan.scope === 'project' ? t(locale, 'setup.scopeProject') : t(locale, 'setup.scopeUser')}\n`,
  );
  process.stdout.write(`\n${t(locale, 'plan.fileOperations')}\n`);
  for (const item of [
    ...plan.cleanupActions,
    ...plan.installationIntent,
    ...plan.targetReconciliation,
    ...plan.adoptionChanges,
    ...plan.configMutation,
    ...plan.workspaceInitialization,
  ])
    process.stdout.write(`  - ${item.detail}\n`);
  for (const warning of plan.warnings)
    process.stdout.write(`  ${t(locale, 'doctor.related')}: ${warning}\n`);
  for (const blocker of plan.blockers)
    process.stdout.write(
      `  ${t(locale, 'plan.blocked', {
        details: blocker,
        path: plan.workspacePlan.git?.projectRoot || '.',
      })}\n`,
    );
}

async function preflightSetup(cwd: string, draft: SetupDraft, options: SetupCommandOptions) {
  if (!draft.install) return true;
  const { install } = requireCommandDeps();
  return Boolean(
    await install(cwd, {
      ...options,
      scope: draft.scope,
      ...(draft.targets ? { targets: draft.targets } : {}),
      ...(draft.adoptionMode ? { adoptionMode: draft.adoptionMode } : {}),
      ...(draft.specsVisibility ? { specsVisibility: draft.specsVisibility } : {}),
      plan: true,
      quiet: true,
    }),
  );
}

function needsSessionLanguageSelection(_state: string, hasReliableLocale: boolean): boolean {
  return !hasReliableLocale;
}

type OperationResultState = 'success' | 'warning' | 'error' | 'cancelled' | 'informational';

function renderOperationResult(
  title: string,
  state: OperationResultState,
  summary: string,
  locale = 'en-US',
): string {
  const labels =
    locale === 'pt-BR'
      ? {
          success: 'Concluído',
          warning: 'Atenção',
          error: 'Erro',
          cancelled: 'Cancelado',
          informational: 'Informação',
          details: 'Detalhes',
          recovery: 'Recuperação',
          next: 'Próxima ação',
        }
      : {
          success: 'Success',
          warning: 'Needs attention',
          error: 'Error',
          cancelled: 'Cancelled',
          informational: 'Information',
          details: 'Details',
          recovery: 'Recovery',
          next: 'Next action',
        };
  const action = labels.next;
  const recovery =
    state === 'success'
      ? locale === 'pt-BR'
        ? 'o estado aplicado pode ser revisado no menu Validar'
        : 'review the applied state from the Validate menu'
      : state === 'warning'
        ? locale === 'pt-BR'
          ? 'revise os detalhes e siga a próxima ação recomendada'
          : 'review the details and follow the recommended next action'
        : state === 'informational'
          ? locale === 'pt-BR'
            ? 'nenhuma alteração foi feita'
            : 'no changes were made'
          : locale === 'pt-BR'
            ? 'nenhuma intenção pendente foi confirmada; tente novamente quando estiver pronto'
            : 'no pending intent was confirmed; retry from the menu when ready';
  return `\n${title}\n\n${labels[state]}: ${summary}\n${labels.recovery}: ${recovery}\n\n${action}: ${
    state === 'success' || state === 'warning' || state === 'informational'
      ? locale === 'pt-BR'
        ? 'retorne ao menu ou revise o estado atual'
        : 'return to the menu or review the current state'
      : locale === 'pt-BR'
        ? 'retorne ao menu para tentar novamente'
        : 'return to the menu to try again'
  }\n`;
}

async function chooseSessionLocale(
  choose: typeof select,
  options: Pick<SetupCommandOptions, 'ascii'> = {},
): Promise<ReturnType<typeof resolveLocale> | null> {
  const language = await choose(
    'Choose your language / Escolha o idioma',
    [
      { value: 'en-US', label: 'English', selected: true },
      { value: 'pt-BR', label: 'Português (Brasil)' },
    ],
    { ascii: Boolean(options.ascii), cancelValues: ['q', '0'] },
  );
  return language.cancelled || typeof language.value !== 'string'
    ? null
    : resolveLocale({ explicit: language.value });
}

function renderLanguagePrelude(): string {
  return `\nsdd-agentic-flow ${VERSION}\n\n`;
}

function renderInvocationWelcome(
  snapshot: SetupStateSnapshot,
  locale: string,
  mode: DisplayMode = 'human-rich',
): string {
  let stateContent: string;
  switch (snapshot.state) {
    case 'Ready':
      stateContent = `${t(locale, 'welcome.returningTitle')}\n\n${symbol('success', mode)} ${t(locale, 'welcome.readyTitle')}\n${t(locale, 'welcome.readyBody')}`;
      break;
    case 'Attention':
      stateContent = `${t(locale, 'welcome.returningTitle')}\n\n${symbol('warn', mode)} ${t(locale, 'welcome.attentionTitle')}`;
      break;
    case 'Blocked':
      stateContent = t(locale, 'welcome.blockedTitle');
      break;
    case 'Fresh':
      stateContent = `${t(locale, 'welcome.freshTitle')}\n${t(locale, 'welcome.freshBody')}`;
      break;
    default:
      stateContent = `${t(locale, 'welcome.incompleteTitle')}\n${t(locale, 'welcome.incompleteBody')}`;
      break;
  }
  return (
    `sdd-agentic-flow ${VERSION}\n${t(locale, 'welcome.product')}\n${t(locale, 'welcome.tagline')}\n\n` +
    `${stateContent}\n\n`
  );
}

async function guidedInit(cwd: string, options: SetupCommandOptions = {}) {
  const { upgradeCommand, runCommand, changeInstallation, purgeKnownSafState } =
    requireCommandDeps();
  const homeDir = asString(options.homeDir, os.homedir());
  let locale = localeFor(cwd, options.language);
  const choose = (
    question: string,
    values: Array<{ value: string; label: string; action?: boolean }>,
  ) =>
    select(question, values, {
      ascii: Boolean(options.ascii),
      cancelValues: ['q', '0'],
      locale,
    });
  const transition = () =>
    clearViewport({ stdout: process.stdout, stdin: process.stdin }, process.env, {
      ascii: Boolean(options.ascii),
    });
  const showOperationResult = async (title: string, result: unknown): Promise<boolean> => {
    const operationStatus =
      result && typeof result === 'object' && 'status' in result ? String(result.status) : '';
    const state: OperationResultState =
      result === false ||
      (result &&
        typeof result === 'object' &&
        ('error' in result || ('ok' in result && result.ok === false)))
        ? 'error'
        : result && typeof result === 'object' && 'cancelled' in result
          ? 'cancelled'
          : operationStatus === 'FAIL'
            ? 'error'
            : operationStatus === 'WARN'
              ? 'warning'
              : 'success';
    const summary =
      state === 'error' && result && typeof result === 'object' && 'error' in result
        ? String(result.error)
        : state === 'error' && result && typeof result === 'object' && 'message' in result
          ? String(result.message)
          : state === 'error' && result && typeof result === 'object' && 'errors' in result
            ? Array.isArray(result.errors)
              ? result.errors.join('; ')
              : String(result.errors)
            : state === 'cancelled'
              ? t(locale, 'setup.cancelled')
              : operationStatus === 'FAIL' || operationStatus === 'WARN'
                ? operationStatus === 'FAIL'
                  ? t(locale, 'doctor.needsAction')
                  : t(locale, 'doctor.related')
                : locale === 'pt-BR'
                  ? 'operação concluída'
                  : 'operation completed';
    process.stdout.write(renderOperationResult(title, state, summary, locale));
    const next = await choose(t(locale, 'menu.question'), [
      { value: 'back', label: t(locale, 'menu.back'), action: true },
      { value: 'exit', label: t(locale, 'menu.exit'), action: true },
    ]);
    return next.cancelled || next.value === 'exit';
  };

  const runSettings = async (): Promise<'back' | 'exit'> => {
    for (;;) {
      transition();
      const choice = await choose(t(locale, 'menu.settings'), [
        { value: 'workflow', label: t(locale, 'menu.workflow') },
        { value: 'language', label: t(locale, 'menu.language') },
        { value: 'installation', label: t(locale, 'menu.installation') },
        { value: 'back', label: t(locale, 'menu.back'), action: true },
        { value: 'exit', label: t(locale, 'menu.exit'), action: true },
      ]);
      if (choice.cancelled || choice.value === 'exit') return 'exit';
      if (choice.value === 'back') return 'back';
      if (choice.value === 'workflow') {
        const workflow = await choose(t(locale, 'menu.workflow'), [
          { value: 'supervised', label: 'Supervised' },
          { value: 'manual', label: 'Manual' },
          { value: 'autonomous', label: 'Autonomous' },
          { value: 'back', label: t(locale, 'menu.back'), action: true },
          { value: 'exit', label: t(locale, 'menu.exit'), action: true },
        ]);
        if (workflow.cancelled || workflow.value === 'exit') return 'exit';
        if (workflow.value && workflow.value !== 'back') {
          let result: unknown;
          try {
            result = await runCommand(
              'config',
              ['policy', '--preset', String(workflow.value)],
              cwd,
            );
          } catch (error: unknown) {
            result = { error: errorMessage(error) };
          }
          if (await showOperationResult(t(locale, 'menu.workflow'), result)) return 'exit';
        }
      } else if (choice.value === 'language') {
        const language = await choose(t(locale, 'menu.language'), [
          { value: 'en-US', label: 'English' },
          { value: 'pt-BR', label: 'Português (Brasil)' },
          { value: 'back', label: t(locale, 'menu.back'), action: true },
          { value: 'exit', label: t(locale, 'menu.exit'), action: true },
        ]);
        if (language.cancelled || language.value === 'exit') return 'exit';
        if (language.value && language.value !== 'back') {
          let result: unknown;
          try {
            result = await runCommand(
              'config',
              ['policy', '--language', String(language.value)],
              cwd,
            );
          } catch (error: unknown) {
            result = { error: errorMessage(error) };
          }
          locale = resolveLocale({ explicit: String(language.value) });
          if (await showOperationResult(t(locale, 'menu.language'), result)) return 'exit';
        }
      } else if (choice.value === 'installation') {
        let result: unknown;
        try {
          result = await changeInstallation(cwd);
        } catch (error: unknown) {
          result = { error: errorMessage(error) };
        }
        if (await showOperationResult(t(locale, 'install.details'), result)) return 'exit';
      }
    }
  };

  const runAdvanced = async (): Promise<'back' | 'exit'> => {
    for (;;) {
      transition();
      const choice = await choose(t(locale, 'menu.advanced'), [
        { value: 'help', label: t(locale, 'menu.commandReference') },
        { value: 'config', label: t(locale, 'menu.configDetails') },
        { value: 'context', label: t(locale, 'menu.refreshContext') },
        { value: 'install', label: t(locale, 'menu.installPlan') },
        { value: 'uninstall', label: t(locale, 'menu.uninstallPlan') },
        { value: 'back', label: t(locale, 'menu.back'), action: true },
        { value: 'exit', label: t(locale, 'menu.exit'), action: true },
      ]);
      if (choice.cancelled || choice.value === 'exit') return 'exit';
      if (choice.value === 'back') return 'back';
      const commands: Record<string, [string, string[]]> = {
        help: ['help', []],
        config: ['config', ['show']],
        context: ['context', ['refresh']],
        install: ['install', ['--plan']],
        uninstall: ['uninstall', ['--plan']],
      };
      const command = commands[String(choice.value)];
      if (command) {
        let result: unknown;
        try {
          result = await runCommand(command[0], command[1], cwd);
        } catch (error: unknown) {
          result = { error: errorMessage(error) };
        }
        if (await showOperationResult(t(locale, 'menu.advanced'), result)) return 'exit';
      }
    }
  };

  const hasConfiguredLanguage =
    fs.existsSync(sddJoin(cwd, 'config.yml')) && Boolean(languageReport(cwd).profile);
  let languageSelected = Boolean(options.language || hasConfiguredLanguage);
  const mode =
    options.mode ??
    outputMode({ stdout: process.stdout, stdin: process.stdin }, process.env, {
      ascii: Boolean(options.ascii),
    });
  let initialScreen = true;
  let snapshot = inspectSetupState(cwd, homeDir);
  if (needsSessionLanguageSelection(snapshot.state, languageSelected)) {
    transition();
    process.stdout.write(renderLanguagePrelude());
    const selectedLocale = await chooseSessionLocale(select, options);
    if (!selectedLocale) {
      process.stdout.write(`${t(locale, 'welcome.cancelled')}\n`);
      return;
    }
    locale = selectedLocale;
    languageSelected = true;
    snapshot = inspectSetupState(cwd, homeDir);
    transition();
  } else {
    transition();
  }
  // The brand is eligible here because guidedInit is only entered by the bare interactive shell.
  // Non-TTY bare execution stays on the status-only welcome path in main().
  await writeBrand(mode, process.stdout, process.env);
  const hasGitWorkspace = resolveGitContext(cwd).ok;
  const userInstallation = inspectUserInstallation(homeDir);
  if (!hasGitWorkspace && userInstallation.state === 'healthy') {
    process.stdout.write(
      `\n${t(locale, 'setup.userInstalledTitle')}\n\n${t(locale, 'setup.userInstalledBody')}\n\n${t(locale, 'setup.userReadyNext')}\n\n`,
    );
    const action = await choose(t(locale, 'menu.question'), [
      { value: 'review', label: t(locale, 'menu.details') },
      { value: 'exit', label: t(locale, 'menu.exit'), action: true },
    ]);
    if (action.cancelled || action.value === 'exit') return;
    let result: unknown;
    try {
      result = await runCommand('install', ['--plan'], cwd);
    } catch (error: unknown) {
      result = { error: errorMessage(error) };
    }
    await showOperationResult(t(locale, 'install.details'), result);
    return;
  }
  process.stdout.write(renderInvocationWelcome(snapshot, locale, mode));

  let directWorkspaceSetup = false;
  for (;;) {
    snapshot = inspectSetupState(cwd, homeDir);
    if (
      !directWorkspaceSetup &&
      hasGitWorkspace &&
      userInstallation.state === 'healthy' &&
      snapshot.state === 'Incomplete'
    ) {
      if (!initialScreen) transition();
      process.stdout.write(
        `\n${t(locale, 'setup.existingUserTitle')}\n\n${t(locale, 'setup.existingUserBody')}\n\n`,
      );
      const action = await choose(t(locale, 'menu.question'), [
        { value: 'setup', label: t(locale, 'setup.setupRepository') },
        { value: 'review', label: t(locale, 'menu.details') },
        { value: 'exit', label: t(locale, 'menu.exit'), action: true },
      ]);
      if (action.cancelled || action.value === 'exit') return;
      if (action.value === 'review') {
        let result: unknown;
        try {
          result = await runCommand('install', ['--plan'], cwd);
        } catch (error: unknown) {
          result = { error: errorMessage(error) };
        }
        if (await showOperationResult(t(locale, 'install.details'), result)) return;
        continue;
      }
      directWorkspaceSetup = true;
      initialScreen = false;
      break;
    }
    if (snapshot.state === 'Ready' || snapshot.state === 'Attention') {
      if (!initialScreen) transition();
      printCurrentSetup(cwd, locale, homeDir);
      const action = await choose(t(locale, 'menu.question'), [
        { value: 'settings', label: t(locale, 'menu.settings') },
        { value: 'updates', label: t(locale, 'menu.updates') },
        { value: 'validate', label: t(locale, 'menu.validate') },
        { value: 'advanced', label: t(locale, 'menu.advanced') },
        { value: 'exit', label: t(locale, 'menu.exit'), action: true },
      ]);
      if (action.cancelled || action.value === 'exit') {
        if (action.cancelled) process.stdout.write(`${t(locale, 'welcome.cancelled')}\n`);
        return;
      }
      initialScreen = false;
      if (action.value === 'settings') {
        if ((await runSettings()) === 'exit') return;
      } else if (action.value === 'updates') {
        let result: unknown;
        try {
          result = await upgradeCommand(cwd, {
            ascii: Boolean(options.ascii),
            interactive: true,
            homeDir,
          });
        } catch (error: unknown) {
          result = { error: errorMessage(error) };
        }
        if (await showOperationResult(t(locale, 'menu.updates'), result)) return;
      } else if (action.value === 'validate') {
        let result: unknown;
        try {
          result = await doctor(cwd, { ascii: Boolean(options.ascii), homeDir });
        } catch (error: unknown) {
          result = { error: errorMessage(error) };
        }
        if (await showOperationResult(t(locale, 'menu.validate'), result)) return;
      } else if (action.value === 'advanced') {
        if ((await runAdvanced()) === 'exit') return;
      }
      continue;
    }
    if (snapshot.state === 'Blocked') {
      if (!initialScreen) {
        transition();
        process.stdout.write(`\n${t(locale, 'welcome.blockedTitle')}\n`);
      }
      const recoveryActions =
        snapshot.installationIntent === 'future' ||
        snapshot.installationIntent === 'unknown' ||
        snapshot.installationIntent === 'legacy'
          ? [{ value: 'repair', label: t(locale, 'menu.repair') }]
          : [];
      const action = await choose(t(locale, 'menu.question'), [
        ...recoveryActions,
        { value: 'change', label: t(locale, 'menu.change') },
        { value: 'validate', label: t(locale, 'menu.validate') },
        { value: 'exit', label: t(locale, 'menu.exit'), action: true },
      ]);
      if (action.cancelled || action.value === 'exit') return;
      if (action.value === 'repair') {
        const confirmation = await choose(t(locale, 'recovery.confirm'), [
          { value: 'apply', label: t(locale, 'recovery.cleanReinstall') },
          { value: 'cancel', label: t(locale, 'menu.back'), action: true },
        ]);
        if (confirmation.cancelled || confirmation.value !== 'apply') continue;
        const repaired = purgeKnownSafState?.(cwd, homeDir) ?? {
          ok: false,
          removed: [],
          remaining: ['SAF cleanup is not available in this shell'],
        };
        if (!repaired.ok) {
          process.stdout.write(`\n${t(locale, 'recovery.incomplete')}\n`);
          continue;
        }
        initialScreen = false;
        break;
      }
      if (action.value === 'change') {
        initialScreen = false;
        break;
      }
      initialScreen = false;
      let result: unknown;
      try {
        result = await doctor(cwd, { ascii: Boolean(options.ascii), homeDir });
      } catch (error: unknown) {
        result = { error: errorMessage(error) };
      }
      if (await showOperationResult(t(locale, 'menu.validate'), result)) return;
      continue;
    }
    if (!initialScreen) {
      transition();
      process.stdout.write(
        `\n${snapshot.state === 'Fresh' ? t(locale, 'welcome.freshTitle') : t(locale, 'welcome.incompleteTitle')}\n` +
          `${snapshot.state === 'Fresh' ? t(locale, 'welcome.freshBody') : t(locale, 'welcome.incompleteBody')}\n\n`,
      );
    }
    const entry = await choose(t(locale, 'menu.question'), [
      {
        value: 'start',
        label:
          snapshot.state === 'Fresh'
            ? t(locale, 'menu.startSetup')
            : t(locale, 'menu.continueSetup'),
      },
      { value: 'learn', label: t(locale, 'menu.learn') },
      { value: 'exit', label: t(locale, 'menu.exit'), action: true },
    ]);
    if (entry.cancelled || entry.value === 'exit') {
      if (entry.cancelled) process.stdout.write(`${t(locale, 'welcome.cancelled')}\n`);
      return;
    }
    initialScreen = false;
    if (entry.value === 'learn') {
      let result: unknown;
      try {
        result = await runCommand('learn-sdd', [], cwd);
      } catch (error: unknown) {
        result = { error: errorMessage(error) };
      }
      if (await showOperationResult(t(locale, 'menu.learn'), result)) return;
      continue;
    }
    break;
  }

  for (;;) {
    const intent = await collectSetupIntent(cwd, locale, { ...options, language: locale }, homeDir);
    if ('cancelled' in intent) return log('INFO', t(locale, 'setup.cancelled'), locale);
    const plan = resolveSetupPlan(cwd, inspectSetupState(cwd, homeDir), intent, homeDir);
    printSetupPlan(plan, locale, mode);
    if (plan.blocked) {
      log('FAIL', plan.blockers.join('; '), locale);
      const installationState = inspectSetupState(cwd, homeDir).installationIntent;
      if (
        installationState === 'future' ||
        installationState === 'unknown' ||
        installationState === 'legacy'
      ) {
        const repair = await select(
          t(locale, 'recovery.question'),
          [
            { value: 'apply', label: t(locale, 'recovery.cleanReinstall') },
            { value: 'back', label: t(locale, 'menu.back'), action: true },
          ],
          { ascii: Boolean(options.ascii), cancelValues: ['q', '0'], locale },
        );
        if (repair.value === 'apply') {
          const repaired = purgeKnownSafState?.(cwd, homeDir) ?? {
            ok: false,
            removed: [],
            remaining: ['SAF cleanup is not available in this shell'],
          };
          if (repaired.ok) continue;
          process.stdout.write(`\n${t(locale, 'recovery.incomplete')}\n`);
        }
      }
      continue;
    }
    const review = await select(
      t(locale, 'setup.review'),
      [
        { value: 'continue', label: t(locale, 'setup.continue') },
        { value: 'back', label: t(locale, 'setup.back') },
        { value: 'cancel', label: t(locale, 'setup.cancel') },
      ],
      { ascii: Boolean(options.ascii), cancelValues: ['q', '0'], locale },
    );
    if (review.cancelled || review.value === 'cancel')
      return log('INFO', t(locale, 'setup.cancelled'), locale);
    if (review.value === 'back') continue;
    if (!setupPlanIsCurrent(cwd, plan, homeDir)) {
      log('WARN', 'setup changed after review; a new plan and confirmation are required', locale);
      continue;
    }
    const policy =
      intent.workflow === 'custom' && intent.executionMode && intent.autonomyLevel
        ? setupPolicyFromPair(intent.executionMode, intent.autonomyLevel)
        : setupPolicyFromPreset(intent.workflow);
    if (!policy) {
      log('FAIL', `unknown workflow: ${intent.workflow}`, locale);
      continue;
    }
    const draft: SetupDraft = {
      install: true,
      scope: adoptionModeForScope(intent.sharing),
      targets: targetsForHosts(intent.selectedHosts),
      adoptionMode: intent.sharing,
      ...(intent.specsVisibility ? { specsVisibility: intent.specsVisibility } : {}),
      policy,
    };
    const applyOptions = {
      ...options,
      homeDir,
      language: intent.language,
      mode,
    };
    if (await applySetup(cwd, draft, applyOptions, locale, plan)) return;
    process.stdout.write(`\n${t(locale, 'setup.failed')}\n`);
    const recovery = await select(
      t(locale, 'menu.question'),
      [
        { value: 'change', label: t(locale, 'setup.changeChoices') },
        { value: 'validate', label: t(locale, 'menu.validate') },
        { value: 'exit', label: t(locale, 'setup.exit') },
      ],
      { ascii: Boolean(options.ascii), cancelValues: ['q', '0'], locale },
    );
    if (recovery.cancelled || recovery.value === 'exit') return;
    if (recovery.value === 'validate')
      await doctor(cwd, { ascii: Boolean(options.ascii), homeDir });
  }
}

async function initInteractive(
  cwd: string,
  languageDefault = 'en-US',
  _featureProfileDefault = 'medium_feature',
  quiet = false,
  executionModeDefault = 'guided',
  autonomyLevelDefault = 'manual',
  localGitExclude = false,
) {
  const configPath = sddJoin(cwd, 'config.yml');
  const mode = resolveMode({ quiet });
  if (fs.existsSync(configPath)) {
    const existing = fs.readFileSync(configPath, 'utf8');
    const schema = existing.match(/^schema:\s*(\S+)$/m)?.[1];
    if (schema !== 'saf-config/v2') {
      fs.writeFileSync(configPath, configFor(cwd, { language: languageDefault }), 'utf8');
      log('INFO', `${SDD_PATHS.config} replaced with the current configuration contract`);
      return;
    }
    log('WARN', `${SDD_PATHS.config} already exists; init will not overwrite it`);
    const config = readConfig(configPath);
    if (config.ok) process.stdout.write(`\n${renderPolicySummary(config, mode)}\n`);
    process.stdout.write(
      `\nChange operating policy with: ${renderCliCommand('config', 'policy')}\n` +
        `Install skills with: ${renderCliCommand('install')}\n`,
    );
    applyInitSideEffects(cwd, {
      localGitExclude: resolveLocalGitExclude({ localGitExclude }),
    });
    return;
  }
  const inferred = inferInitDefaults(cwd);
  const pipedAnswers = process.stdin.isTTY ? null : fs.readFileSync(0, 'utf8').split(/\r?\n/);
  let answerIndex = 0;
  const rl = pipedAnswers
    ? null
    : readline.createInterface({ input: process.stdin, output: process.stdout });
  let locale = resolveLocale({ explicit: languageDefault });
  const ask = async (
    label: string,
    fallback: string,
    allowed: readonly string[] | null,
    kind: 'text' | 'branch' = 'text',
  ): Promise<string> => {
    if (allowed) {
      const labels: Record<string, string> = {
        'en-US': 'English',
        'pt-BR': 'Português (Brasil)',
        generic: 'Any coding agent',
        codex: 'Codex',
        cursor: 'Cursor',
        'claude-code': 'Claude Code',
        'vscode-copilot': 'GitHub Copilot',
        supervised: 'Supervised',
        manual: 'Manual',
        autonomous: 'Autonomous',
        advanced: 'Advanced policy',
        'local-files': 'Local files',
        single: 'Single feature',
        multi: 'Multiple features',
        true: 'Yes',
        false: 'No',
        plan: 'Plan',
        guided: 'Guided',
        apply: 'Apply',
        review: 'Review',
        full: 'Full',
      };
      if (pipedAnswers) {
        process.stdout.write(`${label}: `);
        const answer = (pipedAnswers[answerIndex++] || fallback).trim() || fallback;
        if (!validValue(answer, allowed)) throw new Error(`${label} must be a listed choice`);
        return answer;
      }
      const selected = await select(
        label,
        allowed.map((value) => ({
          value,
          label: labels[value] || value,
          selected: value === fallback,
        })),
        { locale },
      );
      if (selected.cancelled || typeof selected.value !== 'string') throw new Error('cancelled');
      return selected.value;
    }
    const prompt = `${label} [${fallback}]: `;
    let raw: string | undefined;
    if (pipedAnswers) {
      process.stdout.write(prompt);
      raw = pipedAnswers[answerIndex++];
      // human-input-allowlist: free-form project name/branch only
    } else if (rl) {
      raw = await rl.question(prompt);
    } else {
      raw = fallback;
    }
    const answer = (raw || '').trim() || fallback;
    if (!allowed) {
      const valid =
        kind === 'branch' ? /^[A-Za-z0-9][A-Za-z0-9._/-]*$/ : /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/;
      if (!valid.test(answer)) throw new Error(`${label} contains unsupported characters`);
    }
    return answer;
  };
  try {
    process.stdout.write(
      `\n${renderStep(1, 6, t(locale, 'init.language'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    const language = await ask(
      t(locale, 'init.languagePrompt'),
      languageDefault,
      LANGUAGE_PROFILES,
    );
    locale = resolveLocale({ explicit: language });
    const initOptions: InitOptions & InitInteractiveState = {
      language,
      executionMode: executionModeDefault,
      autonomyLevel: autonomyLevelDefault,
    };

    process.stdout.write(
      `\n${renderStep(2, 6, t(locale, 'init.identity'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    initOptions.name = await ask(t(locale, 'init.projectName'), inferred.name, null);
    initOptions.branch = await ask(
      t(locale, 'init.defaultBranch'),
      inferred.branch,
      null,
      'branch',
    );

    process.stdout.write(
      `\n${renderStep(3, 6, t(locale, 'init.agent'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    process.stdout.write(`  ${t(locale, 'init.agentHint')}\n`);
    initOptions.agent = await ask(t(locale, 'init.agentPrompt'), inferred.agent, [
      'generic',
      'codex',
      'cursor',
      'claude-code',
      'vscode-copilot',
    ]);

    process.stdout.write(
      `\n${renderStep(4, 6, t(locale, 'init.policy'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    const presetChoice = await ask(t(locale, 'init.presetPrompt'), ONBOARDING_DEFAULT_PRESET, [
      ...onboardingPresetOrder(),
      'advanced',
    ]);
    if (presetChoice === 'advanced') {
      initOptions.executionMode = await ask(
        'Execution mode',
        executionModeDefault,
        EXECUTION_MODES,
      );
      initOptions.autonomyLevel = await ask(
        'Autonomy level',
        autonomyLevelDefault,
        AUTONOMY_LEVELS,
      );
    } else {
      const resolved = resolveOperatingPreset(presetChoice || ONBOARDING_DEFAULT_PRESET);
      if (!resolved) throw new Error(`Unknown operating preset: ${presetChoice}`);
      initOptions.executionMode = resolved.executionMode;
      initOptions.autonomyLevel = resolved.autonomyLevel;
    }
    process.stdout.write(
      `\n${renderStep(5, 6, t(locale, 'init.workflow'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    initOptions.source = await ask(t(locale, 'init.sourcePrompt'), 'local-files', ['local-files']);
    initOptions.flow = await ask(t(locale, 'init.flowPrompt'), 'single', ['single', 'multi']);
    initOptions.multiWorktree =
      (await ask(t(locale, 'init.worktreePrompt'), 'false', ['true', 'false'])) === 'true';
    initOptions.stackedPrs =
      (await ask(t(locale, 'init.stackedPrompt'), 'false', ['true', 'false'])) === 'true';
    process.stdout.write(
      `\n${renderStep(6, 6, t(locale, 'init.review'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    process.stdout.write(
      `  ${t(locale, 'init.reviewProject')}: ${initOptions.name}\n` +
        `  ${t(locale, 'init.reviewBranch')}: ${initOptions.branch}\n` +
        `  ${t(locale, 'init.reviewAgent')}: ${initOptions.agent}\n` +
        `  ${t(locale, 'init.reviewLanguage')}: ${initOptions.language}\n` +
        `  ${t(locale, 'init.reviewPolicy')}: ${initOptions.executionMode} + ${initOptions.autonomyLevel}\n` +
        `  ${t(locale, 'init.reviewSource')}: ${initOptions.source}\n` +
        `  ${t(locale, 'init.reviewFlow')}: ${initOptions.flow}\n` +
        `  ${t(locale, 'init.reviewWorktree')}: ${initOptions.multiWorktree}\n` +
        `  ${t(locale, 'init.reviewStacked')}: ${initOptions.stackedPrs}\n`,
    );
    if (!autonomyComboValid(initOptions.executionMode, initOptions.autonomyLevel))
      throw new Error(
        `Execution mode ${initOptions.executionMode} cannot combine with autonomy level ${initOptions.autonomyLevel}`,
      );
    const confirmPrompt = t(locale, 'init.confirm');
    let confirmed = true;
    if (pipedAnswers) {
      process.stdout.write(`${confirmPrompt}: `);
      confirmed = !/^(no|n)$/i.test(String(pipedAnswers[answerIndex++] || '').trim());
    } else {
      const confirmation = await select(
        confirmPrompt,
        [
          { value: 'apply', label: 'Apply' },
          { value: 'cancel', label: 'Cancel' },
        ],
        { locale },
      );
      confirmed = !confirmation.cancelled && confirmation.value === 'apply';
    }
    if (!confirmed) {
      log('INFO', t(locale, 'init.cancelled'));
      return;
    }
    init(cwd, {
      ...initOptions,
      ...(initOptions.language ? { profile: initOptions.language } : {}),
      quiet,
      localGitExclude: resolveLocalGitExclude({ localGitExclude }),
    });
  } catch (error: unknown) {
    fail(errorMessage(error), 1);
  } finally {
    if (rl) rl.close();
  }
}

export type { InitOptions, SetupCommandOptions };
export {
  chooseSessionLocale,
  guidedInit,
  init,
  initInteractive,
  needsSessionLanguageSelection,
  onboardingStateFor,
  persistedSetupIntent,
  policyFromConfig,
  policyReviewTitle,
  preflightSetup,
  printCurrentSetup,
  printPolicyLines,
  printUsageGuidePointer,
  renderInvocationWelcome,
  renderLanguagePrelude,
  renderOperationResult,
  resolvePolicyFromCommandOptions,
  setSetupCommandDeps,
};
