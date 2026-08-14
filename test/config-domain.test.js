'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const {
  readConfig,
  applyPolicyMutation,
  validatePolicyMutation,
  resolvePolicyFromPreset,
  autonomyComboValid,
} = require('../bin/config-domain');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-config-domain-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

function writeConfig(name, body) {
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
  assert.equal(readConfig(file).policy.executionMode, 'guided');
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
