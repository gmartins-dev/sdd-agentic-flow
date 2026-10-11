import fs from 'node:fs';
import path from 'node:path';

import { renderCliCommand } from './cli-command';
import { didYouMeanTry, fail } from './cli-output';
import { CANONICAL_COMMANDS, isRemovedCommand } from './command-registry';
import { t } from './messages';
import { PACKAGE_ROOT, USAGE_GUIDE_URL, VERSION } from './paths';

export const USAGE = {
  init: 'usage: init [--plan] [--json] [--quiet] [--yes]',
  install:
    'usage: install [--scope user|project] [--target agents|cursor|claude|copilot] [--adoption-mode personal|specs-shared|team] [--plan|--yes] [--quiet]',
  config:
    'usage: config show | config policy [--plan|--yes] [--preset ...] [--language en-US|pt-BR] [--feature-profile small_fix|medium_feature|large_feature|epic] | config installation [--plan|--yes] [--adoption-mode personal|specs-shared|team]',
  doctor:
    'usage: doctor [--json] [--harness] [--smoke] [--contracts] [--autonomy] [--verbose] [--check-updates]',
  uninstall:
    'usage: uninstall --plan|--yes [--purge] [--scope user|project|all] [--target agents|cursor|claude|copilot] [--verbose] [--quiet]',
  context: 'usage: context status | context refresh | context autonomy-state',
  'autonomous-resume':
    'usage: autonomous-resume [--force] | autonomous-resume --override-guard=<1-7> --reason="..."',
  upgrade: 'usage: upgrade [--check|--plan|--skills-only]',
} as const;

export const KNOWN_COMMANDS = [
  ...new Set(CANONICAL_COMMANDS.map((command) => command.split(' ')[0] ?? command)),
];
const shared =
  '\nCommands, flags, paths, schemas, and JSON keys use canonical English technical tokens.\n';

export const COMMAND_HELP: Record<string, string> = {
  init: `${renderCliCommand('init')}\n\nInitialize the exact current Git workspace without creating policy config or reinstalling skills.\n\nUSAGE\n  ${USAGE.init}\n\n--plan previews the same deterministic plan used by apply. --json emits machine schema 2.\n${shared}`,
  config: `${renderCliCommand('config')}\n\nInspect or change workflow policy and desired installation intent.\n\nUSAGE\n  ${renderCliCommand('config', 'show')}\n  ${renderCliCommand('config', 'policy')} [--plan|--yes] [--preset ...] [--language en-US|pt-BR] [--feature-profile small_fix|medium_feature|large_feature|epic]\n  ${renderCliCommand('config', 'installation')} [--plan|--yes]\n\nconfig policy changes workflow or language. --feature-profile is an advanced explicit project override. config installation saves intent only; it never installs skills. adoption_mode selects personal, specs-shared, or team project visibility. It does not change scope and never edits .gitignore, global excludes, or Git history.\n${shared}`,
  install: `${renderCliCommand('install')}\n\nInstall the 12 official engineering skills and shared layer.\n\nUSAGE\n  ${USAGE.install}\n\n--target is repeatable for user scope: agents | cursor | claude | copilot.\n--adoption-mode selects personal, specs-shared, or team project adoption.\n${shared}`,
  doctor: `${renderCliCommand('doctor')}\n\nRead-only health and contract checks.\n\nUSAGE\n  ${USAGE.doctor}\n\n--json emits one versioned machine document and never prompts.\n${shared}`,
  context: `${renderCliCommand('context')}\n\nInspect or regenerate project context and autonomy state.\n\nUSAGE\n  ${USAGE.context}\n${shared}`,
  upgrade: `${renderCliCommand('upgrade')}\n\nCheck or interactively apply CLI/skill updates.\n\nUSAGE\n  ${USAGE.upgrade}\n\nUpgrade apply is human-authority only and has no JSON/--yes form.\n${shared}`,
  uninstall: `${renderCliCommand('uninstall')}\n\nRemove only recognized SAF-managed installation assets.\n\nUSAGE\n  ${USAGE.uninstall}\n\nUse --plan first; --yes authorizes local apply outside a TTY.\n${shared}`,
  'learn-sdd': `${renderCliCommand('learn-sdd')}\n\nShow a concise explanation of Spec-Driven Development and the SAF workflow.\n\nUSAGE\n  ${renderCliCommand('learn-sdd')}\n${shared}`,
  completion: `${renderCliCommand('completion')}\n\nPrint deterministic shell completion for the selected shell.\n\nUSAGE\n  ${renderCliCommand('completion')} bash|zsh|fish\n${shared}`,
  version: `${renderCliCommand('version')}\n\nPrint the installed package version.\n\nUSAGE\n  ${renderCliCommand('version')}\n${shared}`,
  'autonomous-resume': `${renderCliCommand('autonomous-resume')}\n\nResume a recorded autonomy workflow guardrail.\n\nUSAGE\n  ${USAGE['autonomous-resume']}\n${shared}`,
};

export function writeCommandHelp(key: string): void {
  process.stdout.write(COMMAND_HELP[key] ?? '');
}

export function learnSdd(locale: string): void {
  const docPath = path.join(PACKAGE_ROOT, 'docs', 'what-is-sdd.md');
  const relative = fs.existsSync(docPath) ? 'docs/what-is-sdd.md' : null;
  process.stdout.write(
    `${t(locale, 'learn.body')}\n\n` +
      `${t(locale, 'learn.controlPlane')}\n\n` +
      (relative
        ? `${t(locale, 'learn.readMore')}: ${relative}\n`
        : `${t(locale, 'learn.readMore')}: docs/what-is-sdd.md\n`) +
      `\n${t(locale, 'learn.workflowGuide')}: ${USAGE_GUIDE_URL}\n`,
  );
}

export function help(command?: string): boolean | undefined {
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
