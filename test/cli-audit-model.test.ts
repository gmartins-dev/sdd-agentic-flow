import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertUniqueScenarioId,
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
