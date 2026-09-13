import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assessFreshness,
  diffContractEvidence,
  type EvidenceSnapshot,
  renderContractEvidenceDiff,
  sanitizeObservation,
} from '../scripts/diff-contract-evidence';

function snapshot(overrides: Partial<EvidenceSnapshot>): EvidenceSnapshot {
  return {
    revision: 'revision',
    version: '0.0.0',
    artifactIdentity: 'artifact',
    treeManifest: [],
    records: [],
    findings: [],
    inspectedPaths: [],
    rules: [],
    references: [],
    affectedTests: [],
    gates: [],
    authorityChanges: [],
    invalidatedEvidence: [],
    notRun: [],
    evidence: 'current',
    ...overrides,
  };
}

test('evidence diff classifies resolved, new, persistent, and omitted findings', () => {
  const diff = diffContractEvidence(
    snapshot({
      revision: 'baseline',
      version: '7.14.1',
      artifactIdentity: 'baseline-artifact',
      findings: ['R|a.md|a', 'R|b.md|b'],
      inspectedPaths: ['a.md', 'b.md'],
      rules: ['R'],
      references: ['a', 'b'],
      affectedTests: ['test/baseline.test.ts'],
      gates: ['gate-baseline'],
      authorityChanges: [],
      invalidatedEvidence: [],
      notRun: ['host execution'],
      evidence: 'current',
    }),
    snapshot({
      revision: 'candidate',
      version: '7.15.0',
      artifactIdentity: 'candidate-artifact',
      findings: ['R|b.md|b', 'R|c.md|c'],
      inspectedPaths: ['b.md', 'c.md'],
      rules: ['R', 'S'],
      references: ['b', 'c'],
      affectedTests: ['test/candidate.test.ts'],
      gates: ['gate-candidate'],
      authorityChanges: ['skills/saf-route/SKILL.md'],
      invalidatedEvidence: ['old report'],
      notRun: ['semantic authority review'],
      evidence: 'inconclusive',
    }),
  );
  assert.deepEqual(diff.resolved, []);
  assert.deepEqual(diff.persistent, ['R|b.md|b']);
  assert.deepEqual(diff.newFindings, ['R|c.md|c']);
  assert.deepEqual(diff.omitted, ['a.md']);
  assert.deepEqual(diff.omittedFindings, ['R|a.md|a']);
  assert.equal(diff.metadata.artifactIdentityChanged, true);
  assert.deepEqual(diff.metadata.rules.added, ['S']);
  assert.deepEqual(diff.metadata.rules.removed, []);
  assert.deepEqual(diff.metadata.affectedTests.added, ['test/candidate.test.ts']);
  assert.deepEqual(diff.metadata.affectedTests.removed, ['test/baseline.test.ts']);
  assert.deepEqual(diff.metadata.authorityChanges.added, ['skills/saf-route/SKILL.md']);
  assert.match(renderContractEvidenceDiff(diff), /not-run/);
  assert.match(renderContractEvidenceDiff(diff), /Authority changes added/);
});

test('evidence freshness fails closed for missing or changed inputs', () => {
  const record = {
    record_id: 'obligation|sensor|seam|surface',
    obligation: 'obligation',
    sensor: 'sensor',
    sensor_class: 'structural' as const,
    oracle: 'oracle',
    seam: 'seam',
    surface: 'surface',
    inputs: [{ path: 'rule.yml', kind: 'file' as const, digest: 'a', included: true }],
    command: null,
    observation: null,
    result: 'pass' as const,
    freshness: 'current' as const,
    confidence_limit: 'limit',
    affected_findings: [],
  };
  assert.equal(assessFreshness(record, record.inputs), 'current');
  assert.equal(assessFreshness(record, [{ ...record.inputs[0]!, digest: 'b' }]), 'stale');
  assert.equal(assessFreshness(record, []), 'stale');
  assert.equal(assessFreshness(record, [{ ...record.inputs[0]!, digest: null }]), 'inconclusive');
});

test('evidence records normalize identity and sanitize bounded observations', () => {
  const output = sanitizeObservation('token=secret /home/alice/private\nordinary');
  assert.equal(output.inconclusive, false);
  assert.match(output.summary, /token=\[REDACTED\]/);
  assert.doesNotMatch(output.summary, /secret|\/home\/alice/);
  assert.notEqual(output.digest, '');
});
