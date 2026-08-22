import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkDocumentationContracts } from '../scripts/check-documentation-contracts';

test('documentation contracts accept current commands, packs, and skills', () => {
  const findings = checkDocumentationContracts(
    new Map([
      ['README.md', '`sdd-agentic-flow install full` uses `saf-route` and `saf-validate`.'],
    ]),
  );
  assert.deepEqual(findings, []);
});

test('documentation contracts reject retired references', () => {
  const findings = checkDocumentationContracts(
    new Map([['README.md', '`sdd-agentic-flow install core` still uses `saf-release`.']]),
  );
  assert.equal(
    findings.some((finding) => finding.message.includes('retired')),
    true,
  );
  assert.equal(
    findings.some((finding) => finding.message.includes('unknown skill reference')),
    true,
  );
});
