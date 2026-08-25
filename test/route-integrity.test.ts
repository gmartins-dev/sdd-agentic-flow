import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { commandDefinition } from '../src/command-registry';
import { MENU_ACTIONS } from '../src/menu';

test('menu routes resolve to registered commands and existing packs', () => {
  for (const action of MENU_ACTIONS) {
    if (!action.command.length) continue;
    const first = action.command[0];
    if (!first) continue;
    const base = ['config', 'context'].includes(first) ? action.command.slice(0, 2) : [first];
    assert.ok(commandDefinition(base), `unregistered route: ${action.command.join(' ')}`);
    if (action.command[0] === 'install') {
      const pack = action.command[1];
      assert.ok(pack, `missing pack in route: ${action.command.join(' ')}`);
      assert.equal(fs.existsSync(path.join(__dirname, '..', 'packs', `${pack}.json`)), true);
    }
  }
});
