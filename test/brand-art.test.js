'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  formatBrandArt,
  writeBrandArt,
  shouldAnimateBrandArt,
  brandArtLineCount,
  BRAND_ART_RICH,
  BRAND_ART_ASCII,
} = require('../bin/brand-art');

test('brand art is embedded as three chevron bands', () => {
  assert.equal(BRAND_ART_RICH.length, 3);
  assert.equal(BRAND_ART_ASCII.length, 3);
  assert.equal(brandArtLineCount('human-rich'), 38);
  assert.equal(brandArtLineCount('human-plain'), 38);
  assert.equal(brandArtLineCount('machine'), 0);
});

test('formatBrandArt is empty in machine mode and full otherwise', () => {
  assert.equal(formatBrandArt('machine', { isTTY: true }, {}), '');

  const esc = String.fromCharCode(27);
  const plain = formatBrandArt('human-plain', { isTTY: true }, {});
  assert.match(plain, /#{2,}/);
  assert.match(plain, /\+{2,}/);
  assert.match(plain, /={2,}/);
  assert.ok(!plain.includes(esc));
  assert.equal(plain.endsWith('\n'), true);

  const rich = formatBrandArt('human-rich', { isTTY: true }, {});
  assert.match(rich, /▓/);
  assert.match(rich, /▒/);
  assert.ok(rich.includes(`${esc}[38;2;75;62;168m`));
  assert.ok(rich.includes(`${esc}[38;2;139;125;255m`));

  const noColor = formatBrandArt('human-rich', { isTTY: true }, { NO_COLOR: '1' });
  assert.match(noColor, /▓/);
  assert.ok(!noColor.includes(esc));
});

test('shouldAnimateBrandArt only for human-rich TTY without CI/quiet', () => {
  const tty = { isTTY: true };
  assert.equal(shouldAnimateBrandArt('human-rich', tty, {}), true);
  assert.equal(shouldAnimateBrandArt('human-plain', tty, {}), false);
  assert.equal(shouldAnimateBrandArt('machine', tty, {}), false);
  assert.equal(shouldAnimateBrandArt('human-rich', { isTTY: false }, {}), false);
  assert.equal(shouldAnimateBrandArt('human-rich', tty, { CI: '1' }), false);
  assert.equal(shouldAnimateBrandArt('human-rich', tty, {}, { quiet: true }), false);
  assert.equal(shouldAnimateBrandArt('human-rich', tty, { SDD_BRAND_ANIMATE: '0' }), false);
  assert.equal(shouldAnimateBrandArt('human-rich', tty, {}, { animate: false }), false);
});

test('writeBrandArt animates left-to-right on rich TTY and is instant otherwise', async () => {
  const esc = String.fromCharCode(27);
  const chunks = [];
  const stream = {
    isTTY: true,
    write(chunk) {
      chunks.push(String(chunk));
      return true;
    },
  };

  await writeBrandArt('human-rich', stream, { NO_COLOR: '1' }, { delayMs: 0 });
  const out = chunks.join('');
  assert.match(out, /▓/);
  assert.match(out, /▒/);
  // Two cursor-up rewrites between the three band frames (38 art lines).
  assert.equal((out.match(new RegExp(`${esc}\\[38A`, 'g')) || []).length, 2);

  chunks.length = 0;
  await writeBrandArt('human-plain', stream, {}, { delayMs: 0 });
  const plain = chunks.join('');
  assert.match(plain, /#{2,}/);
  assert.equal(plain.includes(`${esc}[38A`), false);

  chunks.length = 0;
  await writeBrandArt('machine', stream, {}, {});
  assert.equal(chunks.join(''), '');
});
