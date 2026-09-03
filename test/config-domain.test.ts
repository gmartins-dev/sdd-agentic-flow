import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import {
  applyPolicyMutation,
  autonomyComboValid,
  effectiveConfigYaml,
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
  human_outputs: en-US
  technical_tokens: canonical
  bilingual_mode: technical-canonical
`;

test('readConfig parses policy and preset equivalent', () => {
  const file = writeConfig('ok.yml', SAMPLE);
  const config = readConfig(file);
  assert.equal(config.ok, true);
  assert.ok(config.policy);
  assert.equal(config.policy.executionMode, 'guided');
  assert.equal(config.policy.autonomyLevel, 'manual');
  assert.equal(config.presetEquivalent, 'manual');
  assert.equal(config.featureProfileExplicit, true);
});

test('readConfig treats missing config as healthy built-in defaults', () => {
  const config = readConfig(path.join(temporary, 'missing.yml'));
  assert.equal(config.ok, true);
  assert.equal(config.state, 'absent');
  assert.equal(config.origin, 'built-in-defaults');
  assert.equal(config.featureProfileExplicit, false);
  assert.deepEqual(config.policy, { executionMode: 'apply', autonomyLevel: 'supervised' });
});

test('effective defaults do not materialize a feature profile', () => {
  assert.doesNotMatch(effectiveConfigYaml(), /feature_profile:/);
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

test('applyPolicyMutation repairs a mismatched human output locale', () => {
  const file = writeConfig(
    'language-mismatch.yml',
    SAMPLE.replace('profile: en-US', 'profile: pt-BR'),
  );
  const result = applyPolicyMutation(file, {
    executionMode: 'guided',
    autonomyLevel: 'manual',
    languageProfile: 'pt-BR',
  });
  assert.equal(result.ok, true);
  assert.equal(result.wrote, true);
  const content = fs.readFileSync(file, 'utf8');
  assert.match(content, /profile: pt-BR/);
  assert.match(content, /human_outputs: pt-BR/);
});

test('applyPolicyMutation materializes missing language fields', () => {
  const file = writeConfig('language-missing.yml', SAMPLE.replace(/\nlanguage:[\s\S]*$/, '\n'));
  const result = applyPolicyMutation(file, {
    executionMode: 'guided',
    autonomyLevel: 'manual',
    languageProfile: 'en-US',
  });
  assert.equal(result.ok, true);
  const content = fs.readFileSync(file, 'utf8');
  assert.match(
    content,
    /language:\n  (?:profile: en-US\n  human_outputs: en-US|human_outputs: en-US\n  profile: en-US)/,
  );
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

test('explicit feature profile can be materialized without an existing config field', () => {
  const file = path.join(temporary, 'explicit-profile/config.yml');
  const result = applyPolicyMutation(file, {
    executionMode: 'full',
    autonomyLevel: 'autonomous',
    featureProfile: 'large_feature',
  });
  assert.equal(result.ok, true);
  assert.match(fs.readFileSync(file, 'utf8'), /feature_profile: large_feature/);
  assert.equal(readConfig(file).featureProfileExplicit, true);
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

test('policy mutation updates language and feature profile without replacing YAML', () => {
  const file = writeConfig('extended.yml', `${SAMPLE}quality:\n  require_tdd: true\n`);
  const before = fs.readFileSync(file, 'utf8');
  const result = applyPolicyMutation(file, {
    executionMode: 'guided',
    autonomyLevel: 'manual',
    languageProfile: 'pt-BR',
    featureProfile: 'large_feature',
  });
  assert.equal(result.ok, true);
  const content = fs.readFileSync(file, 'utf8');
  assert.notEqual(content, before);
  assert.match(content, /profile: pt-BR/);
  assert.match(content, /human_outputs: pt-BR/);
  assert.match(content, /feature_profile: large_feature/);
  assert.match(content, /require_tdd: true/);
});

test('default policy selection does not materialize absent config', () => {
  const file = path.join(temporary, 'defaults/config.yml');
  const result = applyPolicyMutation(file, {
    executionMode: 'apply',
    autonomyLevel: 'supervised',
    languageProfile: 'en-US',
    featureProfile: 'medium_feature',
  });
  assert.equal(result.ok, true);
  assert.equal(result.wrote, false);
  assert.equal(fs.existsSync(file), false);
});

test('resolvePolicyFromPreset maps manual', () => {
  const resolved = resolvePolicyFromPreset('manual');
  assert.deepEqual(resolved, {
    executionMode: 'guided',
    autonomyLevel: 'manual',
    presetName: 'manual',
  });
});
