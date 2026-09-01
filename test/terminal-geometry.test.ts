import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  displayWidth,
  physicalRows,
  stripAnsi,
  truncateDisplayWidth,
  wrapCopyable,
  wrapDisplayWidth,
} from '../src/terminal-geometry';
import { sanitizeTerminalText } from '../src/terminal-safety';

test('terminal geometry ignores ANSI and measures wide characters by cells', () => {
  assert.equal(stripAnsi('\u001b[31mred\u001b[0m'), 'red');
  assert.equal(displayWidth('a界'), 3);
  assert.equal(displayWidth('\u001b[32m界\u001b[0m'), 2);
});

test('terminal geometry wraps and truncates by visible width', () => {
  assert.deepEqual(wrapDisplayWidth('one two three', 7), ['one two', 'three']);
  assert.equal(truncateDisplayWidth('abcdef', 4), 'abc…');
  assert.equal(physicalRows('a界b', 3), 2);
  assert.deepEqual(wrapCopyable('npx sdd-agentic-flow install --target very-long-name', 10), [
    'npx sdd-agentic-flow install --target very-long-name',
  ]);
});

test('terminal sanitization renders controls inert without changing ordinary text', () => {
  assert.equal(
    sanitizeTerminalText('branch\u001b]0;spoof\u0007\nname'),
    'branch\\x1b]0;spoof\\x07\\nname',
  );
});
