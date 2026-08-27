import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  defaultOnboardingPolicy,
  ONBOARDING_DEFAULT_PRESET,
  onboardingPresetOrder,
  setupPolicyFromPair,
  setupPolicyFromPreset,
} from '../src/config-domain';
import { defaultInstallConfig, serializeInstallConfig } from '../src/install-domain';
import {
  persistedSetupIntent,
  policyFromConfig,
  policyReviewTitle,
  resolvePolicyFromCommandOptions,
} from '../src/setup';

test('onboarding default preset is supervised (apply + supervised)', () => {
  assert.equal(ONBOARDING_DEFAULT_PRESET, 'supervised');
  const draft = defaultOnboardingPolicy();
  assert.equal(draft.presetName, 'supervised');
  assert.equal(draft.executionMode, 'apply');
  assert.equal(draft.autonomyLevel, 'supervised');
});

test('setup policy presets resolve canonical pairs', () => {
  assert.deepEqual(setupPolicyFromPreset('manual'), {
    kind: 'preset',
    presetName: 'manual',
    executionMode: 'guided',
    autonomyLevel: 'manual',
  });
  assert.deepEqual(setupPolicyFromPreset('autonomous'), {
    kind: 'preset',
    presetName: 'autonomous',
    executionMode: 'full',
    autonomyLevel: 'autonomous',
  });
});

test('setup policy rejects invalid pairs', () => {
  assert.equal(setupPolicyFromPair('guided', 'autonomous'), null);
  assert.equal(setupPolicyFromPair('plan', 'autonomous'), null);
});

test('custom valid pair is marked custom when not a preset alias', () => {
  const draft = setupPolicyFromPair('review', 'supervised');
  assert.ok(draft);
  assert.equal(draft.kind, 'custom');
  assert.equal(draft.presetName, null);
});

test('resolvePolicyFromCommandOptions honors flag precedence', () => {
  assert.deepEqual(
    resolvePolicyFromCommandOptions({
      presetName: 'autonomous',
      policyFromCli: true,
    }),
    setupPolicyFromPreset('autonomous'),
  );
  assert.deepEqual(
    resolvePolicyFromCommandOptions({
      executionMode: 'full',
      autonomyLevel: 'autonomous',
      policyFromCli: true,
    }),
    setupPolicyFromPair('full', 'autonomous'),
  );
  assert.equal(
    resolvePolicyFromCommandOptions({
      executionMode: 'guided',
      autonomyLevel: 'manual',
    }),
    null,
  );
  assert.equal(resolvePolicyFromCommandOptions({}), null);
});

test('policyReviewTitle distinguishes preset and custom labels', () => {
  const supervised = defaultOnboardingPolicy();
  assert.equal(policyReviewTitle(supervised, 'en-US'), 'Supervised');
  assert.equal(
    policyReviewTitle(
      { kind: 'custom', presetName: null, executionMode: 'review', autonomyLevel: 'manual' },
      'en-US',
    ),
    'Custom',
  );
});

test('onboarding preset order lists supervised first', () => {
  assert.deepEqual(onboardingPresetOrder(), ['supervised', 'manual', 'autonomous']);
});

test('policyFromConfig maps stored config to draft', () => {
  const draft = policyFromConfig(
    {
      ok: true,
      path: '/tmp/config.yml',
      content: '',
      policy: { executionMode: 'full', autonomyLevel: 'autonomous' },
      presetEquivalent: 'autonomous',
      errors: [],
    },
    'en-US',
  );
  assert.equal(draft.presetName, 'autonomous');
  assert.equal(draft.executionMode, 'full');
  assert.equal(draft.autonomyLevel, 'autonomous');
});

test('guided resume reconstructs persisted intent without re-asking it', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-resume-project-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-resume-home-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd });
    const install = defaultInstallConfig();
    install.user.targets = ['agents', 'claude', 'copilot'];
    fs.mkdirSync(path.join(home, '.sdd-agentic-flow'), { recursive: true });
    fs.writeFileSync(
      path.join(home, '.sdd-agentic-flow', 'install.yml'),
      serializeInstallConfig(install),
    );
    fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow'), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, '.sdd-agentic-flow', 'config.yml'),
      'schema: saf-config/v3\n\nlanguage:\n  profile: pt-BR\n  human_outputs: pt-BR\n\nworkflow:\n  execution_mode: apply\n  autonomy_level: supervised\n  feature_profile: large_feature\n',
    );
    assert.deepEqual(persistedSetupIntent(cwd, home), {
      selectedHosts: ['codex', 'claude-code', 'vscode-copilot'],
      workflow: 'supervised',
      language: 'pt-BR',
      featureProfile: 'large_feature',
    });
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});
