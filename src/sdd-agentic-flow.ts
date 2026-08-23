#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import {
  type CleanUpgradeSession,
  inspectCleanUpgrade,
  prepareCleanUpgrade,
} from './clean-upgrade';
import { COMMAND_HELP, KNOWN_COMMANDS, USAGE, writeCommandHelp } from './cli-help';
import { completionFor, isRemovedCommand, lexicalConflict } from './command-registry';
import { renderPolicySummary, runConfigCommand } from './config';
import { EXECUTION_MODES, readConfig } from './config-domain';
import { configureIntent } from './configure';
import {
  doctor,
  hasOfficialSkillsAt,
  installationStatus,
  languageReport,
  officialSkillsPresence,
  resolveConfiguredAgent,
  resolveSkillsRoot,
} from './doctor';
import {
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
  printInstallPlanReport,
  readPreset,
  wireDoctorInstallSmokeDeps,
} from './install';
import { DEFAULT_USER_TARGETS, shouldUseInteractiveInstall, USER_TARGETS } from './install-domain';
import { targetLabelFor } from './install-preflight';
import { menuActionsFor, shouldShowInteractiveMenu } from './menu';
import { resolveLocale, t, translateText } from './messages';
import {
  autonomyComboValid,
  FEATURE_PROFILES,
  LANGUAGE_PROFILES,
  OPERATING_PRESET_HELP,
  PACKAGE_ROOT,
  PACKS_DIR,
  resolveAutonomyToken,
  resolveOperatingPreset,
  SDD_PATHS,
  sddJoin,
  USAGE_GUIDE_URL,
  userSkillsDirsFor,
  VERSION,
} from './paths';
import {
  autonomousResume,
  autonomyStateReport,
  contextRefresh,
  contextStatus,
} from './project-context';
import { select } from './selector';
import {
  guidedInit,
  init,
  initInteractive,
  onboardingStateFor,
  printCurrentSetup,
  setSetupCommandDeps,
} from './setup';
import {
  type DisplayMode,
  didYouMean,
  outputMode,
  renderKeyValue,
  renderSection,
  styleStatus,
  writeBrand,
} from './ui';
import { uninstall } from './uninstall';
import { checkForUpdate } from './update-check';
import {
  applyManagedPairs,
  classifyManagedPairs,
  collectManagedPairs,
  detectExecutionMode,
  detectInstalledPacks,
  formatCheckReport,
  runNpmGlobalInstall,
  writeInstallProvenance,
} from './upgrade';

type InstallationSummary = {
  mode: string;
  targets: string[];
};

type NextStepOptions = CommandOptions & {
  mode?: DisplayMode | undefined;
  quiet?: boolean | undefined;
};

type CommandOptions = {
  mode?: DisplayMode | undefined;
  quiet?: boolean | undefined;
  ascii?: boolean | undefined;
  json?: boolean | undefined;
  machine?: boolean | undefined;
  homeDir?: string | undefined;
  force?: boolean | undefined;
  plan?: boolean | undefined;
  yes?: boolean | undefined;
  nonInteractive?: boolean | undefined;
  presetName?: string | null | undefined;
  presetAlias?: string | null | undefined;
  executionMode?: string | undefined;
  autonomyLevel?: string | undefined;
  localGitExclude?: boolean | undefined;
  install?: boolean | undefined;
  scope?: string | undefined;
  pack?: string | undefined;
  targets?: string[] | undefined;
  sharing?: string | undefined;
  projectLocalExclude?: boolean | undefined;
  saved?: Record<string, unknown> | null | undefined;
  applyCommand?: string | undefined;
  locale?: string | undefined;
  language?: string | undefined;
  featureProfile?: string | undefined;
  interactive?: boolean | undefined;
  profile?: string | undefined;
  overwriteDiffers?: boolean | undefined;
  [key: string]: unknown;
};

function localeFor(cwd: string, explicit?: string) {
  return resolveLocale({ explicit, configured: languageReport(cwd).profile });
}

function log(status: string, message: string, explicitLocale?: string) {
  const locale = explicitLocale || localeFor(process.cwd());
  process.stdout.write(
    `${styleStatus(status, process.stdout)} ${translateText(locale, message)}\n`,
  );
}

function resolveMode(flags: CommandOptions = {}) {
  return outputMode({ stdout: process.stdout, stdin: process.stdin }, process.env, {
    ascii:
      Boolean(flags.ascii) || process.argv.includes('--ascii') || process.env.SDD_ASCII === '1',
    quiet: Boolean(flags.quiet),
    json: Boolean(flags.json),
  });
}

function stripAsciiFlag(args: string[]) {
  return args.filter((arg: string) => arg !== '--ascii');
}

// Structured stderr errors (What / Reason / Try). Second arg may be an exit code (legacy) or
// `{ code, reason, try }`. Did-you-mean suggestions belong in Try — never auto-executed.
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

async function askYesNo(question: string) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const raw = await rl.question(question);
    const trimmed = String(raw ?? '')
      .trim()
      .toLowerCase();
    return trimmed === 'y' || trimmed === 'yes';
  } finally {
    rl.close();
  }
}

function canPromptInteractively(mode: DisplayMode = resolveMode()) {
  return (
    mode !== 'machine' &&
    shouldShowInteractiveMenu({ stdout: process.stdout, stdin: process.stdin }, process.env)
  );
}

// Suggested-next-step block for human-rich / human-plain only. Suppressed by --quiet and
// by machine mode (pipe/CI/non-TTY/`--json`). Welcome's machine screen prints its own
// contextual next line inline — that is status prose, not this helper.
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

wireDoctorInstallSmokeDeps(init);

function renderInstallationSummaryBlock(
  summary: InstallationSummary,
  mode: DisplayMode,
  locale = 'en-US',
) {
  const lines = [];
  lines.push(...renderSection(locale === 'pt-BR' ? 'Instalação' : 'Installation', mode));
  lines.push(...renderKeyValue(locale === 'pt-BR' ? 'Modelo' : 'Mode', summary.mode, mode));
  lines.push(
    ...renderKeyValue(
      locale === 'pt-BR' ? 'Destinos' : 'Targets',
      summary.targets.length ? summary.targets.join(', ') : '(none detected)',
      mode,
    ),
  );
  return lines.join('\n');
}

function renderPolicySummaryBlock(
  config: import('./config-domain').ReadConfigResult,
  mode: DisplayMode,
  locale = 'en-US',
) {
  return renderPolicySummary(config, mode, locale);
}

function installationSummaryForWelcome(cwd: string) {
  const projectScopeRoot = path.join(cwd, '.agents', 'skills');
  const skillsRoot = resolveSkillsRoot(cwd);
  const mode =
    skillsRoot === projectScopeRoot && fs.existsSync(projectScopeRoot)
      ? 'Project / Team'
      : 'Local / User';
  const targets = [];
  for (const dir of userSkillsDirsFor(resolveConfiguredAgent(cwd)) ?? []) {
    if (installationStatus(dir)) targets.push(targetLabelFor(dir));
  }
  if (mode === 'Project / Team' && installationStatus(projectScopeRoot)) {
    targets.push('Project .agents/skills');
  }
  return { mode, targets: [...new Set(targets)] };
}

function learnSdd(cwd: string) {
  const docPath = path.join(PACKAGE_ROOT, 'docs', 'what-is-sdd.md');
  const relative = fs.existsSync(docPath) ? 'docs/what-is-sdd.md' : null;
  const locale = localeFor(cwd);
  process.stdout.write(
    `${t(locale, 'learn.body')}\n\n` +
      `${t(locale, 'learn.controlPlane')}\n\n` +
      (relative
        ? `${t(locale, 'learn.readMore')}: ${relative}\n`
        : `${t(locale, 'learn.readMore')}: docs/what-is-sdd.md\n`) +
      `\n${t(locale, 'learn.workflowGuide')}: ${USAGE_GUIDE_URL}\n`,
  );
}

function help(command?: string): boolean | undefined {
  if (command) {
    if (isRemovedCommand(command)) {
      fail(`unknown command: ${command}.`, {
        reason: 'This command was removed from the v5 canonical interface.',
        try: ['sdd-agentic-flow help'],
      });
      return false;
    }
    const topic = COMMAND_HELP[command];
    if (!topic) {
      const hint = didYouMeanTry(command, KNOWN_COMMANDS);
      fail(`unknown command: ${command}.`, {
        reason: 'That name is not a CLI command topic.',
        try: ['sdd-agentic-flow help', ...(hint ? [hint] : [])],
      });
      return false;
    }
    process.stdout.write(topic);
    return true;
  }
  process.stdout.write(
    `sdd-agentic-flow ${VERSION}

Spec Driven Development toolkit for AI coding agents.

QUICK START
  npx sdd-agentic-flow
  npx sdd-agentic-flow init
  npx sdd-agentic-flow install full
  npx sdd-agentic-flow doctor

START
  init [--interactive] [--language en-US|pt-BR] [--feature-profile ...] [--preset ...] [--execution-mode ...] [--autonomy-level ...] [--local-git-exclude] [--quiet]  Guided setup or local configuration
  install <pack> [--scope user|project] [--target agents|cursor|claude|copilot] [--plan] [--interactive] [--quiet]  Install a pack
  doctor [--json] [--harness] [--smoke] [--contracts] [--autonomy] [--verbose] [--check-updates]  Validate package or project setup

OPERATE
  config [show|policy|installation]       Inspect policy or saved installation intent
  context [status|refresh|autonomy-state]  Show or refresh project context provenance, or autonomy loop state
  upgrade [--check|--plan|--skills-only] Check for / apply CLI and skills updates (confirm-gated)
  autonomous-resume [--force] [--override-guard=N --reason=...]  Resume an autonomous workflow paused at a guardrail

INSPECT / LEARN
  list                                   List packs
  learn-sdd                              One-screen SDD summary
  help [command]                         Show this reference, or detailed help for one command
  version                                Show CLI version
  completion bash|zsh|fish               Print deterministic shell completion

REMOVE
  uninstall --plan | --yes [--purge] [--scope user|project|all] [--target agents|cursor|claude|copilot] [--quiet]  Remove managed assets

MORE HELP
  npx sdd-agentic-flow help <command>
  npx sdd-agentic-flow <command> --help
`,
  );
  return undefined;
}

// Bare `npx sdd-agentic-flow` (no command) always prints this read-only status screen first —
// it detects state and points at exactly one next command, and never mutates anything on its
// own. When the process is genuinely interactive (both stdout and stdin are a real TTY, and
// process.env.CI is not set — see bin/menu.js's shouldShowInteractiveMenu), main() additionally
// offers a numbered menu below this screen (runInteractiveMenu); selecting an entry runs the
// exact same runCommand() the equivalent explicit CLI command uses, never a second, weaker
// implementation, and the destructive-adjacent "uninstall" entry only ever runs `--plan`,
// explaining afterward how to run `--apply` explicitly. In every other case — piped, scripted,
// CI, agent-invoked, or an explicit `help`/`--help`/`-h`/any explicit command — behavior is
// unchanged from before v1.4.0: this screen only, no prompt, no implicit action, exit 0.
async function welcome(cwd: string, options: CommandOptions = {}) {
  const mode = options.mode ?? resolveMode(options);
  const locale = localeFor(cwd);
  const configPath = sddJoin(cwd, 'config.yml');
  const configFound = fs.existsSync(configPath);
  const projectScopeRoot = path.join(cwd, '.agents', 'skills');
  const skillsRoot = resolveSkillsRoot(cwd);
  const presence = officialSkillsPresence(skillsRoot);
  const skillsInstalled = presence.missing.length === 0;
  const skillsPartial = !skillsInstalled && presence.present.length > 0;
  const contextFound = fs.existsSync(sddJoin(cwd, 'context', 'project-context.md'));

  if (mode === 'human-rich') {
    // Full embedded chevron art — human TTY only; never machine/pipe/CI.
    // human-rich: left→right band reveal (~160ms); plain / SDD_BRAND_ANIMATE=0: instant.
    await writeBrand(mode, process.stdout, process.env, {
      ...(options.quiet ? { quiet: options.quiet } : {}),
    });
    process.stdout.write(
      `sdd-agentic-flow ${VERSION}\n\n` +
        `  ${locale === 'pt-BR' ? 'Harness orientado a especificações para fluxos guiados por humanos.' : 'Spec-driven agent harness for human-guided workflows.'}\n\n`,
    );
  } else {
    process.stdout.write(
      `sdd-agentic-flow ${VERSION}\n` +
        `${t(locale, 'welcome.description')}\n\n${t(locale, 'welcome.status')}\n`,
    );
  }

  const configLabel = configFound
    ? `${SDD_PATHS.config} ${t(locale, 'welcome.configFound')}`
    : `${SDD_PATHS.config} ${t(locale, 'welcome.configMissing')}`;
  const skillsLabel = skillsInstalled
    ? `${t(locale, 'welcome.skillsInstalled')} (${skillsRoot === projectScopeRoot ? 'project' : 'user'} scope: ${skillsRoot})`
    : skillsPartial
      ? `partial skill install detected (${presence.present.length} present) — re-run \`sdd-agentic-flow install full\` to repair`
      : `${t(locale, 'welcome.noSkills')} (project or user scope)`;
  const contextLabel = contextFound
    ? t(locale, 'welcome.contextGenerated')
    : t(locale, 'welcome.contextMissing');

  if (mode === 'human-rich') {
    log(
      configFound ? 'PASS' : 'INFO',
      configFound ? t(locale, 'welcome.configFound') : t(locale, 'welcome.configMissing'),
    );
    log(
      skillsInstalled ? 'PASS' : skillsPartial ? 'WARN' : 'INFO',
      skillsInstalled
        ? t(locale, 'welcome.skillsInstalled')
        : skillsPartial
          ? skillsLabel
          : t(locale, 'welcome.noSkills'),
    );
    if (contextFound) log('PASS', t(locale, 'welcome.contextGenerated'));
    if (configFound) {
      const config = readConfig(configPath);
      if (config.ok) {
        process.stdout.write(`\n${renderPolicySummaryBlock(config, mode, locale)}\n`);
      }
      if (skillsInstalled || skillsPartial) {
        const installSummary = installationSummaryForWelcome(cwd);
        process.stdout.write(`\n${renderInstallationSummaryBlock(installSummary, mode, locale)}\n`);
      }
    }
  } else {
    log(configFound ? 'PASS' : 'INFO', configLabel);
    log(skillsInstalled ? 'PASS' : skillsPartial ? 'WARN' : 'INFO', skillsLabel);
    log(contextFound ? 'PASS' : 'INFO', contextLabel);
  }

  const suggested = !configFound
    ? 'npx sdd-agentic-flow init'
    : !skillsInstalled
      ? 'npx sdd-agentic-flow install full'
      : 'Use your coding agent with the installed SAF workflow.';
  if (mode === 'machine') {
    // Compact status screen (CLI-001): contextual next + quick commands; not nextStep().
    process.stdout.write(
      `\n${t(locale, 'init.next')}\n` +
        `  ${suggested}\n\n` +
        `${t(locale, 'welcome.quickCommands')}\n` +
        (!configFound
          ? '  npx sdd-agentic-flow init              Create local configuration\n  npx sdd-agentic-flow learn-sdd         Learn the workflow\n'
          : !skillsInstalled
            ? '  npx sdd-agentic-flow install full       Install the full skill pack\n  npx sdd-agentic-flow config installation  Change installation intent\n  npx sdd-agentic-flow doctor             Validate local setup\n'
            : '  npx sdd-agentic-flow doctor             Validate local setup\n  npx sdd-agentic-flow config policy      Change operating policy\n  npx sdd-agentic-flow uninstall --plan   Preview what would be removed\n') +
        '\n' +
        `${t(locale, 'welcome.help')}\n\n` +
        `${t(locale, 'welcome.update')}\n` +
        '  npx sdd-agentic-flow upgrade\n' +
        '  (read-only: doctor --check-updates / upgrade --check)\n',
    );
  } else {
    nextStep(suggested, { quiet: options.quiet, mode });
    process.stdout.write(
      !configFound
        ? `\n${t(locale, 'welcome.quickCommands')}\n  npx sdd-agentic-flow learn-sdd\n  npx sdd-agentic-flow help\n`
        : !skillsInstalled
          ? `\n${t(locale, 'welcome.quickCommands')}\n  npx sdd-agentic-flow install full --plan\n  npx sdd-agentic-flow configure\n  npx sdd-agentic-flow doctor\n`
          : `\n${t(locale, 'welcome.optionalMaintenance')}\n  npx sdd-agentic-flow doctor\n  npx sdd-agentic-flow config policy\n  npx sdd-agentic-flow context refresh\n  npx sdd-agentic-flow upgrade\n  npx sdd-agentic-flow uninstall --plan\n`,
    );
    process.stdout.write(
      `\n${t(locale, 'welcome.update')}\n` +
        '  npx sdd-agentic-flow upgrade\n' +
        '  (read-only: doctor --check-updates / upgrade --check)\n',
    );
  }
}

function refreshSkillsAtTarget(
  target: string,
  packs: string[],
  { overwriteDiffers = false }: { overwriteDiffers?: boolean } = {},
) {
  const totals = {
    installed: 0,
    refreshed: 0,
    skippedIdentical: 0,
    skippedDiffers: 0,
    differs: [] as string[],
  };
  for (const pack of packs) {
    const preset = readPreset(pack);
    if (!preset) continue;
    const pairs = collectManagedPairs(PACKAGE_ROOT, preset, target);
    const classified = classifyManagedPairs(pairs);
    totals.differs.push(...classified.differs.map((pair: { rel: string }) => pair.rel));
    totals.skippedIdentical += classified.identical.length;
    const missingSummary = applyManagedPairs(classified.missing, { overwriteDiffers: true });
    totals.installed += missingSummary.installed;
    if (overwriteDiffers) {
      const diffSummary = applyManagedPairs(classified.differs, { overwriteDiffers: true });
      totals.refreshed += diffSummary.refreshed;
    } else {
      totals.skippedDiffers += classified.differs.length;
    }
  }
  if (totals.installed + totals.refreshed > 0) writeInstallProvenance(target, VERSION);
  return totals;
}

async function refreshInstalledSkills(cwd: string, options: CommandOptions = {}) {
  const mode = options.mode ?? resolveMode(options);
  const interactive = Boolean(options.interactive && canPromptInteractively(mode));
  const skillsRoot = resolveSkillsRoot(cwd);
  let packs: string[] = [];

  const projectRoot = path.join(cwd, '.agents', 'skills');
  const targets = [];
  if (hasOfficialSkillsAt(projectRoot) || installationStatus(projectRoot))
    targets.push(projectRoot);
  for (const dir of userSkillsDirsFor(resolveConfiguredAgent(cwd), options.homeDir) ?? []) {
    if (installationStatus(dir) && !targets.includes(dir)) targets.push(dir);
  }
  if (!targets.length) targets.push(skillsRoot);

  const cleanupInspection = inspectCleanUpgrade({
    cwd,
    ...(options.homeDir ? { homeDir: options.homeDir } : {}),
    targetRoots: targets,
  });
  if (cleanupInspection.state === 'future' || cleanupInspection.state === 'unknown') {
    log('FAIL', cleanupInspection.blockedReason || 'clean upgrade blocked before writes');
    return { ok: false, blocked: true };
  }
  packs =
    cleanupInspection.state === 'legacy' ? ['full'] : detectInstalledPacks(skillsRoot, PACKS_DIR);
  if (!packs.length) {
    log('WARN', 'no installed packs detected to refresh');
    process.stdout.write('No changes were made.\n');
    return { ok: true, skipped: true };
  }

  let cleanUpgrade: CleanUpgradeSession | null = null;
  try {
    if (cleanupInspection.state === 'legacy') cleanUpgrade = prepareCleanUpgrade(cleanupInspection);

    let allDiffers: string[] = [];
    for (const target of targets) {
      for (const pack of packs) {
        const preset = readPreset(pack);
        if (!preset) continue;
        const classified = classifyManagedPairs(collectManagedPairs(PACKAGE_ROOT, preset, target));
        allDiffers = allDiffers.concat(
          classified.differs.map((pair: { rel: string }) => `${target}: ${pair.rel}`),
        );
      }
    }

    let overwriteDiffers = false;
    if (allDiffers.length) {
      log('WARN', `${allDiffers.length} managed file(s) differ from the bundled package`);
      for (const line of allDiffers.slice(0, 20)) process.stdout.write(`  ${line}\n`);
      if (allDiffers.length > 20) process.stdout.write(`  … and ${allDiffers.length - 20} more\n`);
      if (interactive) {
        overwriteDiffers = await askYesNo(
          'Overwrite differing managed files with the bundled package? [y/N] ',
        );
        if (!overwriteDiffers) {
          log('WARN', 'skipped differing files (no silent overwrite)');
        }
      } else {
        log('WARN', 'non-interactive: never overwriting differing managed files');
      }
    }

    let wrote = 0;
    let skippedDiffers = 0;
    for (const target of targets) {
      const summary = refreshSkillsAtTarget(target, packs, { overwriteDiffers });
      wrote += summary.installed + summary.refreshed;
      skippedDiffers += summary.skippedDiffers;
      log(
        'PASS',
        `refreshed ${packs.join(', ')} at ${target}: ${summary.installed} new, ${summary.refreshed} updated, ${summary.skippedIdentical} identical, ${summary.skippedDiffers} differed (skipped)`,
      );
    }

    if (!wrote && skippedDiffers) {
      log('WARN', 'no skill files refreshed (all candidates differed or were identical)');
      process.stdout.write('Recovery:\n  sdd-agentic-flow upgrade --skills-only\n');
    }
    cleanUpgrade?.commit();
    return { ok: true, wrote, skippedDiffers, packs };
  } catch (error) {
    cleanUpgrade?.rollback();
    throw error;
  }
}

async function upgradeCommand(cwd: string, options: CommandOptions = {}) {
  const mode = resolveMode({ quiet: options.quiet, ascii: Boolean(options.ascii) });
  const interactive = canPromptInteractively(mode) && !options.check && !options.plan;
  const execMode = detectExecutionMode(PACKAGE_ROOT);

  if (options.skillsOnly) {
    if (options.plan) {
      const skillsRoot = resolveSkillsRoot(cwd);
      const packs = detectInstalledPacks(skillsRoot, PACKS_DIR);
      process.stdout.write(
        `Execution mode: ${execMode}\n` +
          `Registry check: none (--skills-only)\n` +
          `CLI package: unchanged\n` +
          `Plan:\n  1. Refresh installed packs from the currently executing package (${VERSION})\n` +
          `     packs: ${packs.length ? packs.join(', ') : '(none detected)'}\n\n` +
          'Mutations (if applied):\n  managed skill files (after confirms / diff rules)\n\n' +
          'No changes were made.\n',
      );
      return;
    }
    await refreshInstalledSkills(cwd, { mode, interactive, homeDir: options.homeDir });
    return;
  }

  const result = await checkForUpdate({ currentVersion: VERSION });

  if (options.check || (!interactive && !options.plan)) {
    process.stdout.write(formatCheckReport(result));
    if (!result.reachable) {
      process.stdout.write('\nNo changes were made.\n\nTo retry:\n  sdd-agentic-flow upgrade\n');
      process.exitCode = 1;
      return;
    }
    if (!options.check && result.updateAvailable) {
      process.stdout.write(
        '\nThis invocation is non-interactive; no mutations were performed.\n' +
          'Run `sdd-agentic-flow upgrade` in a TTY to confirm CLI/skills updates.\n',
      );
    }
    return;
  }

  if (options.plan) {
    const skillsRoot = resolveSkillsRoot(cwd);
    const packs = detectInstalledPacks(skillsRoot, PACKS_DIR);
    if (!result.reachable) {
      log('WARN', 'unable to check for updates');
      process.stdout.write(
        '\nReason:\n  network unavailable or registry unreachable\n\nNo changes were made.\n\nTo retry:\n  sdd-agentic-flow upgrade --plan\n',
      );
      process.exitCode = 1;
      return;
    }
    process.stdout.write(
      `Current CLI: ${VERSION}\n` +
        `Latest CLI: ${result.latest}\n` +
        `Execution mode: ${execMode}\n\n` +
        'Plan:\n',
    );
    if (result.updateAvailable) {
      if (execMode === 'global')
        process.stdout.write(`  1. Upgrade CLI → ${result.latest} (npm install -g)\n`);
      else
        process.stdout.write(
          `  1. Re-run via npx/local: npx sdd-agentic-flow@latest (no in-process self-replace)\n`,
        );
      process.stdout.write(
        `  2. Refresh installed packs: ${packs.length ? packs.join(', ') : '(none detected)'}\n`,
      );
    } else {
      process.stdout.write('  1. CLI already up to date — no package install\n');
      process.stdout.write(
        `  2. Optional skills refresh from current package: ${packs.length ? packs.join(', ') : '(none detected)'}\n`,
      );
    }
    process.stdout.write(
      '\nMutations (if applied):\n  npm global installation (global mode only)\n' +
        '  managed skill files (after confirms / diff rules)\n\nNo changes were made.\n',
    );
    return;
  }

  // Interactive path
  if (!result.reachable) {
    log('WARN', 'unable to check for updates');
    process.stdout.write(
      '\nReason:\n  network unavailable or registry unreachable\n\nNo changes were made.\n\nTo retry:\n  sdd-agentic-flow upgrade\n',
    );
    return;
  }

  if (!result.updateAvailable) {
    log('PASS', `up to date (${VERSION})`);
    const refreshAnyway = await askYesNo(
      'Refresh installed skills from this package anyway? [y/N] ',
    );
    if (refreshAnyway) await refreshInstalledSkills(cwd, { mode, interactive: true });
    return;
  }

  log('WARN', `update available: ${VERSION} -> ${result.latest}`);
  let cliOk = null;
  const upgradeCli = await askYesNo(`Upgrade CLI to ${result.latest} now? [y/N] `);
  if (upgradeCli) {
    if (execMode === 'global') {
      try {
        process.stdout.write(`Running: npm install -g sdd-agentic-flow@latest\n`);
        runNpmGlobalInstall();
        log('PASS', `CLI upgraded toward ${result.latest}`);
        cliOk = true;
      } catch (error) {
        cliOk = false;
        fail(`CLI upgrade failed: ${errorMessage(error)}`, {
          reason: 'npm install -g exited non-zero.',
          try: ['npm install -g sdd-agentic-flow@latest', 'sdd-agentic-flow upgrade --skills-only'],
        });
      }
    } else {
      process.stdout.write(
        '\nThis session is running via npx/local, so the CLI cannot self-replace in-place.\n\n' +
          'Run:\n  npx sdd-agentic-flow@latest\n\n' +
          'Then, if you want skills refreshed from that newer package:\n' +
          '  npx sdd-agentic-flow@latest upgrade --skills-only\n',
      );
      return;
    }
  }

  const refreshSkills = await askYesNo('Refresh installed skills from this package? [y/N] ');
  let skillsOk = null;
  if (refreshSkills) {
    try {
      await refreshInstalledSkills(cwd, { mode, interactive: true });
      skillsOk = true;
    } catch (error) {
      skillsOk = false;
      log('FAIL', `skill refresh failed: ${errorMessage(error)}`);
    }
  }

  if (cliOk === true && skillsOk === false) {
    process.stdout.write(
      '\nCLI upgrade succeeded.\nSkill refresh failed.\n\n' +
        `Result:\n  CLI: toward ${result.latest}\n  skills: previous / partial\n\n` +
        'No automatic rollback was attempted.\n\nRecovery:\n  sdd-agentic-flow upgrade --skills-only\n',
    );
    process.exitCode = 1;
  }
}

async function runCommand(command: string, rawArgs: string[], cwd: string) {
  const args = stripAsciiFlag(rawArgs);
  const ascii = rawArgs.includes('--ascii') || process.env.SDD_ASCII === '1';
  const conflict = lexicalConflict(rawArgs);
  if (conflict) {
    fail(`usage error: ${conflict}`, {
      reason: 'Flags conflict lexically and are rejected before preflight.',
    });
    return;
  }
  const removedOption =
    command === 'init'
      ? rawArgs.find((arg) => ['--en', '--br', '--non-interactive'].includes(arg))
      : command === 'install'
        ? rawArgs.find((arg) => ['--agent', '--non-interactive'].includes(arg))
        : command === 'uninstall'
          ? rawArgs.find((arg) =>
              ['--apply', '--include-config', '--full', '--agent'].includes(arg),
            )
          : undefined;
  if (removedOption) {
    fail(`usage error: removed option ${removedOption}`, {
      reason: 'The v5 command grammar does not accept this legacy option.',
      try: ['sdd-agentic-flow help'],
    });
    return;
  }
  if (isRemovedCommand(command)) {
    fail(`unknown command: ${command}.`, {
      reason: 'This command was removed from the v5 canonical interface.',
      try: ['sdd-agentic-flow help'],
    });
    return;
  }
  if (command === 'list') {
    if (args.includes('--help')) {
      if (args.length > 1) {
        fail('usage: list [--help]', {
          reason: 'The list command accepts no arguments other than --help.',
          try: ['sdd-agentic-flow list', 'sdd-agentic-flow list --help'],
        });
      } else writeCommandHelp('list');
    } else if (args.length > 0) {
      fail('usage: list [--help]', {
        reason: `Unknown list argument: ${args[0]}.`,
        try: ['sdd-agentic-flow list', 'sdd-agentic-flow list --help'],
      });
    } else list();
  } else if (command === 'init') {
    const usage = USAGE.init;
    if (args.includes('--help')) writeCommandHelp('init');
    else {
      if (
        args.includes('--preset') &&
        (args.includes('--execution-mode') || args.includes('--autonomy-level'))
      ) {
        fail('init --preset cannot combine with --execution-mode or --autonomy-level.', {
          reason: 'Choose a preset or set the two fields explicitly, not both.',
          try: [
            'sdd-agentic-flow init --preset manual',
            'sdd-agentic-flow init --execution-mode full --autonomy-level supervised',
          ],
        });
        return;
      }
      let interactive = false;
      let nonInteractive = false;
      let language = 'en-US';
      let featureProfile = 'medium_feature';
      let executionMode = 'guided';
      let autonomyLevel = 'manual';
      let quiet = false;
      let localGitExclude = false;
      let presetName = null;
      let presetAlias = null;
      let policyFromCli = false;
      for (let index = 0; index < args.length; index += 1) {
        if (args[index] === '--interactive') interactive = true;
        else if (args[index] === '--non-interactive') nonInteractive = true;
        else if (args[index] === '--en') language = 'en-US';
        else if (args[index] === '--br') language = 'pt-BR';
        else if (args[index] === '--quiet') quiet = true;
        else if (args[index] === '--local-git-exclude') localGitExclude = true;
        else if (
          args[index] === '--language' &&
          LANGUAGE_PROFILES.includes(asString(args[index + 1]))
        ) {
          language = asString(args[index + 1]);
          index += 1;
        } else if (
          args[index] === '--feature-profile' &&
          FEATURE_PROFILES.includes(asString(args[index + 1]))
        ) {
          featureProfile = asString(args[index + 1]);
          index += 1;
        } else if (args[index] === '--preset') {
          const resolved = resolveOperatingPreset(asString(args[index + 1]));
          if (!resolved) {
            fail(`unknown --preset ${asString(args[index + 1]) || '(missing)'}.`, {
              reason: `Presets are ${OPERATING_PRESET_HELP}.`,
              try: [
                'sdd-agentic-flow init --preset manual',
                'sdd-agentic-flow init --preset supervised',
                'sdd-agentic-flow init --preset autonomous',
              ],
            });
            return;
          }
          policyFromCli = true;
          presetName = resolved.name;
          presetAlias = resolved.alias;
          executionMode = resolved.executionMode;
          autonomyLevel = resolved.autonomyLevel;
          index += 1;
        } else if (args[index] === '--execution-mode') {
          if (!(EXECUTION_MODES as readonly string[]).includes(asString(args[index + 1]))) {
            fail(usage, {
              reason: args[index + 1]
                ? `Unknown --execution-mode: ${asString(args[index + 1])}`
                : 'Missing --execution-mode value.',
              try: ['sdd-agentic-flow init --execution-mode guided'],
            });
            return;
          }
          policyFromCli = true;
          executionMode = asString(args[index + 1]);
          index += 1;
        } else if (args[index] === '--autonomy-level') {
          const resolved = resolveAutonomyToken(asString(args[index + 1]));
          if (!resolved) {
            fail(usage, {
              reason: args[index + 1]
                ? `Unknown --autonomy-level: ${asString(args[index + 1])}`
                : 'Missing --autonomy-level value.',
              try: ['sdd-agentic-flow init --autonomy-level manual'],
            });
            return;
          }
          policyFromCli = true;
          autonomyLevel = resolved;
          index += 1;
        } else {
          fail(usage);
          return;
        }
      }
      if (interactive && nonInteractive) {
        fail('init --interactive cannot combine with --non-interactive');
        return;
      }
      if (!autonomyComboValid(executionMode, autonomyLevel)) {
        fail(
          `--execution-mode ${executionMode} cannot combine with --autonomy-level ${autonomyLevel} (see docs/autonomy-levels.md).`,
        );
        return;
      }
      const canOnboard = shouldUseInteractiveInstall({
        stdinIsTTY: process.stdin.isTTY,
        stdoutIsTTY: process.stdout.isTTY,
        ci: Boolean(process.env.CI),
        plan: false,
        quiet,
        nonInteractive,
        machine: resolveMode({ quiet, ascii }) === 'machine',
      });
      const initOptions = {
        language,
        featureProfile,
        ...(policyFromCli ? { executionMode, autonomyLevel, presetName, presetAlias } : {}),
        policyFromCli,
        quiet,
        localGitExclude,
        ascii,
      };
      if (canOnboard) await guidedInit(cwd, initOptions);
      else if (interactive)
        await initInteractive(
          cwd,
          language,
          featureProfile,
          quiet,
          executionMode,
          autonomyLevel,
          localGitExclude,
        );
      else
        init(cwd, {
          ...initOptions,
          profile: language,
          executionMode,
          autonomyLevel,
          ...(presetName ? { presetName, presetAlias } : {}),
        });
    }
  } else if (command === 'context') {
    if (args.includes('--help')) writeCommandHelp('context');
    else {
      const sub = args[0] || 'status';
      if (args.length > 1 || !['status', 'refresh', 'autonomy-state'].includes(sub)) {
        const hint = didYouMeanTry(sub, ['status', 'refresh', 'autonomy-state']);
        fail('usage: context [status|refresh|autonomy-state]', {
          reason: 'Only status, refresh, and autonomy-state subcommands are supported.',
          try: [
            'sdd-agentic-flow context status',
            'sdd-agentic-flow context refresh',
            'sdd-agentic-flow context autonomy-state',
            ...(hint ? [hint] : []),
          ],
        });
      }
      if (sub === 'status') contextStatus(cwd);
      else if (sub === 'refresh') contextRefresh(cwd, { ascii });
      else autonomyStateReport(cwd);
    }
  } else if (command === 'config') {
    if (args[0] === 'installation') {
      await runCommand('__config-installation', args.slice(1), cwd);
      return;
    }
    const configPath = sddJoin(cwd, 'config.yml');
    if (args.includes('--help')) {
      writeCommandHelp('config');
      return;
    }
    const result = await runConfigCommand(configPath, args, { ascii });
    if (!result.ok) {
      fail(result.message || 'config command failed', {
        try: result.try || [
          'sdd-agentic-flow config show',
          'sdd-agentic-flow config policy --plan',
        ],
      });
    }
  } else if (command === '__config-installation') {
    if (args.includes('--help')) {
      writeCommandHelp('config');
      return;
    }
    let scope = 'user';
    let sharing = null;
    let plan = false;
    let interactive = false;
    const packs: string[] = [];
    const targets: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === '--plan') plan = true;
      else if (arg === '--interactive') interactive = true;
      else if (arg === '--scope' && ['user', 'project'].includes(asString(args[index + 1])))
        scope = asString(args[++index]);
      else if (arg === '--pack' && args[index + 1]) packs.push(asString(args[++index]));
      else if (arg === '--target' && Object.hasOwn(USER_TARGETS, asString(args[index + 1])))
        targets.push(asString(args[++index]));
      else if (arg === '--sharing' && ['shared', 'local'].includes(asString(args[index + 1])))
        sharing = asString(args[++index]);
      else fail(USAGE.config);
    }
    if (!packs.every((pack: string) => readPreset(pack))) fail('unknown pack in configure');
    if (interactive && plan) fail('configure --interactive cannot combine with --plan');
    const canInteract = shouldUseInteractiveInstall({
      stdinIsTTY: process.stdin.isTTY,
      stdoutIsTTY: process.stdout.isTTY,
      ci: Boolean(process.env.CI),
      plan,
      quiet: false,
      nonInteractive: false,
      machine: false,
    });
    if (interactive || (args.length === 0 && canInteract)) {
      const result = await configureInteractive(cwd, os.homedir());
      if (isConfigureCancelled(result))
        return log('INFO', t(localeFor(cwd), 'configure.cancelled'));
      if (isConfigureError(result)) {
        fail(result.error, {
          reason: 'Use valid pack and target IDs.',
          try: ['sdd-agentic-flow configure --interactive'],
        });
        return;
      }
      log('PASS', 'saved installation intent');
      const reconcilePlan = planForInstallProfile({
        cwd,
        homeDir: os.homedir(),
        scope: isProjectInstallProfile(result.after) ? 'project' : 'user',
        profile: result.after,
      });
      log(
        'INFO',
        `${t(localeFor(cwd), 'configure.savedOnly')} Run \`${installApplyCommand(reconcilePlan)}\`.`,
      );
      return;
    }
    const result = configureIntent({
      homeDir: os.homedir(),
      cwd,
      scope: scope as 'user' | 'project',
      packs,
      ...(targets.length ? { targets } : {}),
      ...(sharing ? { sharing } : {}),
      plan,
    });
    if (plan) {
      process.stdout.write(
        `${t(localeFor(cwd), 'configure.intentPreview')}\n  Scope       ${scope}\n  Packs       ${(result.after.packs || []).join(', ') || '(none)'}\n` +
          (scope === 'user' && isUserInstallProfile(result.after)
            ? `  Targets     ${(result.after.targets || DEFAULT_USER_TARGETS).join(', ')}\n`
            : isProjectInstallProfile(result.after)
              ? `  Sharing     ${result.after.sharing || 'shared'}\n`
              : '') +
          `\n${t(localeFor(cwd), 'configure.reconciliationPreview')}\n`,
      );
    } else log('PASS', `saved ${scope} installation intent`);
    const reconcilePlan = planForInstallProfile({
      cwd,
      homeDir: os.homedir(),
      scope,
      profile: result.after,
    });
    printInstallPlanReport(reconcilePlan, resolveMode({}), cwd, {
      applyCommand: installApplyCommand(reconcilePlan),
    });
    if (plan)
      process.stdout.write(
        `${t(localeFor(cwd), 'configure.saveIntent')}: ${configureCommand(scope, result.after)}\n${t(localeFor(cwd), 'configure.reconcile')}:   ${installApplyCommand(reconcilePlan)}\n`,
      );
    else
      log(
        'INFO',
        `${t(localeFor(cwd), 'configure.savedOnly')} Run \`${installApplyCommand(reconcilePlan)}\`.`,
      );
  } else if (command === 'learn-sdd') {
    if (args.includes('--help')) writeCommandHelp('learn-sdd');
    else learnSdd(cwd);
  } else if (command === 'install') {
    const usage = USAGE.install;
    if (args.includes('--help')) {
      writeCommandHelp('install');
      return;
    }
    let pack = null;
    let scope = null;
    const targets: string[] = [];
    let plan = false;
    let quiet = false;
    let interactive = false;
    let nonInteractive = false;
    let valid = true;
    for (let index = 0; index < args.length; index += 1) {
      const arg = asString(args[index]);
      if (arg === '--plan') plan = true;
      else if (arg === '--quiet') quiet = true;
      else if (arg === '--interactive') interactive = true;
      else if (arg === '--non-interactive') nonInteractive = true;
      else if (arg === '--scope' && ['user', 'project'].includes(asString(args[index + 1]))) {
        scope = asString(args[index + 1]);
        index += 1;
      } else if (arg === '--target' && args[index + 1] !== undefined) {
        const target = asString(args[index + 1]);
        if (!['agents', 'cursor', 'claude', 'copilot'].includes(target)) valid = false;
        else targets.push(target);
        index += 1;
      } else if (!arg.startsWith('--') && pack === null) pack = arg;
      else valid = false;
    }
    if (!valid || !pack || (interactive && nonInteractive)) {
      fail(usage);
      return;
    }
    const packName = pack;
    const automaticInteractive = shouldUseInteractiveInstall({
      stdinIsTTY: process.stdin.isTTY,
      stdoutIsTTY: process.stdout.isTTY,
      ci: Boolean(process.env.CI),
      plan,
      quiet,
      nonInteractive,
      machine: resolveMode({ quiet, ascii }) === 'machine',
    });
    if (interactive || automaticInteractive)
      await installInteractive(packName, cwd, {
        ...(scope ? { scope } : {}),
        ...(targets.length ? { targets } : {}),
        quiet,
        ascii,
      });
    else
      install(packName, cwd, {
        ...(scope ? { scope } : {}),
        ...(targets.length ? { targets } : {}),
        plan,
        quiet,
        ascii,
      });
  } else if (command === 'doctor') {
    if (args.includes('--help')) {
      writeCommandHelp('doctor');
      return;
    }
    let evidenceGraphSlug: string | undefined;
    let output: string | undefined;
    const doctorFlags: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === '--evidence-graph') {
        const slug = args[index + 1];
        if (!slug || slug.startsWith('--')) {
          fail(USAGE.doctor);
          return;
        }
        evidenceGraphSlug = slug;
        index += 1;
      } else if (arg === '--output') {
        const target = args[index + 1];
        if (!target || target.startsWith('--')) {
          fail(USAGE.doctor);
          return;
        }
        output = target;
        index += 1;
      } else if (arg) doctorFlags.push(arg);
    }
    const valid = doctorFlags.every(
      (arg: string) =>
        arg === '--json' ||
        arg === '--harness' ||
        arg === '--html' ||
        arg === '--smoke' ||
        arg === '--contracts' ||
        arg === '--autonomy' ||
        arg === '--verbose' ||
        arg === '--check-updates',
    );
    if (
      !valid ||
      (evidenceGraphSlug &&
        doctorFlags.some((arg) => !['--json', '--verbose', '--html'].includes(arg))) ||
      (doctorFlags.includes('--html') && doctorFlags.includes('--json')) ||
      (doctorFlags.includes('--html') && !evidenceGraphSlug) ||
      (output && (!evidenceGraphSlug || !doctorFlags.includes('--html'))) ||
      (doctorFlags.includes('--harness') &&
        doctorFlags.some((arg) => !['--harness', '--json', '--verbose'].includes(arg)))
    ) {
      if (doctorFlags.includes('--json')) {
        process.stdout.write(
          `${JSON.stringify({ schema_version: 1, cli_version: VERSION, command: 'doctor', ok: false, error: { code: 'usage_error', details: {}, message: USAGE.doctor } })}\n`,
        );
        process.exitCode = 1;
      } else fail(USAGE.doctor);
      return;
    } else
      await doctor(cwd, {
        json: doctorFlags.includes('--json'),
        harness: doctorFlags.includes('--harness'),
        smoke: doctorFlags.includes('--smoke'),
        contracts: doctorFlags.includes('--contracts'),
        autonomy: doctorFlags.includes('--autonomy'),
        verbose: doctorFlags.includes('--verbose'),
        checkUpdates: doctorFlags.includes('--check-updates'),
        ...(evidenceGraphSlug ? { evidenceGraph: evidenceGraphSlug } : {}),
        evidenceGraphHtml: doctorFlags.includes('--html'),
        ...(output ? { output } : {}),
        ascii,
      });
  } else if (command === 'upgrade') {
    if (args.includes('--help')) {
      writeCommandHelp('upgrade');
      return;
    }
    const flags = new Set(['--check', '--plan', '--skills-only', '--quiet']);
    const unknown = args.filter((arg: string) => !flags.has(arg));
    if (unknown.length) {
      const hint = didYouMeanTry(asString(unknown[0]), [...flags]);
      fail(USAGE.upgrade, {
        reason: `Unknown argument: ${unknown[0]}`,
        try: ['sdd-agentic-flow upgrade --check', ...(hint ? [hint] : [])],
      });
    }
    if (args.includes('--check') && args.includes('--skills-only'))
      fail(USAGE.upgrade, {
        reason: '--check and --skills-only cannot be combined.',
        try: ['sdd-agentic-flow upgrade --check', 'sdd-agentic-flow upgrade --skills-only'],
      });
    await upgradeCommand(cwd, {
      check: args.includes('--check'),
      plan: args.includes('--plan'),
      skillsOnly: args.includes('--skills-only'),
      quiet: args.includes('--quiet'),
      ascii,
    });
  } else if (command === 'autonomous-resume') {
    const usage = USAGE['autonomous-resume'];
    if (args.includes('--help')) {
      writeCommandHelp('autonomous-resume');
      return;
    }
    let force = false;
    let overrideGuard = null;
    let reason = null;
    let valid = true;
    let badArg = null;
    for (const arg of args) {
      if (arg === '--force') force = true;
      else if (arg.startsWith('--override-guard='))
        overrideGuard = arg.slice('--override-guard='.length);
      else if (arg.startsWith('--reason=')) reason = arg.slice('--reason='.length);
      else {
        valid = false;
        badArg = arg;
      }
    }
    if (!valid || (overrideGuard && !/^[1-7]$/.test(overrideGuard))) {
      const hint = badArg
        ? didYouMeanTry(badArg, ['--force', '--override-guard=3', '--reason=...'])
        : null;
      fail(usage, {
        reason: badArg ? `Unknown argument: ${badArg}` : 'Invalid arguments.',
        try: [
          'sdd-agentic-flow autonomous-resume --force',
          'sdd-agentic-flow autonomous-resume --override-guard=3 --reason="..."',
          ...(hint ? [hint] : []),
        ],
      });
    }
    if (overrideGuard && !reason)
      fail('--override-guard requires --reason="...".', {
        reason: 'Overrides must be audited with an explicit human reason.',
        try: ['sdd-agentic-flow autonomous-resume --override-guard=3 --reason="..."'],
      });
    autonomousResume(cwd, { force, overrideGuard, reason });
  } else if (command === 'uninstall') {
    if (args.includes('--help')) writeCommandHelp('uninstall');
    else uninstall(args, cwd);
  } else if (command === 'completion') {
    if (args.includes('--help')) {
      writeCommandHelp('completion');
      return;
    }
    const shell = args[0];
    const completion = shell ? completionFor(shell) : undefined;
    if (!completion || args.length !== 1) {
      fail('usage: completion bash|zsh|fish');
      return;
    }
    process.stdout.write(completion);
  } else if (command === 'help' || command === '--help' || command === '-h') help(args[0]);
  else if (command === 'version' || command === '--version' || command === '-v') {
    if (args.includes('--help')) writeCommandHelp('version');
    else process.stdout.write(`${VERSION}\n`);
  } else {
    const hint = didYouMeanTry(command, KNOWN_COMMANDS);
    fail(`unknown command: ${command}.`, {
      reason: 'That name is not a CLI command.',
      try: ['sdd-agentic-flow help', ...(hint ? [hint] : [])],
    });
  }
}

// Only offered when the process is genuinely interactive on both streams and process.env.CI is
// unset (see bin/menu.js's shouldShowInteractiveMenu) — inert under CI, pipes, scripts, and
// agent invocations, where main() never gets here. Selecting an entry runs the exact same
// runCommand() a typed command uses; the "uninstall" entry is structurally --plan only (see
// bin/menu.js's MENU_ACTIONS), so the menu can never trigger a destructive action directly.
async function runInteractiveMenu(cwd: string, options: CommandOptions = {}) {
  const locale = localeFor(cwd);
  for (;;) {
    const configFound = fs.existsSync(sddJoin(cwd, 'config.yml'));
    const skillsInstalled = officialSkillsPresence(resolveSkillsRoot(cwd)).missing.length === 0;
    const onboardingState = onboardingStateFor(cwd);
    if (options.showSummary !== false && ['READY', 'NEEDS_ATTENTION'].includes(onboardingState))
      printCurrentSetup(cwd, locale);
    const actions = menuActionsFor({
      hasConfig: configFound,
      hasSkills: skillsInstalled,
      onboardingState,
    });
    process.stdout.write(`\n${t(locale, 'menu.question')}\n`);
    const choice = await select(
      t(locale, 'menu.select'),
      actions.map((action: import('./menu').MenuAction) => {
        const key =
          action.command[0] === 'upgrade'
            ? 'menu.updates'
            : action.command[0] === 'configure'
              ? 'menu.change'
              : action.command[0] === 'doctor'
                ? 'menu.validate'
                : action.command[0] === 'help'
                  ? 'menu.more'
                  : action.command.length === 0
                    ? 'menu.keep'
                    : null;
        return { value: action, label: key ? t(locale, key) : action.label };
      }),
      { cancelValues: ['q', '0'], locale },
    );
    if (choice.cancelled) return;
    const selection = choice.value as unknown as import('./menu').MenuAction;
    if (!selection.command.length) return;
    process.stdout.write(
      `\n${t(locale, 'menu.running')}: sdd-agentic-flow ${selection.command.join(' ')}\n\n`,
    );
    const menuCommand = selection.command[0];
    if (!menuCommand) return;
    await runCommand(menuCommand, selection.command.slice(1), cwd);
    if (menuCommand === 'uninstall')
      process.stdout.write(
        '\nTo actually remove these, run `sdd-agentic-flow uninstall --apply` explicitly.\n',
      );
  }
}

setSetupCommandDeps({
  install,
  upgradeCommand,
  runCommand,
  runInteractiveMenu,
});

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const cwd = process.cwd();
  if (!command || command === '--ascii') {
    const rest = stripAsciiFlag(command ? [command, ...args] : args);
    if (rest.length) {
      const restCommand = rest[0];
      if (restCommand) return runCommand(restCommand, rest.slice(1), cwd);
    }
    const welcomeAscii = process.argv.includes('--ascii') || process.env.SDD_ASCII === '1';
    await welcome(cwd, { ascii: welcomeAscii });
    const mode = resolveMode({ ascii: welcomeAscii });
    const interactive = shouldShowInteractiveMenu(
      { stdout: process.stdout, stdin: process.stdin },
      process.env,
    );
    const onboardingState = onboardingStateFor(cwd);
    if (interactive && ['FIRST_USE', 'NEW_PROJECT', 'PARTIAL'].includes(onboardingState))
      return guidedInit(cwd, { ascii: welcomeAscii });
    // Trust-model exception: human-rich TTY only — ask before any registry request (default N).
    if (
      mode === 'human-rich' &&
      interactive &&
      process.env.SDD_NO_UPDATE_PROMPT !== '1' &&
      !process.env.CI
    ) {
      const wantsCheck = await askYesNo('Check for updates? [y/N] ');
      if (wantsCheck) await upgradeCommand(cwd, { ascii: welcomeAscii });
    }
    if (interactive) return runInteractiveMenu(cwd);
    return;
  }
  return runCommand(command, args, cwd);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message, 2);
});
