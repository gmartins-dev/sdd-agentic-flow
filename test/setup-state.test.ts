import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { classifySetupState, collectSetupFacts, inspectSetupState } from '../src/setup-state';

test('classifies setup from durable facts without requiring config', () => {
  assert.equal(
    classifySetupState({ config: 'absent', workspace: 'absent', skills: 'absent', context: false }),
    'Fresh',
  );
  assert.equal(
    classifySetupState({ config: 'absent', workspace: 'valid', skills: 'complete', context: true }),
    'Ready',
  );
  assert.equal(
    classifySetupState({ config: 'valid', workspace: 'valid', skills: 'partial', context: true }),
    'Incomplete',
  );
  assert.equal(
    classifySetupState({
      config: 'valid',
      workspace: 'valid',
      skills: 'partial',
      context: true,
      warnings: ['target is incomplete'],
    }),
    'Incomplete',
  );
  assert.equal(
    classifySetupState({
      config: 'valid',
      workspace: 'valid',
      skills: 'complete',
      context: true,
      attention: true,
    }),
    'Attention',
  );
  assert.equal(
    classifySetupState({
      config: 'invalid',
      workspace: 'valid',
      skills: 'complete',
      context: true,
    }),
    'Blocked',
  );
});

test('inspects every required target with an injected home directory', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-state-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-home-'));
  try {
    fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow', 'context'), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, '.sdd-agentic-flow', 'workspace.yml'),
      'schema: saf-workspace/v1\n',
    );
    const facts = collectSetupFacts(cwd, home);
    assert.equal(facts.homeDir, home);
    assert.equal(facts.targets?.length, 3);
    assert.equal(
      facts.targets?.every((target) => !target.complete),
      true,
    );
    assert.equal(inspectSetupState(cwd, home).state, 'Incomplete');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});
