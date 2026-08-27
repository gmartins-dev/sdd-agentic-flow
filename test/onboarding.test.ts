// Stream/TTL mocking for selector tests is intentionally loose; behavior is covered at runtime.
// @ts-nocheck
import assert from 'node:assert/strict';
import { PassThrough, Readable } from 'node:stream';
import { test } from 'node:test';

import { resolveOnboardingState } from '../src/onboarding';
import { resolveSelection, select } from '../src/selector';

// Simulated raw-capable fixtures are intentionally not TERM=dumb; TERM=dumb is
// a documented numbered-readline mode in the v5 terminal contract.
process.env.TERM = 'xterm';
// Raw-selector cases intentionally simulate a real interactive TTY even when
// the test runner exports CI=1; production still disables raw interaction in CI.
process.env.CI = '';

function setTty(stream) {
  Object.defineProperty(stream, 'isTTY', { value: true, configurable: true });
  return stream;
}

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
  assert.deepEqual(resolveSelection('q', options, null, false, ['q', '0']), { cancelled: true });
  assert.deepEqual(resolveSelection('2', options, ['one'], true), {
    value: ['one', 'two'],
    pending: true,
  });
  assert.deepEqual(resolveSelection('', options, ['one', 'two'], true), { value: ['one', 'two'] });
});

test('multi-select navigation actions are not toggleable values', () => {
  const options = [
    { value: 'agents', label: 'Agents', selected: true },
    { value: 'back', label: 'Back', action: true },
  ];
  assert.deepEqual(resolveSelection('2', options, ['agents'], true), { value: 'back' });
});

test('selector falls back to numbered input when a TTY cannot enter raw mode', async () => {
  const input = Readable.from(['\n']);
  setTty(input);
  const output = setTty(new PassThrough());
  const selected = await select('Choose', [{ value: 'default', label: 'Default' }], {
    input,
    output,
  });
  assert.deepEqual(selected, { value: 'default' });
  assert.match(output.read().toString(), /Enter selects the default; 1-9 selects; q\/0 cancels/);
});

test('NO_COLOR keeps the complete numbered selector without ANSI output', async () => {
  const prior = process.env.NO_COLOR;
  const priorTerm = process.env.TERM;
  process.env.NO_COLOR = '1';
  process.env.TERM = 'dumb';
  const input = Readable.from(['2\n']);
  setTty(input);
  input.setRawMode = () => {};
  const output = setTty(new PassThrough());
  try {
    const result = await select(
      'Choose',
      [
        { value: 'one', label: 'One' },
        { value: 'two', label: 'Two' },
      ],
      { input, output, locale: 'en-US' },
    );
    assert.deepEqual(result, { value: 'two' });
    assert.equal(output.read().toString().includes(String.fromCharCode(27)), false);
  } finally {
    if (prior === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = prior;
    if (priorTerm === undefined) delete process.env.TERM;
    else process.env.TERM = priorTerm;
  }
});

test('raw selector redraws the active option before Enter commits it', async () => {
  const noColor = process.env.NO_COLOR;
  delete process.env.NO_COLOR;
  const input = new PassThrough();
  setTty(input);
  input.isRaw = false;
  input.setRawMode = (value) => {
    input.isRaw = value;
  };
  const output = setTty(new PassThrough());

  try {
    const pending = select(
      'Choose',
      [
        { value: 'one', label: 'One' },
        { value: 'two', label: 'Two' },
      ],
      { input, output },
    );
    await new Promise((resolve) => setImmediate(resolve));
    input.write('\u001b[B\r');

    assert.deepEqual(await pending, { value: 'two' });
    const rendered = [output.read(), output.read()].filter(Boolean).join('');
    assert.match(rendered, /> 2\. Two/);
  } finally {
    if (noColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = noColor;
  }
});

test('raw multi-select numbers toggle the numbered value before Enter confirms', async () => {
  const input = new PassThrough();
  setTty(input);
  input.isRaw = false;
  input.setRawMode = (value) => {
    input.isRaw = value;
  };
  const output = setTty(new PassThrough());
  const pending = select(
    'Choose',
    [
      { value: 'one', label: 'One' },
      { value: 'two', label: 'Two' },
    ],
    { input, output, multiple: true },
  );
  await new Promise((resolve) => setImmediate(resolve));
  input.emit('keypress', '2', { name: '2' });
  input.emit('keypress', '\r', { name: 'return' });
  assert.deepEqual(await pending, { value: ['two'] });
});

test('raw selector accepts configured menu exits', async () => {
  const noColor = process.env.NO_COLOR;
  delete process.env.NO_COLOR;
  const input = new PassThrough();
  setTty(input);
  input.isRaw = false;
  input.setRawMode = (value) => {
    input.isRaw = value;
  };
  const output = setTty(new PassThrough());
  try {
    const pending = select('Choose', [{ value: 'one', label: 'One' }], {
      input,
      output,
      cancelValues: ['q', '0'],
    });
    await new Promise((resolve) => setImmediate(resolve));
    input.emit('keypress', 'q', { name: 'q' });
    assert.deepEqual(await pending, { cancelled: true });
  } finally {
    if (noColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = noColor;
  }
});

test('raw selector treats Ctrl+C as cancellation and restores raw mode', async () => {
  const noColor = process.env.NO_COLOR;
  delete process.env.NO_COLOR;
  const input = new PassThrough();
  setTty(input);
  input.isRaw = false;
  input.setRawMode = (value) => {
    input.isRaw = value;
  };
  const output = setTty(new PassThrough());
  try {
    const pending = select('Choose', [{ value: 'one', label: 'One' }], { input, output });
    await new Promise((resolve) => setImmediate(resolve));
    input.emit('keypress', '\u0003', { ctrl: true, name: 'c' });
    assert.deepEqual(await pending, { cancelled: true });
    assert.equal(input.isRaw, false);
  } finally {
    if (noColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = noColor;
  }
});

test('raw selector cancels on EOF and ignores terminal resize without changing selection', async () => {
  const noColor = process.env.NO_COLOR;
  delete process.env.NO_COLOR;
  const input = new PassThrough();
  setTty(input);
  input.isRaw = false;
  input.setRawMode = (value) => {
    input.isRaw = value;
  };
  const output = setTty(new PassThrough());
  try {
    const selected = select(
      'Choose',
      [
        { value: 'one', label: 'One' },
        { value: 'two', label: 'Two' },
      ],
      { input, output },
    );
    await new Promise((resolve) => setImmediate(resolve));
    output.emit('resize');
    input.emit('keypress', '', { name: 'down' });
    input.emit('keypress', '', { name: 'return' });
    assert.deepEqual(await selected, { value: 'two' });

    const eof = new PassThrough();
    setTty(eof);
    eof.isRaw = false;
    eof.setRawMode = () => {};
    const pending = select('Choose', [{ value: 'one', label: 'One' }], { input: eof, output });
    await new Promise((resolve) => setImmediate(resolve));
    eof.end();
    assert.deepEqual(await pending, { cancelled: true });
  } finally {
    if (noColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = noColor;
  }
});
