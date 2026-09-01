import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('canonical terminal catalog contains the required representative matrix', () => {
  const catalog = fs.readFileSync('test/fixtures/terminal-catalog.md', 'utf8');
  for (const label of [
    '80 rich + color',
    '80 rich + NO_COLOR',
    '60 rich',
    '40 rich/minimal',
    '120 rich',
    'ASCII',
    'human-plain',
    '40 pt-BR',
    '60 pt-BR',
    'pt-BR',
    '120 pt-BR',
  ]) {
    assert.match(catalog, new RegExp(`## ${label.replace(/[+]/g, '\\+')}`));
  }
  assert.equal(catalog.includes(String.fromCharCode(27)), false);
  assert.match(catalog, /npx sdd-agentic-flow doctor --json/);
  for (const section of ['Symbols', 'Colors', 'Typography', 'Spacing / Layout'])
    assert.equal(catalog.includes(section), true, `${section} gallery is present`);
  for (const token of [
    'journey.start',
    'status.busy',
    'interactive.disabled',
    'keyboardHint',
    'nested',
  ])
    assert.equal(catalog.includes(token), true, `${token} foundation token is cataloged`);
});
