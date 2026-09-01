import assert from 'node:assert/strict';
import { test } from 'node:test';

import { terminalLog, terminalNext, terminalNote } from '../src/terminal-ui';

function output() {
  let value = '';
  return {
    isTTY: false,
    write(chunk: string) {
      value += chunk;
      return true;
    },
    text: () => value,
  } as unknown as NodeJS.WriteStream & { text: () => string };
}

test('terminal UI keeps plain output deterministic and inert', () => {
  const stream = output();
  terminalLog('PASS', 'done\u001b[31m', { output: stream });
  terminalNote('Summary', [['Path', '/tmp/demo\nunsafe']], { output: stream });
  assert.equal(stream.text(), 'PASS done\\x1b[31m\nSummary\nPath\n/tmp/demo\nunsafe\n');
});

test('terminal UI preserves note structure while keeping controls inert', () => {
  const stream = output();
  terminalNote('Summary\u001b[31m', [['Operations', 'first\nsecond\u001b[31m']], {
    output: stream,
  });
  assert.equal(stream.text(), 'Summary\\x1b[31m\nOperations\nfirst\nsecond\\x1b[31m\n');
});

test('rich notes preserve intentional line breaks', () => {
  const stream = output();
  terminalNote('Summary', [['Operations', 'first\nsecond']], {
    mode: 'human-rich',
    output: stream,
  });
  assert.match(stream.text(), /first/);
  assert.match(stream.text(), /second/);
  assert.doesNotMatch(stream.text(), /first\\nsecond/);
});

test('rich status and notes use the SAF structural renderer', () => {
  const stream = output();
  stream.isTTY = true;
  terminalLog('PASS', 'done', { mode: 'human-rich', output: stream });
  terminalNote('Summary', [['Status', 'ready']], { mode: 'human-rich', output: stream });
  assert.match(stream.text(), /✓/);
  assert.match(stream.text(), /┌/);
  assert.doesNotMatch(stream.text(), /[✔✖]/);
});

test('rich notes honor NO_COLOR instead of forcing ANSI', () => {
  const prior = process.env.NO_COLOR;
  process.env.NO_COLOR = '1';
  const stream = output();
  stream.isTTY = true;
  try {
    terminalNote('Summary', [['Status', 'ready']], { mode: 'human-rich', output: stream });
    assert.equal(stream.text().includes(String.fromCharCode(27)), false);
  } finally {
    if (prior === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = prior;
  }
});

test('terminal UI does not leak presentation into machine mode', () => {
  const stream = output();
  terminalLog('PASS', 'done', { mode: 'machine', output: stream });
  terminalNote('Summary', [['key', 'value']], { mode: 'machine', output: stream });
  assert.equal(stream.text(), '');
});

test('terminal next action keeps rich structure and deterministic plain output', () => {
  const stream = output();
  terminalNext(['npx sdd-agentic-flow doctor', 'review the result'], {
    output: stream,
    title: 'Next action',
  });
  assert.equal(
    stream.text(),
    '\nNext action\n  npx sdd-agentic-flow doctor\n  review the result\n',
  );
});
