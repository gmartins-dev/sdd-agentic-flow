#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type AdoptionMode, adoptionModeForScope, isAdoptionMode } from './adoption';
import { renderCliCommand } from './cli-command';
import { COMMAND_HELP, KNOWN_COMMANDS, USAGE, writeCommandHelp } from './cli-help';
import { completionFor, isRemovedCommand, lexicalConflict } from './command-registry';
import { renderPolicySummary, runConfigCommand } from './config';
import { readConfig } from './config-domain';
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
} from './install';
import { DEFAULT_USER_TARGETS, shouldUseInteractiveInstall, USER_TARGETS } from './install-domain';
import { targetLabelFor } from './install-preflight';
import { shouldShowInteractiveMenu } from './menu';
import { resolveLocale, t, translateText } from './messages';
import {
  PACKAGE_ROOT,
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
import { guidedInit, setSetupCommandDeps } from './setup';
import { OFFICIAL_SKILLS } from './skill-identity';
import { terminalLog, terminalNext, terminalWelcome } from './terminal-ui';
import {
  type DisplayMode,
  didYouMean,
  outputMode,
  renderKeyValue,
  renderSection,
  styleStatus,
} from './ui';
import { purgeKnownSafState, uninstall } from './uninstall';
import { checkForUpdate } from './update-check';
import {
  applyManagedPairs,
  classifyManagedPairs,
  collectManagedPairs,
  detectExecutionMode,
  formatCheckReport,
  readInstallProvenance,
  runNpmGlobalInstall,
  writeInstallProvenance,
} from './upgrade';
import { applyWorkspaceInitialization, planWorkspaceInitialization } from './workspace';

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
  targets?: string[] | undefined;
  adoptionMode?: AdoptionMode | undefined;
  projectLocalExclude?: boolean | undefined;
  saved?: Record<string, unknown> | null | undefined;
  applyCommand?: string | undefined;
  locale?: string | undefined;
  language?: string | undefined;
  featureProfile?: string | undefined;
  installationBlocker?: 'future' | 'unknown' | null;
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
  const mode = resolveMode();
  terminalLog(status, translateText(locale, message), { mode });
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
  const result = await select(question.replace(/\s*\[[^\]]+\]\s*$/, ''), [
    { value: 'continue', label: 'Continue' },
    { value: 'cancel', label: 'Cancel', action: true },
  ]);
  return !result.cancelled && result.value === 'continue';
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
  terminalNext(list, { mode, title: t(locale, 'init.next') });
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

wireDoctorInstallSmokeDeps((cwd) => {
  const plan = planWorkspaceInitialization(cwd);
  if (!plan.ok) throw new Error(plan.error || 'workspace initialization failed');
  const applied = applyWorkspaceInitialization(plan);
  if (!applied.ok) throw new Error(applied.error || 'workspace initialization failed');
});

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
        reason: 'This command is not part of the current canonical interface.',
        try: [renderCliCommand('help')],
      });
      return false;
    }
    const topic = COMMAND_HELP[command];
    if (!topic) {
      const hint = didYouMeanTry(command, KNOWN_COMMANDS);
      fail(`unknown command: ${command}.`, {
        reason: 'That name is not a CLI command topic.',
        try: [renderCliCommand('help'), ...(hint ? [hint] : [])],
      });
      return false;
    }
    process.stdout.write(topic);
    return true;
  }
  process.stdout.write(
    `sdd-agentic-flow ${VERSION}

Spec-Driven Agentic Workflow Harness for coding agents.

QUICK START
  npx sdd-agentic-flow
  Starts the guided human interface.

START
  init [--plan] [--json] [--quiet] [--yes]  Initialize the current workspace
  install [--scope user|project] [--target agents|cursor|claude|copilot] [--plan] [--quiet]  Install the official bundle
  doctor [--json] [--harness] [--smoke] [--contracts] [--autonomy] [--verbose] [--check-updates]  Validate package or project setup

OPERATE
  config [show|policy|installation]       Inspect policy or saved installation intent
  context [status|refresh|autonomy-state]  Show or refresh project context provenance, or autonomy loop state
  upgrade [--check|--plan|--skills-only] Check for / apply CLI and skills updates (confirm-gated)
  autonomous-resume [--force] [--override-guard=N --reason=...]  Resume an autonomous workflow paused at a guardrail

INSPECT / LEARN
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
// process.env.CI is not set — see bin/menu.js's shouldShowInteractiveMenu). The bare command
// remains a status-only surface in every environment; mutations require an explicit command.
async function welcome(cwd: string, options: CommandOptions = {}) {
  const mode = options.mode ?? resolveMode(options);
  const locale = localeFor(cwd);
  const configPath = sddJoin(cwd, 'config.yml');
  const configFound = fs.existsSync(configPath);
  const projectScopeRoot = path.join(cwd, '.agents', 'skills');
  const skillsRoot = resolveSkillsRoot(cwd);
  const presence = officialSkillsPresence(skillsRoot);
  const skillsInstalled = presence.complete;
  const skillsPartial = presence.partial;
  const workspaceFound = fs.existsSync(path.join(cwd, SDD_PATHS.workspace));

  await terminalWelcome(locale, { mode, output: process.stdout });

  const configLabel = configFound
    ? `${SDD_PATHS.config} ${t(locale, 'welcome.configFound')}`
    : `${SDD_PATHS.config} ${t(locale, 'welcome.configMissing')}`;
  const skillsLabel = skillsInstalled
    ? `${t(locale, 'welcome.skillsInstalled')} (${skillsRoot === projectScopeRoot ? 'project' : 'user'} scope: ${skillsRoot})`
    : skillsPartial
      ? `partial skill install detected (${presence.present.length} present) — re-run \`npx sdd-agentic-flow install\` to repair`
      : `${t(locale, 'welcome.noSkills')} (project or user scope)`;
  const workspaceLabel = workspaceFound
    ? locale === 'pt-BR'
      ? 'workspace inicializado'
      : 'workspace initialized'
    : locale === 'pt-BR'
      ? 'workspace ainda não inicializado'
      : 'workspace not initialized';

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
    log(workspaceFound ? 'PASS' : 'INFO', workspaceLabel);
    const config = readConfig(configPath);
    if (config.ok) {
      process.stdout.write(`\n${renderPolicySummaryBlock(config, mode, locale)}\n`);
    }
    if (skillsInstalled || skillsPartial) {
      const installSummary = installationSummaryForWelcome(cwd);
      process.stdout.write(`\n${renderInstallationSummaryBlock(installSummary, mode, locale)}\n`);
    }
  } else {
    log(configFound ? 'PASS' : 'INFO', configLabel);
    log(skillsInstalled ? 'PASS' : skillsPartial ? 'WARN' : 'INFO', skillsLabel);
    log(workspaceFound ? 'PASS' : 'INFO', workspaceLabel);
  }

  const suggested = !skillsInstalled
    ? 'npx sdd-agentic-flow install'
    : !workspaceFound
      ? 'npx sdd-agentic-flow init'
      : 'Use your coding agent with the installed SAF workflow.';
  if (mode === 'machine') {
    // Compact status screen (CLI-001): contextual next + quick commands; not nextStep().
    process.stdout.write(
      `\n${t(locale, 'init.next')}\n` +
        `  ${suggested}\n\n` +
        `${t(locale, 'welcome.quickCommands')}\n` +
        (!skillsInstalled
          ? '  npx sdd-agentic-flow install            Install the official skill bundle\n  npx sdd-agentic-flow config installation  Change installation intent\n  npx sdd-agentic-flow doctor             Validate local setup\n'
          : !workspaceFound
            ? '  npx sdd-agentic-flow init               Initialize this workspace\n  npx sdd-agentic-flow doctor             Validate local setup\n'
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
      !skillsInstalled
        ? `\n${t(locale, 'welcome.quickCommands')}\n  npx sdd-agentic-flow install --plan\n  npx sdd-agentic-flow config installation\n  npx sdd-agentic-flow doctor\n`
        : !workspaceFound
          ? `\n${t(locale, 'welcome.quickCommands')}\n  npx sdd-agentic-flow init --plan\n  npx sdd-agentic-flow doctor\n`
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
  { overwriteDiffers = false }: { overwriteDiffers?: boolean } = {},
) {
  const pairs = collectManagedPairs(PACKAGE_ROOT, OFFICIAL_SKILLS, target);
  const classified = classifyManagedPairs(pairs);
  const missing = applyManagedPairs(classified.missing, { overwriteDiffers: true });
  const changed = overwriteDiffers
    ? applyManagedPairs(classified.differs, { overwriteDiffers: true })
    : {
        installed: 0,
        refreshed: 0,
        skippedIdentical: 0,
        skippedDiffers: classified.differs.length,
      };
  const totals = {
    installed: missing.installed,
    refreshed: changed.refreshed,
    skippedIdentical: classified.identical.length,
    skippedDiffers: changed.skippedDiffers,
    differs: classified.differs.map((pair) => pair.rel),
  };
  if (totals.installed + totals.refreshed > 0)
    writeInstallProvenance(target, {
      packageVersion: VERSION,
      managedSkills: [...OFFICIAL_SKILLS],
      managedPaths: pairs.map((pair) => pair.rel),
    });
  return totals;
}

async function refreshInstalledSkills(cwd: string, options: CommandOptions = {}) {
  const mode = options.mode ?? resolveMode(options);
  const interactive = Boolean(options.interactive && canPromptInteractively(mode));
  const skillsRoot = resolveSkillsRoot(cwd);
  const projectRoot = path.join(cwd, '.agents', 'skills');
  const targets: string[] = [];
  if (hasOfficialSkillsAt(projectRoot) || installationStatus(projectRoot))
    targets.push(projectRoot);
  for (const dir of userSkillsDirsFor(resolveConfiguredAgent(cwd), options.homeDir) ?? [])
    if (installationStatus(dir) && !targets.includes(dir)) targets.push(dir);
  if (!targets.length) targets.push(skillsRoot);

  for (const target of targets) {
    const provenance = readInstallProvenance(target);
    if (provenance && provenance.schema !== 'saf-install-provenance/v3') {
      log('FAIL', `provenance ${provenance.schema} requires a clean v7 reinstall`);
      return { ok: false, blocked: true };
    }
  }

  const allDiffers = targets.flatMap((target) =>
    classifyManagedPairs(collectManagedPairs(PACKAGE_ROOT, OFFICIAL_SKILLS, target)).differs.map(
      (pair) => `${target}: ${pair.rel}`,
    ),
  );
  let overwriteDiffers = false;
  if (allDiffers.length) {
    log('WARN', `${allDiffers.length} managed file(s) differ from the bundled package`);
    for (const line of allDiffers.slice(0, 20)) process.stdout.write(`  ${line}\n`);
    if (interactive)
      overwriteDiffers = await askYesNo(
        'Overwrite differing managed files with the bundled package?',
      );
    else log('WARN', 'non-interactive: never overwriting differing managed files');
  }

  let wrote = 0;
  let skippedDiffers = 0;
  for (const target of targets) {
    const summary = refreshSkillsAtTarget(target, { overwriteDiffers });
    wrote += summary.installed + summary.refreshed;
    skippedDiffers += summary.skippedDiffers;
    log(
      'PASS',
      `refreshed official bundle at ${target}: ${summary.installed} new, ${summary.refreshed} updated, ${summary.skippedIdentical} identical, ${summary.skippedDiffers} differed (skipped)`,
    );
  }
  return { ok: true, wrote, skippedDiffers };
}

async function upgradeCommand(cwd: string, options: CommandOptions = {}) {
  const mode = resolveMode({ quiet: options.quiet, ascii: Boolean(options.ascii) });
  const interactive = canPromptInteractively(mode) && !options.check && !options.plan;
  const execMode = detectExecutionMode(PACKAGE_ROOT);

  if (options.skillsOnly) {
    if (options.plan) {
      process.stdout.write(
        `Execution mode: ${execMode}\n` +
          `Registry check: none (--skills-only)\n` +
          `CLI package: unchanged\n` +
          `Plan:\n  1. Refresh the official bundle from the currently executing package (${VERSION})\n\n` +
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
      process.stdout.write(
        `\nNo changes were made.\n\nTo retry:\n  ${renderCliCommand('upgrade')}\n`,
      );
      process.exitCode = 1;
      return;
    }
    if (!options.check && result.updateAvailable) {
      process.stdout.write(
        '\nThis invocation is non-interactive; no mutations were performed.\n' +
          `Run \`${renderCliCommand('upgrade')}\` in a TTY to confirm CLI/skills updates.\n`,
      );
    }
    return;
  }

  if (options.plan) {
    if (!result.reachable) {
      log('WARN', 'unable to check for updates');
      process.stdout.write(
        `\nReason:\n  network unavailable or registry unreachable\n\nNo changes were made.\n\nTo retry:\n  ${renderCliCommand('upgrade', '--plan')}\n`,
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
        process.stdout.write(`  1. Upgrade CLI -> ${result.latest} (npm install -g)\n`);
      else
        process.stdout.write(
          `  1. Re-run via npx/local: npx sdd-agentic-flow@latest (no in-process self-replace)\n`,
        );
      process.stdout.write('  2. Refresh the installed official bundle\n');
    } else {
      process.stdout.write('  1. CLI already up to date — no package install\n');
      process.stdout.write('  2. Optional official-bundle refresh from current package\n');
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
      `\nReason:\n  network unavailable or registry unreachable\n\nNo changes were made.\n\nTo retry:\n  ${renderCliCommand('upgrade')}\n`,
    );
    return;
  }

  if (!result.updateAvailable) {
    log('PASS', `up to date (${VERSION})`);
    process.stdout.write('\nNo update is required.\n');
    process.stdout.write(
      `To refresh skills deliberately, run ${renderCliCommand('upgrade', '--skills-only')}.\n`,
    );
    return;
  }

  log('WARN', `update available: ${VERSION} -> ${result.latest}`);
  let cliOk = null;
  const upgradeCli = await askYesNo(`Upgrade CLI to ${result.latest} now?`);
  if (upgradeCli) {
    if (execMode === 'global') {
      try {
        process.stdout.write(`Updating the global SAF installation...\n`);
        runNpmGlobalInstall();
        log('PASS', `CLI upgraded toward ${result.latest}`);
        cliOk = true;
      } catch (error) {
        cliOk = false;
        fail(`CLI upgrade failed: ${errorMessage(error)}`, {
          reason: 'npm install -g exited non-zero.',
          try: [
            'npm install -g sdd-agentic-flow@latest',
            renderCliCommand('upgrade', '--skills-only'),
          ],
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

  const refreshSkills = await askYesNo('Refresh installed skills from this package?');
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
        `No automatic rollback was attempted.\n\nRecovery:\n  ${renderCliCommand('upgrade', '--skills-only')}\n`,
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
      reason: 'The current command grammar does not accept this legacy option.',
      try: [renderCliCommand('help')],
    });
    return;
  }
  if (rawArgs.includes('--json') && command !== 'init' && command !== 'doctor') {
    fail(`usage error: ${command} does not support --json`, {
      reason: 'Machine JSON is supported only by init and doctor in v7.7.0.',
      try: [renderCliCommand('init', '--json'), renderCliCommand('doctor', '--json')],
    });
    return;
  }
  if (isRemovedCommand(command)) {
    fail(`unknown command: ${command}.`, {
      reason: 'This command is not part of the current canonical interface.',
      try: [renderCliCommand('help')],
    });
    return;
  }
  if (command === 'list') {
    if (args.includes('--help')) {
      if (args.length > 1) {
        fail('usage: list [--help]', {
          reason: 'The list command accepts no arguments other than --help.',
          try: [renderCliCommand('list'), renderCliCommand('list', '--help')],
        });
      } else writeCommandHelp('list');
    } else if (args.length > 0) {
      fail('usage: list [--help]', {
        reason: `Unknown list argument: ${args[0]}.`,
        try: [renderCliCommand('list'), renderCliCommand('list', '--help')],
      });
    } else
      fail('unknown command: list.', {
        reason: 'Packs were removed in v7; install the official bundle with `install`.',
        try: [renderCliCommand('install')],
      });
  } else if (command === 'init') {
    const usage = USAGE.init;
    if (args.includes('--help')) writeCommandHelp('init');
    else {
      const allowed = new Set(['--plan', '--json', '--quiet', '--yes']);
      const unknown = args.filter((arg) => !allowed.has(arg));
      if (unknown.length) {
        fail(usage, {
          reason: `Unknown or removed init argument: ${unknown[0]}`,
          try: [renderCliCommand('init'), renderCliCommand('init', '--plan')],
        });
        return;
      }
      const plan = planWorkspaceInitialization(cwd);
      const json = args.includes('--json');
      if (!plan.ok) {
        const canRecoverInteractively =
          !json &&
          !args.includes('--plan') &&
          Boolean(process.stdin.isTTY && process.stdout.isTTY) &&
          !process.env.CI;
        if (canRecoverInteractively) {
          await guidedInit(cwd, { ascii });
          return;
        }
        if (json) {
          process.stdout.write(
            `${JSON.stringify({ schema_version: 2, cli_version: VERSION, command: 'init', ok: false, error: { code: 'runtime_error', details: {}, message: plan.error || 'workspace initialization failed' } })}\n`,
          );
          process.exitCode = 1;
        } else fail(plan.error || 'workspace initialization failed');
        return;
      } else {
        if (!json) {
          log('INFO', `Project root: ${plan.git?.projectRoot}`);
          log('INFO', `Git root: ${plan.git?.gitRoot}`);
          for (const file of plan.create) log('INFO', `Create: ${file}`);
          for (const file of plan.preserve) log('INFO', `Preserve: ${file}`);
          for (const entry of plan.excludes) log('INFO', `Git exclude: ${entry}`);
          log('INFO', 'No saf-config/v3 file will be created.');
        }
      }
      if (args.includes('--plan')) {
        if (json)
          process.stdout.write(
            `${JSON.stringify({ schema_version: 2, cli_version: VERSION, command: 'init', ok: true, data: plan })}\n`,
          );
        return;
      }
      if (!args.includes('--plan')) {
        const applied = applyWorkspaceInitialization(plan);
        if (!applied.ok) {
          if (!json) fail(applied.error || 'workspace initialization failed');
          else {
            process.stdout.write(
              `${JSON.stringify({ schema_version: 2, cli_version: VERSION, command: 'init', ok: false, error: { code: 'runtime_error', details: {}, message: applied.error || 'workspace initialization failed' } })}\n`,
            );
            process.exitCode = 1;
          }
        } else if (!json && !args.includes('--quiet')) log('PASS', 'workspace initialized');
        else if (json)
          process.stdout.write(
            `${JSON.stringify({ schema_version: 2, cli_version: VERSION, command: 'init', ok: true, data: { ...plan, applied: true } })}\n`,
          );
      }
      return;
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
            renderCliCommand('context', 'status'),
            renderCliCommand('context', 'refresh'),
            renderCliCommand('context', 'autonomy-state'),
            ...(hint ? [hint] : []),
          ],
        });
        return;
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
          renderCliCommand('config', 'show'),
          renderCliCommand('config', 'policy', '--plan'),
        ],
      });
      return;
    }
  } else if (command === '__config-installation') {
    if (args.includes('--help')) {
      writeCommandHelp('config');
      return;
    }
    let scope: string | null = null;
    let adoptionMode: AdoptionMode | null = null;
    let plan = false;
    let yes = false;
    let interactive = false;
    const targets: string[] = [];
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === '--plan') plan = true;
      else if (arg === '--yes') yes = true;
      else if (arg === '--interactive') interactive = true;
      else if (arg === '--scope' && ['user', 'project'].includes(asString(args[index + 1])))
        scope = asString(args[++index]);
      else if (arg === '--pack') {
        fail('usage error: --pack was removed; v7 installs one official bundle');
        return;
      } else if (arg === '--target' && Object.hasOwn(USER_TARGETS, asString(args[index + 1])))
        targets.push(asString(args[++index]));
      else if (arg === '--adoption-mode' && isAdoptionMode(args[index + 1]))
        adoptionMode = args[++index] as AdoptionMode;
      else {
        fail(USAGE.config);
        return;
      }
    }
    if (scope && adoptionMode && adoptionModeForScope(adoptionMode) !== scope) {
      fail(`adoption mode ${adoptionMode} requires --scope ${adoptionModeForScope(adoptionMode)}`);
      return;
    }
    const effectiveScope = adoptionMode ? adoptionModeForScope(adoptionMode) : scope || 'user';
    if (targets.length && effectiveScope === 'project') {
      fail(`${USAGE.config} — --target requires --scope user or no explicit scope`, {
        reason: 'Project installation has one project skill root; user-only targets are invalid.',
      });
      return;
    }
    if (interactive && plan) {
      fail('config installation --interactive cannot combine with --plan');
      return;
    }
    const canInteract = shouldUseInteractiveInstall({
      stdinIsTTY: process.stdin.isTTY,
      stdoutIsTTY: process.stdout.isTTY,
      ci: Boolean(process.env.CI),
      plan,
      quiet: false,
      nonInteractive: false,
      machine: false,
    });
    if (interactive && !canInteract) {
      fail('config installation --interactive requires a real TTY and unset CI');
      return;
    }
    if (!plan && !interactive && !yes) {
      fail('config installation outside a TTY requires --yes or --plan');
      return;
    }
    if (interactive || (args.length === 0 && canInteract)) {
      const result = await configureInteractive(cwd, os.homedir());
      if (isConfigureCancelled(result))
        return log('INFO', t(localeFor(cwd), 'configure.cancelled'));
      if (isConfigureError(result)) {
        fail(result.error, {
          reason: 'Use valid scope, adoption, and target IDs.',
          try: [renderCliCommand('config', 'installation', '--interactive')],
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
      scope: effectiveScope as 'user' | 'project',
      ...(targets.length ? { targets } : {}),
      ...(adoptionMode ? { adoptionMode } : {}),
      plan,
    });
    if (plan) {
      const effectiveScope = adoptionMode ? adoptionModeForScope(adoptionMode) : scope || 'user';
      process.stdout.write(
        `${t(localeFor(cwd), 'configure.intentPreview')}\n  Scope       ${effectiveScope}\n` +
          (effectiveScope === 'user' && isUserInstallProfile(result.after)
            ? `  Targets     ${(result.after.targets || DEFAULT_USER_TARGETS).join(', ')}\n`
            : isProjectInstallProfile(result.after)
              ? `  Adoption    ${result.after.adoption_mode || 'unclassified'}\n`
              : '') +
          `\n${t(localeFor(cwd), 'configure.reconciliationPreview')}\n`,
      );
    } else log('PASS', `saved ${scope} installation intent`);
    const reconcilePlan = planForInstallProfile({
      cwd,
      homeDir: os.homedir(),
      scope: adoptionMode ? adoptionModeForScope(adoptionMode) : scope || 'user',
      profile: result.after,
    });
    printInstallPlanReport(reconcilePlan, resolveMode({}), cwd, {
      applyCommand: installApplyCommand(reconcilePlan),
    });
    if (plan)
      process.stdout.write(
        `${t(localeFor(cwd), 'configure.saveIntent')}: ${configureCommand(adoptionMode ? adoptionModeForScope(adoptionMode) : scope || 'user', result.after)}\n${t(localeFor(cwd), 'configure.reconcile')}:   ${installApplyCommand(reconcilePlan)}\n`,
      );
    else
      log(
        'INFO',
        `${t(localeFor(cwd), 'configure.savedOnly')} Run \`${installApplyCommand(reconcilePlan)}\`.`,
      );
  } else if (command === 'learn-sdd') {
    if (args.includes('--help')) writeCommandHelp('learn-sdd');
    else if (args.length) {
      fail('usage: learn-sdd', { reason: 'learn-sdd accepts no positional arguments.' });
      return;
    } else learnSdd(cwd);
  } else if (command === 'install') {
    const usage = USAGE.install;
    if (args.includes('--help')) {
      writeCommandHelp('install');
      return;
    }
    let scope: string | undefined;
    const targets: string[] = [];
    let plan = false;
    let yes = false;
    let quiet = false;
    let adoptionMode: AdoptionMode | undefined;
    let valid = true;
    for (let index = 0; index < args.length; index += 1) {
      const arg = asString(args[index]);
      if (arg === '--plan') plan = true;
      else if (arg === '--yes') yes = true;
      else if (arg === '--quiet') quiet = true;
      else if (arg === '--scope' && ['user', 'project'].includes(asString(args[index + 1]))) {
        scope = asString(args[++index]);
      } else if (arg === '--target' && args[index + 1] !== undefined) {
        const target = asString(args[++index]);
        if (!['agents', 'cursor', 'claude', 'copilot'].includes(target)) valid = false;
        else targets.push(target);
      } else if (arg === '--adoption-mode' && isAdoptionMode(args[index + 1])) {
        adoptionMode = args[++index] as AdoptionMode;
      } else {
        valid = false;
      }
    }
    if (!valid) {
      fail(usage, {
        reason: 'v7 accepts no pack positional, --pack, or interactive install flags.',
        try: [renderCliCommand('install'), renderCliCommand('install', '--plan')],
      });
      return;
    }
    if (scope === 'project' && targets.length) {
      fail(`${usage} — --target requires --scope user or no explicit scope`, {
        reason: 'Project installation has one project skill root; user-only targets are invalid.',
      });
      return;
    }
    const automaticInteractive = shouldUseInteractiveInstall({
      stdinIsTTY: process.stdin.isTTY,
      stdoutIsTTY: process.stdout.isTTY,
      ci: Boolean(process.env.CI),
      plan,
      quiet,
      machine: resolveMode({ quiet, ascii }) === 'machine',
    });
    const options = {
      ...(scope ? { scope } : {}),
      ...(targets.length ? { targets } : {}),
      ...(adoptionMode ? { adoptionMode } : {}),
      plan,
      yes,
      quiet,
      ascii,
      mode: resolveMode({ quiet, ascii }),
    };
    if (automaticInteractive) await installInteractive(cwd, options);
    else install(cwd, options);
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
          `${JSON.stringify({ schema_version: 2, cli_version: VERSION, command: 'doctor', ok: false, error: { code: 'usage_error', details: {}, message: USAGE.doctor } })}\n`,
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
        try: [renderCliCommand('upgrade', '--check'), ...(hint ? [hint] : [])],
      });
      return;
    }
    if (args.includes('--check') && args.includes('--skills-only'))
      fail(USAGE.upgrade, {
        reason: '--check and --skills-only cannot be combined.',
        try: [renderCliCommand('upgrade', '--check'), renderCliCommand('upgrade', '--skills-only')],
      });
    if (args.includes('--check') && args.includes('--skills-only')) return;
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
          renderCliCommand('autonomous-resume', '--force'),
          renderCliCommand('autonomous-resume', '--override-guard=3', '--reason="..."'),
          ...(hint ? [hint] : []),
        ],
      });
      return;
    }
    if (overrideGuard && !reason)
      fail('--override-guard requires --reason="...".', {
        reason: 'Overrides must be audited with an explicit human reason.',
        try: [renderCliCommand('autonomous-resume', '--override-guard=3', '--reason="..."')],
      });
    if (overrideGuard && !reason) return;
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
  } else if (command === 'help' || command === '--help' || command === '-h') {
    if (args.length > 1) {
      fail('usage: help [command]', { reason: 'help accepts at most one command topic.' });
      return;
    }
    help(args[0]);
  } else if (command === 'version' || command === '--version' || command === '-v') {
    if (args.includes('--help')) {
      if (args.length !== 1) fail('usage: version [--help]');
      else writeCommandHelp('version');
    } else if (args.length) {
      fail('usage: version', { reason: 'version accepts no arguments.' });
      return;
    } else process.stdout.write(`${VERSION}\n`);
  } else {
    const hint = didYouMeanTry(command, KNOWN_COMMANDS);
    fail(`unknown command: ${command}.`, {
      reason: 'That name is not a CLI command.',
      try: [renderCliCommand('help'), ...(hint ? [hint] : [])],
    });
  }
}

// Only offered when the process is genuinely interactive on both streams and process.env.CI is
// unset (see bin/menu.js's shouldShowInteractiveMenu) — inert under CI, pipes, scripts, and
// agent invocations, where main() never gets here. Selecting an entry runs the exact same
// runCommand() a typed command uses; the "uninstall" entry is structurally --plan only (see
// bin/menu.js's MENU_ACTIONS), so the menu can never trigger a destructive action directly.
async function runInteractiveMenu(cwd: string, options: CommandOptions = {}) {
  return guidedInit(cwd, options);
}

setSetupCommandDeps({
  install,
  upgradeCommand,
  runCommand,
  runInteractiveMenu,
  changeInstallation: (cwd) => changeInstallationInteractive(cwd, os.homedir()),
  purgeKnownSafState,
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
    if (shouldShowInteractiveMenu({ stdout: process.stdout, stdin: process.stdin }, process.env)) {
      await guidedInit(cwd, { ascii: welcomeAscii });
      process.stdin.pause();
      (process.stdin as NodeJS.ReadStream & { unref?: () => void }).unref?.();
      process.exit(0);
      return;
    }
    await welcome(cwd, { ascii: welcomeAscii });
    return;
  }
  return runCommand(command, args, cwd);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message, 2);
});
