import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import {
  applyPolicyMutation,
  autonomyComboValid,
  readConfig,
  resolvePolicyFromPreset,
  validatePolicyMutation,
} from '../src/config-domain';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-config-domain-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

function writeConfig(name: string, body: string): string {
  const file = path.join(temporary, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

const SAMPLE = `version: 1
workflow:
  execution_mode: guided
  autonomy_level: manual
  feature_profile: medium_feature
language:
  profile: en-US
`;

test('readConfig parses policy and preset equivalent', () => {
  const file = writeConfig('ok.yml', SAMPLE);
  const config = readConfig(file);
  assert.equal(config.ok, true);
  assert.ok(config.policy);
  assert.equal(config.policy.executionMode, 'guided');
  assert.equal(config.policy.autonomyLevel, 'manual');
  assert.equal(config.presetEquivalent, 'manual');
});

test('validatePolicyMutation rejects invalid combos', () => {
  assert.equal(autonomyComboValid('plan', 'autonomous'), false);
  const result = validatePolicyMutation({ executionMode: 'plan', autonomyLevel: 'autonomous' });
  assert.equal(result.ok, false);
});

test('applyPolicyMutation dry-run does not write', () => {
  const file = writeConfig('mutate.yml', SAMPLE);
  const result = applyPolicyMutation(
    file,
    { executionMode: 'apply', autonomyLevel: 'supervised' },
    { dryRun: true },
  );
  assert.equal(result.ok, true);
  assert.equal(result.wrote, false);
  const unchanged = readConfig(file);
  assert.ok(unchanged.ok && unchanged.policy);
  assert.equal(unchanged.policy.executionMode, 'guided');
});

test('applyPolicyMutation writes authorized fields only', () => {
  const file = writeConfig('write.yml', SAMPLE);
  const result = applyPolicyMutation(
    file,
    { executionMode: 'full', autonomyLevel: 'autonomous' },
    { dryRun: false },
  );
  assert.equal(result.ok, true);
  assert.equal(result.wrote, true);
  const updated = readConfig(file);
  assert.ok(updated.ok && updated.policy);
  assert.equal(updated.policy.executionMode, 'full');
  assert.equal(updated.policy.autonomyLevel, 'autonomous');
  assert.equal(updated.presetEquivalent, 'autonomous');
});

test('resolvePolicyFromPreset maps manual', () => {
  const resolved = resolvePolicyFromPreset('manual');
  assert.deepEqual(resolved, {
    executionMode: 'guided',
    autonomyLevel: 'manual',
    presetName: 'manual',
  });
});
