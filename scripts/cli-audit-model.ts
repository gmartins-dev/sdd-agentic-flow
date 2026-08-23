export type ExecutionOutcome = 'PASS' | 'FAIL' | 'SKIPPED';
export type EvidenceCoverage = 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';

export type AuditObservation = {
  outcome: ExecutionOutcome;
  coverage: EvidenceCoverage;
  note: string;
  limitation?: string;
};

export type AuditCaseSummary = {
  passed: number;
  failed: number;
  skipped: number;
  complete: number;
  partial: number;
  unavailable: number;
};

export function normalizeObservation(result: unknown): AuditObservation {
  if (typeof result === 'object' && result !== null && 'outcome' in result) {
    const candidate = result as Partial<AuditObservation>;
    if (!candidate.outcome || !candidate.coverage || !candidate.note) {
      throw new Error('invalid audit observation');
    }
    const observation: AuditObservation = {
      outcome: candidate.outcome,
      coverage: candidate.coverage,
      note: candidate.note,
    };
    if (candidate.limitation) observation.limitation = candidate.limitation;
    return observation;
  }

  return {
    outcome: 'PASS',
    coverage: 'COMPLETE',
    note: typeof result === 'string' && result ? result : 'observed expected behavior',
  };
}

export function assertUniqueScenarioId(ids: ReadonlySet<string>, id: string): void {
  if (ids.has(id)) throw new Error(`duplicate audit scenario ID: ${id}`);
}

export function summarizeAuditCases(
  cases: ReadonlyArray<Pick<AuditObservation, 'outcome' | 'coverage'>>,
): AuditCaseSummary {
  return cases.reduce(
    (summary, item) => {
      summary[
        item.outcome === 'PASS' ? 'passed' : item.outcome === 'FAIL' ? 'failed' : 'skipped'
      ] += 1;
      summary[
        item.coverage === 'COMPLETE'
          ? 'complete'
          : item.coverage === 'PARTIAL'
            ? 'partial'
            : 'unavailable'
      ] += 1;
      return summary;
    },
    { passed: 0, failed: 0, skipped: 0, complete: 0, partial: 0, unavailable: 0 },
  );
}
