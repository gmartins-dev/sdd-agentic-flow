import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import {
  brandArtFitsTerminal,
  brandArtLineCount,
  brandArtVariant,
  brandArtWidth,
  CANONICAL_MASK,
  CANONICAL_WIDE_HEIGHT,
  CANONICAL_WIDE_WIDTH,
  formatBrandArt,
  formatOneLineBrand,
  shouldAnimateBrandArt,
  writeBrandArt,
} from '../src/brand-art';
import { stripAnsi } from '../src/terminal-geometry';
import { asBrandStream, brandStream } from './helpers';

const ESC = String.fromCharCode(27);
const FOREGROUND = new Set(['▒', '▓']);
const BOUNDS = {
  small: [7, 24, 18, 27],
  medium: [30, 57, 12, 33],
  large: [63, 102, 3, 42],
} as const;

function canonicalRows(): string[] {
  return fs
    .readFileSync('public/ascii/saf-ascii-art.txt', 'utf8')
    .replace(/\r?\n$/, '')
    .split(/\r?\n/);
}

function sourceCells(): Set<string> {
  return new Set(
    canonicalRows().flatMap((row, y) =>
      [...row].flatMap((character, x) => (FOREGROUND.has(character) ? [`${x},${y}`] : [])),
    ),
  );
}

function renderedCells(value: string, offset = 0): Set<string> {
  return new Set(
    stripAnsi(value)
      .replace(/\n$/, '')
      .split('\n')
      .flatMap((row, y) =>
        [...row].flatMap((character, x) =>
          FOREGROUND.has(character) ? [`${x - offset},${y}`] : [],
        ),
      ),
  );
}

function componentCells(component: keyof typeof BOUNDS): Set<string> {
  const [minX, maxX, minY, maxY] = BOUNDS[component];
  return new Set(
    [...sourceCells()].filter((cell) => {
      const [x = 0, y = 0] = cell.split(',').map(Number);
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }),
  );
}

function wideStream(columns = 110, rows = 60) {
  return asBrandStream({ isTTY: true, columns, rows });
}

test('canonical TXT and embedded mask preserve exact 110×46 occupancy', () => {
  const rows = canonicalRows();
  assert.equal(rows.length, CANONICAL_WIDE_HEIGHT);
  assert.deepEqual([...new Set(rows.map((row) => [...row].length))], [CANONICAL_WIDE_WIDTH]);
  assert.equal(CANONICAL_MASK.length, CANONICAL_WIDE_HEIGHT);
  assert.deepEqual(
    CANONICAL_MASK.map((spans) =>
      spans.flatMap(([start, end]) =>
        Array.from({ length: end - start + 1 }, (_, index) => start + index),
      ),
    ),
    rows.map((row) => [...row].flatMap((character, x) => (FOREGROUND.has(character) ? [x] : []))),
  );
});

test('canonical renderer preserves every foreground glyph and coordinate', () => {
  const source = canonicalRows().map((row) => row.replaceAll('█', ' '));
  const rendered = stripAnsi(formatBrandArt('human-rich', wideStream(110), { NO_COLOR: '1' }))
    .replace(/\n$/, '')
    .split('\n')
    .map((row) => row.padEnd(CANONICAL_WIDE_WIDTH, ' ').slice(0, CANONICAL_WIDE_WIDTH));
  assert.deepEqual(rendered, source);
});

test('canonical components are disjoint and cover every foreground cell', () => {
  const parts = (['small', 'medium', 'large'] as const).map(componentCells);
  assert.equal(new Set(parts.flatMap((part) => [...part])).size, sourceCells().size);
  assert.equal(
    new Set(parts.flatMap((part) => [...part])).size,
    parts.reduce((sum, part) => sum + part.size, 0),
  );
});

test('canonical renderer keeps the full canvas and complete viewport offset', () => {
  const rendered = formatBrandArt(
    'human-rich',
    wideStream(120),
    { NO_COLOR: '1' },
    { center: true },
  );
  assert.equal(brandArtVariant('human-rich', wideStream()), 'wide');
  assert.equal(brandArtWidth('human-rich', wideStream()), CANONICAL_WIDE_WIDTH);
  assert.equal(brandArtLineCount('human-rich', wideStream()), CANONICAL_WIDE_HEIGHT);
  assert.deepEqual(renderedCells(rendered, 5), sourceCells());
  assert.equal(rendered.replace(/\r?\n$/, '').split('\n').length, CANONICAL_WIDE_HEIGHT);

  const extraWide = formatBrandArt(
    'human-rich',
    wideStream(140),
    { NO_COLOR: '1' },
    { center: true },
  );
  assert.deepEqual(renderedCells(extraWide, 15), sourceCells());
});

test('canonical renderer uses theme colors without changing geometry', () => {
  const rendered = formatBrandArt('human-rich', wideStream(), { COLORTERM: 'truecolor' });
  assert.deepEqual(renderedCells(rendered), sourceCells());
  assert.ok(rendered.includes(`${ESC}[38;2;75;62;168m`));
  assert.ok(rendered.includes(`${ESC}[38;2;109;94;240m`));
  assert.ok(rendered.includes(`${ESC}[38;2;139;125;255m`));

  const noColor = formatBrandArt('human-rich', wideStream(), { NO_COLOR: '1' });
  assert.deepEqual(renderedCells(noColor), sourceCells());
  assert.equal(noColor.includes(ESC), false);
});

test('canonical variant requires width 110 and enough rows; smaller terminals keep fallbacks', () => {
  assert.equal(brandArtVariant('human-rich', wideStream(110, 60)), 'wide');
  assert.equal(brandArtVariant('human-rich', wideStream(111, 60)), 'wide');
  assert.equal(brandArtVariant('human-rich', wideStream(120, 59)), 'compact');
  assert.equal(brandArtVariant('human-rich', wideStream(109, 60)), 'compact');
  assert.equal(brandArtVariant('human-rich', wideStream(20, 60)), 'minimal');
  assert.equal(brandArtFitsTerminal('machine', wideStream()), false);
});

test('plain, ASCII, and machine modes remain deterministic', () => {
  const plain = formatBrandArt('human-plain', wideStream(110), {});
  assert.match(plain, /#{10}\s+\+{16}\s+={22}/);
  assert.equal(plain.includes(ESC), false);
  assert.equal(formatBrandArt('machine', wideStream(), {}), '');
  assert.equal(formatOneLineBrand('human-plain', wideStream(20), {}), '>  >>  >>>\n');
  assert.equal(brandArtLineCount('machine', wideStream()), 0);
});

test('animation reveals component masks in order on a fixed 110×46 canvas', async () => {
  const chunks: string[] = [];
  const stream = {
    isTTY: true,
    columns: 110,
    rows: 60,
    write(chunk: string) {
      chunks.push(String(chunk));
      return true;
    },
  };

  await writeBrandArt('human-rich', stream, { NO_COLOR: '1' }, { delayMs: 0 });
  const frames = chunks
    .join('')
    .split(`${ESC}[${CANONICAL_WIDE_HEIGHT}A`)
    .map((frame) => frame.replaceAll(`${ESC}[K`, ''));
  assert.equal(frames.length, 3);
  assert.deepEqual(renderedCells(frames[0] ?? ''), componentCells('small'));
  assert.deepEqual(
    renderedCells(frames[1] ?? ''),
    new Set([...componentCells('small'), ...componentCells('medium')]),
  );
  assert.deepEqual(renderedCells(frames[2] ?? ''), sourceCells());
  assert.equal(
    renderedCells(frames[2] ?? '').size,
    renderedCells(formatBrandArt('human-rich', stream, { NO_COLOR: '1' })).size,
  );
  assert.equal(chunks.join('').split(`${ESC}[${CANONICAL_WIDE_HEIGHT}A`).length - 1, 2);
});

test('animation is disabled outside rich interactive TTY contexts', () => {
  const tty = brandStream(true, 110);
  assert.equal(shouldAnimateBrandArt('human-rich', tty, {}), true);
  assert.equal(shouldAnimateBrandArt('human-rich', brandStream(false, 110), {}), false);
  assert.equal(shouldAnimateBrandArt('human-plain', tty, {}), false);
  assert.equal(shouldAnimateBrandArt('machine', tty, {}), false);
  assert.equal(shouldAnimateBrandArt('human-rich', tty, { CI: '1' }), false);
  assert.equal(shouldAnimateBrandArt('human-rich', tty, { TERM: 'dumb' }), false);
  assert.equal(shouldAnimateBrandArt('human-rich', tty, { SDD_BRAND_ANIMATE: '0' }), false);
});

test('centered compact and minimal fallbacks remain stable', () => {
  const compact = formatBrandArt(
    'human-rich',
    asBrandStream({ isTTY: true, columns: 80, rows: 40 }),
    { NO_COLOR: '1' },
    { center: true },
  );
  assert.match(compact, /██████████\s+████████████████\s+██████████████████████/);
  assert.equal(
    brandArtWidth('human-rich', asBrandStream({ isTTY: true, columns: 80, rows: 40 })),
    54,
  );
  const minimal = formatBrandArt(
    'human-rich',
    asBrandStream({ isTTY: true, columns: 20, rows: 40 }),
    { NO_COLOR: '1' },
    { center: true },
  );
  assert.equal(minimal, '     ›  ››  ›››\n');
});
