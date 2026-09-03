import assert from 'node:assert/strict';
import { test } from 'node:test';

import { terminalLog, terminalNext, terminalNote, terminalWelcome } from '../src/terminal-ui';

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

test('terminal welcome composes centered rich branding and localized text', async () => {
  const priorNoColor = process.env.NO_COLOR;
  const priorAnimation = process.env.SDD_BRAND_ANIMATE;
  process.env.NO_COLOR = '1';
  process.env.SDD_BRAND_ANIMATE = '0';
  const stream = output();
  stream.isTTY = true;
  stream.columns = 80;
  try {
    await terminalWelcome('pt-BR', { mode: 'human-rich', output: stream });
    assert.match(stream.text(), /SDD-AGENTIC-FLOW \(SAF\)/);
    assert.match(
      stream.text(),
      /Specs primeiro\. Evidências antes de concluir\. Você mantém o controle\./,
    );
    assert.match(stream.text(), new RegExp(`${String.fromCharCode(27)}\\[3m`));
    assert.doesNotMatch(stream.text(), /38(?:;|m)/);
    assert.match(stream.text(), /^ {45}█/m);
  } finally {
    if (priorNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = priorNoColor;
    if (priorAnimation === undefined) delete process.env.SDD_BRAND_ANIMATE;
    else process.env.SDD_BRAND_ANIMATE = priorAnimation;
  }
});

test('terminal welcome keeps plain output left-aligned and version-free', async () => {
  const stream = output();
  await terminalWelcome('en-US', { mode: 'human-plain', output: stream });
  assert.match(stream.text(), /^SDD-AGENTIC-FLOW \(SAF\)/);
  assert.match(stream.text(), /Specs first\. Evidence before done\. You stay in control\.\n\n$/);
  assert.doesNotMatch(stream.text(), /^\s+SDD-AGENTIC-FLOW/m);
  assert.doesNotMatch(stream.text(), /sdd-agentic-flow 7\.9\.1/);
  assert.doesNotMatch(stream.text(), new RegExp(String.fromCharCode(27)));
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
