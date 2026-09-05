import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import {
  brandArtVariant,
  brandArtWidth,
  CANONICAL_MASK,
  CANONICAL_WIDE_HEIGHT,
  CANONICAL_WIDE_WIDTH,
  formatBrandArt,
  shouldAnimateBrandArt,
  writeBrandArt,
} from '../src/brand-art';
import { BRAND_ANIMATION } from '../src/brand-motion';
import { stripAnsi } from '../src/terminal-geometry';
import { asBrandStream } from './helpers';

const foreground = (value: string) =>
  new Set(
    value
      .split('\n')
      .flatMap((row, y) => [...row].flatMap((cell, x) => (cell === '█' ? [`${x},${y}`] : []))),
  );

test('generated canonical TXT and embedded mask are 80×34 and lossless', () => {
  const rows = fs
    .readFileSync('public/ascii/saf-ascii-art.txt', 'utf8')
    .replace(/\n$/, '')
    .split('\n');
  assert.equal(rows.length, CANONICAL_WIDE_HEIGHT);
  assert.ok(rows.every((row) => [...row].length === CANONICAL_WIDE_WIDTH));
  assert.equal(CANONICAL_MASK.length, CANONICAL_WIDE_HEIGHT);
  const maskCells = new Set(
    CANONICAL_MASK.flatMap((row, y) =>
      row.flatMap(([start, end]) =>
        Array.from({ length: end - start + 1 }, (_, i) => `${start + i},${y}`),
      ),
    ),
  );
  assert.deepEqual(maskCells, foreground(rows.join('\n')));
});

test('canonical presentation preserves geometry and semantic colors', () => {
  const stream = asBrandStream({ isTTY: true, columns: 120, rows: 60 });
  const plain = stripAnsi(
    formatBrandArt('human-rich', stream, { NO_COLOR: '1' }, { center: true }),
  );
  assert.equal(plain.split('\n').filter(Boolean).length, CANONICAL_WIDE_HEIGHT);
  assert.equal(brandArtWidth('human-rich', stream), CANONICAL_WIDE_WIDTH);
  const colored = formatBrandArt('human-rich', stream, { COLORTERM: 'truecolor' });
  assert.match(colored, /38;2;75;62;168/);
  assert.match(colored, /38;2;109;94;240/);
  assert.match(colored, /38;2;139;125;255/);
});

test('responsive policy preserves compact 54-column breakpoint and height rules', () => {
  const stream = (columns: number, rows?: number) =>
    asBrandStream({ isTTY: true, columns, ...(rows === undefined ? {} : { rows }) });
  assert.equal(brandArtVariant('human-rich', stream(80, 48)), 'wide');
  assert.equal(brandArtVariant('human-rich', stream(80, 47)), 'compact');
  assert.equal(brandArtVariant('human-rich', stream(80)), 'wide');
  assert.equal(brandArtVariant('human-rich', stream(54, 14)), 'compact');
  assert.equal(brandArtVariant('human-rich', stream(53, 14)), 'minimal');
  assert.equal(brandArtVariant('human-rich', stream(80, 13)), 'minimal');
});

test('motion frames are finite, semantic, and settle on canonical runs', () => {
  assert.equal(BRAND_ANIMATION.frames.length, 10);
  assert.deepEqual(
    BRAND_ANIMATION.frames.map((frame) => frame.durationMs),
    [50, 55, 60, 65, 65, 70, 70, 75, 80, 0],
  );
  const final = BRAND_ANIMATION.frames.at(-1)!;
  assert.deepEqual(
    final.rows,
    CANONICAL_MASK.map((row) =>
      row.map(([column, end, component]) => ({
        column,
        text: '█'.repeat(end - column + 1),
        role: `brand.${component}`,
      })),
    ),
  );
  assert.ok(
    BRAND_ANIMATION.frames
      .slice(0, -1)
      .some((frame) => frame.rows.some((row) => row.some((run) => run.role.startsWith('flow.')))),
  );
});

test('motion admission is limited to a rich interactive tall terminal', () => {
  assert.equal(
    shouldAnimateBrandArt('human-rich', asBrandStream({ isTTY: true, columns: 80, rows: 48 }), {}),
    true,
  );
  assert.equal(
    shouldAnimateBrandArt('human-rich', asBrandStream({ isTTY: true, columns: 80, rows: 47 }), {}),
    false,
  );
  assert.equal(
    shouldAnimateBrandArt('human-rich', asBrandStream({ isTTY: true, columns: 80 }), {}),
    false,
  );
  assert.equal(
    shouldAnimateBrandArt('human-rich', asBrandStream({ isTTY: false, columns: 80, rows: 48 }), {}),
    false,
  );
  assert.equal(
    shouldAnimateBrandArt('human-rich', asBrandStream({ isTTY: true, columns: 80, rows: 48 }), {
      SDD_BRAND_ANIMATE: '0',
    }),
    false,
  );
});

test('disabled motion writes exactly one static canonical frame', async () => {
  const chunks: string[] = [];
  await writeBrandArt(
    'human-rich',
    {
      isTTY: true,
      columns: 80,
      rows: 48,
      write: (chunk) => {
        chunks.push(chunk);
        return true;
      },
    },
    { NO_COLOR: '1', SDD_BRAND_ANIMATE: '0' },
  );
  assert.equal(chunks.length, 1);
  assert.equal(
    stripAnsi(chunks[0] ?? '')
      .replace(/\n$/, '')
      .split('\n').length,
    CANONICAL_WIDE_HEIGHT,
  );
});
