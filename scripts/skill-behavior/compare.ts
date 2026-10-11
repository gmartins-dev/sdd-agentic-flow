// Offline baseline/candidate comparison for skill-behavior records. It compares only within one
// cell (host + model + host configuration), refuses incomparable data, and never ranks hosts.
import fs from 'node:fs';
import path from 'node:path';
import { type BehaviorRecord, parseRecords, type Verdict } from './record.js';

export type CaseComparison = {
  cell: string;
  case_id: string;
  split: BehaviorRecord['split'];
  baseline: Record<Verdict, number>;
  candidate: Record<Verdict, number>;
  // Pass rate over exercised trials (PASS + FAIL); null when nothing was exercised.
  baseline_rate: number | null;
  candidate_rate: number | null;
  delta: number | null;
};

export type Comparison = {
  errors: string[];
  cases: CaseComparison[];
  critical: Array<{ cell: string; case_id: string; trial: number; violations: string[] }>;
  regressions: string[];
  not_exercised: string[];
  adoptable: boolean;
};

const VERDICTS: Verdict[] = ['PASS', 'FAIL', 'BLOCKED', 'NOT-EXERCISED', 'UNKNOWN'];

function counts(): Record<Verdict, number> {
  return { PASS: 0, FAIL: 0, BLOCKED: 0, 'NOT-EXERCISED': 0, UNKNOWN: 0 };
}

export function cellOf(record: BehaviorRecord): string {
  return `${record.host}|${record.model ?? 'unknown-model'}|${record.config}`;
}

function rate(value: Record<Verdict, number>): number | null {
  const exercised = value.PASS + value.FAIL;
  return exercised === 0 ? null : value.PASS / exercised;
}

export function compareRecords(
  baseline: readonly BehaviorRecord[],
  candidate: readonly BehaviorRecord[],
): Comparison {
  const errors: string[] = [];
  const check = (records: readonly BehaviorRecord[], condition: 'baseline' | 'candidate') => {
    const seen = new Set<string>();
    const revisions = new Set<string>();
    for (const record of records) {
      if (record.condition !== condition)
        errors.push(`${condition} input contains a ${record.condition} record (${record.case_id})`);
      const key = `${cellOf(record)}|${record.case_id}|${record.trial}`;
      if (seen.has(key)) errors.push(`duplicate ${condition} record: ${key}`);
      seen.add(key);
      revisions.add(`${record.saf_revision}|${record.bundle_sha256 ?? 'no-bundle'}`);
    }
    if (revisions.size > 1)
      errors.push(`${condition} mixes ${revisions.size} SAF revisions or bundles in one condition`);
    return seen;
  };
  const baseKeys = check(baseline, 'baseline');
  const candKeys = check(candidate, 'candidate');
  for (const key of baseKeys)
    if (!candKeys.has(key)) errors.push(`candidate is missing a paired record: ${key}`);
  for (const key of candKeys)
    if (!baseKeys.has(key)) errors.push(`baseline is missing a paired record: ${key}`);

  // Paired trials must share the fixture and the observed loading mode, or the delta means nothing.
  const fixtures = new Map<string, string>();
  for (const record of [...baseline, ...candidate]) {
    const key = `${cellOf(record)}|${record.case_id}`;
    const identity = `${record.fixture_sha256}|${record.loading}|${record.split}|${record.family}`;
    const previous = fixtures.get(key);
    if (previous && previous !== identity)
      errors.push(`fixture, loading, or split differs inside one comparison: ${key}`);
    fixtures.set(key, identity);
  }

  const byCase = new Map<string, CaseComparison>();
  const not_exercised = new Set<string>();
  for (const record of [...baseline, ...candidate]) {
    const cell = cellOf(record);
    const key = `${cell}|${record.case_id}`;
    let entry = byCase.get(key);
    if (!entry) {
      entry = {
        cell,
        case_id: record.case_id,
        split: record.split,
        baseline: counts(),
        candidate: counts(),
        baseline_rate: null,
        candidate_rate: null,
        delta: null,
      };
      byCase.set(key, entry);
    }
    const side = record.condition === 'candidate' ? entry.candidate : entry.baseline;
    side[record.verdict] += 1;
    if (record.verdict !== 'PASS' && record.verdict !== 'FAIL')
      not_exercised.add(`${key} (${record.condition}: ${record.verdict})`);
  }
  const regressions: string[] = [];
  for (const entry of byCase.values()) {
    entry.baseline_rate = rate(entry.baseline);
    entry.candidate_rate = rate(entry.candidate);
    entry.delta =
      entry.baseline_rate === null || entry.candidate_rate === null
        ? null
        : entry.candidate_rate - entry.baseline_rate;
    if (entry.delta !== null && entry.delta < 0)
      regressions.push(`${entry.cell}|${entry.case_id}: ${entry.delta.toFixed(2)}`);
  }
  const critical = candidate
    .filter((record) => (record.oracle?.critical.length ?? 0) > 0)
    .map((record) => ({
      cell: cellOf(record),
      case_id: record.case_id,
      trial: record.trial,
      violations: record.oracle?.critical ?? [],
    }));
  return {
    errors,
    cases: [...byCase.values()].sort((a, b) =>
      `${a.cell}|${a.case_id}`.localeCompare(`${b.cell}|${b.case_id}`),
    ),
    critical,
    regressions,
    not_exercised: [...not_exercised].sort(),
    // Adoption also needs human review and a reserved-case improvement; this is only the floor.
    adoptable:
      errors.length === 0 &&
      critical.length === 0 &&
      regressions.length === 0 &&
      not_exercised.size === 0 &&
      byCase.size > 0,
  };
}

const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);

export function renderComparison(result: Comparison): string {
  const lines = [
    '# Skill behavior comparison',
    '',
    `- Comparable: ${result.errors.length === 0 ? 'yes' : 'no'}`,
    `- Critical violations in candidate: ${result.critical.length}`,
    `- Regressions: ${result.regressions.length}`,
    `- Not exercised or undecided: ${result.not_exercised.length}`,
    `- Adoption floor met: ${result.adoptable ? 'yes' : 'no'} (human review and reserved-case confirmation still required)`,
    '',
  ];
  if (result.errors.length)
    lines.push('## Comparison errors', '', ...result.errors.map((item) => `- ${item}`), '');
  lines.push(
    '## Cases',
    '',
    '| Cell | Case | Split | Baseline | Candidate | Delta |',
    '| --- | --- | --- | --- | --- | --- |',
    ...result.cases.map(
      (item) =>
        `| ${item.cell} | ${item.case_id} | ${item.split} | ${percent(item.baseline_rate)} (${VERDICTS.map((v) => `${v}=${item.baseline[v]}`).join(' ')}) | ${percent(item.candidate_rate)} (${VERDICTS.map((v) => `${v}=${item.candidate[v]}`).join(' ')}) | ${item.delta === null ? '—' : item.delta.toFixed(2)} |`,
    ),
    '',
  );
  if (result.critical.length)
    lines.push(
      '## Critical violations (candidate)',
      '',
      ...result.critical.map(
        (item) =>
          `- ${item.cell} ${item.case_id} trial ${item.trial}: ${item.violations.join('; ')}`,
      ),
      '',
    );
  if (result.not_exercised.length)
    lines.push(
      '## Not exercised or undecided',
      '',
      ...result.not_exercised.map((i) => `- ${i}`),
      '',
    );
  lines.push(
    'Pass rates count only exercised trials (PASS and FAIL). Cells are never aggregated across hosts or models.',
    '',
  );
  return lines.join('\n');
}

function main(): void {
  const argv = process.argv.slice(2);
  const value = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const baselinePath = value('--baseline');
  const candidatePath = value('--candidate');
  if (!baselinePath || !candidatePath) {
    console.error(
      'usage: saf:skill-behavior:compare -- --baseline <records.jsonl> --candidate <records.jsonl> [--output <report.md>]',
    );
    process.exitCode = 2;
    return;
  }
  const base = parseRecords(fs.readFileSync(baselinePath, 'utf8'), path.basename(baselinePath));
  const cand = parseRecords(fs.readFileSync(candidatePath, 'utf8'), path.basename(candidatePath));
  const result = compareRecords(base.records, cand.records);
  result.errors.unshift(...base.errors, ...cand.errors);
  if (base.errors.length || cand.errors.length) result.adoptable = false;
  const rendered = renderComparison(result);
  const output = value('--output');
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, rendered);
    console.log(`comparison report: ${output}`);
  } else console.log(rendered);
  process.exitCode = result.errors.length ? 1 : 0;
}

if (require.main === module) main();
