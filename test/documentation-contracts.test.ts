import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import {
  checkDocumentationContracts,
  checkReleaseDocumentationState,
  loadReleaseDocumentationState,
} from '../scripts/check-documentation-contracts';

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

test('documentation contracts reject retired v7 lifecycle vocabulary', () => {
  const findings = checkDocumentationContracts(
    new Map([
      [
        'README.md',
        'Run `init --preset supervised`, `install full`, and use `saf-config/v2`.\n\n## Packs\n',
      ],
    ]),
  );
  assert.equal(
    findings.some((finding) => finding.message.includes('retired documentation vocabulary')),
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

test('release documentation state matches current package and planned semver', () => {
  assert.deepEqual(
    checkReleaseDocumentationState({
      roadmap: 'Current release: v7.9.1\nPlanned release: v7.10.0\n',
      changelog: '# Changelog\n\n## 7.9.1\n\n- current\n',
      packageVersion: '7.9.1',
    }),
    [],
  );
});

test('release documentation state rejects stale labels and mismatched versions', () => {
  const findings = checkReleaseDocumentationState({
    roadmap:
      'Current release: v7.8.0\nPlanned release: v7.7.0\n\n- v7.9.1 (next patch)\n- Next release after 7.7.1 — v7.8.0\n',
    changelog: '# Changelog\n\n## 7.9.1\n',
    packageVersion: '7.9.1',
  });
  assert.equal(
    findings.some((finding) => finding.message.includes('package.json')),
    true,
  );
  assert.equal(
    findings.some((finding) => finding.message.includes('first CHANGELOG')),
    true,
  );
  assert.equal(
    findings.some((finding) => finding.message.includes('Planned release')),
    true,
  );
  assert.equal(
    findings.some((finding) => finding.message.includes('next patch')),
    true,
  );
  assert.equal(
    findings.some((finding) => finding.message.includes('released version')),
    true,
  );
});

test('release documentation loader reads roadmap, changelog, and package version', () => {
  const state = loadReleaseDocumentationState();
  assert.equal(state.packageVersion, '7.10.0');
  assert.match(state.roadmap, /Current release: v7\.10\.0/);
  assert.match(state.changelog, /^## 7\.10\.0/m);
});
