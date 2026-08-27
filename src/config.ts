import { renderCliCommand } from './cli-command';
import {
  applyPolicyMutation,
  OPERATING_PRESETS,
  type PolicyPreview,
  type ReadConfigResult,
  readConfig,
  resolvePolicyFromPreset,
} from './config-domain';
import { resolveLocale, t } from './messages';
import { select } from './selector';
import { type DisplayMode, outputMode, renderKeyValue, renderSection, renderWarning } from './ui';

type ConfigCommandOptions = {
  mode?: DisplayMode;
  json?: boolean;
  machine?: boolean;
  quiet?: boolean;
  ascii?: boolean;
};

type CommandResult = {
  ok: boolean;
  exitCode: number;
  message?: string | undefined;
  try?: string[] | undefined;
  cancelled?: boolean;
  unchanged?: boolean;
};

function localeForConfig(configPath: string): string {
  const config = readConfig(configPath);
  return resolveLocale({ configured: config.ok ? config.languageProfile : null });
}

function renderPolicySummary(
  config: ReadConfigResult,
  mode: DisplayMode,
  locale = 'en-US',
): string {
  const policy = config.policy ?? { executionMode: null, autonomyLevel: null };
  const lines: string[] = [];
  if (mode === 'machine') {
    if (policy.executionMode) lines.push(`execution_mode=${policy.executionMode}`);
    if (policy.autonomyLevel) lines.push(`autonomy_level=${policy.autonomyLevel}`);
    if (config.presetEquivalent) lines.push(`preset=${config.presetEquivalent}`);
    if (config.featureProfile) lines.push(`feature_profile=${config.featureProfile}`);
    if (config.languageProfile) lines.push(`language=${config.languageProfile}`);
    return lines.join('\n');
  }
  lines.push(...renderSection(t(locale, 'config.operatingPolicy'), mode));
  if (config.presetEquivalent) {
    lines.push(...renderKeyValue('Preset', config.presetEquivalent, mode));
  }
  if (policy.executionMode) {
    lines.push(...renderKeyValue('Execution mode', policy.executionMode, mode));
  }
  if (policy.autonomyLevel) {
    lines.push(...renderKeyValue('Autonomy level', policy.autonomyLevel, mode));
  }
  if (config.featureProfile) {
    lines.push(...renderKeyValue('Feature profile', config.featureProfile, mode));
  }
  if (config.languageProfile) {
    lines.push(...renderKeyValue('Language', config.languageProfile, mode));
  }
  return lines.join('\n');
}

function renderPolicyPreviewBlock(
  preview: PolicyPreview,
  mode: DisplayMode,
  locale = 'en-US',
): string {
  const lines: string[] = [];
  lines.push(...renderSection(t(locale, 'config.policyPreview'), mode));
  const before = preview.beforePreset
    ? preview.beforePreset
    : `${preview.before.executionMode} + ${preview.before.autonomyLevel}`;
  const after = preview.afterPreset
    ? preview.afterPreset
    : `${preview.after.executionMode} + ${preview.after.autonomyLevel}`;
  lines.push(...renderKeyValue(t(locale, 'config.before'), before, mode));
  lines.push(...renderKeyValue(t(locale, 'config.after'), after, mode));
  if (preview.beforeLanguage && preview.afterLanguage) {
    lines.push(
      ...renderKeyValue('Language', `${preview.beforeLanguage} -> ${preview.afterLanguage}`, mode),
    );
  }
  if (preview.beforeFeatureProfile && preview.afterFeatureProfile) {
    lines.push(
      ...renderKeyValue(
        'Feature profile',
        `${preview.beforeFeatureProfile} -> ${preview.afterFeatureProfile}`,
        mode,
      ),
    );
  }
  return lines.join('\n');
}

async function resolveNextPolicy(
  args: string[],
  current: ReadConfigResult | null = null,
  locale = 'en-US',
): Promise<
  | { ok: true; policy: NonNullable<ReturnType<typeof resolvePolicyFromPreset>> }
  | { ok: false; cancelled?: boolean; message?: string; try?: string[] }
> {
  let preset: string | null = null;
  let executionMode: string | null = null;
  let autonomyLevel: string | null = null;
  let languageProfile: string | null = null;
  let featureProfile: string | null = null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = typeof args[index] === 'string' ? args[index] : '';
    if (arg === '--plan' || arg === '--yes') continue;
    if (arg === '--preset' && typeof args[index + 1] === 'string') {
      preset = args[index + 1] as string;
      index += 1;
    } else if (arg === '--execution-mode' && typeof args[index + 1] === 'string') {
      executionMode = args[index + 1] as string;
      index += 1;
    } else if (arg === '--autonomy-level' && typeof args[index + 1] === 'string') {
      autonomyLevel = args[index + 1] as string;
      index += 1;
    } else if (
      (arg === '--language' || arg === '--language-profile') &&
      typeof args[index + 1] === 'string'
    ) {
      languageProfile = args[index + 1] as string;
      index += 1;
    } else if (arg === '--feature-profile' && typeof args[index + 1] === 'string') {
      featureProfile = args[index + 1] as string;
      index += 1;
    }
  }
  if (preset) {
    const resolved = resolvePolicyFromPreset(preset);
    if (!resolved) return { ok: false, message: `unknown preset: ${preset}` };
    return {
      ok: true,
      policy: {
        ...resolved,
        ...(languageProfile ? { languageProfile } : {}),
        ...(featureProfile ? { featureProfile } : {}),
      },
    };
  }
  if (executionMode && autonomyLevel) {
    return {
      ok: true,
      policy: {
        executionMode,
        autonomyLevel,
        presetName: 'custom',
        ...(languageProfile ? { languageProfile } : {}),
        ...(featureProfile ? { featureProfile } : {}),
      } as NonNullable<ReturnType<typeof resolvePolicyFromPreset>>,
    };
  }
  if (
    (languageProfile || featureProfile) &&
    current?.policy?.executionMode &&
    current.policy.autonomyLevel
  ) {
    return {
      ok: true,
      policy: {
        executionMode: current.policy.executionMode,
        autonomyLevel: current.policy.autonomyLevel,
        presetName: current.presetEquivalent || 'custom',
        ...(languageProfile ? { languageProfile } : {}),
        ...(featureProfile ? { featureProfile } : {}),
      } as NonNullable<ReturnType<typeof resolvePolicyFromPreset>>,
    };
  }
  if (process.stdin.isTTY) {
    const fallback = current?.ok ? current.presetEquivalent || 'manual' : 'manual';
    const names = [fallback, ...Object.keys(OPERATING_PRESETS).filter((name) => name !== fallback)];
    const chosen = await select(
      t(locale, 'config.operatingPolicy'),
      names.map((name) => ({
        value: name,
        label: `${name}: ${OPERATING_PRESETS[name as keyof typeof OPERATING_PRESETS].executionMode} + ${OPERATING_PRESETS[name as keyof typeof OPERATING_PRESETS].autonomyLevel}`,
      })),
    );
    if ('cancelled' in chosen && chosen.cancelled) return { ok: false, cancelled: true };
    if ('value' in chosen && typeof chosen.value === 'string') {
      const policy = resolvePolicyFromPreset(chosen.value);
      if (!policy) return { ok: false, message: `unknown preset: ${chosen.value}` };
      const selectedLanguage = await select('Language', [
        { value: 'en-US', label: 'English', selected: current?.languageProfile !== 'pt-BR' },
        {
          value: 'pt-BR',
          label: 'Português (Brasil)',
          selected: current?.languageProfile === 'pt-BR',
        },
      ]);
      if ('cancelled' in selectedLanguage && selectedLanguage.cancelled)
        return { ok: false, cancelled: true };
      const selectedFeatureProfile = await select('Feature profile', [
        {
          value: 'small_fix',
          label: 'Small fix',
          selected: current?.featureProfile === 'small_fix',
        },
        {
          value: 'medium_feature',
          label: 'Medium feature',
          selected: !current?.featureProfile || current.featureProfile === 'medium_feature',
        },
        {
          value: 'large_feature',
          label: 'Large feature',
          selected: current?.featureProfile === 'large_feature',
        },
        { value: 'epic', label: 'Epic', selected: current?.featureProfile === 'epic' },
      ]);
      if ('cancelled' in selectedFeatureProfile && selectedFeatureProfile.cancelled)
        return { ok: false, cancelled: true };
      return {
        ok: true,
        policy: {
          ...policy,
          ...('value' in selectedLanguage && typeof selectedLanguage.value === 'string'
            ? { languageProfile: selectedLanguage.value }
            : {}),
          ...('value' in selectedFeatureProfile && typeof selectedFeatureProfile.value === 'string'
            ? { featureProfile: selectedFeatureProfile.value }
            : {}),
        } as NonNullable<ReturnType<typeof resolvePolicyFromPreset>>,
      };
    }
    return { ok: false, message: 'invalid selection' };
  }
  return {
    ok: false,
    message:
      'Non-interactive policy change requires --yes with --preset or explicit --execution-mode and --autonomy-level',
    try: [
      renderCliCommand('config', 'policy', '--plan', '--preset', 'supervised'),
      renderCliCommand('config', 'policy', '--yes', '--preset', 'manual'),
    ],
  };
}

async function runConfigShow(
  configPath: string,
  options: ConfigCommandOptions = {},
): Promise<CommandResult> {
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

async function runConfigPolicy(
  configPath: string,
  args: string[],
  options: ConfigCommandOptions = {},
): Promise<CommandResult> {
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
    return { ok: false, exitCode: 1, message: previewResult.errors?.join('; ') };
  }
  const preview = previewResult.preview;
  if (!preview) {
    return { ok: false, exitCode: 1, message: 'policy preview unavailable' };
  }
  if (
    preview.before.executionMode === preview.after.executionMode &&
    preview.before.autonomyLevel === preview.after.autonomyLevel &&
    preview.beforeLanguage === preview.afterLanguage &&
    preview.beforeFeatureProfile === preview.afterFeatureProfile
  ) {
    process.stdout.write(
      `${t(locale, 'config.alreadyUsing')} ${current.presetEquivalent || t(locale, 'config.keepCurrent')}.\n`,
    );
    return { ok: true, exitCode: 0, unchanged: true };
  }
  process.stdout.write(`${renderPolicyPreviewBlock(preview, mode, locale)}\n`);
  if (planOnly) return { ok: true, exitCode: 0 };
  if (!process.stdin.isTTY) {
    if (!yes) {
      return {
        ok: false,
        exitCode: 1,
        message: t(locale, 'config.nonInteractive'),
        try: [renderCliCommand('config', 'policy', '--yes', '--preset', 'supervised')],
      };
    }
    const applied = applyPolicyMutation(configPath, resolved.policy, { dryRun: false });
    if (!applied.ok) return { ok: false, exitCode: 1, message: applied.errors?.join('; ') };
    process.stdout.write(`PASS ${t(locale, 'config.updated')}\n`);
    return { ok: true, exitCode: 0 };
  }
  if (!yes) {
    const confirmation = await select(t(locale, 'config.applyChange'), [
      { value: 'yes', label: 'Continue' },
      { value: 'no', label: 'Cancel' },
    ]);
    if (
      ('cancelled' in confirmation && confirmation.cancelled) ||
      ('value' in confirmation && confirmation.value !== 'yes')
    ) {
      process.stdout.write(`${renderWarning(t(locale, 'config.cancelled'), mode)}\n`);
      return { ok: true, exitCode: 0, cancelled: true };
    }
  }
  const applied = applyPolicyMutation(configPath, resolved.policy, { dryRun: false });
  if (!applied.ok) return { ok: false, exitCode: 1, message: applied.errors?.join('; ') };
  process.stdout.write(`PASS ${t(locale, 'config.updated')}\n`);
  return { ok: true, exitCode: 0 };
}

async function runConfigCommand(
  configPath: string,
  args: string[],
  options: ConfigCommandOptions = {},
): Promise<CommandResult> {
  const sub = args[0] === 'show' || args[0] === 'policy' ? args[0] : null;
  const tail = sub ? args.slice(1) : args;
  if (!sub || sub === 'show') return runConfigShow(configPath, options);
  if (sub === 'policy') return runConfigPolicy(configPath, tail, options);
  return { ok: false, exitCode: 1, message: 'usage: config [show|policy]' };
}

export type { CommandResult, ConfigCommandOptions };
export { renderPolicySummary, runConfigCommand, runConfigPolicy, runConfigShow };
