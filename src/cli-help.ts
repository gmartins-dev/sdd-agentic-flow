import { renderCliCommand } from './cli-command';
import { CANONICAL_COMMANDS } from './command-registry';

export const USAGE = {
  init: 'usage: init [--plan] [--json] [--quiet] [--ascii] [--yes]',
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
  config: `${renderCliCommand('config')}\n\nInspect or change workflow policy and desired installation intent.\n\nUSAGE\n  ${renderCliCommand('config', 'show')}\n  ${renderCliCommand('config', 'policy')} [--plan|--yes] [--preset ...] [--language en-US|pt-BR] [--feature-profile small_fix|medium_feature|large_feature|epic]\n  ${renderCliCommand('config', 'installation')} [--plan|--yes]\n\nconfig policy changes workflow, language, and feature profile. config installation saves intent only; it never installs skills. adoption_mode selects personal, specs-shared, or team project visibility. It does not change scope and never edits .gitignore, global excludes, or Git history.\n${shared}`,
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
