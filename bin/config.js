'use strict';

const {
  readConfig,
  applyPolicyMutation,
  resolvePolicyFromPreset,
  OPERATING_PRESETS,
} = require('./config-domain');
const { outputMode, renderKeyValue, renderSection, renderWarning } = require('./ui');
const { resolveLocale, t } = require('./messages');
const { select } = require('./selector');

function localeForConfig(configPath) {
  const config = readConfig(configPath);
  return resolveLocale({ configured: config.ok ? config.languageProfile : null });
}

function renderPolicySummary(config, mode, locale = 'en-US') {
  const lines = [];
  if (mode === 'machine') {
    lines.push(`execution_mode=${config.policy.executionMode}`);
    lines.push(`autonomy_level=${config.policy.autonomyLevel}`);
    if (config.presetEquivalent) lines.push(`preset=${config.presetEquivalent}`);
    if (config.featureProfile) lines.push(`feature_profile=${config.featureProfile}`);
    if (config.languageProfile) lines.push(`language=${config.languageProfile}`);
    return lines.join('\n');
  }
  lines.push(...renderSection(t(locale, 'config.operatingPolicy'), mode));
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

function renderPolicyPreview(preview, mode, locale = 'en-US') {
  const lines = [];
  lines.push(...renderSection(t(locale, 'config.policyPreview'), mode));
  const before = preview.beforePreset
    ? preview.beforePreset
    : `${preview.before.executionMode} + ${preview.before.autonomyLevel}`;
  const after = preview.afterPreset
    ? preview.afterPreset
    : `${preview.after.executionMode} + ${preview.after.autonomyLevel}`;
  lines.push(...renderKeyValue(t(locale, 'config.before'), before, mode));
  lines.push(...renderKeyValue(t(locale, 'config.after'), after, mode));
  return lines.join('\n');
}

async function resolveNextPolicy(args, current = null, locale = 'en-US') {
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
    const fallback = current?.presetEquivalent || 'manual';
    const names = [fallback, ...Object.keys(OPERATING_PRESETS).filter((name) => name !== fallback)];
    const chosen = await select(
      t(locale, 'config.operatingPolicy'),
      names.map((name) => ({
        value: name,
        label: `${name}: ${OPERATING_PRESETS[name].executionMode} + ${OPERATING_PRESETS[name].autonomyLevel}`,
      })),
    );
    if (chosen.cancelled) return { ok: false, cancelled: true };
    return { ok: true, policy: resolvePolicyFromPreset(chosen.value) };
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
  process.stdout.write(`${renderPolicySummary(config, mode, localeForConfig(configPath))}\n`);
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
  const locale = localeForConfig(configPath);
  if (!planOnly && process.stdin.isTTY) {
    process.stdout.write(`${renderPolicySummary(current, mode, locale)}\n\n`);
  }
  const resolved = await resolveNextPolicy(args, current, locale);
  if (!resolved.ok) {
    if (resolved.cancelled) {
      process.stdout.write(`${renderWarning(t(locale, 'config.cancelled'), mode)}\n`);
      return { ok: true, exitCode: 0, cancelled: true };
    }
    return { ok: false, exitCode: 1, message: resolved.message, try: resolved.try };
  }
  const previewResult = applyPolicyMutation(configPath, resolved.policy, { dryRun: true });
  if (!previewResult.ok) {
    return { ok: false, exitCode: 1, message: previewResult.errors.join('; ') };
  }
  if (
    previewResult.preview.before.executionMode === previewResult.preview.after.executionMode &&
    previewResult.preview.before.autonomyLevel === previewResult.preview.after.autonomyLevel
  ) {
    process.stdout.write(
      `${t(locale, 'config.alreadyUsing')} ${current.presetEquivalent || t(locale, 'config.keepCurrent')}.\n`,
    );
    return { ok: true, exitCode: 0, unchanged: true };
  }
  process.stdout.write(`${renderPolicyPreview(previewResult.preview, mode, locale)}\n`);
  if (planOnly) return { ok: true, exitCode: 0 };
  if (!process.stdin.isTTY) {
    if (!yes) {
      return {
        ok: false,
        exitCode: 1,
        message: t(locale, 'config.nonInteractive'),
        try: ['sdd-agentic-flow config policy --yes --preset supervised'],
      };
    }
    const applied = applyPolicyMutation(configPath, resolved.policy, { dryRun: false });
    if (!applied.ok) return { ok: false, exitCode: 1, message: applied.errors.join('; ') };
    process.stdout.write(`PASS ${t(locale, 'config.updated')}\n`);
    return { ok: true, exitCode: 0 };
  }
  if (!yes) {
    const confirmation = await select(t(locale, 'config.applyChange'), [
      { value: 'yes', label: 'Continue' },
      { value: 'no', label: 'Cancel' },
    ]);
    if (confirmation.cancelled || confirmation.value !== 'yes') {
      process.stdout.write(`${renderWarning(t(locale, 'config.cancelled'), mode)}\n`);
      return { ok: true, exitCode: 0, cancelled: true };
    }
  }
  const applied = applyPolicyMutation(configPath, resolved.policy, { dryRun: false });
  if (!applied.ok) return { ok: false, exitCode: 1, message: applied.errors.join('; ') };
  process.stdout.write(`PASS ${t(locale, 'config.updated')}\n`);
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
