import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ansiColor,
  BREAKPOINTS,
  COLORS,
  SAF_ASCII_GLYPHS,
  SAF_THEME,
  SPACING,
  symbol,
  TERMINAL_GLYPHS,
  TYPOGRAPHY,
} from '../src/terminal-theme';

const structuralGroups = ['journey', 'stage', 'status', 'selection', 'navigation'] as const;

test('terminal theme provides safe rich and ASCII values for every semantic token', () => {
  for (const group of structuralGroups) {
    for (const [name, token] of Object.entries(TERMINAL_GLYPHS[group])) {
      assert.ok(token.rich, `${group}.${name} rich token is present`);
      assert.match(token.ascii, /^[\x20-\x7E]+$/, `${group}.${name} ASCII fallback is printable`);
      assert.doesNotMatch(
        token.rich,
        /(?:\uFE0E|\uFE0F|\u200D|[\uE000-\uF8FF]|[\u{F0000}-\u{FFFFD}]|[\u{100000}-\u{10FFFD}])/u,
      );
      assert.equal([...token.rich].length, 1, `${group}.${name} is one code point`);
    }
  }
  assert.equal(symbol('success', 'human-rich'), '✓');
  assert.equal(symbol('success', 'human-plain'), 'OK');
  assert.equal(SAF_ASCII_GLYPHS.checkboxSelected, '[x]');
  assert.equal(SAF_ASCII_GLYPHS.radioFocused, '(*)');
  assert.equal(SAF_ASCII_GLYPHS.checkboxFocused, '[*]');
  assert.equal(SAF_ASCII_GLYPHS.pointerActive, '>');
  assert.deepEqual(Object.keys(TERMINAL_GLYPHS.selection), [
    'radioFocused',
    'radioSelected',
    'radioUnselected',
    'checkboxFocused',
    'checkboxSelected',
    'checkboxUnselected',
  ]);
});

test('terminal theme exposes four complete declarative foundations', () => {
  assert.equal(SAF_THEME.colors, COLORS);
  assert.equal(SAF_THEME.typography, TYPOGRAPHY);
  assert.equal(SAF_THEME.spacing, SPACING);
  assert.equal(SAF_THEME.breakpoints, BREAKPOINTS);
  assert.equal(SPACING.contentWidth, 72);
  assert.deepEqual(BREAKPOINTS, { wide: 80, compact: 60, stacked: 40, narrow: 40 });
  for (const group of Object.values(COLORS)) {
    for (const token of Object.values(group)) {
      assert.match(token.truecolor, /^(#[0-9A-Fa-f]{6}|)$/);
      assert.ok(Number.isInteger(token.ansi256));
      assert.ok(Number.isInteger(token.ansi16));
    }
  }
  assert.equal(ansiColor(COLORS.status.success, 'truecolor'), '38;2;101;211;154');
  assert.equal(ansiColor(COLORS.status.success, 'ansi256'), '38;5;78');
  assert.equal(ansiColor(COLORS.status.success, 'ansi16'), '32');
  assert.deepEqual(Object.keys(TYPOGRAPHY), [
    'display',
    'title',
    'section',
    'body',
    'value',
    'supporting',
    'command',
    'path',
    'keyboardHint',
    'tagline',
  ]);
});

test('brand lockup remains a brand-only multi-code-point exception', () => {
  assert.equal(TERMINAL_GLYPHS.brand.lockup.rich, '›  ››  ›››');
  assert.equal(TERMINAL_GLYPHS.brand.chevron.rich, '›');
});
