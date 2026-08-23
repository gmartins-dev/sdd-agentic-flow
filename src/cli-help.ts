import { CANONICAL_COMMANDS } from './command-registry';
import { SDD_PATHS } from './paths';

export const USAGE = {
  init: 'usage: init [--interactive] [--language en-US|pt-BR] [--feature-profile small_fix|medium_feature|large_feature|epic] [--preset manual|supervised|autonomous] [--execution-mode plan|guided|apply|review|full] [--autonomy-level manual|supervised|autonomous] [--local-git-exclude] [--quiet]',
  install:
    'usage: install <planning|execution|review|multi-task|full> [--scope user|project] [--target agents|cursor|claude|copilot] [--plan] [--interactive] [--quiet]',
  config: 'usage: config show | config policy [--plan|--yes] | config installation [--plan|--yes]',
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
  init: `sdd-agentic-flow init\n\nCreate ${SDD_PATHS.config}, project context, usage guidance, and local SDD state. Existing configuration is preserved.\n\nUSAGE\n  ${USAGE.init}\n\nOPTIONS\n  --interactive          Guided setup; requires interactive TTY and unset CI.\n  --language <profile>   en-US or pt-BR.\n  --feature-profile <p>  small_fix | medium_feature | large_feature | epic.\n  --preset <p>           manual | supervised | autonomous.\n  --execution-mode <m>   plan | guided | apply | review | full.\n  --autonomy-level <l>   manual | supervised | autonomous.\n  --local-git-exclude    Keep toolkit state out of Git status.\n  --quiet                Suppress optional next-step prose.\n  --ascii                Use ASCII presentation.\n${shared}`,
  config: `sdd-agentic-flow config\n\nInspect or change workflow policy and desired installation intent.\n\nUSAGE\n  sdd-agentic-flow config show\n  sdd-agentic-flow config policy [--plan|--yes]\n  sdd-agentic-flow config installation [--plan|--yes]\n\nconfig installation saves intent only; it never installs skills.\n${shared}`,
  install: `sdd-agentic-flow install <pack>\n\nInstall one of the five v6 skill packs: planning, execution, review, multi-task, or full.\n\nUSAGE\n  ${USAGE.install}\n\n--target is repeatable for user scope: agents | cursor | claude | copilot.\n${shared}`,
  doctor: `sdd-agentic-flow doctor\n\nRead-only health and contract checks.\n\nUSAGE\n  ${USAGE.doctor}\n\n--json emits one versioned machine document and never prompts.\n${shared}`,
  context: `sdd-agentic-flow context\n\nInspect or regenerate project context and autonomy state.\n\nUSAGE\n  ${USAGE.context}\n${shared}`,
  upgrade: `sdd-agentic-flow upgrade\n\nCheck or interactively apply CLI/skill updates.\n\nUSAGE\n  ${USAGE.upgrade}\n\nUpgrade apply is human-authority only and has no JSON/--yes form.\n${shared}`,
  uninstall: `sdd-agentic-flow uninstall\n\nRemove only recognized SAF-managed installation assets.\n\nUSAGE\n  ${USAGE.uninstall}\n\nUse --plan first; --yes authorizes local apply outside a TTY.\n${shared}`,
  'learn-sdd': `sdd-agentic-flow learn-sdd\n\nShow a concise explanation of Spec-Driven Development and the SAF workflow.\n\nUSAGE\n  sdd-agentic-flow learn-sdd\n${shared}`,
  completion: `sdd-agentic-flow completion\n\nPrint deterministic shell completion for the selected shell.\n\nUSAGE\n  sdd-agentic-flow completion bash|zsh|fish\n${shared}`,
  version: `sdd-agentic-flow version\n\nPrint the installed package version.\n\nUSAGE\n  sdd-agentic-flow version\n${shared}`,
  'autonomous-resume': `sdd-agentic-flow autonomous-resume\n\nResume a recorded autonomy workflow guardrail.\n\nUSAGE\n  ${USAGE['autonomous-resume']}\n${shared}`,
  list: 'sdd-agentic-flow list\n\nList available skill packs.\n',
};

export function writeCommandHelp(key: string): void {
  process.stdout.write(COMMAND_HELP[key] ?? '');
}
