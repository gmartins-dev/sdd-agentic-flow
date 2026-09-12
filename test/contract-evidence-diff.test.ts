import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  diffContractEvidence,
  renderContractEvidenceDiff,
} from '../scripts/diff-contract-evidence';

test('evidence diff classifies resolved, new, persistent, and omitted findings', () => {
  const diff = diffContractEvidence(
    {
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
    },
    {
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
    },
  );
  assert.deepEqual(diff.resolved, ['R|a.md|a']);
  assert.deepEqual(diff.persistent, ['R|b.md|b']);
  assert.deepEqual(diff.newFindings, ['R|c.md|c']);
  assert.deepEqual(diff.omitted, ['a.md']);
  assert.equal(diff.metadata.artifactIdentityChanged, true);
  assert.deepEqual(diff.metadata.rules.added, ['S']);
  assert.deepEqual(diff.metadata.rules.removed, []);
  assert.deepEqual(diff.metadata.affectedTests.added, ['test/candidate.test.ts']);
  assert.deepEqual(diff.metadata.affectedTests.removed, ['test/baseline.test.ts']);
  assert.deepEqual(diff.metadata.authorityChanges.added, ['skills/saf-route/SKILL.md']);
  assert.match(renderContractEvidenceDiff(diff), /not-run/);
  assert.match(renderContractEvidenceDiff(diff), /Authority changes added/);
});
