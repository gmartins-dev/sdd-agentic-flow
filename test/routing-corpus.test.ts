import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import { validateEvalCorpus } from '../scripts/check-skill-contracts';

const corpus = JSON.parse(fs.readFileSync('shared/evals/evals.json', 'utf8')) as Record<
  string,
  unknown
>;

function copyCorpus(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(corpus)) as Record<string, unknown>;
}

test('routing corpus validates its fixtures, routes, authorities, and preserved mode', () => {
  assert.deepEqual(validateEvalCorpus(corpus), []);
});

test('routing corpus rejects invalid structural references', () => {
  const invalid = copyCorpus();
  const cases = invalid.routing_cases as Array<Record<string, unknown>>;
  cases[0]!.fixture = 'missing-fixture';
  cases[1]!.expected_route = 'effective-defaults';
  cases[2]!.expected_skill = 'unknown-skill';
  cases[3]!.authority_ref = 'shared/references/workflow-routing.md#missing';
  cases[4]!.expected_skill = 'saf-implement';
  cases[5]!.id = cases[0]!.id;
  cases[0]!.expected_mode = 'changed';
  const failures = validateEvalCorpus(invalid);
  assert.ok(failures.some((failure) => failure.includes('unknown fixture')));
  assert.ok(failures.some((failure) => failure.includes('invalid expected_route')));
  assert.ok(failures.some((failure) => failure.includes('official expected_skill')));
  assert.ok(failures.some((failure) => failure.includes('unapproved authority_ref')));
  assert.ok(failures.some((failure) => failure.includes('must not declare expected_skill')));
  assert.ok(failures.some((failure) => failure.includes('duplicate routing case id')));
  assert.ok(failures.some((failure) => failure.includes('expected_mode must remain')));
});

test('routing corpus rejects missing required fields and cases', () => {
  const invalid = copyCorpus();
  const cases = invalid.routing_cases as Array<Record<string, unknown>>;
  const fixtures = invalid.routing_fixtures as Array<Record<string, unknown>>;
  delete cases[1]!.expected_skill;
  delete cases[2]!.authority_ref;
  cases.splice(8, 1);
  fixtures[0]!.id = 'renamed-fixture';
  const failures = validateEvalCorpus(invalid);
  assert.ok(failures.some((failure) => failure.includes('requires an official expected_skill')));
  assert.ok(failures.some((failure) => failure.includes('missing authority_ref')));
  assert.ok(failures.some((failure) => failure.includes('missing required routing case')));
  assert.ok(failures.some((failure) => failure.includes('missing required fixture')));
});

test('routing corpus rejects a removed authority heading', () => {
  const failures = validateEvalCorpus(corpus, '/tmp/nonexistent-saf-root');
  assert.ok(failures.some((failure) => failure.includes('authority file missing')));
});
