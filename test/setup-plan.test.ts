import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { setupPlanIsCurrent, setupPrecondition, targetsForHosts } from '../src/setup-plan';

test('maps selected hosts to deduplicated persisted targets', () => {
  assert.deepEqual(targetsForHosts(['codex', 'cursor', 'claude-code']), [
    'agents',
    'cursor',
    'claude',
  ]);
});

test('invalidates a reviewed setup plan when durable inputs change', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-plan-'));
  try {
    const plan = { precondition: setupPrecondition(cwd) } as Parameters<
      typeof setupPlanIsCurrent
    >[1];
    fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.sdd-agentic-flow', 'workspace.yml'), 'changed\n');
    assert.equal(setupPlanIsCurrent(cwd, plan), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
