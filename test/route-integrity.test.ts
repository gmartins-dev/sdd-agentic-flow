import assert from 'node:assert/strict';
import { test } from 'node:test';

import { commandDefinition } from '../src/command-registry';
import { MENU_ACTIONS } from '../src/menu';

test('menu routes resolve to registered commands', () => {
  for (const action of MENU_ACTIONS) {
    if (!action.command.length) continue;
    const first = action.command[0];
    if (!first) continue;
    const base = ['config', 'context'].includes(first) ? action.command.slice(0, 2) : [first];
    assert.ok(commandDefinition(base), `unregistered route: ${action.command.join(' ')}`);
  }
});
