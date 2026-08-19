export type CommandAuthority = 'read-only' | 'local-mutation' | 'human-authority';

export type CommandDefinition = {
  path: readonly string[];
  authority: CommandAuthority;
  supportsPlan: boolean;
  supportsInteractive: boolean;
  supportsJson: boolean;
};

const definitions = [
  ['init', 'local-mutation', true, true, true],
  ['install', 'local-mutation', true, true, true],
  ['config show', 'read-only', false, false, true],
  ['config policy', 'local-mutation', true, true, true],
  ['config installation', 'local-mutation', true, true, true],
  ['context status', 'read-only', false, false, true],
  ['context refresh', 'local-mutation', true, true, true],
  ['context autonomy-state', 'read-only', false, false, true],
  ['doctor', 'read-only', false, false, true],
  ['upgrade', 'human-authority', true, false, false],
  ['autonomous-resume', 'human-authority', false, false, false],
  ['uninstall', 'local-mutation', true, true, true],
  ['list', 'read-only', false, false, true],
  ['learn-sdd', 'read-only', false, false, false],
  ['help', 'read-only', false, false, false],
  ['version', 'read-only', false, false, true],
  ['completion', 'read-only', false, false, false],
] as const;

export const COMMAND_REGISTRY: readonly CommandDefinition[] = definitions.map(
  ([path, authority, supportsPlan, supportsInteractive, supportsJson]) => ({
    path: path.split(' '),
    authority,
    supportsPlan,
    supportsInteractive,
    supportsJson,
  }),
);

export const CANONICAL_COMMANDS = COMMAND_REGISTRY.map((command) => command.path.join(' '));

export const REMOVED_COMMANDS = ['discover', 'configure'] as const;

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

export type CompletionShell = 'bash' | 'zsh' | 'fish';

export function completionFor(shell: string): string | undefined {
  if (!['bash', 'zsh', 'fish'].includes(shell)) return undefined;
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
