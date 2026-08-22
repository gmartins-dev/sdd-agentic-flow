import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  colorEnabled,
  didYouMean,
  doctorFooterLines,
  isRich,
  outputMode,
  styleBrand,
  styleStatus,
  symbol,
  terminalCapabilities,
} from '../src/ui';
import { brandStream, outputStreams } from './helpers';

const ttyPair = outputStreams(true, true);
const pipePair = outputStreams(false, false);

test('colorEnabled requires a real TTY and respects NO_COLOR', () => {
  assert.equal(colorEnabled(brandStream(true), {}), true);
  assert.equal(colorEnabled(brandStream(false), {}), false);
  assert.equal(colorEnabled(undefined, {}), false);
  assert.equal(colorEnabled(brandStream(true), { NO_COLOR: '1' }), false);
  assert.equal(colorEnabled(brandStream(true), { NO_COLOR: '' }), false);
});

test('colorEnabled honors FORCE_COLOR only when the stream is a TTY', () => {
  assert.equal(colorEnabled(brandStream(true), { FORCE_COLOR: '1' }), true);
  assert.equal(colorEnabled(brandStream(false), { FORCE_COLOR: '1' }), false);
  assert.equal(colorEnabled(brandStream(true), { FORCE_COLOR: '0' }), true);
  assert.equal(colorEnabled(brandStream(true), { NO_COLOR: '1', FORCE_COLOR: '1' }), false);
});

test('styleStatus wraps known statuses in ANSI codes only when color is enabled', () => {
  const styled = styleStatus('PASS', brandStream(true), {});
  const esc = String.fromCharCode(27);
  assert.equal(styled, `${esc}[32mPASS${esc}[0m`);
  assert.equal(styleStatus('PASS', brandStream(false), {}), 'PASS');
  assert.equal(styleStatus('PASS', brandStream(true), { NO_COLOR: '1' }), 'PASS');
  assert.equal(styleStatus('PASS', undefined, {}), 'PASS');
});

test('styleStatus returns the raw input unchanged for an unknown status token', () => {
  assert.equal(styleStatus('BOGUS', brandStream(true), {}), 'BOGUS');
});

test('CLI-015: outputMode covers human-rich / human-plain / machine cells', () => {
  assert.equal(outputMode(ttyPair, {}, {}), 'human-rich');
  assert.equal(outputMode(ttyPair, {}, { quiet: true }), 'human-plain');
  assert.equal(outputMode(ttyPair, {}, { ascii: true }), 'human-plain');
  assert.equal(outputMode(ttyPair, { SDD_ASCII: '1' }, {}), 'human-plain');
  assert.equal(outputMode(ttyPair, { NO_COLOR: '1' }, {}), 'human-plain');
  assert.equal(outputMode(ttyPair, {}, { json: true }), 'machine');
  assert.equal(outputMode(ttyPair, { CI: '1' }, {}), 'human-plain');
  assert.equal(outputMode(pipePair, {}, {}), 'human-plain');
  assert.equal(outputMode(pipePair, { CI: '1' }, {}), 'human-plain');
  assert.equal(outputMode(outputStreams(true, false), {}, {}), 'human-plain');
  assert.equal(isRich('human-rich'), true);
  assert.equal(isRich('human-plain'), false);
  assert.equal(isRich('machine'), false);
});

test('CLI-016: terminal capabilities keep raw navigation under NO_COLOR and ASCII', () => {
  const input = { isTTY: true, setRawMode: () => undefined } as never;
  const output = { isTTY: true, columns: 100 } as never;
  const noColor = terminalCapabilities({ stdin: input, stdout: output }, { NO_COLOR: '1' });
  assert.equal(noColor.interactive, true);
  assert.equal(noColor.rawInput, true);
  assert.equal(noColor.cursor, true);
  assert.equal(noColor.color, false);
  const dumb = terminalCapabilities({ stdin: input, stdout: output }, { TERM: 'dumb' });
  assert.equal(dumb.cursor, false);
  assert.equal(dumb.rawInput, true);
});

test('CLI-012: symbols are ASCII outside human-rich; welcome brand is the full embedded art', () => {
  assert.equal(symbol('success', 'human-rich'), '✓');
  assert.equal(symbol('brand', 'human-rich'), '›››');
  assert.equal(symbol('next', 'human-rich'), '→');
  assert.equal(symbol('success', 'human-plain'), 'OK');
  assert.equal(symbol('brand', 'human-plain'), '>>>');
  assert.equal(symbol('next', 'machine'), '->');
  assert.equal(symbol('warn', 'human-rich'), '!');
  assert.equal(symbol('fail', 'human-rich'), '✗');
  assert.equal(symbol('unknown' as 'success', 'human-rich'), '');
  // styleBrand = full block for welcome (not the one-line ›››).
  assert.match(styleBrand('human-plain', brandStream(true), {}), /#{2,}/);
  assert.match(styleBrand('human-rich', brandStream(true), { NO_COLOR: '1' }), /▓/);
  const colored = styleBrand('human-rich', brandStream(true), {});
  const esc = String.fromCharCode(27);
  assert.ok(colored.includes(`${esc}[38;2;75;62;168m`));
  assert.ok(colored.includes(`${esc}[38;2;139;125;255m`));
  assert.equal(styleBrand('machine', brandStream(true), {}), '');
});

test('doctorFooterLines covers Fix/Next rules for human-rich footer content', () => {
  assert.deepEqual(
    doctorFooterLines([
      { name: 'config', status: 'WARN', message: '.sdd-agentic-flow/config.yml not found' },
      { name: 'project_context', status: 'WARN', message: 'project-context.md not found' },
    ]),
    ['Fix: npx sdd-agentic-flow init', 'Fix: npx sdd-agentic-flow context refresh'],
  );
  assert.deepEqual(
    doctorFooterLines([
      {
        name: 'project_context',
        status: 'WARN',
        message: 'found (repository has changed since generation)',
      },
    ]),
    ['Fix: npx sdd-agentic-flow context refresh'],
  );
  assert.deepEqual(doctorFooterLines([{ name: 'safety', status: 'PASS', message: 'ok' }]), [
    'Next: use your coding agent with the installed SDD workflow',
    'Next: npx sdd-agentic-flow doctor',
  ]);
  assert.deepEqual(doctorFooterLines([{ name: 'skills', status: 'WARN', message: 'missing' }]), []);
});

test('didYouMean returns the closest known candidate for a small typo', () => {
  const candidates = [
    'list',
    'init',
    'context',
    'context',
    'install',
    'doctor',
    'uninstall',
    'help',
    'version',
  ];
  assert.equal(didYouMean('doctro', candidates), 'doctor');
  assert.equal(didYouMean('unintsall', candidates), 'uninstall');
  assert.equal(didYouMean('ful', ['full', 'planning', 'review']), 'full');
});

test('didYouMean returns null when nothing is close enough, or for empty input', () => {
  const candidates = [
    'list',
    'init',
    'context',
    'context',
    'install',
    'doctor',
    'uninstall',
    'help',
    'version',
  ];
  assert.equal(didYouMean('xyzzyplugh', candidates), null);
  assert.equal(didYouMean('', candidates), null);
  assert.equal(didYouMean(null, candidates), null);
  assert.equal(didYouMean('init', []), null);
  assert.equal(didYouMean('init', null as unknown as string[]), null);
});
