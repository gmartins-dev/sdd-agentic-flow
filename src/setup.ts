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
  formatPolicyPair,
  ONBOARDING_DEFAULT_PRESET,
  onboardingPresetOrder,
  policyDisplayTitle,
  readConfig,
  type SetupPolicyDraft,
  setupPolicyFromPair,
  setupPolicyFromPreset,
} from './config-domain';
import { configureIntent } from './configure';
import { doctor, languageReport } from './doctor';
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
  FEATURE_PROFILES,
  gitInfoExcludePath,
  LANGUAGE_PROFILES,
  LOCAL_GIT_EXCLUDE_COMMENT,
  LOCAL_GIT_EXCLUDE_ENTRY,
  OPERATING_PRESETS,
  PACKAGE_ROOT,
  resolveOperatingPreset,
  SDD_PATHS,
  SDD_ROOT,
  sddJoin,
  USAGE_GUIDE_PT_BR_URL,
  USAGE_GUIDE_URL,
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
import { inspectSetupState } from './setup-state';
import { type DisplayMode, isRich, outputMode, renderStep, styleStatus } from './ui';
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
  process.stdout.write(
    `${styleStatus(status, process.stdout)} ${translateText(locale, message)}\n`,
  );
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
    process.stdout.write(`│\n`);
    process.stdout.write(`${styleStatus('PASS', process.stdout)} ${message}\n`);
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
  feature_profile: ${options.featureProfile || 'medium_feature'}
  allow_multi_worktree: ${options.multiWorktree || false}
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
  const rich = isRich(resolveMode({ ascii: Boolean(options.ascii) }));
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
  process.stdout.write(
    `${indent}                ${formatPolicyPair(draft.executionMode, draft.autonomyLevel)}\n`,
  );
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

function setupLocationLabel(scope: string, options: SetupCommandOptions = {}) {
  return `official bundle ${isRich(resolveMode({ ascii: Boolean(options.ascii) })) ? '·' : '-'} ${scope}`;
}

function printCurrentSetup(cwd: string, locale: string, homeDir = os.homedir()) {
  const config = readConfig(sddJoin(cwd, 'config.yml'));
  const saved = savedSetupProfile(cwd, homeDir);
  const state = onboardingStateFor(cwd);
  const location = saved ? setupLocationLabel(asString(saved.scope)) : t(locale, 'setup.missing');
  const context = fs.existsSync(sddJoin(cwd, 'context', 'project-context.md'))
    ? t(locale, 'setup.ready')
    : t(locale, 'setup.missing');
  const health =
    state === 'READY'
      ? t(locale, 'setup.ready')
      : state === 'PARTIAL'
        ? t(locale, 'setup.partial')
        : t(locale, 'setup.attention');
  process.stdout.write(`\n${t(locale, 'setup.current')}\n\n`);
  process.stdout.write(`  ${t(locale, 'setup.location')}       ${location}\n`);
  if (config.ok) printPolicyLines(policyFromConfig(config, locale), locale);
  process.stdout.write(`  ${t(locale, 'setup.context')}      ${context}\n`);
  process.stdout.write(`  ${t(locale, 'setup.health')}       ${health}\n`);
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
  if (draft.install && !plan && !(await preflightSetup(cwd, draft, options))) return false;
  if (plan && plan.installationPlan.applicability !== 'applicable') return false;
  printSetupStages(locale, 'validation', ['project', 'skills', 'context'], options);
  process.stdout.write(`\n${t(locale, 'setup.apply')}\n`);
  const policy =
    draft.policy ?? resolvePolicyFromCommandOptions(options) ?? defaultOnboardingPolicy();
  if (draft.install) {
    configureIntent({
      homeDir,
      cwd,
      scope: draft.scope === 'project' ? 'project' : 'user',
      ...(draft.scope === 'user' && draft.targets ? { targets: draft.targets } : {}),
      ...(draft.adoptionMode ? { adoptionMode: draft.adoptionMode } : {}),
    });
    if (
      !(await install(cwd, {
        ...(draft.scope ? { scope: draft.scope } : {}),
        ...(draft.targets ? { targets: draft.targets } : {}),
        ...(draft.adoptionMode ? { adoptionMode: draft.adoptionMode } : {}),
        ...(plan?.installationPlan ? { resolvedPlan: plan.installationPlan } : {}),
        homeDir,
        quiet: true,
        ascii: Boolean(options.ascii),
      }))
    )
      return false;
  }
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
  const result = await doctor(cwd, { ascii: Boolean(options.ascii), homeDir });
  if ('status' in result && result.status === 'PASS') {
    log('PASS', t(locale, 'setup.ready'), locale);
    process.stdout.write(
      `\n${t(locale, 'setup.policyReady', {
        preset: policyReviewTitle(policy, locale),
        pair: formatPolicyPair(policy.executionMode, policy.autonomyLevel),
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
  featureProfile?: SetupIntent['featureProfile'];
};

function persistedSetupIntent(cwd: string, homeDir: string): PersistedSetupIntent {
  let saved: ReturnType<typeof readInstallConfig> = null;
  try {
    saved = readInstallConfig(homeDir);
  } catch {
    return {};
  }
  const profile = saved?.projects[repositoryKey(cwd)];
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
    config.ok && config.policy?.executionMode && config.policy.autonomyLevel
      ? setupPolicyFromPair(config.policy.executionMode, config.policy.autonomyLevel)
      : null;
  const presetWorkflow = workflow?.presetName;
  return {
    ...(sharing ? { sharing } : {}),
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
    ...(config.ok && LANGUAGE_PROFILES.includes(config.languageProfile ?? '')
      ? { language: config.languageProfile as SetupIntent['language'] }
      : {}),
    ...(config.ok && FEATURE_PROFILES.includes(config.featureProfile ?? '')
      ? { featureProfile: config.featureProfile as SetupIntent['featureProfile'] }
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
  const sharing = persisted.sharing
    ? { value: persisted.sharing }
    : await choose('Sharing', [
        { value: 'personal', label: 'Just for me', selected: true },
        { value: 'specs-shared', label: 'Share specs with the team' },
        { value: 'team', label: 'Use SAF with my team' },
      ]);
  if (('cancelled' in sharing && sharing.cancelled) || typeof sharing.value !== 'string')
    return { cancelled: true };

  const hints = detectSetupHosts({ cwd, homeDir });
  let selectedHosts: SetupIntent['selectedHosts'] = persisted.selectedHosts ?? [];
  if (!selectedHosts.length) {
    for (;;) {
      const hosts = await choose(
        'Coding agents',
        hints.map((hint) => ({
          value: hint.host,
          label: `${hint.host}${hint.detected ? ` (${hint.evidence.join(', ')})` : ''}`,
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

  const workflow = persisted.workflow
    ? { value: persisted.workflow }
    : await choose('Workflow', [
        { value: 'supervised', label: 'Supervised', selected: true },
        { value: 'manual', label: 'Manual' },
        { value: 'autonomous', label: 'Autonomous' },
        { value: 'custom', label: 'Custom execution/autonomy pair' },
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
  const language = persisted.language
    ? { value: persisted.language }
    : await choose('Language', [
        { value: 'en-US', label: 'English', selected: locale !== 'pt-BR' },
        { value: 'pt-BR', label: 'Português (Brasil)', selected: locale === 'pt-BR' },
      ]);
  if (('cancelled' in language && language.cancelled) || typeof language.value !== 'string')
    return { cancelled: true };
  const featureProfile = persisted.featureProfile
    ? { value: persisted.featureProfile }
    : await choose('Process depth', [
        { value: 'medium_feature', label: 'Standard', selected: true },
        { value: 'small_fix', label: 'Lightweight' },
        { value: 'large_feature', label: 'Thorough' },
        { value: 'epic', label: 'Epic' },
      ]);
  if (
    ('cancelled' in featureProfile && featureProfile.cancelled) ||
    typeof featureProfile.value !== 'string'
  )
    return { cancelled: true };
  return {
    sharing: sharing.value as SetupIntent['sharing'],
    selectedHosts,
    workflow: workflow.value as SetupIntent['workflow'],
    ...(executionMode ? { executionMode } : {}),
    ...(autonomyLevel ? { autonomyLevel } : {}),
    language: language.value as SetupIntent['language'],
    featureProfile: featureProfile.value as SetupIntent['featureProfile'],
  };
}

function printSetupPlan(plan: SetupPlan): void {
  process.stdout.write('\nSetup plan\n\n');
  process.stdout.write(`  Sharing: ${plan.intent?.sharing}\n`);
  process.stdout.write(`  Targets: ${plan.targets.join(', ') || '(none)'}\n`);
  process.stdout.write(`  Scope: ${plan.scope}\n`);
  for (const item of [
    ...plan.cleanupActions,
    ...plan.installationIntent,
    ...plan.targetReconciliation,
    ...plan.adoptionChanges,
    ...plan.configMutation,
    ...plan.workspaceInitialization,
  ])
    process.stdout.write(`  ${item.kind}: ${item.detail}\n`);
  for (const warning of plan.warnings) process.stdout.write(`  Warning: ${warning}\n`);
  for (const blocker of plan.blockers) process.stdout.write(`  Blocked: ${blocker}\n`);
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
      plan: true,
      quiet: true,
    }),
  );
}

async function guidedInit(cwd: string, options: SetupCommandOptions = {}) {
  const { upgradeCommand, runCommand, runInteractiveMenu, changeInstallation } =
    requireCommandDeps();
  const homeDir = asString(options.homeDir, os.homedir());
  const snapshot = inspectSetupState(cwd, homeDir);
  const locale = localeFor(cwd, options.language);
  if (snapshot.state === 'Ready' || snapshot.state === 'Attention') {
    printCurrentSetup(cwd, locale, homeDir);
    const action = await select(
      t(locale, 'menu.question'),
      [
        { value: 'keep', label: t(locale, 'menu.keep') },
        { value: 'changePolicy', label: t(locale, 'menu.changePolicy') },
        { value: 'changeInstall', label: t(locale, 'menu.changeInstall') },
        { value: 'updates', label: t(locale, 'menu.updates') },
        { value: 'validate', label: t(locale, 'menu.validate') },
        { value: 'more', label: t(locale, 'menu.more') },
      ],
      { ascii: Boolean(options.ascii), cancelValues: ['q', '0'], locale },
    );
    if (action.cancelled || action.value === 'keep') return;
    if (action.value === 'updates') return upgradeCommand(cwd, { ascii: Boolean(options.ascii) });
    if (action.value === 'changePolicy') return runCommand('config', ['policy'], cwd);
    if (action.value === 'changeInstall') return changeInstallation(cwd);
    if (action.value === 'validate') return doctor(cwd, { ascii: Boolean(options.ascii), homeDir });
    return runInteractiveMenu(cwd, { showSummary: false });
  }

  for (;;) {
    const intent = await collectSetupIntent(cwd, locale, options, homeDir);
    if ('cancelled' in intent) return log('INFO', t(locale, 'setup.cancelled'), locale);
    const plan = resolveSetupPlan(cwd, inspectSetupState(cwd, homeDir), intent, homeDir);
    printSetupPlan(plan);
    if (plan.blocked) {
      log('FAIL', plan.blockers.join('; '), locale);
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
      policy,
    };
    const applyOptions = {
      ...options,
      homeDir,
      language: intent.language,
      featureProfile: intent.featureProfile,
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
  featureProfileDefault = 'medium_feature',
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
      fs.writeFileSync(
        configPath,
        configFor(cwd, { language: languageDefault, featureProfile: featureProfileDefault }),
        'utf8',
      );
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
    const prompt = `${label} [${fallback}]: `;
    let raw: string | undefined;
    if (pipedAnswers) {
      process.stdout.write(prompt);
      raw = pipedAnswers[answerIndex++];
    } else if (rl) {
      raw = await rl.question(prompt);
    } else {
      raw = fallback;
    }
    const answer = (raw || '').trim() || fallback;
    if (allowed && !validValue(answer, allowed))
      throw new Error(`${label} must be one of: ${allowed.join(', ')}`);
    if (!allowed) {
      const valid =
        kind === 'branch' ? /^[A-Za-z0-9][A-Za-z0-9._/-]*$/ : /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/;
      if (!valid.test(answer)) throw new Error(`${label} contains unsupported characters`);
    }
    return answer;
  };
  try {
    process.stdout.write(
      `\n${renderStep(1, 7, t(locale, 'init.language'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    process.stdout.write(
      '  en-US — English human output\n  pt-BR — Saída humana em português do Brasil\n',
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
      `\n${renderStep(2, 7, t(locale, 'init.identity'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    initOptions.name = await ask(t(locale, 'init.projectName'), inferred.name, null);
    initOptions.branch = await ask(
      t(locale, 'init.defaultBranch'),
      inferred.branch,
      null,
      'branch',
    );

    process.stdout.write(
      `\n${renderStep(3, 7, t(locale, 'init.agent'), mode, t(locale, 'step')).join('\n')}\n`,
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
      `\n${renderStep(4, 7, t(locale, 'init.profile'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    process.stdout.write(`  ${FEATURE_PROFILES.join(', ')}\n`);
    initOptions.featureProfile = await ask(
      t(locale, 'init.featurePrompt'),
      featureProfileDefault,
      FEATURE_PROFILES,
    );

    process.stdout.write(
      `\n${renderStep(5, 7, t(locale, 'init.policy'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    for (const name of onboardingPresetOrder()) {
      const preset = OPERATING_PRESETS[name];
      if (!preset) continue;
      process.stdout.write(`  ${name}: ${preset.executionMode} + ${preset.autonomyLevel}\n`);
    }
    const presetPrompt = `${t(locale, 'init.presetPrompt')} [${ONBOARDING_DEFAULT_PRESET}]: `;
    let presetRaw: string | undefined;
    if (pipedAnswers) {
      process.stdout.write(presetPrompt);
      presetRaw = pipedAnswers[answerIndex++];
    } else {
      presetRaw = rl ? await rl.question(presetPrompt) : ONBOARDING_DEFAULT_PRESET;
    }
    const presetChoice = (presetRaw || ONBOARDING_DEFAULT_PRESET).trim();
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
      `\n${renderStep(6, 7, t(locale, 'init.workflow'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    initOptions.source = await ask(t(locale, 'init.sourcePrompt'), 'local-files', ['local-files']);
    initOptions.flow = await ask(t(locale, 'init.flowPrompt'), 'single', ['single', 'multi']);
    initOptions.multiWorktree =
      (await ask(t(locale, 'init.worktreePrompt'), 'false', ['true', 'false'])) === 'true';
    initOptions.stackedPrs =
      (await ask(t(locale, 'init.stackedPrompt'), 'false', ['true', 'false'])) === 'true';
    process.stdout.write(
      `\n${renderStep(7, 7, t(locale, 'init.review'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    process.stdout.write(
      `  ${t(locale, 'init.reviewProject')}: ${initOptions.name}\n` +
        `  ${t(locale, 'init.reviewBranch')}: ${initOptions.branch}\n` +
        `  ${t(locale, 'init.reviewAgent')}: ${initOptions.agent}\n` +
        `  ${t(locale, 'init.reviewLanguage')}: ${initOptions.language}\n` +
        `  ${t(locale, 'init.reviewProfile')}: ${initOptions.featureProfile}\n` +
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
    let confirmRaw: string | undefined;
    if (pipedAnswers) {
      process.stdout.write(confirmPrompt);
      confirmRaw = pipedAnswers[answerIndex++];
    } else {
      confirmRaw = rl ? await rl.question(confirmPrompt) : 'yes';
    }
    if (/^(no|n)$/i.test(String(confirmRaw || '').trim())) {
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
  guidedInit,
  init,
  initInteractive,
  onboardingStateFor,
  persistedSetupIntent,
  policyFromConfig,
  policyReviewTitle,
  preflightSetup,
  printCurrentSetup,
  printPolicyLines,
  printUsageGuidePointer,
  resolvePolicyFromCommandOptions,
  setSetupCommandDeps,
};
