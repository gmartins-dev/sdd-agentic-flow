import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planRecovery } from '../src/recovery';

test('recovery recommends upgrade before bounded future reset', () => {
  const plan = planRecovery({ setupState: 'Blocked', installationKind: 'future' });
  assert.equal(plan.recommended?.code, 'upgrade_cli');
  assert.deepEqual(
    plan.actions.map((action) => action.code),
    ['upgrade_cli', 'clean_reinstall'],
  );
});

test('recovery prioritizes source-control visibility over ordinary drift', () => {
  const plan = planRecovery({
    setupState: 'Incomplete',
    installationDrift: true,
    sourceControlVisibilityDrift: true,
    gitAvailable: true,
  });
  assert.equal(plan.recommended?.code, 'resolve_source_control_visibility');
});

test('recovery uses user scope outside Git', () => {
  const plan = planRecovery({ setupState: 'Incomplete', gitAvailable: false });
  assert.equal(plan.recommended?.code, 'continue_setup');
  assert.equal(plan.actions.find((action) => action.code === 'continue_setup')?.scope, 'user');
  assert.equal(
    plan.actions.find((action) => action.code === 'use_git_workspace')?.scope,
    'project',
  );
});

test('recovery offers a clean reinstall for invalid SAF project control state', () => {
  const plan = planRecovery({ setupState: 'Blocked', projectStateInvalid: true });
  assert.equal(plan.recommended?.code, 'clean_reinstall');
  assert.equal(plan.recommended?.scope, 'combined');
});

test('recovery offers a clean reinstall for interrupted known SAF state', () => {
  const plan = planRecovery({ setupState: 'Blocked', knownStateBlocker: true });
  assert.equal(plan.recommended?.code, 'clean_reinstall');
});

test('recovery does not offer a clean reinstall for a foreign collision', () => {
  const plan = planRecovery({ setupState: 'Blocked', collision: true });
  assert.equal(
    plan.actions.some((action) => action.code === 'clean_reinstall'),
    false,
  );
});

test('recovery does not offer a clean reinstall when collision accompanies invalid state', () => {
  const plan = planRecovery({
    setupState: 'Blocked',
    projectStateInvalid: true,
    collision: true,
  });
  assert.equal(
    plan.actions.some((action) => action.code === 'clean_reinstall'),
    false,
  );
});
