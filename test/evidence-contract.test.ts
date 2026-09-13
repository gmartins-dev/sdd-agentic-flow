import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  canonicalInputManifest,
  normalizeEvidencePath,
  observationDigest,
  parseEvidenceReport,
  readDeclaredInput,
  sanitizeEvidenceText,
} from '../src/evidence-contract';

const digest = (value: string) =>
  `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;

function report(): string {
  const observation = 'one parser fixture passed';
  return `# Task check — T01

Feature: sample-feature
Evidence contract: saf-evidence/v1
Report ID: 123e4567-e89b-42d3-a456-426614174000
Report scope: check:sample-feature:T01
Supersedes: none

## Evidence

| Requirement anchor | Sensor | Record IDs | Result | Freshness |
| --- | --- | --- | --- | --- |
| REQ-01 | evidence-contract-test | EV-001 | pass | current |

## Evidence records

### EV-001

Requirement anchors: REQ-01
Sensor: evidence-contract-test
Sensor class: unitary
Oracle: REQ-01 acceptance criterion
Seam: report parser
Surface: src/evidence-contract.ts
Revision: 0123456789abcdef0123456789abcdef01234567
Run state before: clean
Run state after: clean
Inputs:
| Path | SHA-256 | Status | Reason |
| --- | --- | --- | --- |
| src/evidence-contract.ts | ${digest('input')} | included | — |
Command: npx tsx --test test/evidence-contract.test.ts
Exit status: 0
Observation: ${observation}
Observation digest: ${digest(observation)}
Result: pass
Freshness: current
Confidence limit: Declared scope does not trace runtime-loaded dependencies.
`;
}

test('parses a valid v1 report with deterministic identity', () => {
  const parsed = parseEvidenceReport(report());
  assert.ok(parsed);
  assert.equal(parsed.reportId, '123e4567-e89b-42d3-a456-426614174000');
  assert.equal(parsed.records[0]?.sensor, 'evidence-contract-test');
  assert.equal(
    parsed.records[0]?.observationDigest,
    observationDigest('one parser fixture passed'),
  );
});

test('rejects malformed report envelopes and unsafe record text', () => {
  assert.equal(
    parseEvidenceReport(
      report().replace('Evidence contract: saf-evidence/v1', 'Evidence contract: v4'),
    ),
    null,
  );
  assert.equal(
    parseEvidenceReport(
      report().replace(
        'Report ID: 123e4567-e89b-42d3-a456-426614174000',
        'Report ID: 123e4567-e89b-42d3-a456-426614174000\nReport ID: 123e4567-e89b-42d3-a456-426614174000',
      ),
    ),
    null,
  );
  assert.equal(
    parseEvidenceReport(report().replace('## Evidence records', '```\n## Evidence records\n```')),
    null,
  );
  assert.equal(
    parseEvidenceReport(report().replace('Seam: report parser', 'Seam: token=secret')),
    null,
  );
  assert.equal(
    parseEvidenceReport(
      report().replace('Report ID: 123e4567-e89b-42d3-a456-426614174000', 'Report ID: invalid'),
    ),
    null,
  );
});

test('canonical manifests sort deterministically and reject collisions', () => {
  const first = canonicalInputManifest([
    { path: 'b.ts', sha256: digest('b'), status: 'included', reason: null },
    { path: 'a.ts', sha256: digest('a'), status: 'included', reason: null },
  ]);
  const second = canonicalInputManifest([...first.entries].reverse());
  assert.equal(first.digest, second.digest);
  assert.throws(() =>
    canonicalInputManifest([
      { path: 'A.ts', sha256: digest('a'), status: 'included', reason: null },
      { path: 'a.ts', sha256: digest('b'), status: 'included', reason: null },
    ]),
  );
  assert.equal(normalizeEvidencePath('../secret'), null);
  assert.throws(() =>
    canonicalInputManifest([
      { path: 'excluded.txt', sha256: 'not-recorded', status: 'excluded', reason: 'token=secret' },
    ]),
  );
});

test('declared inputs use raw bytes and reject symlinks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-evidence-contract-'));
  try {
    fs.writeFileSync(path.join(root, 'input.txt'), 'input');
    const input = {
      path: 'input.txt',
      sha256: digest('input'),
      status: 'included' as const,
      reason: null,
    };
    assert.equal(readDeclaredInput(root, input), 'current');
    fs.writeFileSync(path.join(root, 'input.txt'), 'changed');
    assert.equal(readDeclaredInput(root, input), 'stale');
    fs.symlinkSync(path.join(root, 'input.txt'), path.join(root, 'link.txt'));
    assert.equal(readDeclaredInput(root, { ...input, path: 'link.txt' }), 'inconclusive');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('sanitization rejects secret and home-path text while bounding persisted output', () => {
  assert.equal(sanitizeEvidenceText('token=secret').safe, false);
  assert.equal(sanitizeEvidenceText('/home/alice/project').safe, false);
  assert.ok(Buffer.byteLength(sanitizeEvidenceText('a'.repeat(4096)).value, 'utf8') <= 2048);
});
