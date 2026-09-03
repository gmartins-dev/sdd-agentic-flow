// Canonical terminal adaptation of public/ascii/saf-ascii-art.txt.
// The TXT is a 110×46 raster: █ is transparent background, while ▒/▓ are foreground.
// The mask below is embedded so the published CLI has no asset runtime dependency.

import { centerDisplayBlock, centerDisplayLine, displayWidth } from './terminal-geometry';
import { ansiColor, COLORS } from './terminal-theme';

const DEFAULT_BRAND_ANIMATE_MS = 240;
const CANONICAL_WIDE_WIDTH = 110;
const CANONICAL_WIDE_HEIGHT = 46;
const CANONICAL_WIDE_MIN_ROWS = 60;
const COMPACT_ART_WIDTH = 54;
const COMPACT_ART_HEIGHT = 14;
const MAX_ART_WIDTH = CANONICAL_WIDE_WIDTH;
const GAP = '   ';
const INLINE_GAP = '  ';
const ONE_LINE_RICH = ['›', '››', '›››'] as const;
const ONE_LINE_PLAIN = '>  >>  >>>';

type DisplayMode = 'human-rich' | 'human-plain' | 'machine';
type BrandArtBand = readonly string[];
type BrandArtParts = readonly BrandArtBand[];
type BrandArtVariant = 'wide' | 'compact' | 'minimal';
type BrandComponent = 'small' | 'medium' | 'large';
type CanonicalRun = readonly [start: number, end: number, glyph: '▒' | '▓'];

type BrandStream = {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
  write: (chunk: string) => boolean | undefined;
};

type BrandEnv = NodeJS.ProcessEnv;

const COMPONENT_ORDER: readonly BrandComponent[] = ['small', 'medium', 'large'];
const COMPONENT_BOUNDS: Readonly<
  Record<BrandComponent, readonly [number, number, number, number]>
> = {
  small: [7, 24, 18, 27],
  medium: [30, 57, 12, 33],
  large: [63, 102, 3, 42],
};

// Each row stores the exact foreground runs from the approved 110×46 asset.
// These runs preserve source glyphs and coordinates; they never generate geometry.
const CANONICAL_MASK: readonly (readonly CanonicalRun[])[] = [
  [],
  [],
  [],
  [[63, 63, '▒']],
  [[63, 66, '▒']],
  [[63, 68, '▒']],
  [[63, 70, '▒']],
  [[63, 72, '▒']],
  [[63, 74, '▒']],
  [[63, 76, '▒']],
  [[63, 78, '▒']],
  [[63, 80, '▒']],
  [
    [30, 31, '▒'],
    [63, 82, '▒'],
  ],
  [
    [30, 34, '▒'],
    [63, 84, '▒'],
  ],
  [
    [30, 36, '▒'],
    [37, 37, '▓'],
    [63, 86, '▒'],
  ],
  [
    [30, 39, '▒'],
    [63, 88, '▒'],
  ],
  [
    [30, 42, '▒'],
    [63, 90, '▒'],
  ],
  [
    [30, 44, '▒'],
    [63, 92, '▒'],
  ],
  [
    [7, 10, '▓'],
    [30, 47, '▒'],
    [63, 94, '▒'],
  ],
  [
    [7, 13, '▓'],
    [30, 49, '▒'],
    [63, 96, '▒'],
  ],
  [
    [7, 17, '▓'],
    [30, 52, '▒'],
    [63, 98, '▒'],
  ],
  [
    [7, 21, '▓'],
    [30, 54, '▒'],
    [55, 55, '▓'],
    [63, 100, '▒'],
  ],
  [
    [7, 24, '▓'],
    [30, 57, '▒'],
    [63, 102, '▒'],
  ],
  [
    [7, 24, '▓'],
    [30, 57, '▒'],
    [63, 102, '▒'],
  ],
  [
    [7, 21, '▓'],
    [30, 54, '▒'],
    [55, 55, '▓'],
    [63, 100, '▒'],
  ],
  [
    [7, 17, '▓'],
    [30, 52, '▒'],
    [63, 98, '▒'],
  ],
  [
    [7, 13, '▓'],
    [30, 49, '▒'],
    [63, 96, '▒'],
  ],
  [
    [7, 10, '▓'],
    [30, 47, '▒'],
    [63, 94, '▒'],
  ],
  [
    [30, 44, '▒'],
    [63, 92, '▒'],
  ],
  [
    [30, 42, '▒'],
    [63, 90, '▒'],
  ],
  [
    [30, 39, '▒'],
    [63, 88, '▒'],
  ],
  [
    [30, 36, '▒'],
    [37, 37, '▓'],
    [63, 86, '▒'],
  ],
  [
    [30, 34, '▒'],
    [63, 84, '▒'],
  ],
  [
    [30, 31, '▒'],
    [63, 82, '▒'],
  ],
  [[63, 80, '▒']],
  [[63, 78, '▒']],
  [[63, 76, '▒']],
  [[63, 74, '▒']],
  [[63, 72, '▒']],
  [[63, 70, '▒']],
  [[63, 68, '▒']],
  [[63, 66, '▒']],
  [[63, 63, '▒']],
  [],
  [],
  [],
];

// Intentional compact fallback: a denser, left-anchored translation of the same
// small → medium → large silhouette. It is a separate fallback, never a scaled
// or resampled version of the canonical 110×46 asset.
function compactBand(widths: readonly number[], glyph: string): BrandArtBand {
  const top = Math.floor((COMPACT_ART_HEIGHT - widths.length) / 2);
  return Array.from({ length: COMPACT_ART_HEIGHT }, (_, row) => {
    const width = widths[row - top] ?? 0;
    return glyph.repeat(width);
  });
}

const COMPACT_WIDTHS = {
  small: [3, 6, 10, 10, 6, 3],
  medium: [2, 5, 8, 11, 16, 16, 11, 8, 5, 2],
  large: [1, 3, 6, 9, 13, 17, 22, 22, 17, 13, 9, 6, 3, 1],
} as const;

const BRAND_ART_COMPACT_RICH: BrandArtParts = [
  compactBand(COMPACT_WIDTHS.small, '█'),
  compactBand(COMPACT_WIDTHS.medium, '█'),
  compactBand(COMPACT_WIDTHS.large, '█'),
];

const BRAND_ART_COMPACT_ASCII: BrandArtParts = [
  compactBand(COMPACT_WIDTHS.small, '#'),
  compactBand(COMPACT_WIDTHS.medium, '+'),
  compactBand(COMPACT_WIDTHS.large, '='),
];

// Compatibility aliases: callers that consumed the old symbols now receive the compact fallback.
const BRAND_ART_RICH = BRAND_ART_COMPACT_RICH;
const BRAND_ART_ASCII = BRAND_ART_COMPACT_ASCII;
const BRAND_ART_WIDE_RICH = BRAND_ART_COMPACT_RICH;
const BRAND_ART_WIDE_ASCII = BRAND_ART_COMPACT_ASCII;

function streamColumns(stream: BrandStream | undefined): number {
  return typeof stream?.columns === 'number' && stream.columns > 0 ? stream.columns : 80;
}

type BrandArtOptions = {
  quiet?: boolean | undefined;
  animate?: boolean | undefined;
  delayMs?: number | undefined;
  center?: boolean | undefined;
  visibleParts?: number | undefined;
  variant?: Exclude<BrandArtVariant, 'minimal'> | undefined;
};

function artColorEnabled(stream: BrandStream | undefined, env: BrandEnv = process.env): boolean {
  if (env.NO_COLOR !== undefined) return false;
  if (!stream?.isTTY) return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0') return true;
  return true;
}

function brandColorDepth(env: BrandEnv): 'ansi16' | 'ansi256' | 'truecolor' {
  const terminal = env.TERM ?? '';
  const colorTerminal = env.COLORTERM ?? '';
  if (colorTerminal === 'truecolor' || colorTerminal === '24bit') return 'truecolor';
  if (terminal.includes('256color')) return 'ansi256';
  return 'ansi16';
}

function componentAt(x: number, y: number): BrandComponent | undefined {
  for (const component of COMPONENT_ORDER) {
    const [minX, maxX, minY, maxY] = COMPONENT_BOUNDS[component];
    if (x >= minX && x <= maxX && y >= minY && y <= maxY) return component;
  }
  return undefined;
}

function visibleComponent(component: BrandComponent, visibleParts: number): boolean {
  return COMPONENT_ORDER.indexOf(component) < visibleParts;
}

function componentColor(component: BrandComponent) {
  return component === 'small'
    ? COLORS.brand.secondary
    : component === 'medium'
      ? COLORS.brand.primary
      : COLORS.brand.accent;
}

function renderInk(
  value: string,
  component: BrandComponent,
  stream: BrandStream | undefined,
  env: BrandEnv,
): string {
  if (!artColorEnabled(stream, env)) return value;
  return `\x1b[${ansiColor(componentColor(component), brandColorDepth(env))}m${value}\x1b[0m`;
}

function canonicalOffset(stream: BrandStream | undefined, center: boolean): number {
  return center ? Math.max(0, Math.floor((streamColumns(stream) - CANONICAL_WIDE_WIDTH) / 2)) : 0;
}

function renderCanonical(
  stream: BrandStream | undefined,
  env: BrandEnv,
  center: boolean,
  visibleParts: number,
): string[] {
  const offset = canonicalOffset(stream, center);
  return CANONICAL_MASK.map((spans, y) => {
    let cursor = 0;
    let line = ' '.repeat(offset);
    for (const [start, end, glyph] of spans) {
      const component = componentAt(start, y);
      if (!component || !visibleComponent(component, visibleParts)) continue;
      line += ' '.repeat(Math.max(0, start - cursor));
      line += renderInk(glyph.repeat(end - start + 1), component, stream, env);
      cursor = end + 1;
    }
    return line.replace(/\s+$/, '');
  });
}

function bandWidths(parts: BrandArtParts): number[] {
  return parts.map((band) => Math.max(0, ...band.map((line) => displayWidth(line))));
}

function padDisplayEnd(value: string, width: number): string {
  return `${value}${' '.repeat(Math.max(0, width - displayWidth(value)))}`;
}

function joinedWidth(parts: BrandArtParts): number {
  if (!parts.length) return 0;
  const widths = bandWidths(parts);
  return widths.reduce((sum, width) => sum + width, 0) + GAP.length * (parts.length - 1);
}

function joinArt(parts: BrandArtParts): string[] {
  const widths = bandWidths(parts);
  const firstBand = parts[0];
  if (!firstBand) return [];
  return firstBand.map((_, row) =>
    parts
      .map((band, index) => padDisplayEnd(band[row] || '', widths[index] ?? 0))
      .join(GAP)
      .replace(/\s+$/, ''),
  );
}

function paintCompact(
  parts: BrandArtParts,
  stream: BrandStream | undefined,
  env: BrandEnv,
  center: boolean,
  visibleParts = parts.length,
): string[] {
  const widths = bandWidths(parts);
  const firstBand = parts[0];
  if (!firstBand) return [];
  const lines = firstBand.map((_, row) =>
    parts
      .map((band, index) => {
        const cell = padDisplayEnd(band[row] || '', widths[index] ?? 0);
        if (index >= visibleParts || !artColorEnabled(stream, env)) return cell;
        const component = COMPONENT_ORDER[index];
        if (!component) return cell;
        return cell.replace(/(\S+)/g, (ink) => renderInk(ink, component, stream, env));
      })
      .join(GAP)
      .replace(/\s+$/, ''),
  );
  if (!center) return lines;
  const width = joinedWidth(parts);
  return centerDisplayBlock(
    lines.map((line) => padDisplayEnd(line, width)),
    streamColumns(stream),
  ).map((line) => line.trimEnd());
}

function partsForVariant(
  mode: DisplayMode,
  _variant: Exclude<BrandArtVariant, 'minimal'>,
): BrandArtParts {
  return mode === 'human-rich' ? BRAND_ART_COMPACT_RICH : BRAND_ART_COMPACT_ASCII;
}

function canonicalBrandFits(stream: BrandStream | undefined): boolean {
  if (streamColumns(stream) < CANONICAL_WIDE_WIDTH) return false;
  if (typeof stream?.rows === 'number' && stream.rows > 0 && stream.rows < CANONICAL_WIDE_MIN_ROWS)
    return false;
  return true;
}

function compactBrandFits(stream: BrandStream | undefined): boolean {
  if (streamColumns(stream) < COMPACT_ART_WIDTH) return false;
  return !(typeof stream?.rows === 'number' && stream.rows > 0 && stream.rows < COMPACT_ART_HEIGHT);
}

function brandArtVariant(
  mode: DisplayMode,
  stream: BrandStream | undefined,
  preferred?: Exclude<BrandArtVariant, 'minimal'>,
): BrandArtVariant {
  if (mode === 'machine') return 'minimal';
  if (mode === 'human-rich' && canonicalBrandFits(stream)) return 'wide';
  if (preferred === 'wide' && !compactBrandFits(stream)) return 'minimal';
  return compactBrandFits(stream) ? 'compact' : 'minimal';
}

function artPartsFor(
  mode: DisplayMode,
  stream?: BrandStream,
  preferred?: Exclude<BrandArtVariant, 'minimal'>,
): BrandArtParts | null {
  const variant = brandArtVariant(mode, stream, preferred);
  return variant === 'minimal' ? null : partsForVariant(mode, variant);
}

function formatBrandArt(
  mode: DisplayMode = 'human-rich',
  stream?: BrandStream,
  env: BrandEnv = process.env,
  options: Pick<BrandArtOptions, 'center' | 'visibleParts' | 'variant'> = {},
): string {
  if (mode === 'machine') return '';
  const variant = brandArtVariant(mode, stream, options.variant);
  if (variant === 'minimal') {
    const oneLine = formatOneLineBrand(mode, stream, env).trimEnd();
    return `${options.center ? centerDisplayLine(oneLine, streamColumns(stream)) : oneLine}\n`;
  }
  if (mode === 'human-rich' && variant === 'wide') {
    return `${renderCanonical(
      stream,
      env,
      Boolean(options.center),
      Math.max(0, Math.min(COMPONENT_ORDER.length, options.visibleParts ?? COMPONENT_ORDER.length)),
    ).join('\n')}\n`;
  }
  const parts = artPartsFor(mode, stream, variant);
  if (!parts) return '';
  const rendered =
    mode === 'human-rich'
      ? paintCompact(parts, stream, env, Boolean(options.center), options.visibleParts)
      : joinArt(parts);
  return `${rendered.join('\n')}\n`;
}

function brandArtLineCount(mode: DisplayMode = 'human-rich', stream?: BrandStream): number {
  if (mode === 'machine') return 0;
  return brandArtVariant(mode, stream) === 'wide'
    ? CANONICAL_WIDE_HEIGHT
    : artPartsFor(mode, stream)?.[0]?.length || 1;
}

function brandArtWidth(mode: DisplayMode = 'human-rich', stream?: BrandStream): number {
  const variant = brandArtVariant(mode, stream);
  return variant === 'wide'
    ? CANONICAL_WIDE_WIDTH
    : variant === 'compact'
      ? joinedWidth(partsForVariant(mode, variant))
      : 0;
}

function formatOneLineBrand(
  mode: DisplayMode = 'human-rich',
  stream?: BrandStream,
  env: BrandEnv = process.env,
): string {
  if (mode === 'machine') return '';
  if (mode !== 'human-rich') return `${ONE_LINE_PLAIN}\n`;
  if (!artColorEnabled(stream, env)) return `${ONE_LINE_RICH.join(INLINE_GAP)}\n`;
  return `${ONE_LINE_RICH.map((mark, index) => {
    const token =
      [COLORS.brand.secondary, COLORS.brand.primary, COLORS.brand.accent][index] ??
      COLORS.brand.primary;
    return `\x1b[${ansiColor(token, brandColorDepth(env))}m${mark}\x1b[0m`;
  }).join(INLINE_GAP)}\n`;
}

function brandArtFitsTerminal(mode: DisplayMode, stream: BrandStream | undefined): boolean {
  return brandArtVariant(mode, stream) !== 'minimal';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldAnimateBrandArt(
  mode: DisplayMode,
  stream: BrandStream | undefined,
  env: BrandEnv = process.env,
  options: BrandArtOptions = {},
): boolean {
  if (mode !== 'human-rich') return false;
  if (!stream?.isTTY) return false;
  if (env.CI || env.TERM === 'dumb') return false;
  if (options.quiet || env.SDD_BRAND_ANIMATE === '0' || options.animate === false) return false;
  return true;
}

async function writeBrandArt(
  mode: DisplayMode = 'human-rich',
  stream?: BrandStream,
  env: BrandEnv = process.env,
  options: BrandArtOptions = {},
): Promise<void> {
  if (mode === 'machine' || !stream) return;
  const variant = brandArtVariant(mode, stream);
  if (variant === 'minimal') {
    const oneLine = formatOneLineBrand(mode, stream, env).trimEnd();
    stream.write(
      `${options.center ? centerDisplayLine(oneLine, streamColumns(stream)) : oneLine}\n`,
    );
    return;
  }
  const animate = shouldAnimateBrandArt(mode, stream, env, options);
  if (mode !== 'human-rich' || variant !== 'wide' || !animate) {
    const art = formatBrandArt(mode, stream, env, { center: options.center });
    if (art) stream.write(art);
    return;
  }

  const delayMs = options.delayMs ?? DEFAULT_BRAND_ANIMATE_MS;
  for (let visible = 1; visible <= COMPONENT_ORDER.length; visible += 1) {
    if (visible > 1) stream.write(`\x1b[${CANONICAL_WIDE_HEIGHT}A`);
    const frame = renderCanonical(stream, env, Boolean(options.center), visible);
    stream.write(`${frame.map((line) => `${line}\x1b[K`).join('\n')}\n`);
    if (visible < COMPONENT_ORDER.length && delayMs > 0) await sleep(delayMs);
  }
}

export type { BrandArtOptions, BrandArtVariant, BrandStream, DisplayMode };
export {
  BRAND_ART_ASCII,
  BRAND_ART_COMPACT_ASCII,
  BRAND_ART_COMPACT_RICH,
  BRAND_ART_RICH,
  BRAND_ART_WIDE_ASCII,
  BRAND_ART_WIDE_RICH,
  brandArtFitsTerminal,
  brandArtLineCount,
  brandArtVariant,
  brandArtWidth,
  CANONICAL_MASK,
  CANONICAL_WIDE_HEIGHT,
  CANONICAL_WIDE_WIDTH,
  COMPACT_ART_WIDTH,
  DEFAULT_BRAND_ANIMATE_MS,
  formatBrandArt,
  formatOneLineBrand,
  MAX_ART_WIDTH,
  shouldAnimateBrandArt,
  writeBrandArt,
};
