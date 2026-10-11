#!/usr/bin/env node

import os from 'node:os';
import { type AdoptionMode, isAdoptionMode } from './adoption';
import { renderCliCommand } from './cli-command';
import { help, KNOWN_COMMANDS, learnSdd, USAGE, writeCommandHelp } from './cli-help';
import { asString, didYouMeanTry, fail, logStatus, resolveMode } from './cli-output';
import { completionFor, isRemovedCommand, lexicalConflict } from './command-registry';
import { runConfigCommand } from './config';
import { doctor, projectLocale } from './doctor';
import { HandledError } from './handled-error';
import {
  changeInstallationInteractive,
  install,
  installInteractive,
  runConfigInstallation,
  wireDoctorInstallSmokeDeps,
} from './install';
import { shouldUseInteractiveInstall } from './install-domain';
import { shouldShowInteractiveMenu } from './menu';
import { sddJoin, VERSION } from './paths';
import {
  autonomousResume,
  autonomyStateReport,
  contextRefresh,
  contextStatus,
} from './project-context';
import { guidedInit, setSetupCommandDeps } from './setup';
import { purgeKnownSafState, uninstall } from './uninstall';
import { upgradeCommand } from './upgrade-command';
import { welcome } from './welcome';
import { applyWorkspaceInitialization, planWorkspaceInitialization } from './workspace';

// Thin router: global argument preflight, then one handler per canonical command. Handlers
// parse their own arguments and delegate behavior to the owning command module.

type CommandContext = {
  command: string;
  args: string[];
  rawArgs: string[];
  cwd: string;
  ascii: boolean;
};

type CommandHandler = (context: CommandContext) => Promise<void>;

function log(status: string, message: string, explicitLocale?: string) {
  logStatus(status, message, projectLocale(process.cwd(), explicitLocale));
}

function stripAsciiFlag(args: string[]) {
  return args.filter((arg: string) => arg !== '--ascii');
}

wireDoctorInstallSmokeDeps((cwd) => {
  const plan = planWorkspaceInitialization(cwd);
  if (!plan.ok) throw new Error(plan.error || 'workspace initialization failed');
  const applied = applyWorkspaceInitialization(plan);
  if (!applied.ok) throw new Error(applied.error || 'workspace initialization failed');
});

async function handleList({ args }: CommandContext): Promise<void> {
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
}

async function handleInit({ args, cwd, ascii }: CommandContext): Promise<void> {
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
}

async function handleContext({ args, cwd, ascii }: CommandContext): Promise<void> {
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
}

async function handleConfig({ args, cwd, ascii }: CommandContext): Promise<void> {
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
}

async function handleConfigInstallation({ args, cwd }: CommandContext): Promise<void> {
  await runConfigInstallation(args, cwd);
}

async function handleLearnSdd({ args, cwd }: CommandContext): Promise<void> {
  if (args.includes('--help')) writeCommandHelp('learn-sdd');
  else if (args.length) {
    fail('usage: learn-sdd', { reason: 'learn-sdd accepts no positional arguments.' });
    return;
  } else learnSdd(projectLocale(cwd));
}

async function handleInstall({ args, cwd, ascii }: CommandContext): Promise<void> {
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
}

async function handleDoctor({ args, cwd, ascii }: CommandContext): Promise<void> {
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
}

async function handleUpgrade({ args, cwd, ascii }: CommandContext): Promise<void> {
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
  const upgradeResult = await upgradeCommand(cwd, {
    check: args.includes('--check'),
    plan: args.includes('--plan'),
    skillsOnly: args.includes('--skills-only'),
    quiet: args.includes('--quiet'),
    ascii,
  });
  if (upgradeResult.status === 'FAIL') process.exitCode = 1;
}

async function handleAutonomousResume({ args, cwd }: CommandContext): Promise<void> {
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
}

async function handleUninstall({ args, cwd }: CommandContext): Promise<void> {
  if (args.includes('--help')) writeCommandHelp('uninstall');
  else uninstall(args, cwd);
}

async function handleCompletion({ args }: CommandContext): Promise<void> {
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
}

async function handleHelp({ args }: CommandContext): Promise<void> {
  if (args.length > 1) {
    fail('usage: help [command]', { reason: 'help accepts at most one command topic.' });
    return;
  }
  help(args[0]);
}

async function handleVersion({ args }: CommandContext): Promise<void> {
  if (args.includes('--help')) {
    if (args.length !== 1) fail('usage: version [--help]');
    else writeCommandHelp('version');
  } else if (args.length) {
    fail('usage: version', { reason: 'version accepts no arguments.' });
    return;
  } else process.stdout.write(`${VERSION}\n`);
}

async function handleUnknown({ command }: CommandContext): Promise<void> {
  const hint = didYouMeanTry(command, KNOWN_COMMANDS);
  fail(`unknown command: ${command}.`, {
    reason: 'That name is not a CLI command.',
    try: [renderCliCommand('help'), ...(hint ? [hint] : [])],
  });
}

const COMMAND_HANDLERS: Record<string, CommandHandler> = {
  list: handleList,
  init: handleInit,
  context: handleContext,
  config: handleConfig,
  '__config-installation': handleConfigInstallation,
  'learn-sdd': handleLearnSdd,
  install: handleInstall,
  doctor: handleDoctor,
  upgrade: handleUpgrade,
  'autonomous-resume': handleAutonomousResume,
  uninstall: handleUninstall,
  completion: handleCompletion,
  help: handleHelp,
  '--help': handleHelp,
  '-h': handleHelp,
  version: handleVersion,
  '--version': handleVersion,
  '-v': handleVersion,
};

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
  const handler = Object.hasOwn(COMMAND_HANDLERS, command) ? COMMAND_HANDLERS[command] : undefined;
  await (handler ?? handleUnknown)({ command, args, rawArgs, cwd, ascii });
}

// Only offered when the process is genuinely interactive on both streams and process.env.CI is
// unset (see bin/menu.js's shouldShowInteractiveMenu) — inert under CI, pipes, scripts, and
// agent invocations, where main() never gets here. Selecting an entry runs the exact same
// runCommand() a typed command uses; the "uninstall" entry is structurally --plan only (see
// bin/menu.js's MENU_ACTIONS), so the menu can never trigger a destructive action directly.
async function runInteractiveMenu(cwd: string, options: Parameters<typeof guidedInit>[1] = {}) {
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
  fail(message, error instanceof HandledError ? 1 : 2);
});
