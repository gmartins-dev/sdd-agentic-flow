import fs from 'node:fs';

const EXECUTION_MODES = ['plan', 'guided', 'apply', 'review', 'full'] as const;
const AUTONOMY_LEVELS = ['manual', 'supervised', 'autonomous'] as const;
const INVALID_AUTONOMY_COMBOS = new Set(['plan:autonomous', 'guided:autonomous']);

type ExecutionMode = (typeof EXECUTION_MODES)[number];
type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];
type OperatingPresetName = keyof typeof OPERATING_PRESETS;

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
  path: string;
  content: string | null;
  policy?: Policy;
  featureProfile?: string | null;
  languageProfile?: string | null;
  presetEquivalent?: string | null;
  errors: string[];
};

type PolicyMutationInput = {
  executionMode: string;
  autonomyLevel: string;
};

type PolicyPreview = {
  before: { executionMode: ExecutionMode; autonomyLevel: AutonomyLevel };
  after: { executionMode: ExecutionMode; autonomyLevel: AutonomyLevel };
  beforePreset: string | null;
  afterPreset: string | null;
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
    return { ok: false, errors: ['config not found'], path: configPath, content: null };
  }
  let content: string;
  try {
    content = fs.readFileSync(configPath, 'utf8');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [message], path: configPath, content: null };
  }
  const executionMode = configValue(content, 'execution_mode');
  const autonomyLevel = configValue(content, 'autonomy_level');
  const featureProfile = configValue(content, 'feature_profile');
  const languageProfile = configValue(content, 'profile');
  const errors: string[] = [];
  const schema = content.match(/^schema:\s*(\S+)$/m)?.[1];
  if (schema !== 'saf-config/v1') errors.push('unsupported config schema');
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

function validatePolicyMutation({ executionMode, autonomyLevel }: PolicyMutationInput): {
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
  { executionMode, autonomyLevel }: PolicyMutationInput,
  options: ApplyPolicyOptions = {},
): {
  ok: boolean;
  errors?: string[];
  preview?: PolicyPreview;
  wrote?: boolean;
} {
  const validation = validatePolicyMutation({ executionMode, autonomyLevel });
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, wrote: false };
  }
  const current = readConfig(configPath);
  if (!current.ok || !current.content) {
    return {
      ok: false,
      errors: current.errors?.length ? current.errors : ['config not readable'],
      wrote: false,
    };
  }
  if (!current.content || !current.policy?.executionMode || !current.policy?.autonomyLevel) {
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
  EXECUTION_MODES,
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
