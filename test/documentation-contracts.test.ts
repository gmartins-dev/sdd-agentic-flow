import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import { checkDocumentationContracts } from '../scripts/check-documentation-contracts';

test('documentation contracts accept current commands and skills', () => {
  const findings = checkDocumentationContracts(
    new Map([['README.md', '`sdd-agentic-flow install` uses `saf-route` and `saf-validate`.']]),
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

test('documentation contracts cover the representation model and registry inventory', () => {
  const documents = new Map<string, string>([
    [
      'docs/information-representation-model.md',
      fs.readFileSync('docs/information-representation-model.md', 'utf8'),
    ],
    [
      'shared/references/artifact-contracts.md',
      fs.readFileSync('shared/references/artifact-contracts.md', 'utf8'),
    ],
  ]);
  assert.deepEqual(checkDocumentationContracts(documents), []);
});

test('documentation contracts reject a missing representation token', () => {
  const model = fs
    .readFileSync('docs/information-representation-model.md', 'utf8')
    .replace('`validation-report`', 'validation-report');
  const findings = checkDocumentationContracts(
    new Map([
      ['docs/information-representation-model.md', model],
      ['shared/references/artifact-contracts.md', ''],
    ]),
  );
  assert.equal(
    findings.some((finding) => finding.message.includes('validation-report')),
    true,
  );
});
