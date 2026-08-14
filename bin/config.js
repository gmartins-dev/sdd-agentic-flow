'use strict';

const readline = require('node:readline/promises');
const {
  readConfig,
  applyPolicyMutation,
  resolvePolicyFromPreset,
  OPERATING_PRESETS,
} = require('./config-domain');
const { outputMode, renderKeyValue, renderSection, renderWarning } = require('./ui');

function renderPolicySummary(config, mode) {
  const lines = [];
  if (mode === 'machine') {
    lines.push(`execution_mode=${config.policy.executionMode}`);
    lines.push(`autonomy_level=${config.policy.autonomyLevel}`);
    if (config.presetEquivalent) lines.push(`preset=${config.presetEquivalent}`);
    if (config.featureProfile) lines.push(`feature_profile=${config.featureProfile}`);
    if (config.languageProfile) lines.push(`language=${config.languageProfile}`);
    return lines.join('\n');
  }
  lines.push(...renderSection('Operating policy', mode));
  if (config.presetEquivalent) {
    lines.push(...renderKeyValue('Preset', config.presetEquivalent, mode));
  }
  lines.push(...renderKeyValue('Execution mode', config.policy.executionMode, mode));
  lines.push(...renderKeyValue('Autonomy level', config.policy.autonomyLevel, mode));
  if (config.featureProfile) {
    lines.push(...renderKeyValue('Feature profile', config.featureProfile, mode));
  }
  if (config.languageProfile) {
    lines.push(...renderKeyValue('Language', config.languageProfile, mode));
  }
  return lines.join('\n');
}

function renderPolicyPreview(preview, mode) {
  const lines = [];
  lines.push(...renderSection('Policy change preview', mode));
  const before = preview.beforePreset
    ? preview.beforePreset
    : `${preview.before.executionMode} + ${preview.before.autonomyLevel}`;
  const after = preview.afterPreset
    ? preview.afterPreset
    : `${preview.after.executionMode} + ${preview.after.autonomyLevel}`;
  lines.push(...renderKeyValue('Before', before, mode));
  lines.push(...renderKeyValue('After', after, mode));
  return lines.join('\n');
}

async function resolveNextPolicy(args) {
  let preset = null;
  let executionMode = null;
  let autonomyLevel = null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--plan' || arg === '--yes') continue;
    if (arg === '--preset' && args[index + 1]) {
      preset = args[index + 1];
      index += 1;
    } else if (arg === '--execution-mode' && args[index + 1]) {
      executionMode = args[index + 1];
      index += 1;
    } else if (arg === '--autonomy-level' && args[index + 1]) {
      autonomyLevel = args[index + 1];
      index += 1;
    }
  }
  if (preset) {
    const resolved = resolvePolicyFromPreset(preset);
    if (!resolved) return { ok: false, message: `unknown preset: ${preset}` };
    return { ok: true, policy: resolved };
  }
  if (executionMode && autonomyLevel) {
    return { ok: true, policy: { executionMode, autonomyLevel } };
  }
  if (process.stdin.isTTY) {
    process.stdout.write('Operating presets:\n');
    for (const [name, value] of Object.entries(OPERATING_PRESETS)) {
      process.stdout.write(`  ${name}: ${value.executionMode} + ${value.autonomyLevel}\n`);
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const raw = await rl.question('\nPreset [manual]: ');
      const chosen = (raw || 'manual').trim();
      const resolved = resolvePolicyFromPreset(chosen);
      if (!resolved) return { ok: false, message: `unknown preset: ${chosen}` };
      return { ok: true, policy: resolved };
    } finally {
      rl.close();
    }
  }
  return {
    ok: false,
    message:
      'Non-interactive policy change requires --yes with --preset or explicit --execution-mode and --autonomy-level',
    try: [
      'sdd-agentic-flow config policy --plan --preset supervised',
      'sdd-agentic-flow config policy --yes --preset manual',
    ],
  };
}

async function runConfigShow(configPath, options = {}) {
  const mode =
    options.mode ||
    outputMode({ stdout: process.stdout, stdin: process.stdin }, process.env, options);
  const config = readConfig(configPath);
  if (!config.ok) {
    return { ok: false, exitCode: 1, message: config.errors.join('; ') };
  }
  process.stdout.write(`${renderPolicySummary(config, mode)}\n`);
  return { ok: true, exitCode: 0 };
}

async function runConfigPolicy(configPath, args, options = {}) {
  const mode =
    options.mode ||
    outputMode({ stdout: process.stdout, stdin: process.stdin }, process.env, options);
  const planOnly = args.includes('--plan');
  const yes = args.includes('--yes');
  const current = readConfig(configPath);
  if (!current.ok) {
    return { ok: false, exitCode: 1, message: current.errors.join('; ') };
  }
  if (!planOnly && process.stdin.isTTY) {
    process.stdout.write(`${renderPolicySummary(current, mode)}\n\n`);
  }
  const resolved = await resolveNextPolicy(args);
  if (!resolved.ok) {
    return { ok: false, exitCode: 1, message: resolved.message, try: resolved.try };
  }
  const previewResult = applyPolicyMutation(configPath, resolved.policy, { dryRun: true });
  if (!previewResult.ok) {
    return { ok: false, exitCode: 1, message: previewResult.errors.join('; ') };
  }
  process.stdout.write(`${renderPolicyPreview(previewResult.preview, mode)}\n`);
  if (planOnly) return { ok: true, exitCode: 0 };
  if (!process.stdin.isTTY) {
    if (!yes) {
      return {
        ok: false,
        exitCode: 1,
        message: 'Non-interactive mutation requires --yes',
        try: ['sdd-agentic-flow config policy --yes --preset supervised'],
      };
    }
    const applied = applyPolicyMutation(configPath, resolved.policy, { dryRun: false });
    if (!applied.ok) return { ok: false, exitCode: 1, message: applied.errors.join('; ') };
    process.stdout.write('PASS policy updated\n');
    return { ok: true, exitCode: 0 };
  }
  if (!yes) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let confirmed = false;
    try {
      const raw = await rl.question('Apply this policy change? [y/N] ');
      confirmed = /^y(es)?$/i.test((raw || '').trim());
    } finally {
      rl.close();
    }
    if (!confirmed) {
      process.stdout.write(`${renderWarning('Policy change cancelled.', mode)}\n`);
      return { ok: true, exitCode: 0, cancelled: true };
    }
  }
  const applied = applyPolicyMutation(configPath, resolved.policy, { dryRun: false });
  if (!applied.ok) return { ok: false, exitCode: 1, message: applied.errors.join('; ') };
  process.stdout.write('PASS policy updated\n');
  return { ok: true, exitCode: 0 };
}

async function runConfigCommand(configPath, args, options = {}) {
  const sub = args[0] === 'show' || args[0] === 'policy' ? args[0] : null;
  const tail = sub ? args.slice(1) : args;
  if (!sub || sub === 'show') return runConfigShow(configPath, options);
  if (sub === 'policy') return runConfigPolicy(configPath, tail, options);
  return { ok: false, exitCode: 1, message: 'usage: config [show|policy]' };
}

module.exports = {
  runConfigCommand,
  runConfigShow,
  runConfigPolicy,
  renderPolicySummary,
};
