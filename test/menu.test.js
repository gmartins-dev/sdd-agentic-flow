'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  shouldShowInteractiveMenu,
  MENU_ACTIONS,
  menuActionsFor,
  resolveMenuSelection,
} = require('../bin/menu');

test('shouldShowInteractiveMenu requires both streams to be a real TTY and no CI env var', () => {
  assert.equal(
    shouldShowInteractiveMenu({ stdout: { isTTY: true }, stdin: { isTTY: true } }, {}),
    true,
  );
  assert.equal(
    shouldShowInteractiveMenu({ stdout: { isTTY: false }, stdin: { isTTY: true } }, {}),
    false,
  );
  assert.equal(
    shouldShowInteractiveMenu({ stdout: { isTTY: true }, stdin: { isTTY: false } }, {}),
    false,
  );
  assert.equal(
    shouldShowInteractiveMenu({ stdout: { isTTY: true }, stdin: { isTTY: true } }, { CI: 'true' }),
    false,
  );
  assert.equal(shouldShowInteractiveMenu({}, {}), false);
  assert.equal(shouldShowInteractiveMenu(undefined, undefined), false);
});

test('resolveMenuSelection treats empty input, 0, and q as no action', () => {
  for (const input of ['', '0', 'q', 'Q', '  ']) {
    assert.equal(resolveMenuSelection(input), null, JSON.stringify(input));
  }
});

test('resolveMenuSelection maps valid numeric input to the corresponding action', () => {
  assert.deepEqual(resolveMenuSelection('1'), MENU_ACTIONS[0]);
  assert.deepEqual(resolveMenuSelection(String(MENU_ACTIONS.length)), MENU_ACTIONS.at(-1));
});

test('resolveMenuSelection never throws on out-of-range or non-numeric input', () => {
  assert.equal(resolveMenuSelection('999'), null);
  assert.equal(resolveMenuSelection('abc'), null);
  assert.equal(resolveMenuSelection(undefined), null);
  assert.equal(resolveMenuSelection(null), null);
});

test('CLI-008: the uninstall menu entry is hard-coded to --plan only, never --apply', () => {
  const uninstallEntry = MENU_ACTIONS.find((action) => /uninstall/i.test(action.label));
  assert.ok(uninstallEntry, 'expected an uninstall entry in MENU_ACTIONS');
  assert.deepEqual(uninstallEntry.command, ['uninstall', '--plan']);
  const installed = menuActionsFor({ hasConfig: true, hasSkills: true });
  const filtered = installed.find((action) => action.command[0] === 'uninstall');
  assert.deepEqual(filtered.command, ['uninstall', '--plan']);
});

test('menuActionsFor filters by config/skills state', () => {
  assert.deepEqual(
    menuActionsFor({ hasConfig: false, hasSkills: false }).map((a) => a.command),
    [['init'], ['learn-sdd'], ['help']],
  );
  assert.deepEqual(
    menuActionsFor({ hasConfig: true, hasSkills: false }).map((a) => a.command),
    [['install', 'core'], ['install', 'core', '--plan'], ['doctor'], ['configure'], ['help']],
  );
  assert.deepEqual(
    menuActionsFor({ hasConfig: true, hasSkills: true }).map((a) => a.command),
    [
      ['doctor'],
      ['config', 'policy'],
      ['upgrade'],
      ['discover', '--force'],
      ['uninstall', '--plan'],
      ['help'],
    ],
  );
});

test('ready menu uses the explicit advanced-options label', () => {
  const actions = menuActionsFor({ onboardingState: 'READY' });
  assert.equal(actions.at(-1).label, 'Commands and advanced options');
});
