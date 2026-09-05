// Static SAF terminal branding. Geometry is generated from symbol.svg at build time;
// the published bundle never reads public/.

import {
  CANONICAL_BRAND_HEIGHT,
  CANONICAL_BRAND_MASK,
  CANONICAL_BRAND_WIDTH,
} from './brand-animation.generated';
import { playBrandMotion } from './brand-motion';
import { centerDisplayBlock, centerDisplayLine, displayWidth } from './terminal-geometry';
import { ansiColor, COLORS } from './terminal-theme';

const DEFAULT_BRAND_ANIMATE_MS = 590;
const COMPACT_ART_WIDTH = 54;
const COMPACT_ART_HEIGHT = 14;
const MAX_ART_WIDTH = CANONICAL_BRAND_WIDTH;
const GAP = '   ';
const INLINE_GAP = '  ';
const ONE_LINE_RICH = ['›', '››', '›››'] as const;
const ONE_LINE_PLAIN = '>  >>  >>>';
type DisplayMode = 'human-rich' | 'human-plain' | 'machine';
type BrandArtBand = readonly string[];
type BrandArtParts = readonly BrandArtBand[];
type BrandArtVariant = 'wide' | 'compact' | 'minimal';
type BrandComponent = 'small' | 'medium' | 'large';
type CanonicalRun = readonly [start: number, end: number, role: BrandComponent];
type BrandStream = {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
  write: (chunk: string) => boolean | undefined;
  once?: (event: string, listener: () => void) => void;
  on?: (event: string, listener: () => void) => void;
};
type BrandEnv = NodeJS.ProcessEnv;
type BrandArtOptions = {
  quiet?: boolean;
  animate?: boolean;
  delayMs?: number;
  center?: boolean;
  visibleParts?: number;
  variant?: Exclude<BrandArtVariant, 'minimal'>;
};
const COMPONENT_ORDER: readonly BrandComponent[] = ['small', 'medium', 'large'];
const COMPONENT_COLORS = {
  small: COLORS.brand.secondary,
  medium: COLORS.brand.primary,
  large: COLORS.brand.accent,
} as const;
const CANONICAL_MASK: readonly (readonly CanonicalRun[])[] = CANONICAL_BRAND_MASK;

function streamColumns(stream?: BrandStream): number {
  return typeof stream?.columns === 'number' && stream.columns > 0 ? stream.columns : 80;
}
function streamRows(stream?: BrandStream): number | null {
  return typeof stream?.rows === 'number' && stream.rows > 0 ? stream.rows : null;
}
function artColorEnabled(stream?: BrandStream, env: BrandEnv = process.env): boolean {
  return env.NO_COLOR === undefined && Boolean(stream?.isTTY);
}
function brandColorDepth(env: BrandEnv): 'ansi16' | 'ansi256' | 'truecolor' {
  const t = env.TERM ?? '';
  const c = env.COLORTERM ?? '';
  return c === 'truecolor' || c === '24bit'
    ? 'truecolor'
    : t.includes('256color')
      ? 'ansi256'
      : 'ansi16';
}
function componentColor(component: BrandComponent) {
  return COMPONENT_COLORS[component];
}
function renderInk(
  value: string,
  component: BrandComponent,
  stream: BrandStream | undefined,
  env: BrandEnv,
): string {
  return artColorEnabled(stream, env)
    ? `\x1b[${ansiColor(componentColor(component), brandColorDepth(env))}m${value}\x1b[0m`
    : value;
}
function visibleComponent(component: BrandComponent, visibleParts: number): boolean {
  return COMPONENT_ORDER.indexOf(component) < visibleParts;
}
function canonicalOffset(stream: BrandStream | undefined, center: boolean): number {
  return center ? Math.max(0, Math.floor((streamColumns(stream) - CANONICAL_BRAND_WIDTH) / 2)) : 0;
}
function renderCanonical(
  stream: BrandStream | undefined,
  env: BrandEnv,
  center: boolean,
  visibleParts: number,
): string[] {
  const offset = canonicalOffset(stream, center);
  return CANONICAL_MASK.map((spans) => {
    let line = ' '.repeat(offset);
    let cursor = 0;
    for (const [start, end, component] of spans) {
      line += ' '.repeat(Math.max(0, start - cursor));
      if (visibleComponent(component, visibleParts))
        line += renderInk('█'.repeat(end - start + 1), component, stream, env);
      else line += ' '.repeat(end - start + 1);
      cursor = end + 1;
    }
    return line;
  });
}
function compactBand(widths: readonly number[], glyph: string): BrandArtBand {
  const top = Math.floor((COMPACT_ART_HEIGHT - widths.length) / 2);
  return Array.from({ length: COMPACT_ART_HEIGHT }, (_, row) =>
    (widths[row - top] ?? 0) ? glyph.repeat(widths[row - top] ?? 0) : '',
  );
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
const BRAND_ART_RICH = BRAND_ART_COMPACT_RICH;
const BRAND_ART_ASCII = BRAND_ART_COMPACT_ASCII;
const BRAND_ART_WIDE_RICH = BRAND_ART_COMPACT_RICH;
const BRAND_ART_WIDE_ASCII = BRAND_ART_COMPACT_ASCII;
function bandWidths(parts: BrandArtParts): number[] {
  return parts.map((band) => Math.max(0, ...band.map((line) => displayWidth(line))));
}
function padDisplayEnd(value: string, width: number): string {
  return `${value}${' '.repeat(Math.max(0, width - displayWidth(value)))}`;
}
function joinedWidth(parts: BrandArtParts): number {
  const widths = bandWidths(parts);
  return widths.reduce((sum, width) => sum + width, 0) + GAP.length * (parts.length - 1);
}
function partsForVariant(mode: DisplayMode): BrandArtParts {
  return mode === 'human-rich' ? BRAND_ART_COMPACT_RICH : BRAND_ART_COMPACT_ASCII;
}
function joinPlain(parts: BrandArtParts): string[] {
  const widths = bandWidths(parts);
  const first = parts[0];
  if (!first) return [];
  return first.map((_, row) =>
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
  const first = parts[0];
  if (!first) return [];
  const lines = first.map((_, row) =>
    parts
      .map((band, index) => {
        const cell = padDisplayEnd(band[row] || '', widths[index] ?? 0);
        const component = COMPONENT_ORDER[index];
        return index < visibleParts && component && artColorEnabled(stream, env)
          ? cell.replace(/(\S+)/g, (ink) => renderInk(ink, component, stream, env))
          : cell;
      })
      .join(GAP)
      .replace(/\s+$/, ''),
  );
  if (!center) return lines;
  return centerDisplayBlock(
    lines.map((line) => padDisplayEnd(line, joinedWidth(parts))),
    streamColumns(stream),
  ).map((line) => line.trimEnd());
}
function compactBrandFits(stream?: BrandStream): boolean {
  return (
    streamColumns(stream) >= COMPACT_ART_WIDTH &&
    (streamRows(stream) === null || (streamRows(stream) ?? 0) >= COMPACT_ART_HEIGHT)
  );
}
function canonicalBrandFits(stream?: BrandStream): boolean {
  return (
    streamColumns(stream) >= CANONICAL_BRAND_WIDTH &&
    (streamRows(stream) === null || (streamRows(stream) ?? 0) >= 48)
  );
}
function brandArtVariant(
  mode: DisplayMode,
  stream?: BrandStream,
  preferred?: Exclude<BrandArtVariant, 'minimal'>,
): BrandArtVariant {
  if (mode === 'machine') return 'minimal';
  if (mode === 'human-rich' && canonicalBrandFits(stream)) return 'wide';
  if (preferred === 'wide' && !compactBrandFits(stream)) return 'minimal';
  return compactBrandFits(stream) ? 'compact' : 'minimal';
}
function formatOneLineBrand(
  mode: DisplayMode = 'human-rich',
  stream?: BrandStream,
  env: BrandEnv = process.env,
): string {
  if (mode === 'machine') return '';
  if (mode !== 'human-rich') return `${ONE_LINE_PLAIN}\n`;
  if (!artColorEnabled(stream, env)) return `${ONE_LINE_RICH.join(INLINE_GAP)}\n`;
  return `${ONE_LINE_RICH.map((mark, i) => `\x1b[${ansiColor([COLORS.brand.secondary, COLORS.brand.primary, COLORS.brand.accent][i] ?? COLORS.brand.primary, brandColorDepth(env))}m${mark}\x1b[0m`).join(INLINE_GAP)}\n`;
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
    const line = formatOneLineBrand(mode, stream, env).trimEnd();
    return `${options.center ? centerDisplayLine(line, streamColumns(stream)) : line}\n`;
  }
  if (mode === 'human-rich' && variant === 'wide')
    return `${renderCanonical(stream, env, Boolean(options.center), Math.max(0, Math.min(3, options.visibleParts ?? 3))).join('\n')}\n`;
  const parts = partsForVariant(mode);
  const rendered =
    mode === 'human-rich'
      ? paintCompact(parts, stream, env, Boolean(options.center), options.visibleParts)
      : joinPlain(parts);
  return `${rendered.join('\n')}\n`;
}
function brandArtLineCount(mode: DisplayMode = 'human-rich', stream?: BrandStream): number {
  if (mode === 'machine') return 0;
  return brandArtVariant(mode, stream) === 'wide'
    ? CANONICAL_BRAND_HEIGHT
    : brandArtVariant(mode, stream) === 'compact'
      ? COMPACT_ART_HEIGHT
      : 1;
}
function brandArtWidth(mode: DisplayMode = 'human-rich', stream?: BrandStream): number {
  const variant = brandArtVariant(mode, stream);
  return variant === 'wide'
    ? CANONICAL_BRAND_WIDTH
    : variant === 'compact'
      ? joinedWidth(partsForVariant(mode))
      : 0;
}
function brandArtFitsTerminal(mode: DisplayMode, stream?: BrandStream): boolean {
  return brandArtVariant(mode, stream) !== 'minimal';
}
function shouldAnimateBrandArt(
  mode: DisplayMode,
  stream: BrandStream | undefined,
  env: BrandEnv = process.env,
  options: BrandArtOptions = {},
): boolean {
  return (
    mode === 'human-rich' &&
    Boolean(stream?.isTTY) &&
    canonicalBrandFits(stream) &&
    streamRows(stream) !== null &&
    (streamRows(stream) ?? 0) >= 48 &&
    env.CI === undefined &&
    env.TERM !== 'dumb' &&
    env.SDD_BRAND_ANIMATE !== '0' &&
    options.animate !== false &&
    !options.quiet
  );
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
    stream.write(
      options.center
        ? `${centerDisplayLine(
            formatOneLineBrand(mode, stream, env).trimEnd(),
            streamColumns(stream),
          )}\n`
        : formatOneLineBrand(mode, stream, env),
    );
    return;
  }
  if (!shouldAnimateBrandArt(mode, stream, env, options)) {
    stream.write(formatBrandArt(mode, stream, env, { center: Boolean(options.center) }));
    return;
  }
  await playBrandMotion(stream, env, {
    center: Boolean(options.center),
    durationMs: options.delayMs ?? DEFAULT_BRAND_ANIMATE_MS,
  });
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
  CANONICAL_BRAND_HEIGHT as CANONICAL_WIDE_HEIGHT,
  CANONICAL_BRAND_WIDTH as CANONICAL_WIDE_WIDTH,
  CANONICAL_MASK,
  COMPACT_ART_WIDTH,
  DEFAULT_BRAND_ANIMATE_MS,
  formatBrandArt,
  formatOneLineBrand,
  MAX_ART_WIDTH,
  shouldAnimateBrandArt,
  writeBrandArt,
};
