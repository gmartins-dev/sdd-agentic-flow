import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { VERSION } from '../src/paths';

import {
  analyzeConsumerClosure,
  type ConsumerClosureEntry,
  expectedInstalledPaths,
  materializeSourceProjection,
} from './consumer-closure';

export type EvidenceInput = {
  path: string;
  kind: 'file' | 'directory' | 'symlink' | 'revision' | 'command';
  digest: string | null;
  included: boolean;
  exclusion?: string;
};

export type EvidenceRecord = {
  record_id: string;
  obligation: string;
  sensor: string;
  sensor_class: 'structural' | 'unitary' | 'integration' | 'contract' | 'black-box' | 'review';
  oracle: string;
  seam: string;
  surface: string;
  inputs: EvidenceInput[];
  command: { text: string; exit_status?: number } | null;
  observation: { summary: string; digest: string } | null;
  result: 'pass' | 'fail' | 'inconclusive' | 'not-run';
  freshness: 'current' | 'stale' | 'inconclusive';
  confidence_limit: string;
  affected_findings: string[];
};

export type TreeManifestEntry = {
  path: string;
  kind: 'file' | 'directory' | 'symlink' | 'unreadable';
  digest: string | null;
};

export type EvidenceSnapshot = {
  revision: string;
  version: string;
  artifactIdentity: string;
  treeManifest: TreeManifestEntry[];
  records: EvidenceRecord[];
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
  omittedFindings: string[];
  metadata: EvidenceMetadataDiff;
};

export type ClosureFindingDelta = {
  identity: string;
  status: 'new' | 'persistent' | 'resolved' | 'omitted';
};

function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function digest(value: string | Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableRecordId(
  record: Pick<EvidenceRecord, 'obligation' | 'sensor' | 'seam' | 'surface'>,
): string {
  return [record.obligation, record.sensor, record.seam, record.surface]
    .map((part) => part.trim().replaceAll('|', '/'))
    .join('|');
}

export function sanitizeObservation(
  value: string,
  limit = 2048,
): {
  summary: string;
  digest: string;
  inconclusive: boolean;
} {
  const inconclusive = /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|AKIA[0-9A-Z]{16}/i.test(value);
  const sanitized = value
    .replace(/(authorization|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/\/(?:home|Users)\/[^\s]+/g, '[PATH]')
    .split('')
    .map((character) => {
      const code = character.charCodeAt(0);
      return (code < 32 && ![9, 10, 13].includes(code)) || code === 127 ? '�' : character;
    })
    .join('');
  const bounded =
    Buffer.byteLength(sanitized) > limit
      ? `${Buffer.from(sanitized).subarray(0, limit).toString('utf8')}…`
      : sanitized;
  return { summary: bounded, digest: digest(sanitized), inconclusive };
}

export function assessFreshness(
  record: EvidenceRecord,
  currentInputs: readonly EvidenceInput[],
): EvidenceRecord['freshness'] {
  if (record.inputs.some((input) => input.included && input.digest === null)) return 'inconclusive';
  const current = new Map(currentInputs.map((input) => [input.path, input]));
  for (const input of record.inputs) {
    const observed = current.get(input.path);
    if (observed?.included && observed.digest === null) return 'inconclusive';
    if (!observed || (input.included && input.digest !== observed.digest)) return 'stale';
  }
  if (
    currentInputs.some(
      (input) => input.included && !record.inputs.some((item) => item.path === input.path),
    )
  )
    return 'stale';
  return 'current';
}

function treeManifest(root: string, paths: string[]): TreeManifestEntry[] {
  return paths.map((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    try {
      const stat = fs.lstatSync(absolutePath);
      if (stat.isSymbolicLink())
        return {
          path: relativePath,
          kind: 'symlink',
          digest: digest(fs.readlinkSync(absolutePath)),
        };
      if (stat.isDirectory()) return { path: relativePath, kind: 'directory', digest: null };
      return {
        path: relativePath,
        kind: 'file',
        digest: digest(fs.readFileSync(absolutePath)),
      };
    } catch {
      return { path: relativePath, kind: 'unreadable', digest: null };
    }
  });
}

function recordForClosure(
  result: ReturnType<typeof analyzeConsumerClosure>,
  inputs: EvidenceInput[],
  revision: string,
): EvidenceRecord {
  const observation = sanitizeObservation(
    `${result.status}\n${result.findings.map((finding) => finding.normalizedReference).join('\n')}`,
  );
  const resultStatus = observation.inconclusive
    ? 'inconclusive'
    : result.status === 'PASS'
      ? 'pass'
      : result.status === 'FAIL'
        ? 'fail'
        : 'inconclusive';
  const exitStatus = resultStatus === 'pass' ? 0 : resultStatus === 'fail' ? 1 : 2;
  const record = {
    obligation: 'consumer-closure',
    sensor: 'consumer-closure',
    sensor_class: 'contract' as const,
    oracle: 'consumer closure rules',
    seam: 'installed bundle references',
    surface: 'source/dist/packed consumer projection',
  };
  return {
    record_id: stableRecordId(record),
    ...record,
    inputs: [
      ...inputs,
      { path: '<revision>', kind: 'revision' as const, digest: revision, included: true },
    ].sort((left, right) => left.path.localeCompare(right.path)),
    command: { text: 'consumer closure inspection', exit_status: exitStatus },
    observation: observation.inconclusive ? null : observation,
    result: resultStatus,
    freshness: observation.inconclusive ? 'inconclusive' : 'current',
    confidence_limit:
      'Mechanical closure only; semantic review and host execution remain separate.',
    affected_findings: result.findings.map(
      (finding) => `${finding.rule}|${finding.file}|${finding.normalizedReference}`,
    ),
  };
}

function projectionInputs(entries: readonly ConsumerClosureEntry[]): EvidenceInput[] {
  return entries.map((entry) => ({
    path: sourcePath(entry.relativePath),
    kind: entry.kind === 'symlink' ? 'symlink' : 'file',
    digest: entry.readError
      ? null
      : digest(entry.kind === 'symlink' ? (entry.target ?? '') : (entry.content ?? '')),
    included: !entry.readError,
    ...(entry.readError
      ? { exclusion: 'unreadable projection input; record is inconclusive' }
      : {}),
  }));
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
  const omittedFindings = sorted(
    [...baselineFindings].filter((finding) => {
      const file = finding.split('|')[1];
      return !candidate.inspectedPaths.includes(file ?? '');
    }),
  );
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
    resolved: sorted(
      [...baselineFindings].filter((item) => {
        if (candidateFindings.has(item) || omittedFindings.includes(item)) return false;
        const file = item.split('|')[1];
        return candidate.inspectedPaths.includes(file ?? '');
      }),
    ),
    omitted: sorted(
      baseline.inspectedPaths.filter((item) => !candidate.inspectedPaths.includes(item)),
    ),
    omittedFindings,
    metadata: metadataDiff(baseline, candidate),
  };
}

export function closureFindingLedger(diff: ContractEvidenceDiff): ClosureFindingDelta[] {
  return [
    ...diff.newFindings.map((identity) => ({ identity, status: 'new' as const })),
    ...diff.persistent.map((identity) => ({ identity, status: 'persistent' as const })),
    ...diff.resolved.map((identity) => ({ identity, status: 'resolved' as const })),
    ...diff.omittedFindings.map((identity) => ({ identity, status: 'omitted' as const })),
  ];
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
  | 'revision'
  | 'version'
  | 'artifactIdentity'
  | 'findings'
  | 'inspectedPaths'
  | 'treeManifest'
  | 'records'
  | 'evidence'
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
  const closureInputs = entries.map((entry) => ({
    path: sourcePath(entry.relativePath),
    kind: 'revision' as const,
    digest: entry.readError ? null : digest(entry.content ?? ''),
    included: !entry.readError,
    ...(entry.readError ? { exclusion: 'unreadable revision input; record is inconclusive' } : {}),
  }));
  const closure = recordForClosure(result, closureInputs, revision);
  return {
    revision,
    version,
    artifactIdentity: `sdd-agentic-flow@${version} installed bundle`,
    treeManifest: [],
    records: [closure],
    findings: result.findings.map(
      (finding) => `${finding.rule}|${finding.file}|${finding.normalizedReference}`,
    ),
    inspectedPaths: result.inspectedPaths,
    ...snapshotMetadata(root, result, false),
    evidence: result.status === 'INCONCLUSIVE' ? 'inconclusive' : 'current',
  };
}

function candidateSnapshot(root: string): EvidenceSnapshot {
  const projection = materializeSourceProjection(root);
  const result = analyzeConsumerClosure({ entries: projection });
  const paths = changedPaths(root);
  const manifest = treeManifest(root, paths);
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  const closure = recordForClosure(result, projectionInputs(projection), revision);
  const treeIdentity = digest(JSON.stringify(manifest));
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    version: string;
  };
  return {
    revision,
    version: packageJson.version,
    artifactIdentity: `sdd-agentic-flow@${packageJson.version} installed bundle; tree=${treeIdentity}`,
    treeManifest: manifest,
    records: [closure],
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
    `Candidate tree entries: ${diff.candidate.treeManifest.length}`,
    '',
    '## Findings',
    '',
    `- New: ${diff.newFindings.join(', ') || 'none'}`,
    `- Persistent: ${diff.persistent.join(', ') || 'none'}`,
    `- Resolved: ${diff.resolved.join(', ') || 'none'}`,
    `- Omitted: ${diff.omitted.join(', ') || 'none'}`,
    `- Omitted findings (not resolved): ${diff.omittedFindings.join(', ') || 'none'}`,
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
    '',
    '## Evidence records',
    '',
    '| Record | Result | Freshness | Inputs | Observation | Limit |',
    '| --- | --- | --- | ---: | --- | --- |',
    ...diff.candidate.records.map(
      (record) =>
        `| ${record.record_id} | ${record.result} | ${record.freshness} | ${record.inputs.length} | ${record.observation?.digest ?? 'not persisted'} | ${record.confidence_limit} |`,
    ),
  ];
  return `${lines.join('\n')}\n`;
}

if (process.argv[1]?.endsWith('diff-contract-evidence.ts')) {
  const root = path.resolve(__dirname, '..');
  const args = process.argv.slice(2);
  const valueAfter = (flag: string): string | null => {
    const index = args.indexOf(flag);
    return index >= 0 ? (args[index + 1] ?? null) : null;
  };
  const baselineArg = valueAfter('--baseline');
  const candidateArg = valueAfter('--candidate');
  const workingTree = args.includes('--working-tree');
  if (!baselineArg || (!candidateArg && !workingTree) || (candidateArg && workingTree)) {
    throw new Error(
      'usage: diff-contract-evidence --baseline <git-revision> (--candidate <git-revision> | --working-tree)',
    );
  }
  const resolveCommit = (revision: string) =>
    execFileSync('git', ['rev-parse', '--verify', `${revision}^{commit}`], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
  const baselineRevision = resolveCommit(baselineArg);
  const candidateRevision = candidateArg ? resolveCommit(candidateArg) : null;
  if (workingTree && process.env.SAF_RELEASE_CERTIFICATION === '1')
    throw new Error('--working-tree is forbidden for release certification');
  const diff = diffContractEvidence(
    snapshotFromGit(root, baselineRevision),
    candidateRevision ? snapshotFromGit(root, candidateRevision) : candidateSnapshot(root),
  );
  const output =
    process.env.SAF_CONTRACT_DIFF_REPORT ||
    path.join(root, '.local', 'gmm', 'sdd-agentic-flow', `v${VERSION}-contract-diff.md`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, renderContractEvidenceDiff(diff), 'utf8');
  console.log(`PASS contract evidence diff: ${output}`);
}
