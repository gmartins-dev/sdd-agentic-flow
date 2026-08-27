import fs from 'node:fs';
import path from 'node:path';

const EXECUTION_MODES = ['plan', 'guided', 'apply', 'review', 'full'] as const;
const AUTONOMY_LEVELS = ['manual', 'supervised', 'autonomous'] as const;
const INVALID_AUTONOMY_COMBOS = new Set(['plan:autonomous', 'guided:autonomous']);

type ExecutionMode = (typeof EXECUTION_MODES)[number];
type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];
type OperatingPresetName = keyof typeof OPERATING_PRESETS;

const EFFECTIVE_DEFAULTS = Object.freeze({
  execution_mode: 'apply',
  autonomy_level: 'supervised',
  specs_root: '.specs/features',
  source_type: 'local-files',
  language_profile: 'en-US',
  tlc_baseline_required: true,
  require_tdd: true,
  require_independent_check: true,
  require_evidence_before_completion: true,
  no_commit_by_default: true,
  no_push_by_default: true,
  no_merge_or_deploy: true,
});

function effectiveConfigYaml(): string {
  return `schema: saf-config/v3

language:
  profile: ${EFFECTIVE_DEFAULTS.language_profile}
  human_outputs: ${EFFECTIVE_DEFAULTS.language_profile}
  technical_tokens: canonical
  bilingual_mode: technical-canonical

specs:
  root: ${EFFECTIVE_DEFAULTS.specs_root}

source:
  type: ${EFFECTIVE_DEFAULTS.source_type}
  snapshots_dir: .sdd-agentic-flow/snapshots

workflow:
  default_flow: single
  commit_policy: manual
  execution_mode: ${EFFECTIVE_DEFAULTS.execution_mode}
  autonomy_level: ${EFFECTIVE_DEFAULTS.autonomy_level}
  autonomy_budget:
    max_iterations: 50
    max_tokens: 500000
    max_runtime_hours: 4
    pause_on_warning: true

quality:
  tlc_baseline_required: ${EFFECTIVE_DEFAULTS.tlc_baseline_required}
  require_tdd: ${EFFECTIVE_DEFAULTS.require_tdd}
  require_independent_check: ${EFFECTIVE_DEFAULTS.require_independent_check}
  require_evidence_before_completion: ${EFFECTIVE_DEFAULTS.require_evidence_before_completion}

safety:
  no_commit_by_default: ${EFFECTIVE_DEFAULTS.no_commit_by_default}
  no_push_by_default: ${EFFECTIVE_DEFAULTS.no_push_by_default}
  no_merge_or_deploy: ${EFFECTIVE_DEFAULTS.no_merge_or_deploy}
`;
}

/** Recommended preset for guided onboarding Enter-through (not global fail-safe default). */
const ONBOARDING_DEFAULT_PRESET: OperatingPresetName = 'supervised';

type SetupPolicyDraft = {
  kind: 'preset' | 'custom';
  presetName: string | null;
  executionMode: ExecutionMode;
  autonomyLevel: AutonomyLevel;
};

const OPERATING_PRESETS = {
  manual: { executionMode: 'guided', autonomyLevel: 'manual' },
  supervised: { executionMode: 'apply', autonomyLevel: 'supervised' },
  autonomous: { executionMode: 'full', autonomyLevel: 'autonomous' },
} as const satisfies Record<string, { executionMode: ExecutionMode; autonomyLevel: AutonomyLevel }>;

type Policy = {
  executionMode: string | null;
  autonomyLevel: string | null;
};

type ReadConfigResult = {
  ok: boolean;
  state?: 'absent' | 'valid' | 'invalid';
  origin?: 'built-in-defaults' | 'project-config';
  path: string;
  content: string | null;
  policy?: Policy;
  featureProfile?: string | null;
  featureProfileExplicit?: boolean;
  languageProfile?: string | null;
  presetEquivalent?: string | null;
  errors: string[];
};

type PolicyMutationInput = {
  executionMode: string;
  autonomyLevel: string;
  languageProfile?: string;
  language?: string;
  featureProfile?: string;
};

type PolicyPreview = {
  before: { executionMode: ExecutionMode; autonomyLevel: AutonomyLevel };
  after: { executionMode: ExecutionMode; autonomyLevel: AutonomyLevel };
  beforePreset: string | null;
  afterPreset: string | null;
  beforeLanguage?: string;
  afterLanguage?: string;
  beforeFeatureProfile?: string;
  afterFeatureProfile?: string;
};

type ApplyPolicyOptions = {
  dryRun?: boolean;
};

function isExecutionMode(value: string): value is ExecutionMode {
  return (EXECUTION_MODES as readonly string[]).includes(value);
}

function isAutonomyLevel(value: string): value is AutonomyLevel {
  return (AUTONOMY_LEVELS as readonly string[]).includes(value);
}

function autonomyComboValid(executionMode: string, autonomyLevel: string): boolean {
  return !INVALID_AUTONOMY_COMBOS.has(`${executionMode}:${autonomyLevel}`);
}

function configValue(content: string, key: string): string | null {
  const match = content.match(new RegExp(`^\\s+${key}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? null;
}

function presetEquivalentFor(executionMode: string, autonomyLevel: string): string | null {
  for (const [name, preset] of Object.entries(OPERATING_PRESETS)) {
    if (preset.executionMode === executionMode && preset.autonomyLevel === autonomyLevel) {
      return name;
    }
  }
  return null;
}

function readConfig(configPath: string): ReadConfigResult {
  if (!fs.existsSync(configPath)) {
    return {
      ok: true,
      state: 'absent',
      origin: 'built-in-defaults',
      errors: [],
      path: configPath,
      content: null,
      policy: {
        executionMode: EFFECTIVE_DEFAULTS.execution_mode,
        autonomyLevel: EFFECTIVE_DEFAULTS.autonomy_level,
      },
      featureProfile: 'medium_feature',
      featureProfileExplicit: false,
      languageProfile: EFFECTIVE_DEFAULTS.language_profile,
      presetEquivalent: 'supervised',
    };
  }
  let content: string;
  try {
    content = fs.readFileSync(configPath, 'utf8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      state: 'invalid',
      origin: 'project-config',
      errors: [message],
      path: configPath,
      content: null,
    };
  }
  const executionMode = configValue(content, 'execution_mode');
  const autonomyLevel = configValue(content, 'autonomy_level');
  const featureProfile = configValue(content, 'feature_profile');
  const languageProfile = configValue(content, 'profile');
  const errors: string[] = [];
  const schema = content.match(/^schema:\s*(\S+)$/m)?.[1];
  if (schema !== 'saf-config/v3') errors.push('unsupported config schema');
  if (!executionMode) errors.push('workflow.execution_mode missing');
  if (!autonomyLevel) errors.push('workflow.autonomy_level missing');
  if (executionMode && !isExecutionMode(executionMode)) {
    errors.push(`invalid execution_mode: ${executionMode}`);
  }
  if (autonomyLevel && !isAutonomyLevel(autonomyLevel)) {
    errors.push(`invalid autonomy_level: ${autonomyLevel}`);
  }
  if (executionMode && autonomyLevel && !autonomyComboValid(executionMode, autonomyLevel)) {
    errors.push(`invalid combo: ${executionMode} + ${autonomyLevel}`);
  }
  return {
    ok: errors.length === 0,
    state: errors.length === 0 ? 'valid' : 'invalid',
    origin: 'project-config',
    path: configPath,
    content,
    policy: { executionMode, autonomyLevel },
    featureProfile,
    featureProfileExplicit: featureProfile !== null,
    languageProfile,
    presetEquivalent:
      executionMode && autonomyLevel ? presetEquivalentFor(executionMode, autonomyLevel) : null,
    errors,
  };
}

function validatePolicyMutation({
  executionMode,
  autonomyLevel,
  languageProfile,
  language,
  featureProfile,
}: PolicyMutationInput): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!executionMode || !isExecutionMode(executionMode)) {
    errors.push(`invalid execution_mode: ${executionMode ?? '(missing)'}`);
  }
  if (!autonomyLevel || !isAutonomyLevel(autonomyLevel)) {
    errors.push(`invalid autonomy_level: ${autonomyLevel ?? '(missing)'}`);
  }
  if (executionMode && autonomyLevel && !autonomyComboValid(executionMode, autonomyLevel)) {
    errors.push(`invalid combo: ${executionMode} + ${autonomyLevel}`);
  }
  const selectedLanguage = languageProfile ?? language;
  if (selectedLanguage && !['en-US', 'pt-BR'].includes(selectedLanguage))
    errors.push(`invalid language profile: ${selectedLanguage}`);
  if (
    featureProfile &&
    !['small_fix', 'medium_feature', 'large_feature', 'epic'].includes(featureProfile)
  )
    errors.push(`invalid feature profile: ${featureProfile}`);
  return { ok: errors.length === 0, errors };
}

function replaceWorkflowField(
  content: string,
  key: string,
  value: string,
): { ok: true; content: string } | { ok: false; error: string } {
  const pattern = new RegExp(`^(\\s+${key}:\\s*).+$`, 'm');
  if (!pattern.test(content)) {
    return { ok: false, error: `field ${key} not found` };
  }
  return { ok: true, content: content.replace(pattern, `$1${value}`) };
}

function replaceConfigField(
  content: string,
  key: string,
  value: string,
): { ok: true; content: string } | { ok: false; error: string } {
  const pattern = new RegExp(`^(\\s+${key}:\\s*).+$`, 'm');
  if (!pattern.test(content)) return { ok: false, error: `field ${key} not found` };
  return { ok: true, content: content.replace(pattern, `$1${value}`) };
}

function addWorkflowField(content: string, key: string, value: string): string {
  const marker = /^( {2}autonomy_level:\s*.+)$/m;
  return marker.test(content) ? content.replace(marker, `$1\n  ${key}: ${value}`) : content;
}

function buildPolicyPreview(
  before: { executionMode: string; autonomyLevel: string },
  after: { executionMode: string; autonomyLevel: string },
): PolicyPreview {
  return {
    before: {
      executionMode: before.executionMode as ExecutionMode,
      autonomyLevel: before.autonomyLevel as AutonomyLevel,
    },
    after: {
      executionMode: after.executionMode as ExecutionMode,
      autonomyLevel: after.autonomyLevel as AutonomyLevel,
    },
    beforePreset: presetEquivalentFor(before.executionMode, before.autonomyLevel),
    afterPreset: presetEquivalentFor(after.executionMode, after.autonomyLevel),
  };
}

function applyPolicyMutation(
  configPath: string,
  { executionMode, autonomyLevel, languageProfile, language, featureProfile }: PolicyMutationInput,
  options: ApplyPolicyOptions = {},
): {
  ok: boolean;
  errors?: string[];
  preview?: PolicyPreview;
  wrote?: boolean;
} {
  const validation = validatePolicyMutation({
    executionMode,
    autonomyLevel,
    ...(languageProfile ? { languageProfile } : {}),
    ...(language ? { language } : {}),
    ...(featureProfile ? { featureProfile } : {}),
  });
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, wrote: false };
  }
  const current = readConfig(configPath);
  if (!current.ok) {
    return {
      ok: false,
      errors: current.errors?.length ? current.errors : ['config not readable'],
      wrote: false,
    };
  }
  if (!current.policy?.executionMode || !current.policy?.autonomyLevel) {
    return {
      ok: false,
      errors: current.errors?.length ? current.errors : ['config policy fields missing'],
      wrote: false,
    };
  }
  const preview = buildPolicyPreview(
    {
      executionMode: current.policy.executionMode,
      autonomyLevel: current.policy.autonomyLevel,
    },
    { executionMode, autonomyLevel },
  );
  const selectedLanguage = languageProfile ?? language;
  const beforeLanguage = current.languageProfile ?? EFFECTIVE_DEFAULTS.language_profile;
  const beforeFeatureProfile = current.featureProfile ?? 'medium_feature';
  const afterLanguage = selectedLanguage ?? beforeLanguage;
  const afterFeatureProfile = featureProfile ?? beforeFeatureProfile;
  preview.beforeLanguage = beforeLanguage;
  preview.afterLanguage = afterLanguage;
  preview.beforeFeatureProfile = beforeFeatureProfile;
  preview.afterFeatureProfile = afterFeatureProfile;
  const unchanged =
    preview.before.executionMode === preview.after.executionMode &&
    preview.before.autonomyLevel === preview.after.autonomyLevel &&
    beforeLanguage === afterLanguage &&
    beforeFeatureProfile === afterFeatureProfile;
  if (unchanged) return { ok: true, preview, wrote: false };
  if (options.dryRun) {
    return { ok: true, preview, wrote: false };
  }
  let next = current.content ?? effectiveConfigYaml();
  let replaced = replaceWorkflowField(next, 'execution_mode', executionMode);
  if (!replaced.ok) return { ok: false, errors: [replaced.error], wrote: false };
  next = replaced.content;
  if (selectedLanguage) {
    const languageResult = replaceConfigField(next, 'profile', selectedLanguage);
    if (!languageResult.ok) return { ok: false, errors: [languageResult.error], wrote: false };
    next = languageResult.content;
    const humanResult = replaceConfigField(next, 'human_outputs', selectedLanguage);
    if (!humanResult.ok) return { ok: false, errors: [humanResult.error], wrote: false };
    next = humanResult.content;
  }
  if (featureProfile) {
    const featureResult = replaceConfigField(next, 'feature_profile', featureProfile);
    next = featureResult.ok
      ? featureResult.content
      : addWorkflowField(next, 'feature_profile', featureProfile);
    if (!next.includes(`feature_profile: ${featureProfile}`))
      return { ok: false, errors: ['field feature_profile not found'], wrote: false };
  }
  replaced = replaceWorkflowField(next, 'autonomy_level', autonomyLevel);
  if (!replaced.ok) return { ok: false, errors: [replaced.error], wrote: false };
  next = replaced.content;
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, next, 'utf8');
  return { ok: true, preview, wrote: true };
}

function resolvePolicyFromPreset(presetName: string): {
  executionMode: ExecutionMode;
  autonomyLevel: AutonomyLevel;
  presetName: string;
} | null {
  if (!(presetName in OPERATING_PRESETS)) return null;
  const preset = OPERATING_PRESETS[presetName as OperatingPresetName];
  return {
    executionMode: preset.executionMode,
    autonomyLevel: preset.autonomyLevel,
    presetName,
  };
}

function setupPolicyFromPreset(presetName: string): SetupPolicyDraft | null {
  const resolved = resolvePolicyFromPreset(presetName);
  if (!resolved) return null;
  return {
    kind: 'preset',
    presetName: resolved.presetName,
    executionMode: resolved.executionMode,
    autonomyLevel: resolved.autonomyLevel,
  };
}

function setupPolicyFromPair(
  executionMode: string,
  autonomyLevel: string,
): SetupPolicyDraft | null {
  if (!isExecutionMode(executionMode) || !isAutonomyLevel(autonomyLevel)) return null;
  if (!autonomyComboValid(executionMode, autonomyLevel)) return null;
  const equivalent = presetEquivalentFor(executionMode, autonomyLevel);
  return {
    kind: equivalent ? 'preset' : 'custom',
    presetName: equivalent,
    executionMode,
    autonomyLevel,
  };
}

/** Display order for onboarding preset prompts (recommended first). */
const ONBOARDING_PRESET_ORDER: OperatingPresetName[] = ['supervised', 'manual', 'autonomous'];

function onboardingPresetOrder(): OperatingPresetName[] {
  return [...ONBOARDING_PRESET_ORDER];
}

function defaultOnboardingPolicy(): SetupPolicyDraft {
  const draft = setupPolicyFromPreset(ONBOARDING_DEFAULT_PRESET);
  if (!draft) {
    throw new Error(`missing onboarding preset: ${ONBOARDING_DEFAULT_PRESET}`);
  }
  return draft;
}

function formatPolicyPair(executionMode: string, autonomyLevel: string): string {
  return `${executionMode} + ${autonomyLevel}`;
}

function policyDisplayTitle(draft: SetupPolicyDraft): string {
  if (draft.presetName) {
    return draft.presetName.charAt(0).toUpperCase() + draft.presetName.slice(1);
  }
  return 'Custom';
}

export type {
  AutonomyLevel,
  ExecutionMode,
  OperatingPresetName,
  PolicyMutationInput,
  PolicyPreview,
  ReadConfigResult,
  SetupPolicyDraft,
};
export {
  AUTONOMY_LEVELS,
  applyPolicyMutation,
  autonomyComboValid,
  configValue,
  defaultOnboardingPolicy,
  EFFECTIVE_DEFAULTS,
  EXECUTION_MODES,
  effectiveConfigYaml,
  formatPolicyPair,
  ONBOARDING_DEFAULT_PRESET,
  ONBOARDING_PRESET_ORDER,
  OPERATING_PRESETS,
  onboardingPresetOrder,
  policyDisplayTitle,
  presetEquivalentFor,
  readConfig,
  resolvePolicyFromPreset,
  setupPolicyFromPair,
  setupPolicyFromPreset,
  validatePolicyMutation,
};
