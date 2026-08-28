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
