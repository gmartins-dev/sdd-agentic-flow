'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { colorEnabled, styleStatus, didYouMean } = require('../bin/ui');

test('colorEnabled requires a real TTY and respects NO_COLOR', () => {
  assert.equal(colorEnabled({ isTTY: true }, {}), true);
  assert.equal(colorEnabled({ isTTY: false }, {}), false);
  assert.equal(colorEnabled(undefined, {}), false);
  assert.equal(colorEnabled({ isTTY: true }, { NO_COLOR: '1' }), false);
  assert.equal(colorEnabled({ isTTY: true }, { NO_COLOR: '' }), false);
});

test('styleStatus wraps known statuses in ANSI codes only when color is enabled', () => {
  const styled = styleStatus('PASS', { isTTY: true }, {});
  const esc = String.fromCharCode(27);
  assert.equal(styled, `${esc}[32mPASS${esc}[0m`);
  assert.equal(styleStatus('PASS', { isTTY: false }, {}), 'PASS');
  assert.equal(styleStatus('PASS', { isTTY: true }, { NO_COLOR: '1' }), 'PASS');
  assert.equal(styleStatus('PASS', undefined, {}), 'PASS');
});

test('styleStatus returns the raw input unchanged for an unknown status token', () => {
  assert.equal(styleStatus('BOGUS', { isTTY: true }, {}), 'BOGUS');
});

test('didYouMean returns the closest known candidate for a small typo', () => {
  const candidates = [
    'list',
    'init',
    'discover',
    'context',
    'install',
    'doctor',
    'uninstall',
    'help',
    'version',
  ];
  assert.equal(didYouMean('doctro', candidates), 'doctor');
  assert.equal(didYouMean('unintsall', candidates), 'uninstall');
  assert.equal(didYouMean('cor', ['core', 'planning', 'pr']), 'core');
});

test('didYouMean returns null when nothing is close enough, or for empty input', () => {
  const candidates = [
    'list',
    'init',
    'discover',
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
  assert.equal(didYouMean('init', null), null);
});
