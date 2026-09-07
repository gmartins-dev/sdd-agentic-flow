// Static SAF terminal branding. Geometry is generated from symbol.svg at build time;
// the published bundle never reads public/.

import {
  BRAND_VARIANTS,
  CANONICAL_BRAND_HEIGHT,
  CANONICAL_BRAND_MASK,
  CANONICAL_BRAND_WIDTH,
} from './brand-animation.generated';
import { playBrandMotion } from './brand-motion';
import { colorEnabled, detectColorDepth } from './terminal-color';
import { centerDisplayLine } from './terminal-geometry';
import { ansiColor, COLORS } from './terminal-theme';

const DEFAULT_BRAND_ANIMATE_MS = 590;
const COMPACT_ART_WIDTH = 54;
const MAX_ART_WIDTH = CANONICAL_BRAND_WIDTH;
const INLINE_GAP = '  ';
const ONE_LINE_RICH = ['›', '››', '›››'] as const;
const ONE_LINE_PLAIN = '>  >>  >>>';
type DisplayMode = 'human-rich' | 'human-plain' | 'machine';
type BrandArtVariant = 'wide' | 'medium' | 'compact' | 'minimal';
type BrandComponent = 'small' | 'medium' | 'large';
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
  contentRows?: number;
};
const COMPONENT_ORDER: readonly BrandComponent[] = ['small', 'medium', 'large'];
const COMPONENT_COLORS = {
  small: COLORS.brand.secondary,
  medium: COLORS.brand.primary,
  large: COLORS.brand.accent,
} as const;
const CANONICAL_MASK = CANONICAL_BRAND_MASK;

function streamColumns(stream?: BrandStream): number {
  return typeof stream?.columns === 'number' && stream.columns > 0 ? stream.columns : 80;
}
function streamRows(stream?: BrandStream): number | null {
  return typeof stream?.rows === 'number' && stream.rows > 0 ? stream.rows : null;
}
function artColorEnabled(stream?: BrandStream, env: BrandEnv = process.env): boolean {
  return colorEnabled(stream, env);
}
function brandColorDepth(env: BrandEnv): 'ansi16' | 'ansi256' | 'truecolor' {
  const depth = detectColorDepth({ isTTY: true }, env);
  return depth === 'none' ? 'ansi16' : depth;
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
type GeneratedVariantName = keyof typeof BRAND_VARIANTS;
type GeneratedRun = { column: number; text: string; role: string };

function generatedVariantName(
  stream: BrandStream | undefined,
  variant: BrandArtVariant,
): GeneratedVariantName {
  if (variant === 'wide' || variant === 'medium' || variant === 'compact') return variant;
  return streamColumns(stream) >= 54 ? 'medium' : 'compact';
}

function generatedLines(
  mode: DisplayMode,
  variant: GeneratedVariantName,
  stream: BrandStream | undefined,
  env: BrandEnv,
  center: boolean,
  visibleParts: number,
): string[] {
  const rows = BRAND_VARIANTS[variant][
    mode === 'human-rich' ? 'rich' : 'ascii'
  ] as readonly (readonly GeneratedRun[])[];
  const width = BRAND_VARIANTS[variant].width;
  const offset = center ? Math.max(0, Math.floor((streamColumns(stream) - width) / 2)) : 0;
  return rows.map((runs) => {
    let line = ' '.repeat(offset);
    let cursor = offset;
    for (const run of runs) {
      const component = run.role.replace('brand.', '') as BrandComponent;
      line += ' '.repeat(Math.max(0, run.column + offset - cursor));
      if (visibleComponent(component, visibleParts)) {
        const value =
          mode === 'human-rich' && artColorEnabled(stream, env)
            ? renderInk(run.text, component, stream, env)
            : run.text;
        line += value;
      } else line += ' '.repeat(run.text.length);
      cursor = run.column + offset + run.text.length;
    }
    return line;
  });
}
function variantFits(
  variant: Exclude<BrandArtVariant, 'minimal'>,
  stream?: BrandStream,
  contentRows?: number,
): boolean {
  const generated = BRAND_VARIANTS[variant];
  const minimumRows =
    contentRows === undefined
      ? variant === 'wide'
        ? 48
        : generated.height
      : generated.height + Math.max(0, contentRows);
  return (
    streamColumns(stream) >= generated.width &&
    (streamRows(stream) === null || (streamRows(stream) ?? 0) >= minimumRows)
  );
}
function brandArtVariant(
  mode: DisplayMode,
  stream?: BrandStream,
  preferred?: Exclude<BrandArtVariant, 'minimal'>,
  contentRows?: number,
): BrandArtVariant {
  if (mode === 'machine') return 'minimal';
  if (preferred && variantFits(preferred, stream, contentRows)) return preferred;
  const variants: readonly Exclude<BrandArtVariant, 'minimal'>[] =
    mode === 'human-rich' ? ['wide', 'medium', 'compact'] : ['medium', 'compact'];
  return variants.find((variant) => variantFits(variant, stream, contentRows)) ?? 'minimal';
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
  options: Pick<BrandArtOptions, 'center' | 'visibleParts' | 'variant' | 'contentRows'> = {},
): string {
  if (mode === 'machine') return '';
  const variant = brandArtVariant(mode, stream, options.variant, options.contentRows);
  if (variant === 'minimal') {
    const line = formatOneLineBrand(mode, stream, env).trimEnd();
    return `${options.center ? centerDisplayLine(line, streamColumns(stream)) : line}\n`;
  }
  const rendered = generatedLines(
    mode,
    generatedVariantName(stream, variant),
    stream,
    env,
    Boolean(options.center),
    Math.max(0, Math.min(3, options.visibleParts ?? 3)),
  );
  return `${rendered.join('\n')}\n`;
}
function brandArtLineCount(mode: DisplayMode = 'human-rich', stream?: BrandStream): number {
  if (mode === 'machine') return 0;
  const variant = brandArtVariant(mode, stream);
  return variant === 'minimal' ? 1 : BRAND_VARIANTS[generatedVariantName(stream, variant)].height;
}
function brandArtWidth(mode: DisplayMode = 'human-rich', stream?: BrandStream): number {
  const variant = brandArtVariant(mode, stream);
  return variant === 'minimal' ? 0 : BRAND_VARIANTS[generatedVariantName(stream, variant)].width;
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
    variantFits('wide', stream) &&
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
    const formatOptions: Pick<BrandArtOptions, 'center' | 'contentRows' | 'variant'> = {
      center: Boolean(options.center),
    };
    if (options.contentRows !== undefined) formatOptions.contentRows = options.contentRows;
    if (options.variant !== undefined) formatOptions.variant = options.variant;
    stream.write(formatBrandArt(mode, stream, env, formatOptions));
    return;
  }
  await playBrandMotion(stream, env, {
    center: Boolean(options.center),
    durationMs: options.delayMs ?? DEFAULT_BRAND_ANIMATE_MS,
  });
}

export type { BrandArtOptions, BrandArtVariant, BrandStream, DisplayMode };
export {
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
