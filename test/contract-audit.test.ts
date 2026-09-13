import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import {
  buildContractAudit,
  renderContractAudit,
  validateContractAudit,
} from '../scripts/generate-contract-audit';
import { resolveContractProvenance, validateContractReferences } from '../src/contract-graph';

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
  assert.match(renderContractAudit(audit), /Provenance/);
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

test('contract provenance distinguishes direct, inherited, and undeclared fields', () => {
  const provenance = resolveContractProvenance([
    { name: 'base', frontmatter: 'requires: [spec-package]\nextends: null\n' },
    { name: 'child', frontmatter: 'extends: base\n' },
    { name: 'empty', frontmatter: '' },
  ]);
  assert.equal(provenance.get('base')?.requires?.source, 'direct');
  assert.equal(provenance.get('child')?.requires?.source, 'inherited');
  assert.equal(provenance.get('child')?.requires?.declaredBy, 'base');
  assert.equal(provenance.get('empty')?.requires?.source, 'not-declared');
});

test('contract graph rejects unknown extends targets and cycles', () => {
  const unknown = validateContractReferences([
    { name: 'child', frontmatter: 'extends: missing\n' },
  ]);
  assert.ok(unknown.failures.some((failure) => failure.includes('extends references unknown')));
  const cycle = validateContractReferences([
    { name: 'a', frontmatter: 'extends: b\n' },
    { name: 'b', frontmatter: 'extends: a\n' },
  ]);
  assert.deepEqual(cycle.cycles, [['a', 'b', 'a']]);
});
