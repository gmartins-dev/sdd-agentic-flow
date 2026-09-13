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

test('routing corpus rejects a removed required continuity behavior', () => {
  const invalid = copyCorpus();
  invalid.behavior_cases = (invalid.behavior_cases as Array<Record<string, unknown>>).filter(
    (item) => item.id !== 'handoff-v8-current-successor',
  );
  assert.ok(
    validateEvalCorpus(invalid).some((failure) =>
      failure.includes('missing required behavior handoff-v8-current-successor'),
    ),
  );
});

test('routing corpus rejects a removed authority heading', () => {
  const failures = validateEvalCorpus(corpus, '/tmp/nonexistent-saf-root');
  assert.ok(failures.some((failure) => failure.includes('authority file missing')));
});

test('routing corpus permits added fixtures but requires positive and negative Skill coverage', () => {
  const expanded = copyCorpus();
  (expanded.routing_fixtures as unknown[]).push({
    id: 'additional',
    description: 'Another bounded input.',
  });
  assert.deepEqual(validateEvalCorpus(expanded), []);
  expanded.routing_cases = (expanded.routing_cases as Array<Record<string, unknown>>).filter(
    (item) => item.expected_skill !== 'saf-explain',
  );
  assert.ok(
    validateEvalCorpus(expanded).some((failure) =>
      failure.includes('missing positive route for saf-explain'),
    ),
  );
  const invalid = copyCorpus();
  for (const item of invalid.routing_cases as Array<Record<string, unknown>>)
    delete item.rejected_skills;
  assert.ok(
    validateEvalCorpus(invalid).some((failure) => failure.includes('missing negative route')),
  );
});

test('routing and narrative examples reject contradictions, missing gates, and malformed records', () => {
  const invalid = copyCorpus();
  const cases = invalid.routing_cases as Array<Record<string, unknown>>;
  cases[0]!.rejected_skills = [cases[0]!.expected_skill, 'unknown'];
  delete cases.find((item) => item.expected_route === 'human-gate')!.gate_reason;
  cases[1]!.authority_ref = '__proto__';
  const behavior = invalid.behavior_cases as Array<Record<string, unknown>>;
  delete behavior[0]!.input;
  behavior[1]!.id = behavior[0]!.id;
  (invalid.prompt_cases as unknown[]).push(null, []);
  const errors = validateEvalCorpus(invalid);
  for (const message of [
    'invalid rejected skill',
    'missing gate_reason',
    'unapproved authority_ref',
    'missing input',
    'duplicate behavior_cases',
    'non-record',
  ])
    assert.ok(
      errors.some((error) => error.includes(message)),
      message,
    );
});

function reviewRounds(value: Record<string, unknown>): Array<Record<string, unknown>> {
  return (value.review_examples as Array<Record<string, unknown>>)[0]!.rounds as Array<
    Record<string, unknown>
  >;
}

test('review examples reject lost carry-over and missing resolution tables', () => {
  const invalid = copyCorpus();
  const round = reviewRounds(invalid)[1]!;
  (round.findings as unknown[]).shift();
  (round.resolution as unknown[]).shift();
  assert.ok(validateEvalCorpus(invalid).some((error) => error.includes('omitted carry-over F001')));
  delete round.resolution;
  assert.ok(
    validateEvalCorpus(invalid).some((error) =>
      error.includes('resolution table must be an array'),
    ),
  );
});

test('review examples reject invalid evidence, duplicate IDs and inconsistent resolution', () => {
  const invalid = copyCorpus();
  const rounds = reviewRounds(invalid);
  const findings = rounds[0]!.findings as Array<Record<string, unknown>>;
  findings[1]!.finding_id = findings[0]!.finding_id;
  delete findings[0]!.location;
  (findings[0]!.evidence as Array<Record<string, unknown>>)[0]!.type = 'self-report';
  const resolution = rounds[1]!.resolution as Array<Record<string, unknown>>;
  resolution[0]!.current_state = 'confirmed';
  rounds[1]!.previous = 'unrelated/1';
  const errors = validateEvalCorpus(invalid);
  for (const message of [
    'duplicate finding_id',
    'missing location',
    'invalid evidence type',
    'resolution state mismatch',
    'invalid previous review reference',
  ])
    assert.ok(
      errors.some((error) => error.includes(message)),
      message,
    );
});

test('review examples accept supported states with matching resolution entries', () => {
  for (const state of [
    'confirmed',
    'not-reproduced',
    'evidence-gap',
    'spec-conflict',
    'human-judgment',
    'resolved',
    'deferred',
  ]) {
    const variant = copyCorpus();
    const round = reviewRounds(variant)[1]!;
    (round.findings as Array<Record<string, unknown>>)[0]!.state = state;
    (round.resolution as Array<Record<string, unknown>>)[0]!.current_state = state;
    assert.deepEqual(validateEvalCorpus(variant), [], state);
  }
  const invalid = copyCorpus();
  reviewRounds(invalid)[1]!.findings = null;
  assert.ok(
    validateEvalCorpus(invalid).some((error) => error.includes('findings must be an array')),
  );
});

test('routing boundaries remain covered even when each Skill still has other examples', () => {
  const invalid = copyCorpus();
  for (const item of invalid.routing_cases as Array<Record<string, unknown>>)
    if (item.expected_skill === 'saf-create-pr') item.rejected_skills = ['saf-implement'];
  assert.ok(
    validateEvalCorpus(invalid).some((error) =>
      error.includes('missing boundary saf-create-pr instead of saf-review-pr'),
    ),
  );
});

test('review IDs allocate sequentially across rounds without requiring row order', () => {
  const reordered = copyCorpus();
  for (const round of reviewRounds(reordered)) (round.findings as unknown[]).reverse();
  assert.deepEqual(validateEvalCorpus(reordered), []);
  for (const replacement of ['F000', 'F009']) {
    const invalid = copyCorpus();
    for (const round of reviewRounds(invalid))
      for (const entry of [
        ...(round.findings as Array<Record<string, unknown>>),
        ...((round.resolution as Array<Record<string, unknown>>) ?? []),
      ])
        if (entry.finding_id === 'F001') entry.finding_id = replacement;
    assert.ok(
      validateEvalCorpus(invalid).some((error) => error.includes('nonsequential finding_id')),
    );
  }
});
