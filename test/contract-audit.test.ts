import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import {
  buildContractAudit,
  renderContractAudit,
  validateContractAudit,
} from '../scripts/generate-contract-audit';

const root = path.resolve(__dirname, '..');

test('contract audit projects all official Skills without creating a second authority', () => {
  const audit = buildContractAudit(root);
  assert.equal(audit.records.length, 12);
  assert.equal(new Set(audit.records.map((record) => record.id)).size, 12);
  assert.ok(audit.records.every((record) => record.authority.length > 0));
  assert.ok(audit.records.every((record) => record.semanticReview === 'required'));
  assert.ok(audit.records.every((record) => record.evidenceRequired.length > 0));
  assert.deepEqual(validateContractAudit(audit, root), []);
  assert.match(renderContractAudit(audit), /# Contract audit/);
});

test('contract audit rejects duplicate IDs and unresolved structured references', () => {
  const audit = buildContractAudit(root);
  const first = audit.records[0]!;
  const second = audit.records[1]!;
  second.id = first.id;
  first.authority = ['skills/missing/SKILL.md'];
  first.tests = ['test/missing.test.ts'];
  first.consumers = ['unknown-contract-kind'];
  first.handoff = '';
  const errors = validateContractAudit(audit, root);
  assert.ok(errors.some((error) => error.includes('duplicate id')));
  assert.ok(errors.some((error) => error.includes('unresolved authority')));
  assert.ok(errors.some((error) => error.includes('unresolved test')));
  assert.ok(errors.some((error) => error.includes('unknown contract kind')));
  assert.ok(errors.some((error) => error.includes('missing handoff')));
});
