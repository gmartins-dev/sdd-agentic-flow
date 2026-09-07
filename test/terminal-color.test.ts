import assert from 'node:assert/strict';
import test from 'node:test';
import { colorEnabled, detectColorDepth } from '../src/terminal-color';

const tty = { isTTY: true };
const pipe = { isTTY: false };

test('terminal color precedence detects trustworthy truecolor markers', () => {
  const cases: Array<[string, NodeJS.ProcessEnv, string]> = [
    ['COLORTERM truecolor', { COLORTERM: ' TRUECOLOR ' }, 'truecolor'],
    ['COLORTERM 24bit', { COLORTERM: '24BIT' }, 'truecolor'],
    ['TERM truecolor', { TERM: 'xterm-truecolor' }, 'truecolor'],
    ['TERM 24bit', { TERM: 'xterm-24bit' }, 'truecolor'],
    ['WT_SESSION', { WT_SESSION: ' session-id ' }, 'truecolor'],
    ['Windows Terminal', { TERM_PROGRAM: ' Windows-Terminal ' }, 'truecolor'],
    ['256 color', { TERM: 'xterm-256color' }, 'ansi256'],
    ['fallback', { TERM: 'xterm' }, 'ansi16'],
  ];
  for (const [label, env, expected] of cases)
    assert.equal(detectColorDepth(tty, env), expected, label);
});

test('NO_COLOR and non-TTY win over every capability marker', () => {
  assert.equal(colorEnabled(pipe, { WT_SESSION: 'id', COLORTERM: 'truecolor' }), false);
  assert.equal(detectColorDepth(pipe, { WT_SESSION: 'id', COLORTERM: 'truecolor' }), 'none');
  assert.equal(detectColorDepth(tty, { NO_COLOR: '', WT_SESSION: 'id' }), 'none');
  assert.equal(detectColorDepth(tty, { WT_SESSION: '   ' }), 'ansi16');
  assert.equal(detectColorDepth(tty, { FORCE_COLOR: '0', WT_SESSION: 'id' }), 'truecolor');
});
