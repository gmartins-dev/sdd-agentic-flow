import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';

import { renderPolicySummary } from './config';
import { AUTONOMY_LEVELS, EXECUTION_MODES, readConfig } from './config-domain';
import { configureIntent } from './configure';
import {
  coreSkillsPresence,
  doctor,
  doctorChecks,
  languageReport,
  resolveSkillsRoot,
  severity,
} from './doctor';
import type { InstallConfig, InstallProjectProfile } from './install-domain';
import {
  DEFAULT_USER_TARGETS,
  defaultInstallConfig,
  readInstallConfig,
  repositoryKey,
  USER_TARGETS,
} from './install-domain';
import { USER_TARGET_LABELS } from './install-preflight';
import { resolveLocale, t, translateText } from './messages';
import { resolveOnboardingState } from './onboarding';
import {
  autonomyComboValid,
  FEATURE_PROFILES,
  LANGUAGE_PROFILES,
  LOCAL_GIT_EXCLUDE_COMMENT,
  LOCAL_GIT_EXCLUDE_ENTRY,
  OPERATING_PRESETS,
  PACKAGE_ROOT,
  PRESETS_DIR,
  resolveOperatingPreset,
  SDD_PATHS,
  SDD_ROOT,
  sddJoin,
  USAGE_GUIDE_URL,
} from './paths';
import { discoverProject } from './project-context';
import { type SelectionResult, select } from './selector';
import { type DisplayMode, isRich, outputMode, renderStep, styleStatus } from './ui';

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
};

type SetupDraft = {
  install?: boolean | undefined;
  scope?: string | undefined;
  pack?: string | undefined;
  targets?: string[] | undefined;
  sharing?: string | undefined;
  path?: string | undefined;
  projectLocalExclude?: boolean | undefined;
  saved?: Record<string, unknown> | null | undefined;
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
  localGitExclude?: boolean | undefined;
  showSummary?: boolean | undefined;
  [key: string]: unknown;
};

type NextStepOptions = SetupCommandOptions & {
  mode?: DisplayMode | undefined;
  quiet?: boolean | undefined;
};

type InstallFn = (
  pack: string,
  cwd: string,
  options: SetupCommandOptions,
) => boolean | Promise<boolean>;

type SetupCommandDeps = {
  install: InstallFn;
  upgradeCommand: (cwd: string, options: SetupCommandOptions) => Promise<unknown>;
  runCommand: (command: string, args: string[], cwd: string) => Promise<unknown>;
  runInteractiveMenu: (cwd: string, options: SetupCommandOptions) => Promise<unknown>;
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

function presetNames(): string[] {
  return fs
    .readdirSync(PRESETS_DIR)
    .filter((file: string) => file.endsWith('.json'))
    .map((file: string) => file.replace(/\.json$/, ''))
    .sort();
}

function configFor(options: SetupCommandOptions = {}) {
  const profile = options.profile || options.language || 'en-US';
  return `version: 1

project:
  name: ${options.name || 'example-project'}
  default_branch: ${options.branch || 'main'}

agent:
  target: ${options.agent || 'generic'}

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

function writeUsageGuide(cwd: string, locale: string) {
  const source = path.join(PACKAGE_ROOT, 'shared', 'templates', 'usage.template.md');
  const destination = sddJoin(cwd, 'usage.md');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  log('PASS', `wrote ${SDD_PATHS.usage}`, locale);
}

function applyLocalGitExclude(cwd: string, locale: string) {
  const gitDir = path.join(cwd, '.git');
  if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
    log('WARN', 'init --local-git-exclude: no .git directory; skipped (Git is optional)', locale);
    return;
  }
  const infoDir = path.join(gitDir, 'info');
  const excludePath = path.join(infoDir, 'exclude');
  fs.mkdirSync(infoDir, { recursive: true });
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
  if (options.localGitExclude) applyLocalGitExclude(cwd, locale);
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

function init(cwd: string, options: InitOptions & SetupCommandOptions = {}) {
  const mode = resolveMode({ quiet: options.quiet, ascii: Boolean(options.ascii) });
  const locale = localeFor(cwd, options.profile || options.language);
  applyInitSideEffects(cwd, { ...options, locale });
  const configPath = sddJoin(cwd, 'config.yml');
  if (fs.existsSync(configPath)) {
    log('WARN', `preserved existing ${SDD_PATHS.config}`);
    return false;
  }
  for (const relative of [SDD_PATHS.snapshots, SDD_PATHS.reports, '.specs/features']) {
    fs.mkdirSync(path.join(cwd, relative), { recursive: true });
  }
  fs.writeFileSync(configPath, configFor(options), 'utf8');
  logPassLine(t(locale, 'init.createdConfig', { path: SDD_PATHS.config }), {
    mode,
    quiet: options.quiet,
  });
  logPassLine(t(locale, 'init.createdDirectories'), { mode, quiet: options.quiet });
  if (options.presetName) {
    const aliasNote = options.presetAlias ? ` (alias: ${options.presetAlias})` : '';
    log('INFO', `preset ${options.presetName}${aliasNote}`);
    log('INFO', `execution_mode: ${options.executionMode || 'guided'}`);
    log('INFO', `autonomy_level: ${options.autonomyLevel || 'manual'}`);
  }
  discoverProject(cwd, { force: false, quiet: true, ascii: Boolean(options.ascii) });
  if (!options.quiet) {
    nextStep('npx sdd-agentic-flow install core', { quiet: options.quiet, mode });
    process.stdout.write(`\n${printUsageGuidePointer(cwd)}`);
  }
  return true;
}

function validValue(value: string, allowed: readonly string[]) {
  return allowed.includes(value) ? value : null;
}

function onboardingStateFor(cwd: string) {
  const skillsRoot = resolveSkillsRoot(cwd);
  return resolveOnboardingState({
    hasConfig: fs.existsSync(sddJoin(cwd, 'config.yml')),
    hasSkills: coreSkillsPresence(skillsRoot).missing.length === 0,
    hasContext: fs.existsSync(sddJoin(cwd, 'context', 'project-context.md')),
    doctorStatus: severity(doctorChecks(cwd)),
  });
}

function savedSetupProfile(cwd: string): Record<string, unknown> | null {
  const saved = readInstallConfig(os.homedir()) || defaultInstallConfig();
  const project = saved.projects[repositoryKey(cwd)];
  if (project?.packs?.length)
    return { scope: 'project', profile: project as Record<string, unknown> };
  if (saved.user?.packs?.length) return { scope: 'user', profile: saved.user };
  return null;
}

function setupDraft(cwd: string, state: string): SetupDraft {
  const saved = savedSetupProfile(cwd);
  const profile = (saved?.profile ?? {}) as {
    packs?: string[];
    targets?: string[];
    sharing?: string;
  };
  return {
    install: state !== 'NEW_PROJECT',
    scope: (saved?.scope as string | undefined) || 'user',
    pack: profile.packs?.[0] || 'full',
    targets: profile.targets || [...DEFAULT_USER_TARGETS],
    projectLocalExclude: profile.sharing === 'local',
    saved,
  };
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

function setupLocationLabel(pack: string, scope: string, options: SetupCommandOptions = {}) {
  return `${pack} ${isRich(resolveMode({ ascii: Boolean(options.ascii) })) ? '·' : '-'} ${scope}`;
}

function printSetupReview(draft: SetupDraft, locale: string, options: SetupCommandOptions = {}) {
  process.stdout.write(`\n${t(locale, 'setup.review')}\n\n`);
  process.stdout.write(`  ${t(locale, 'setup.project')}      ${SDD_PATHS.config}\n`);
  if (!draft.install) {
    process.stdout.write(
      `  ${t(locale, 'setup.location')}       ${t(locale, 'setup.existingUser')}\n`,
    );
    return;
  }
  process.stdout.write(
    `  ${t(locale, 'setup.location')}       ${setupLocationLabel(asString(draft.pack), asString(draft.scope), options)}\n`,
  );
  if (draft.scope === 'user')
    process.stdout.write(
      `  ${t(locale, 'install.targets')}      ${(draft.targets ?? []).join(', ')}\n`,
    );
  else
    process.stdout.write(
      `  ${t(locale, 'install.projectSharing')}   ${draft.projectLocalExclude ? t(locale, 'setup.local') : t(locale, 'setup.shared')}\n`,
    );
  process.stdout.write(`  ${t(locale, 'setup.context')}      ${SDD_PATHS.projectContext}\n`);
}

function printCurrentSetup(cwd: string, locale: string) {
  const config = readConfig(sddJoin(cwd, 'config.yml'));
  const saved = savedSetupProfile(cwd);
  const state = onboardingStateFor(cwd);
  const workflow = config.ok ? (config.policy?.executionMode ?? '') : 'guided';
  const location = saved
    ? setupLocationLabel(
        asString(
          (saved.profile as InstallProjectProfile | InstallConfig['user']).packs?.join(', '),
        ),
        asString(saved.scope),
      )
    : t(locale, 'setup.missing');
  const context = fs.existsSync(sddJoin(cwd, 'context', 'project-context.md'))
    ? t(locale, 'setup.ready')
    : t(locale, 'setup.missing');
  const health =
    state === 'READY'
      ? t(locale, 'setup.ready')
      : state === 'PARTIAL'
        ? t(locale, 'setup.partial')
        : t(locale, 'setup.attention');
  process.stdout.write(
    `\n${t(locale, 'setup.current')}\n\n` +
      `  ${t(locale, 'setup.workflow')}     ${workflow}\n` +
      `  ${t(locale, 'setup.location')}       ${location}\n` +
      `  ${t(locale, 'setup.context')}      ${context}\n` +
      `  ${t(locale, 'setup.health')}       ${health}\n`,
  );
}

async function customizeSetup(draft: SetupDraft, locale: string, options: SetupCommandOptions) {
  const pack = await select(
    t(locale, 'setup.pack'),
    ['full', ...presetNames().filter((name: string) => name !== 'full')].map((value: string) => ({
      value,
      label: value,
    })),
    { ascii: Boolean(options.ascii), cancelValues: ['q', '0'], locale },
  );
  if (pack.cancelled) return null;
  const scope = await select(
    t(locale, 'setup.scope'),
    [
      { value: 'user', label: t(locale, 'setup.scopeUser') },
      { value: 'project', label: t(locale, 'setup.scopeProject') },
    ],
    { ascii: Boolean(options.ascii), cancelValues: ['q', '0'], locale },
  );
  if (scope.cancelled) return null;
  const packValue = selectionString(pack);
  const scopeValue = selectionString(scope);
  if (!packValue || !scopeValue) return null;
  const next: SetupDraft = {
    ...draft,
    install: true,
    pack: packValue,
    scope: scopeValue,
  };
  if (next.scope === 'user') {
    const targets = await select(
      t(locale, 'setup.targets'),
      Object.entries(USER_TARGETS).map(([value, target]) => ({
        value,
        label:
          target[0] === '.agents'
            ? 'Shared Agent Skills'
            : USER_TARGET_LABELS[value as keyof typeof USER_TARGET_LABELS],
        selected: (next.targets ?? []).includes(value),
      })),
      { multiple: true, ascii: Boolean(options.ascii), cancelValues: ['q', '0'], locale },
    );
    const selectedTargets = selectionStrings(targets);
    if (targets.cancelled || !selectedTargets.length) return null;
    next.targets = selectedTargets;
  } else {
    const sharing = await select(
      t(locale, 'setup.sharing'),
      [
        { value: 'shared', label: t(locale, 'setup.shared') },
        { value: 'local', label: t(locale, 'setup.local') },
      ],
      { ascii: Boolean(options.ascii), cancelValues: ['q', '0'], locale },
    );
    if (sharing.cancelled) return null;
    next.projectLocalExclude = selectionString(sharing) === 'local';
  }
  return next;
}

async function applySetup(
  cwd: string,
  draft: SetupDraft,
  options: SetupCommandOptions,
  locale: string,
) {
  const { install } = requireCommandDeps();
  process.exitCode = undefined;
  printSetupStages(locale, 'validation', ['project', 'skills', 'context'], options);
  process.stdout.write(`\n${t(locale, 'setup.apply')}\n`);
  init(cwd, {
    ...(options.language ? { profile: options.language } : {}),
    ...(options.featureProfile ? { featureProfile: options.featureProfile } : {}),
    ...(options.executionMode ? { executionMode: options.executionMode } : {}),
    ...(options.autonomyLevel ? { autonomyLevel: options.autonomyLevel } : {}),
    ...(options.presetName ? { presetName: options.presetName } : {}),
    ...(options.presetAlias ? { presetAlias: options.presetAlias } : {}),
    quiet: true,
    ...(options.localGitExclude ? { localGitExclude: options.localGitExclude } : {}),
    ascii: Boolean(options.ascii),
  });
  if (draft.install) {
    configureIntent({
      homeDir: os.homedir(),
      cwd,
      scope: draft.scope === 'project' ? 'project' : 'user',
      packs: [asString(draft.pack, 'core')],
      ...(draft.scope === 'user' && draft.targets ? { targets: draft.targets } : {}),
      ...(draft.scope === 'project'
        ? { sharing: draft.projectLocalExclude ? 'local' : 'shared' }
        : {}),
    });
    if (
      !(await install(asString(draft.pack, 'core'), cwd, {
        ...(draft.scope ? { scope: draft.scope } : {}),
        ...(draft.targets ? { targets: draft.targets } : {}),
        ...(draft.projectLocalExclude ? { projectLocalExclude: draft.projectLocalExclude } : {}),
        quiet: true,
        ascii: Boolean(options.ascii),
      }))
    )
      return false;
  }
  const result = await doctor(cwd, { ascii: Boolean(options.ascii) });
  if (result.status === 'PASS') {
    log('PASS', t(locale, 'setup.ready'), locale);
    return true;
  }
  return false;
}

async function guidedInit(cwd: string, options: SetupCommandOptions = {}) {
  const { upgradeCommand, runCommand, runInteractiveMenu } = requireCommandDeps();
  const state = onboardingStateFor(cwd);
  const locale = localeFor(cwd, options.language);
  if (state === 'READY' || state === 'NEEDS_ATTENTION') {
    printCurrentSetup(cwd, locale);
    const action = await select(
      t(locale, 'menu.question'),
      [
        { value: 'keep', label: t(locale, 'menu.keep') },
        { value: 'updates', label: t(locale, 'menu.updates') },
        { value: 'change', label: t(locale, 'menu.change') },
        { value: 'validate', label: t(locale, 'menu.validate') },
        { value: 'more', label: t(locale, 'menu.more') },
      ],
      { ascii: Boolean(options.ascii), cancelValues: ['q', '0'], locale },
    );
    if (action.cancelled || action.value === 'keep') return;
    if (action.value === 'updates') return upgradeCommand(cwd, { ascii: Boolean(options.ascii) });
    if (action.value === 'change') return runCommand('configure', ['--interactive'], cwd);
    if (action.value === 'validate') return doctor(cwd, { ascii: Boolean(options.ascii) });
    return runInteractiveMenu(cwd, { showSummary: false });
  }

  for (;;) {
    let draft = setupDraft(cwd, state);
    printSetupStages(locale, 'project', [], options);
    process.stdout.write(
      `\n${state === 'NEW_PROJECT' ? t(locale, 'setup.existingUser') : t(locale, 'setup.settings')}\n`,
    );
    const pathChoice = await select(
      t(locale, 'setup.path'),
      [
        ...(draft.saved && state === 'PARTIAL'
          ? [{ value: 'resume', label: t(locale, 'setup.resume') }]
          : [{ value: 'recommended', label: t(locale, 'setup.recommended') }]),
        { value: 'customize', label: t(locale, 'setup.customize') },
      ],
      { ascii: Boolean(options.ascii), cancelValues: ['q', '0'], locale },
    );
    if (pathChoice.cancelled) return log('INFO', t(locale, 'setup.cancelled'), locale);
    if (pathChoice.value === 'customize') {
      const customized = await customizeSetup(draft, locale, options);
      if (!customized) return log('INFO', t(locale, 'setup.cancelled'), locale);
      draft = customized;
    }
    printSetupStages(locale, 'skills', ['project'], options);
    printSetupReview(draft, locale, options);
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
    for (;;) {
      if (await applySetup(cwd, draft, options, locale)) return;
      process.stdout.write(`\n${t(locale, 'setup.failed')}\n`);
      const recovery = await select(
        t(locale, 'menu.question'),
        [
          { value: 'retry', label: t(locale, 'setup.retry') },
          { value: 'change', label: t(locale, 'setup.changeChoices') },
          { value: 'validate', label: t(locale, 'menu.validate') },
          { value: 'exit', label: t(locale, 'setup.exit') },
        ],
        { ascii: Boolean(options.ascii), cancelValues: ['q', '0'], locale },
      );
      if (recovery.cancelled || recovery.value === 'exit') return;
      if (recovery.value === 'change') break;
      if (recovery.value === 'validate') await doctor(cwd, { ascii: Boolean(options.ascii) });
    }
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
    log('WARN', `${SDD_PATHS.config} already exists; init will not overwrite it`);
    const config = readConfig(configPath);
    if (config.ok) process.stdout.write(`\n${renderPolicySummary(config, mode)}\n`);
    process.stdout.write(
      '\nChange operating policy with: npx sdd-agentic-flow config policy\n' +
        'Install skills with: npx sdd-agentic-flow install core\n',
    );
    applyInitSideEffects(cwd, { localGitExclude });
    return;
  }
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
    initOptions.name = await ask(t(locale, 'init.projectName'), 'example-project', null);
    initOptions.branch = await ask(t(locale, 'init.defaultBranch'), 'main', null, 'branch');

    process.stdout.write(
      `\n${renderStep(3, 7, t(locale, 'init.agent'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    process.stdout.write(`  ${t(locale, 'init.agentHint')}\n`);
    initOptions.agent = await ask(t(locale, 'init.agentPrompt'), 'generic', [
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
    for (const [name, preset] of Object.entries(OPERATING_PRESETS)) {
      process.stdout.write(`  ${name}: ${preset.executionMode} + ${preset.autonomyLevel}\n`);
    }
    const presetPrompt = `${t(locale, 'init.presetPrompt')} [manual]: `;
    let presetRaw: string | undefined;
    if (pipedAnswers) {
      process.stdout.write(presetPrompt);
      presetRaw = pipedAnswers[answerIndex++];
    } else {
      presetRaw = rl ? await rl.question(presetPrompt) : 'manual';
    }
    const presetChoice = (presetRaw || 'manual').trim();
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
      const resolved = resolveOperatingPreset(presetChoice || 'manual');
      if (!resolved) throw new Error(`Unknown operating preset: ${presetChoice}`);
      initOptions.executionMode = resolved.executionMode;
      initOptions.autonomyLevel = resolved.autonomyLevel;
    }
    process.stdout.write(
      `\n${renderStep(6, 7, t(locale, 'init.workflow'), mode, t(locale, 'step')).join('\n')}\n`,
    );
    initOptions.source = await ask(t(locale, 'init.sourcePrompt'), 'local-files', [
      'local-files',
      'github-guidance',
    ]);
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
      localGitExclude,
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
  printCurrentSetup,
  printUsageGuidePointer,
  setSetupCommandDeps,
};
