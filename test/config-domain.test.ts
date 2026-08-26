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

const SAMPLE = `schema: saf-config/v3
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

test('readConfig treats missing config as healthy built-in defaults', () => {
  const config = readConfig(path.join(temporary, 'missing.yml'));
  assert.equal(config.ok, true);
  assert.equal(config.state, 'absent');
  assert.equal(config.origin, 'built-in-defaults');
  assert.deepEqual(config.policy, { executionMode: 'apply', autonomyLevel: 'supervised' });
});

test('readConfig rejects unsupported v5 schema before policy mutation', () => {
  const file = writeConfig('old.yml', SAMPLE.replace('saf-config/v3', 'saf-config/v0'));
  const config = readConfig(file);
  assert.equal(config.ok, false);
  assert.match(config.errors.join('; '), /unsupported config schema/);
  const before = fs.readFileSync(file, 'utf8');
  const mutation = applyPolicyMutation(file, {
    executionMode: 'full',
    autonomyLevel: 'autonomous',
  });
  assert.equal(mutation.ok, false);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
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

test('applyPolicyMutation materializes config only when an absent default is changed', () => {
  const file = path.join(temporary, 'new/config.yml');
  const preview = applyPolicyMutation(
    file,
    { executionMode: 'full', autonomyLevel: 'autonomous' },
    { dryRun: true },
  );
  assert.equal(preview.ok, true);
  assert.equal(fs.existsSync(file), false);
  const result = applyPolicyMutation(file, {
    executionMode: 'full',
    autonomyLevel: 'autonomous',
  });
  assert.equal(result.ok, true);
  assert.equal(readConfig(file).presetEquivalent, 'autonomous');
});

test('policy mutation preserves comments and unrelated config content', () => {
  const file = writeConfig('preserve.yml', `${SAMPLE}# local note\ncustom_extension: retained\n`);
  const result = applyPolicyMutation(file, {
    executionMode: 'apply',
    autonomyLevel: 'supervised',
  });
  assert.equal(result.ok, true);
  const content = fs.readFileSync(file, 'utf8');
  assert.match(content, /# local note/);
  assert.match(content, /custom_extension: retained/);
  assert.match(content, /execution_mode: apply/);
  assert.match(content, /autonomy_level: supervised/);
});

test('resolvePolicyFromPreset maps manual', () => {
  const resolved = resolvePolicyFromPreset('manual');
  assert.deepEqual(resolved, {
    executionMode: 'guided',
    autonomyLevel: 'manual',
    presetName: 'manual',
  });
});
