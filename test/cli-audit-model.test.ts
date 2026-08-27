import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertUniqueScenarioId,
  decideCertification,
  normalizeObservation,
  summarizeAuditCases,
} from '../scripts/cli-audit-model.js';

test('normalizes ordinary observations as complete passes', () => {
  assert.deepEqual(normalizeObservation('completed'), {
    outcome: 'PASS',
    coverage: 'COMPLETE',
    note: 'completed',
  });
});

test('preserves explicit skipped and unavailable evidence', () => {
  assert.deepEqual(
    normalizeObservation({
      outcome: 'SKIPPED',
      coverage: 'UNAVAILABLE',
      note: 'PTY helper unavailable',
      limitation: 'script command is not installed',
    }),
    {
      outcome: 'SKIPPED',
      coverage: 'UNAVAILABLE',
      note: 'PTY helper unavailable',
      limitation: 'script command is not installed',
    },
  );
});

test('rejects duplicate scenario IDs', () => {
  const ids = new Set(['J01']);
  assert.throws(() => assertUniqueScenarioId(ids, 'J01'), /duplicate audit scenario ID/);
});

test('summarizes outcome and coverage independently', () => {
  assert.deepEqual(
    summarizeAuditCases([
      { outcome: 'PASS', coverage: 'COMPLETE' },
      { outcome: 'PASS', coverage: 'PARTIAL' },
      { outcome: 'SKIPPED', coverage: 'UNAVAILABLE' },
      { outcome: 'FAIL', coverage: 'PARTIAL' },
    ]),
    { passed: 2, failed: 1, skipped: 1, complete: 1, partial: 2, unavailable: 1 },
  );
});

test('certification verdicts require complete mandatory evidence', () => {
  const pass = decideCertification([
    { outcome: 'PASS', coverage: 'COMPLETE', note: 'ok', requirement: 'mandatory' },
  ]);
  assert.deepEqual(pass, { verdict: 'PASS', exitCode: 0 });

  const unavailable = decideCertification([
    { outcome: 'SKIPPED', coverage: 'UNAVAILABLE', note: 'no pty', requirement: 'mandatory' },
  ]);
  assert.deepEqual(unavailable, { verdict: 'NOT CERTIFIED', exitCode: 1 });

  const partial = decideCertification([
    { outcome: 'PASS', coverage: 'PARTIAL', note: 'incomplete', requirement: 'mandatory' },
  ]);
  assert.deepEqual(partial, { verdict: 'NOT CERTIFIED', exitCode: 1 });
});

test('observed failures fail certification even when the scenario is optional', () => {
  const result = decideCertification([
    { outcome: 'FAIL', coverage: 'COMPLETE', note: 'broken', requirement: 'optional' },
  ]);
  assert.deepEqual(result, { verdict: 'FAIL', exitCode: 1 });
});

test('non-blocking and blocking findings have distinct release outcomes', () => {
  const findings = decideCertification(
    [{ outcome: 'PASS', coverage: 'COMPLETE', note: 'ok', requirement: 'mandatory' }],
    [{ id: 'F1', severity: 'Low', blocking: false, classification: 'UX', summary: 'wording' }],
  );
  assert.deepEqual(findings, { verdict: 'PASS WITH FINDINGS', exitCode: 1 });

  const blocking = decideCertification(
    [{ outcome: 'PASS', coverage: 'COMPLETE', note: 'ok', requirement: 'mandatory' }],
    [{ id: 'F2', severity: 'High', blocking: true, classification: 'SAFETY', summary: 'unsafe' }],
  );
  assert.deepEqual(blocking, { verdict: 'FAIL', exitCode: 1 });
});
