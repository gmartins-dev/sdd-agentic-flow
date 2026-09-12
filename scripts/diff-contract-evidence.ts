import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import {
  analyzeConsumerClosure,
  type ConsumerClosureEntry,
  expectedInstalledPaths,
  materializeSourceProjection,
} from './consumer-closure';

export type EvidenceSnapshot = {
  revision: string;
  version: string;
  artifactIdentity: string;
  findings: string[];
  inspectedPaths: string[];
  rules: string[];
  references: string[];
  affectedTests: string[];
  gates: string[];
  authorityChanges: string[];
  invalidatedEvidence: string[];
  notRun: string[];
  evidence: 'current' | 'not-run' | 'inconclusive';
};

type SetDelta = { added: string[]; removed: string[] };

export type EvidenceMetadataDiff = {
  artifactIdentityChanged: boolean;
  rules: SetDelta;
  references: SetDelta;
  affectedTests: SetDelta;
  gates: SetDelta;
  authorityChanges: SetDelta;
  invalidatedEvidence: SetDelta;
  notRun: SetDelta;
};

export type ContractEvidenceDiff = {
  baseline: EvidenceSnapshot;
  candidate: EvidenceSnapshot;
  newFindings: string[];
  persistent: string[];
  resolved: string[];
  omitted: string[];
  metadata: EvidenceMetadataDiff;
};

function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function setDelta(before: string[], after: string[]): SetDelta {
  const previous = new Set(before);
  const next = new Set(after);
  return {
    added: sorted([...next].filter((value) => !previous.has(value))),
    removed: sorted([...previous].filter((value) => !next.has(value))),
  };
}

function metadataDiff(
  baseline: EvidenceSnapshot,
  candidate: EvidenceSnapshot,
): EvidenceMetadataDiff {
  return {
    artifactIdentityChanged: baseline.artifactIdentity !== candidate.artifactIdentity,
    rules: setDelta(baseline.rules, candidate.rules),
    references: setDelta(baseline.references, candidate.references),
    affectedTests: setDelta(baseline.affectedTests, candidate.affectedTests),
    gates: setDelta(baseline.gates, candidate.gates),
    authorityChanges: setDelta(baseline.authorityChanges, candidate.authorityChanges),
    invalidatedEvidence: setDelta(baseline.invalidatedEvidence, candidate.invalidatedEvidence),
    notRun: setDelta(baseline.notRun, candidate.notRun),
  };
}

export function diffContractEvidence(
  baseline: EvidenceSnapshot,
  candidate: EvidenceSnapshot,
): ContractEvidenceDiff {
  const baselineFindings = new Set(baseline.findings);
  const candidateFindings = new Set(candidate.findings);
  return {
    baseline: {
      ...baseline,
      findings: sorted(baseline.findings),
      inspectedPaths: sorted(baseline.inspectedPaths),
    },
    candidate: {
      ...candidate,
      findings: sorted(candidate.findings),
      inspectedPaths: sorted(candidate.inspectedPaths),
    },
    newFindings: sorted([...candidateFindings].filter((item) => !baselineFindings.has(item))),
    persistent: sorted([...candidateFindings].filter((item) => baselineFindings.has(item))),
    resolved: sorted([...baselineFindings].filter((item) => !candidateFindings.has(item))),
    omitted: sorted(
      baseline.inspectedPaths.filter((item) => !candidate.inspectedPaths.includes(item)),
    ),
    metadata: metadataDiff(baseline, candidate),
  };
}

function sourcePath(installedPath: string): string {
  return installedPath.startsWith('sdd-agentic-flow-shared/')
    ? `shared/${installedPath.slice('sdd-agentic-flow-shared/'.length)}`
    : `skills/${installedPath}`;
}

const CLOSURE_RULES = [
  'SAF-CLOSURE-001',
  'SAF-CLOSURE-002',
  'SAF-CLOSURE-003',
  'SAF-CLOSURE-004',
  'SAF-CLOSURE-005',
  'SAF-CLOSURE-006',
  'SAF-CLOSURE-007',
  'SAF-CLOSURE-008',
  'SAF-CLOSURE-009',
];
const RELEASE_GATES = [
  'npm run check',
  'npm run sanitize',
  'npm run pack:dry',
  'npm run release:check',
  'consumer closure dist',
  'consumer closure packed',
];
const AUDIT_TESTS = [
  'test/consumer-closure.test.ts',
  'test/consumer-closure-certification.test.ts',
  'test/contract-audit.test.ts',
  'test/contract-evidence-diff.test.ts',
];
const NOT_RUN = ['host execution', 'semantic authority review'];

function changedPaths(root: string): string[] {
  const tracked = execFileSync('git', ['diff', '--name-only', 'HEAD', '--'], {
    cwd: root,
    encoding: 'utf8',
  }).split('\n');
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  }).split('\n');
  return sorted([...tracked, ...untracked].filter(Boolean));
}

function snapshotMetadata(
  root: string,
  result: ReturnType<typeof analyzeConsumerClosure>,
  candidate: boolean,
): Omit<
  EvidenceSnapshot,
  'revision' | 'version' | 'artifactIdentity' | 'findings' | 'inspectedPaths' | 'evidence'
> {
  const paths = candidate ? changedPaths(root) : [];
  const authorityChanges = paths.filter(
    (file) =>
      file.startsWith('skills/') ||
      file.startsWith('shared/references/') ||
      file === 'shared/evals/evals.json',
  );
  const affectedTests = paths.filter((file) => file.startsWith('test/'));
  return {
    rules: CLOSURE_RULES,
    references: result.findings.map((finding) => finding.normalizedReference),
    affectedTests: sorted([...AUDIT_TESTS, ...(candidate ? affectedTests : [])]),
    gates: RELEASE_GATES,
    authorityChanges,
    invalidatedEvidence: result.status === 'INCONCLUSIVE' ? ['consumer closure inspection'] : [],
    notRun: NOT_RUN,
  };
}

function snapshotFromGit(root: string, revision: string): EvidenceSnapshot {
  const entries: ConsumerClosureEntry[] = expectedInstalledPaths().map((relativePath) => {
    try {
      return {
        relativePath,
        kind: 'file' as const,
        content: execFileSync('git', ['show', `${revision}:${sourcePath(relativePath)}`], {
          cwd: root,
          encoding: 'utf8',
        }),
      };
    } catch (error) {
      return {
        relativePath,
        kind: 'file' as const,
        readError: error instanceof Error ? error.message : String(error),
      };
    }
  });
  const result = analyzeConsumerClosure({ entries });
  const version = JSON.parse(
    execFileSync('git', ['show', `${revision}:package.json`], { cwd: root, encoding: 'utf8' }),
  ).version as string;
  return {
    revision,
    version,
    artifactIdentity: `sdd-agentic-flow@${version} installed bundle`,
    findings: result.findings.map(
      (finding) => `${finding.rule}|${finding.file}|${finding.normalizedReference}`,
    ),
    inspectedPaths: result.inspectedPaths,
    ...snapshotMetadata(root, result, false),
    evidence: result.status === 'INCONCLUSIVE' ? 'inconclusive' : 'current',
  };
}

function candidateSnapshot(root: string): EvidenceSnapshot {
  const result = analyzeConsumerClosure({ entries: materializeSourceProjection(root) });
  return {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    version: (
      JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string }
    ).version,
    artifactIdentity: `sdd-agentic-flow@${(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string }).version} installed bundle`,
    findings: result.findings.map(
      (finding) => `${finding.rule}|${finding.file}|${finding.normalizedReference}`,
    ),
    inspectedPaths: result.inspectedPaths,
    ...snapshotMetadata(root, result, true),
    evidence: result.status === 'INCONCLUSIVE' ? 'inconclusive' : 'current',
  };
}

export function renderContractEvidenceDiff(diff: ContractEvidenceDiff): string {
  const lines = [
    '# Contract evidence diff',
    '',
    `Baseline: ${diff.baseline.version} / ${diff.baseline.revision}`,
    `Candidate: ${diff.candidate.version} / ${diff.candidate.revision}`,
    '',
    '## Findings',
    '',
    `- New: ${diff.newFindings.join(', ') || 'none'}`,
    `- Persistent: ${diff.persistent.join(', ') || 'none'}`,
    `- Resolved: ${diff.resolved.join(', ') || 'none'}`,
    `- Omitted: ${diff.omitted.join(', ') || 'none'}`,
    '',
    '## Metadata',
    '',
    `- Artifact identity changed: ${diff.metadata.artifactIdentityChanged ? 'yes' : 'no'}`,
    `- Rules added: ${diff.metadata.rules.added.join(', ') || 'none'}; removed: ${diff.metadata.rules.removed.join(', ') || 'none'}`,
    `- References added: ${diff.metadata.references.added.join(', ') || 'none'}; removed: ${diff.metadata.references.removed.join(', ') || 'none'}`,
    `- Affected tests added: ${diff.metadata.affectedTests.added.join(', ') || 'none'}; removed: ${diff.metadata.affectedTests.removed.join(', ') || 'none'}`,
    `- Gates added: ${diff.metadata.gates.added.join(', ') || 'none'}; removed: ${diff.metadata.gates.removed.join(', ') || 'none'}`,
    `- Authority changes added: ${diff.metadata.authorityChanges.added.join(', ') || 'none'}; removed: ${diff.metadata.authorityChanges.removed.join(', ') || 'none'}`,
    `- Invalidated evidence added: ${diff.metadata.invalidatedEvidence.added.join(', ') || 'none'}; removed: ${diff.metadata.invalidatedEvidence.removed.join(', ') || 'none'}`,
    `- Not-run added: ${diff.metadata.notRun.added.join(', ') || 'none'}; removed: ${diff.metadata.notRun.removed.join(', ') || 'none'}`,
    '',
    '## Evidence limits',
    '',
    `- Baseline: ${diff.baseline.evidence}`,
    `- Candidate: ${diff.candidate.evidence}`,
    '- Host execution: not-run',
    '- Semantic authority review: not-run',
  ];
  return `${lines.join('\n')}\n`;
}

if (process.argv[1]?.endsWith('diff-contract-evidence.ts')) {
  const root = path.resolve(__dirname, '..');
  const diff = diffContractEvidence(snapshotFromGit(root, 'HEAD'), candidateSnapshot(root));
  const output =
    process.env.SAF_CONTRACT_DIFF_REPORT ||
    path.join(root, '.local', 'gmm', 'sdd-agentic-flow', 'v7.15.0-contract-diff.md');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, renderContractEvidenceDiff(diff), 'utf8');
  console.log(`PASS contract evidence diff: ${output}`);
}
