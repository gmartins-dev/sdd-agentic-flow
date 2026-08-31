export type CommandAuthority = 'read-only' | 'local-mutation' | 'human-authority';

export type CommandDefinition = {
  path: readonly string[];
  authority: CommandAuthority;
  supportsPlan: boolean;
  supportsAutomaticPrompt: boolean;
  supportsInteractiveFlag: boolean;
  supportsJson: boolean;
};

const definitions = [
  ['init', 'local-mutation', true, true, false, true],
  ['install', 'local-mutation', true, true, false, false],
  ['config show', 'read-only', false, false, false, false],
  ['config policy', 'local-mutation', true, true, true, false],
  ['config installation', 'local-mutation', true, true, true, false],
  ['context status', 'read-only', false, false, false, false],
  ['context refresh', 'local-mutation', false, false, false, false],
  ['context autonomy-state', 'read-only', false, false, false, false],
  ['doctor', 'read-only', false, false, false, true],
  ['upgrade', 'human-authority', true, false, false, false],
  ['autonomous-resume', 'human-authority', false, false, false, false],
  ['uninstall', 'local-mutation', true, true, false, false],
  ['learn-sdd', 'read-only', false, false, false, false],
  ['help', 'read-only', false, false, false, false],
  ['version', 'read-only', false, false, false, false],
  ['completion', 'read-only', false, false, false, false],
] as const;

export const COMMAND_REGISTRY: readonly CommandDefinition[] = definitions.map(
  ([
    path,
    authority,
    supportsPlan,
    supportsAutomaticPrompt,
    supportsInteractiveFlag,
    supportsJson,
  ]) => ({
    path: path.split(' '),
    authority,
    supportsPlan,
    supportsAutomaticPrompt,
    supportsInteractiveFlag,
    supportsJson,
  }),
);

export const CANONICAL_COMMANDS = COMMAND_REGISTRY.map((command) => command.path.join(' '));

export const REMOVED_COMMANDS = ['discover', 'configure', 'list'] as const;

export function isRemovedCommand(command: string): boolean {
  return (REMOVED_COMMANDS as readonly string[]).includes(command);
}

export function lexicalConflict(args: readonly string[]): string | undefined {
  const has = (flag: string) => args.includes(flag);
  const pairs: readonly (readonly [string, string])[] = [
    ['--json', '--interactive'],
    ['--json', '--quiet'],
    ['--json', '--ascii'],
    ['--plan', '--yes'],
    ['--interactive', '--yes'],
    ['--interactive', '--plan'],
  ];
  const conflict = pairs.find(([left, right]) => has(left) && has(right));
  return conflict ? `${conflict[0]} cannot be combined with ${conflict[1]}` : undefined;
}

export const COMPLETION_SHELLS = ['bash', 'zsh', 'fish'] as const;
export type CompletionShell = (typeof COMPLETION_SHELLS)[number];

export function completionFor(shell: string): string | undefined {
  if (!COMPLETION_SHELLS.includes(shell as CompletionShell)) return undefined;
  const commands = CANONICAL_COMMANDS.join(' ');
  if (shell === 'fish') return `complete -c sdd-agentic-flow -f -a '${commands}'\n`;
  const words = CANONICAL_COMMANDS.join(' ');
  const currentWord = '$' + '{COMP_WORDS[COMP_CWORD]}';
  return shell === 'zsh'
    ? `#compdef sdd-agentic-flow\n_sdd_agentic_flow() {\n  _arguments '1:command:(${words})'\n}\n_sdd_agentic_flow "$@"\n`
    : `_sdd_agentic_flow() {\n  COMPREPLY=( $(compgen -W '${words}' -- "${currentWord}") )\n}\ncomplete -F _sdd_agentic_flow sdd-agentic-flow\n`;
}

export function commandDefinition(tokens: readonly string[]): CommandDefinition | undefined {
  return COMMAND_REGISTRY.find((command) => command.path.join(' ') === tokens.join(' '));
}
