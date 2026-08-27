export type ExecutionOutcome = 'PASS' | 'FAIL' | 'SKIPPED';
export type EvidenceCoverage = 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';
export type CertificationVerdict = 'PASS' | 'PASS WITH FINDINGS' | 'FAIL' | 'NOT CERTIFIED';
export type ScenarioRequirement = 'mandatory' | 'optional';
export type FindingSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';

export type CertificationFinding = {
  id: string;
  severity: FindingSeverity;
  blocking: boolean;
  classification: string;
  summary: string;
};

export type AuditObservation = {
  outcome: ExecutionOutcome;
  coverage: EvidenceCoverage;
  note: string;
  limitation?: string;
};

export type ScenarioEvidence = AuditObservation & {
  requirement: ScenarioRequirement;
};

export type CertificationDecision = {
  verdict: CertificationVerdict;
  exitCode: 0 | 1;
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

export function decideCertification(
  scenarios: ReadonlyArray<ScenarioEvidence>,
  findings: ReadonlyArray<CertificationFinding> = [],
): CertificationDecision {
  const mandatory = scenarios.filter((scenario) => scenario.requirement === 'mandatory');
  if (
    mandatory.some((scenario) => scenario.outcome === 'SKIPPED' || scenario.coverage !== 'COMPLETE')
  ) {
    return { verdict: 'NOT CERTIFIED', exitCode: 1 };
  }
  if (scenarios.some((scenario) => scenario.outcome === 'FAIL')) {
    return { verdict: 'FAIL', exitCode: 1 };
  }
  if (findings.some((finding) => finding.blocking)) {
    return { verdict: 'FAIL', exitCode: 1 };
  }
  if (findings.length > 0) {
    return { verdict: 'PASS WITH FINDINGS', exitCode: 1 };
  }
  return { verdict: 'PASS', exitCode: 0 };
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
