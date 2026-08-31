import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANONICAL_COMMANDS,
  COMMAND_REGISTRY,
  commandDefinition,
  completionFor,
  lexicalConflict,
} from '../src/command-registry';

test('v7 command registry contains only the canonical hierarchy', () => {
  assert.deepEqual(CANONICAL_COMMANDS, [
    'init',
    'install',
    'config show',
    'config policy',
    'config installation',
    'context status',
    'context refresh',
    'context autonomy-state',
    'doctor',
    'upgrade',
    'autonomous-resume',
    'uninstall',
    'learn-sdd',
    'help',
    'version',
    'completion',
  ]);
  assert.equal(commandDefinition(['discover']), undefined);
  assert.equal(commandDefinition(['configure']), undefined);
  assert.equal(
    COMMAND_REGISTRY.find((command) => command.path.join(' ') === 'uninstall')?.supportsPlan,
    true,
  );
  assert.deepEqual(
    COMMAND_REGISTRY.filter((command) => command.supportsJson).map((command) =>
      command.path.join(' '),
    ),
    ['init', 'doctor'],
  );
  assert.equal(
    COMMAND_REGISTRY.find((command) => command.path.join(' ') === 'init')?.supportsAutomaticPrompt,
    true,
  );
  assert.match(completionFor('bash') ?? '', /completion/);
  assert.match(completionFor('zsh') ?? '', /#compdef/);
  assert.match(completionFor('fish') ?? '', /complete -c/);
  assert.equal(completionFor('powershell'), undefined);
  assert.equal(
    lexicalConflict(['--json', '--interactive']),
    '--json cannot be combined with --interactive',
  );
  assert.equal(lexicalConflict(['--plan', '--yes']), '--plan cannot be combined with --yes');
  assert.equal(lexicalConflict(['--json', '--plan']), undefined);
});
