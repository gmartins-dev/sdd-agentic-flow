'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PassThrough, Readable } = require('node:stream');
const { resolveOnboardingState } = require('../bin/onboarding');
const { resolveSelection, select } = require('../bin/selector');

test('onboarding state is derived from setup artifacts', () => {
  assert.equal(resolveOnboardingState(), 'FIRST_USE');
  assert.equal(resolveOnboardingState({ hasSkills: true }), 'NEW_PROJECT');
  assert.equal(resolveOnboardingState({ hasConfig: true }), 'PARTIAL');
  assert.equal(
    resolveOnboardingState({
      hasConfig: true,
      hasSkills: true,
      hasContext: true,
      doctorStatus: 'PASS',
    }),
    'READY',
  );
  assert.equal(
    resolveOnboardingState({
      hasConfig: true,
      hasSkills: true,
      hasContext: true,
      doctorStatus: 'FAIL',
    }),
    'NEEDS_ATTENTION',
  );
  assert.equal(
    resolveOnboardingState({
      hasConfig: true,
      hasSkills: true,
      hasContext: true,
      doctorStatus: 'WARN',
    }),
    'NEEDS_ATTENTION',
  );
});

test('selector honors defaults, numbers, multi-select, and cancellation', () => {
  const options = [{ value: 'one' }, { value: 'two' }];
  assert.deepEqual(resolveSelection('', options), { value: 'one' });
  assert.deepEqual(resolveSelection('2', options), { value: 'two' });
  assert.deepEqual(resolveSelection('\u001b', options), { cancelled: true });
  assert.deepEqual(resolveSelection('2', options, ['one'], true), {
    value: ['one', 'two'],
    pending: true,
  });
  assert.deepEqual(resolveSelection('', options, ['one', 'two'], true), { value: ['one', 'two'] });
});

test('selector falls back to numbered input when a TTY cannot enter raw mode', async () => {
  const input = Readable.from(['\n']);
  input.isTTY = true;
  const output = new PassThrough();
  output.isTTY = true;
  const selected = await select('Choose', [{ value: 'default', label: 'Default' }], {
    input,
    output,
  });
  assert.deepEqual(selected, { value: 'default' });
  assert.match(output.read().toString(), /1-9 selects/);
});
