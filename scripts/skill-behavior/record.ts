// Internal maintainer envelope for one skill-behavior execution. It identifies the run and keeps
// observed facts apart; it is not a public SAF artifact schema and replicates no report authority.
import type { OracleResult } from './oracle.js';

export const RECORD_SCHEMA = 'saf-skill-behavior-record/internal-1';

export type Condition = 'baseline' | 'candidate' | 'no-saf';
export type Termination =
  | 'normal'
  | 'timeout'
  | 'budget'
  | 'transport-error'
  | 'host-unavailable'
  | 'not-run';
export type Verdict = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT-EXERCISED' | 'UNKNOWN';
// A fact the host or observer may or may not expose; `unknown` is never read as success.
export type Fact = 'observed' | 'absent' | 'unknown';
export type AttributionLayer =
  | 'none'
  | 'unassigned'
  | 'saf-instruction'
  | 'loading'
  | 'host-tool'
  | 'fixture-oracle';
export type AttributionConfidence = 'n/a' | 'demonstrated' | 'hypothesis' | 'inconclusive';

export type BehaviorRecord = {
  schema: typeof RECORD_SCHEMA;
  run_id: string;
  case_id: string;
  family: string;
  split: 'development' | 'reserved';
  condition: Condition;
  trial: number;
  host: string;
  host_version: string | null;
  model: string | null;
  config: string;
  loading: 'natural' | 'explicit' | 'resume';
  saf_revision: string;
  bundle_sha256: string | null;
  fixture_sha256: string;
  capabilities_required: string[];
  capabilities_missing: string[];
  termination: Termination;
  exit_code: number | null;
  duration_ms: number | null;
  facts: {
    accepted: Fact;
    completed: Fact;
    effects_persisted: Fact;
    cleanup: Fact;
    // Whether the host transcript shows the skill being loaded; absent for stub and dry runs.
    skill_loaded?: Fact;
  };
  checks_not_run: Array<{ name: string; reason: string }>;
  oracle: OracleResult | null;
  verdict: Verdict;
  owner_refs: string[];
  attribution: { layer: AttributionLayer; confidence: AttributionConfidence };
  usage: { input_tokens?: number; output_tokens?: number; cost_usd?: number } | null;
};

// PASS requires a normal termination and an oracle that observed every obligation. A forbidden
// (critical) effect is a FAIL even when the run stopped abnormally: the effect happened anyway.
// A missing action after an abnormal stop is UNKNOWN, because the agent may never have acted.
export function deriveVerdict(input: {
  termination: Termination;
  capabilitiesMissing: readonly string[];
  oracle: OracleResult | null;
}): Verdict {
  if (input.termination === 'host-unavailable') return 'BLOCKED';
  if (input.termination === 'not-run' || input.capabilitiesMissing.length > 0)
    return 'NOT-EXERCISED';
  if (input.oracle && input.oracle.critical.length > 0) return 'FAIL';
  if (input.termination !== 'normal') return 'UNKNOWN';
  if (input.oracle && input.oracle.passed === false) return 'FAIL';
  if (!input.oracle || input.oracle.passed === null) return 'UNKNOWN';
  return 'PASS';
}

const CONDITIONS = new Set(['baseline', 'candidate', 'no-saf']);
const TERMINATIONS = new Set([
  'normal',
  'timeout',
  'budget',
  'transport-error',
  'host-unavailable',
  'not-run',
]);
const FACTS = new Set(['observed', 'absent', 'unknown']);
const LAYERS = new Set([
  'none',
  'unassigned',
  'saf-instruction',
  'loading',
  'host-tool',
  'fixture-oracle',
]);
const CONFIDENCE = new Set(['n/a', 'demonstrated', 'hypothesis', 'inconclusive']);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function validateRecord(value: unknown, label = 'record'): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object') return [`${label}: not an object`];
  const record = value as Partial<BehaviorRecord>;
  const need = (ok: boolean, message: string) => {
    if (!ok) errors.push(`${label}: ${message}`);
  };
  need(record.schema === RECORD_SCHEMA, `schema must be ${RECORD_SCHEMA}`);
  for (const field of ['run_id', 'case_id', 'family', 'host', 'config', 'saf_revision'] as const)
    need(
      typeof record[field] === 'string' && record[field] !== '',
      `${field} must be a non-empty string`,
    );
  need(
    typeof record.fixture_sha256 === 'string' && /^[0-9a-f]{64}$/.test(record.fixture_sha256),
    'fixture_sha256 must be a sha256 digest',
  );
  need(
    record.bundle_sha256 === null ||
      (typeof record.bundle_sha256 === 'string' && /^[0-9a-f]{64}$/.test(record.bundle_sha256)),
    'bundle_sha256 must be a sha256 digest or null',
  );
  need(
    record.split === 'development' || record.split === 'reserved',
    'split must be development or reserved',
  );
  need(CONDITIONS.has(String(record.condition)), 'condition is invalid');
  need(
    typeof record.trial === 'number' && Number.isInteger(record.trial) && record.trial >= 1,
    'trial must be a positive integer',
  );
  need(
    record.loading === 'natural' || record.loading === 'explicit' || record.loading === 'resume',
    'loading is invalid',
  );
  need(TERMINATIONS.has(String(record.termination)), 'termination is invalid');
  need(isStringArray(record.capabilities_required), 'capabilities_required must be strings');
  need(isStringArray(record.capabilities_missing), 'capabilities_missing must be strings');
  need(isStringArray(record.owner_refs), 'owner_refs must be strings');
  const facts = record.facts;
  need(
    Boolean(facts) &&
      (['accepted', 'completed', 'effects_persisted', 'cleanup'] as const).every((key) =>
        FACTS.has(String(facts?.[key])),
      ),
    'facts must record accepted, completed, effects_persisted, and cleanup',
  );
  need(
    facts?.skill_loaded === undefined || FACTS.has(String(facts.skill_loaded)),
    'facts.skill_loaded is invalid',
  );
  need(
    Array.isArray(record.checks_not_run) &&
      record.checks_not_run.every(
        (item) => typeof item?.name === 'string' && typeof item?.reason === 'string' && item.reason,
      ),
    'checks_not_run entries need a name and a reason',
  );
  need(
    Boolean(record.attribution) &&
      LAYERS.has(String(record.attribution?.layer)) &&
      CONFIDENCE.has(String(record.attribution?.confidence)),
    'attribution is invalid',
  );
  const oracle = record.oracle as Partial<OracleResult> | null | undefined;
  need(
    oracle === null ||
      (Boolean(oracle) &&
        typeof oracle === 'object' &&
        (oracle.passed === true || oracle.passed === false || oracle.passed === null) &&
        isStringArray(oracle.violations) &&
        isStringArray(oracle.critical) &&
        isStringArray(oracle.observations)),
    'oracle must be null or an oracle result',
  );
  if (errors.length) return errors;
  // The stored verdict must be the one the observations imply; a hand-edited PASS is rejected.
  const derived = deriveVerdict({
    termination: record.termination as Termination,
    capabilitiesMissing: record.capabilities_missing as string[],
    oracle: record.oracle ?? null,
  });
  need(record.verdict === derived, `verdict ${record.verdict} does not match observed ${derived}`);
  need(
    record.verdict !== 'FAIL' || record.attribution?.layer !== 'none',
    'a FAIL needs an attribution layer other than none (use unassigned until reviewed)',
  );
  return errors;
}

export function parseRecords(
  text: string,
  label = 'records',
): {
  records: BehaviorRecord[];
  errors: string[];
} {
  const records: BehaviorRecord[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const where = `${label}:${index + 1}`;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      errors.push(`${where}: invalid JSON`);
      return;
    }
    const found = validateRecord(value, where);
    if (found.length) errors.push(...found);
    else records.push(value as BehaviorRecord);
  });
  return { records, errors };
}
