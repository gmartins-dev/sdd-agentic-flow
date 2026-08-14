'use strict';

const fs = require('node:fs');

const EXECUTION_MODES = ['plan', 'guided', 'apply', 'review', 'full'];
const AUTONOMY_LEVELS = ['manual', 'supervised', 'autonomous'];
const INVALID_AUTONOMY_COMBOS = new Set(['plan:autonomous', 'guided:autonomous']);

const OPERATING_PRESETS = {
  manual: { executionMode: 'guided', autonomyLevel: 'manual' },
  supervised: { executionMode: 'apply', autonomyLevel: 'supervised' },
  autonomous: { executionMode: 'full', autonomyLevel: 'autonomous' },
};

function autonomyComboValid(executionMode, autonomyLevel) {
  return !INVALID_AUTONOMY_COMBOS.has(`${executionMode}:${autonomyLevel}`);
}

function configValue(content, key) {
  const match = content.match(new RegExp(`^\\s+${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
}

function presetEquivalentFor(executionMode, autonomyLevel) {
  for (const [name, preset] of Object.entries(OPERATING_PRESETS)) {
    if (preset.executionMode === executionMode && preset.autonomyLevel === autonomyLevel) {
      return name;
    }
  }
  return null;
}

function readConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return { ok: false, errors: ['config not found'], path: configPath, content: null };
  }
  let content;
  try {
    content = fs.readFileSync(configPath, 'utf8');
  } catch (error) {
    return { ok: false, errors: [error.message], path: configPath, content: null };
  }
  const executionMode = configValue(content, 'execution_mode');
  const autonomyLevel = configValue(content, 'autonomy_level');
  const featureProfile = configValue(content, 'feature_profile');
  const languageProfile = configValue(content, 'profile');
  const errors = [];
  if (!executionMode) errors.push('workflow.execution_mode missing');
  if (!autonomyLevel) errors.push('workflow.autonomy_level missing');
  if (executionMode && !EXECUTION_MODES.includes(executionMode)) {
    errors.push(`invalid execution_mode: ${executionMode}`);
  }
  if (autonomyLevel && !AUTONOMY_LEVELS.includes(autonomyLevel)) {
    errors.push(`invalid autonomy_level: ${autonomyLevel}`);
  }
  if (executionMode && autonomyLevel && !autonomyComboValid(executionMode, autonomyLevel)) {
    errors.push(`invalid combo: ${executionMode} + ${autonomyLevel}`);
  }
  return {
    ok: errors.length === 0,
    path: configPath,
    content,
    policy: { executionMode, autonomyLevel },
    featureProfile,
    languageProfile,
    presetEquivalent:
      executionMode && autonomyLevel ? presetEquivalentFor(executionMode, autonomyLevel) : null,
    errors,
  };
}

function validatePolicyMutation({ executionMode, autonomyLevel }) {
  const errors = [];
  if (!executionMode || !EXECUTION_MODES.includes(executionMode)) {
    errors.push(`invalid execution_mode: ${executionMode ?? '(missing)'}`);
  }
  if (!autonomyLevel || !AUTONOMY_LEVELS.includes(autonomyLevel)) {
    errors.push(`invalid autonomy_level: ${autonomyLevel ?? '(missing)'}`);
  }
  if (executionMode && autonomyLevel && !autonomyComboValid(executionMode, autonomyLevel)) {
    errors.push(`invalid combo: ${executionMode} + ${autonomyLevel}`);
  }
  return { ok: errors.length === 0, errors };
}

function replaceWorkflowField(content, key, value) {
  const pattern = new RegExp(`^(\\s+${key}:\\s*).+$`, 'm');
  if (!pattern.test(content)) {
    return { ok: false, error: `field ${key} not found` };
  }
  return { ok: true, content: content.replace(pattern, `$1${value}`) };
}

function buildPolicyPreview(before, after) {
  return {
    before,
    after,
    beforePreset: presetEquivalentFor(before.executionMode, before.autonomyLevel),
    afterPreset: presetEquivalentFor(after.executionMode, after.autonomyLevel),
  };
}

function applyPolicyMutation(configPath, { executionMode, autonomyLevel }, options = {}) {
  const validation = validatePolicyMutation({ executionMode, autonomyLevel });
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, wrote: false };
  }
  const current = readConfig(configPath);
  if (!current.content) {
    return {
      ok: false,
      errors: current.errors?.length ? current.errors : ['config not readable'],
      wrote: false,
    };
  }
  if (!current.policy.executionMode || !current.policy.autonomyLevel) {
    return {
      ok: false,
      errors: current.errors?.length ? current.errors : ['config policy fields missing'],
      wrote: false,
    };
  }
  const preview = buildPolicyPreview(current.policy, { executionMode, autonomyLevel });
  if (options.dryRun) {
    return { ok: true, preview, wrote: false };
  }
  let next = current.content;
  let replaced = replaceWorkflowField(next, 'execution_mode', executionMode);
  if (!replaced.ok) return { ok: false, errors: [replaced.error], wrote: false };
  next = replaced.content;
  replaced = replaceWorkflowField(next, 'autonomy_level', autonomyLevel);
  if (!replaced.ok) return { ok: false, errors: [replaced.error], wrote: false };
  next = replaced.content;
  fs.writeFileSync(configPath, next, 'utf8');
  return { ok: true, preview, wrote: true };
}

function resolvePolicyFromPreset(presetName) {
  const preset = OPERATING_PRESETS[presetName];
  if (!preset) return null;
  return {
    executionMode: preset.executionMode,
    autonomyLevel: preset.autonomyLevel,
    presetName,
  };
}

module.exports = {
  EXECUTION_MODES,
  AUTONOMY_LEVELS,
  OPERATING_PRESETS,
  autonomyComboValid,
  presetEquivalentFor,
  readConfig,
  validatePolicyMutation,
  applyPolicyMutation,
  resolvePolicyFromPreset,
  configValue,
};
