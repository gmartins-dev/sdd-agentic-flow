import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BRAND_ART_ASCII,
  BRAND_ART_RICH,
  brandArtFitsTerminal,
  brandArtLineCount,
  brandArtWidth,
  formatBrandArt,
  formatOneLineBrand,
  MAX_ART_WIDTH,
  shouldAnimateBrandArt,
  writeBrandArt,
} from '../src/brand-art';
import { asBrandStream, brandStream } from './helpers';

test('brand art is a compact three-chevron mark', () => {
  assert.equal(BRAND_ART_RICH.length, 3);
  assert.equal(BRAND_ART_ASCII.length, 3);
  const richLines = brandArtLineCount('human-rich');
  const plainLines = brandArtLineCount('human-plain');
  assert.ok(richLines >= 8 && richLines <= 10);
  assert.equal(plainLines, richLines);
  assert.equal(brandArtLineCount('machine'), 0);
  assert.ok(brandArtWidth('human-rich') <= MAX_ART_WIDTH);
  assert.ok(brandArtWidth('human-plain') <= MAX_ART_WIDTH);
  assert.equal(brandArtWidth('machine'), 0);
});

test('formatBrandArt is empty in machine mode and full otherwise', () => {
  assert.equal(formatBrandArt('machine', brandStream(true), {}), '');

  const esc = String.fromCharCode(27);
  const plain = formatBrandArt('human-plain', brandStream(true), {});
  assert.match(plain, /#{2,}/);
  assert.match(plain, /\+{2,}/);
  assert.match(plain, /={2,}/);
  assert.ok(!plain.includes(esc));
  assert.equal(plain.endsWith('\n'), true);

  const rich = formatBrandArt('human-rich', brandStream(true), {});
  assert.match(rich, /▓/);
  assert.match(rich, /▒/);
  assert.ok(rich.includes(`${esc}[38;2;75;62;168m`));
  assert.ok(rich.includes(`${esc}[38;2;139;125;255m`));

  const noColor = formatBrandArt('human-rich', brandStream(true), { NO_COLOR: '1' });
  assert.match(noColor, /▓/);
  assert.ok(!noColor.includes(esc));
});

test('shouldAnimateBrandArt only for human-rich TTY without CI/quiet', () => {
  const tty = brandStream(true);
  assert.equal(shouldAnimateBrandArt('human-rich', tty, {}), true);
  assert.equal(shouldAnimateBrandArt('human-plain', tty, {}), false);
  assert.equal(shouldAnimateBrandArt('machine', tty, {}), false);
  assert.equal(shouldAnimateBrandArt('human-rich', brandStream(false), {}), false);
  assert.equal(shouldAnimateBrandArt('human-rich', tty, { CI: '1' }), false);
  assert.equal(shouldAnimateBrandArt('human-rich', tty, {}, { quiet: true }), false);
  assert.equal(shouldAnimateBrandArt('human-rich', tty, { SDD_BRAND_ANIMATE: '0' }), false);
  assert.equal(shouldAnimateBrandArt('human-rich', tty, {}, { animate: false }), false);
});

test('brandArtFitsTerminal rejects narrow or short TTY reports', () => {
  const wide = asBrandStream({ isTTY: true, columns: 80, rows: 40 });
  const width = brandArtWidth('human-rich');
  const height = brandArtLineCount('human-rich');
  assert.equal(brandArtFitsTerminal('human-rich', wide), true);
  assert.equal(
    brandArtFitsTerminal('human-rich', asBrandStream({ isTTY: true, columns: width - 1 })),
    false,
  );
  assert.equal(
    brandArtFitsTerminal('human-rich', asBrandStream({ isTTY: true, rows: height + 9 })),
    false,
  );
  assert.equal(brandArtFitsTerminal('machine', wide), false);
});

test('writeBrandArt animates left-to-right on rich TTY and is instant otherwise', async () => {
  const esc = String.fromCharCode(27);
  const lineCount = brandArtLineCount('human-rich');
  const chunks: string[] = [];
  const stream = {
    isTTY: true,
    columns: 80,
    rows: 40,
    write(chunk: string) {
      chunks.push(String(chunk));
      return true;
    },
  };

  await writeBrandArt('human-rich', stream, { NO_COLOR: '1' }, { delayMs: 0 });
  const out = chunks.join('');
  assert.match(out, /▓/);
  assert.match(out, /▒/);
  assert.equal((out.match(new RegExp(`${esc}\\[${lineCount}A`, 'g')) || []).length, 2);

  chunks.length = 0;
  await writeBrandArt('human-plain', stream, {}, { delayMs: 0 });
  const plain = chunks.join('');
  assert.match(plain, /#{2,}/);
  assert.equal(plain.includes(`${esc}[${lineCount}A`), false);

  chunks.length = 0;
  await writeBrandArt('machine', stream, {}, {});
  assert.equal(chunks.join(''), '');
});

test('writeBrandArt falls back to one-line mark on tiny TTY', async () => {
  const chunks: string[] = [];
  const narrow = {
    isTTY: true,
    columns: brandArtWidth('human-rich') - 1,
    rows: 40,
    write(chunk: string) {
      chunks.push(String(chunk));
      return true;
    },
  };

  await writeBrandArt('human-rich', narrow, { NO_COLOR: '1' }, { delayMs: 0 });
  assert.equal(chunks.join(''), formatOneLineBrand('human-rich', narrow, { NO_COLOR: '1' }));
  assert.ok(!chunks.join('').includes('▓'));

  chunks.length = 0;
  await writeBrandArt('human-plain', narrow, {}, { delayMs: 0 });
  assert.equal(chunks.join(''), '>>>\n');
});
