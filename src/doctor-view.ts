import type { EvidenceGraphResult } from './evidence-graph';
import { t } from './messages';

type CheckStatus = 'PASS' | 'INFO' | 'WARN' | 'FAIL';

type DoctorCheck = {
  name: string;
  status: CheckStatus;
  message?: string;
};

type StatusCounts = Record<CheckStatus, number>;

type DoctorViewOptions = {
  verbose?: boolean;
  locale?: string;
};

type DoctorView = {
  counts: StatusCounts;
  hasProblems: boolean;
  title: string;
  primaryFix: string | null;
  shown: DoctorCheck[];
};

function summarizeChecks(checks: DoctorCheck[] = []): StatusCounts {
  const counts: StatusCounts = { PASS: 0, INFO: 0, WARN: 0, FAIL: 0 };
  for (const check of checks) counts[check.status] = (counts[check.status] || 0) + 1;
  return counts;
}

function primaryRemediation(checks: DoctorCheck[] = []): string | null {
  const byName = new Map(checks.map((check) => [check.name, check]));
  if (['WARN', 'FAIL'].includes(byName.get('config')?.status ?? '')) return 'npx sdd-agentic-flow';
  if (['WARN', 'FAIL'].includes(byName.get('skills')?.status ?? '')) return 'npx sdd-agentic-flow';
  if (['WARN', 'FAIL'].includes(byName.get('installation_intent')?.status ?? ''))
    return 'npx sdd-agentic-flow';
  if (['WARN', 'FAIL'].includes(byName.get('installation_provenance')?.status ?? ''))
    return 'npx sdd-agentic-flow';
  if (['WARN', 'FAIL'].includes(byName.get('language_profile')?.status ?? '')) {
    const language = byName.get('language_profile');
    return /not installed/i.test(language?.message ?? '')
      ? 'npx sdd-agentic-flow'
      : 'npx sdd-agentic-flow init --language <profile>';
  }
  return null;
}

function buildDoctorView(checks: DoctorCheck[], options: DoctorViewOptions = {}): DoctorView {
  const { verbose = false, locale = 'en-US' } = options;
  const counts = summarizeChecks(checks);
  const hasProblems = counts.WARN + counts.FAIL > 0;
  const shown = verbose
    ? checks
    : checks.filter((check) => ['WARN', 'FAIL'].includes(check.status));
  return {
    counts,
    hasProblems,
    title: hasProblems ? t(locale, 'doctor.needsAction') : t(locale, 'ready.title'),
    primaryFix: primaryRemediation(checks),
    shown,
  };
}

function formatEvidenceGraph(result: EvidenceGraphResult): string {
  const lines: string[] = [`Evidence graph — ${result.featureSlug}`, ''];
  if (result.errors.length) {
    for (const error of result.errors) lines.push(`ERROR: ${error}`);
    lines.push('');
  }
  for (const node of result.requirements) {
    lines.push(`${node.reqId}: ${node.status}`);
    if (node.taskIds.length) lines.push(`  tasks: ${node.taskIds.join(', ')}`);
    if (node.checkReports.length)
      lines.push(
        `  checks: ${node.checkReports.map((reportPath) => reportPath.split(/[/\\]/).pop() ?? reportPath).join(', ')}`,
      );
  }
  return lines.join('\n');
}

export type { CheckStatus, DoctorCheck, DoctorView, DoctorViewOptions };
export { buildDoctorView, formatEvidenceGraph, primaryRemediation, summarizeChecks };
