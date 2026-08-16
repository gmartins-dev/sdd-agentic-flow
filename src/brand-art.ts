// Compact welcome brand art (v1.13.1) — three chevrons, terminal-safe size.
// Target: ~7–10 lines, ≤52 columns (CLIG / Hermes ASCII sizing). No public/ runtime read.
// Shown only in human-rich / human-plain; omitted in machine (pipe/CI/agents).

const BRAND_ANSI = ['38;2;75;62;168', '38;2;109;94;240', '38;2;139;125;255'] as const;
const GAP = '  ';
const DEFAULT_BRAND_ANIMATE_MS = 160;
const MAX_ART_WIDTH = 52;
const ONE_LINE_RICH = ['›', '›', '›'] as const;
const ONE_LINE_PLAIN = '>>>';

type DisplayMode = 'human-rich' | 'human-plain' | 'machine';
type BrandArtBand = readonly string[];
type BrandArtParts = readonly BrandArtBand[];

type BrandStream = {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
  write: (chunk: string) => boolean | undefined;
};

type BrandEnv = NodeJS.ProcessEnv;

type BrandArtOptions = {
  quiet?: boolean | undefined;
  animate?: boolean | undefined;
  delayMs?: number | undefined;
};

// Compact three-chevron bands (height 9). Joined width stays well under 52 columns.
const BRAND_ART_RICH: BrandArtParts = [
  ['▓', '▓▓', '▓▓▓▓', '▓▓▓▓▓▓', '▓▓▓▓▓▓▓▓', '▓▓▓▓▓▓', '▓▓▓▓', '▓▓', '▓'],
  ['▓▓', '▓▓▓▓', '▓▓▓▓▓▓', '▓▓▓▓▓▓▓▓', '▓▓▓▓▓▓▓▓▓▓', '▓▓▓▓▓▓▓▓', '▓▓▓▓▓▓', '▓▓▓▓', '▓▓'],
  ['▒▒', '▒▒▒▒', '▒▒▒▒▒▒', '▒▒▒▒▒▒▒▒', '▒▒▒▒▒▒▒▒▒▒', '▒▒▒▒▒▒▒▒', '▒▒▒▒▒▒', '▒▒▒▒', '▒▒'],
];

const BRAND_ART_ASCII: BrandArtParts = [
  ['#', '##', '####', '######', '########', '######', '####', '##', '#'],
  ['++', '++++', '++++++', '++++++++', '++++++++++', '++++++++', '++++++', '++++', '++'],
  ['==', '====', '======', '========', '==========', '========', '======', '====', '=='],
];

function artColorEnabled(stream: BrandStream | undefined, env: BrandEnv = process.env): boolean {
  if (env.NO_COLOR !== undefined) return false;
  if (!stream?.isTTY) return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0') return true;
  return true;
}

function bandWidths(parts: BrandArtParts): number[] {
  return parts.map((band) => Math.max(0, ...band.map((line) => line.length)));
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
      .map((band, index) => (band[row] || '').padEnd(widths[index] ?? 0, ' '))
      .join(GAP)
      .replace(/\s+$/, ''),
  );
}

function paintArt(parts: BrandArtParts, stream: BrandStream | undefined, env: BrandEnv): string[] {
  const widths = bandWidths(parts);
  const colorOn = artColorEnabled(stream, env);
  const firstBand = parts[0];
  if (!firstBand) return [];
  return firstBand.map((_, row) =>
    parts
      .map((band, index) => {
        const cell = (band[row] || '').padEnd(widths[index] ?? 0, ' ');
        if (!colorOn) return cell;
        const code = BRAND_ANSI[index] || BRAND_ANSI[0];
        return cell.replace(/(\S+)/g, (ink) => `\x1b[${code}m${ink}\x1b[0m`);
      })
      .join(GAP)
      .replace(/\s+$/, ''),
  );
}

function artPartsFor(mode: DisplayMode): BrandArtParts | null {
  if (mode === 'machine') return null;
  return mode === 'human-rich' ? BRAND_ART_RICH : BRAND_ART_ASCII;
}

/** Full brand block for welcome. Empty in machine mode. Trailing newline when non-empty. */
function formatBrandArt(
  mode: DisplayMode = 'human-rich',
  stream?: BrandStream,
  env: BrandEnv = process.env,
): string {
  const parts = artPartsFor(mode);
  if (!parts) return '';
  const painted = mode === 'human-rich' ? paintArt(parts, stream, env) : joinArt(parts);
  return `${painted.join('\n')}\n`;
}

function brandArtLineCount(mode: DisplayMode = 'human-rich'): number {
  const parts = artPartsFor(mode);
  return parts?.[0]?.length || 0;
}

function brandArtWidth(mode: DisplayMode = 'human-rich'): number {
  const parts = artPartsFor(mode);
  return parts ? joinedWidth(parts) : 0;
}

function formatOneLineBrand(
  mode: DisplayMode = 'human-rich',
  stream?: BrandStream,
  env: BrandEnv = process.env,
): string {
  if (mode === 'machine') return '';
  if (mode !== 'human-rich') return `${ONE_LINE_PLAIN}\n`;
  if (!artColorEnabled(stream, env)) return `${ONE_LINE_RICH.join('')}\n`;
  return `${ONE_LINE_RICH.map((mark, index) => {
    const code = BRAND_ANSI[index] || BRAND_ANSI[0];
    return `\x1b[${code}m${mark}\x1b[0m`;
  }).join('')}\n`;
}

/** False when the TTY reports columns/rows too small for the compact block. */
function brandArtFitsTerminal(mode: DisplayMode, stream: BrandStream | undefined): boolean {
  const parts = artPartsFor(mode);
  if (!parts) return false;
  const firstBand = parts[0];
  if (!firstBand) return false;
  const height = firstBand.length;
  const width = joinedWidth(parts);
  if (typeof stream?.columns === 'number' && stream.columns > 0 && stream.columns < width)
    return false;
  if (typeof stream?.rows === 'number' && stream.rows > 0 && stream.rows < height + 10)
    return false;
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Left→right chevron reveal: human-rich TTY only. Never in machine/plain/CI/--quiet. */
function shouldAnimateBrandArt(
  mode: DisplayMode,
  stream: BrandStream | undefined,
  env: BrandEnv = process.env,
  options: BrandArtOptions = {},
): boolean {
  if (mode !== 'human-rich') return false;
  if (!stream?.isTTY) return false;
  if (env.CI) return false;
  if (options.quiet) return false;
  if (env.SDD_BRAND_ANIMATE === '0') return false;
  if (options.animate === false) return false;
  return true;
}

/**
 * Write welcome brand art to stream. Compact block; human-rich TTY reveals bands 1→2→3
 * (~160ms steps). Tiny TTY (columns/rows) falls back to a one-line mark. Plain / machine /
 * CI / --quiet / SDD_BRAND_ANIMATE=0 stay instant (or empty).
 */
async function writeBrandArt(
  mode: DisplayMode = 'human-rich',
  stream?: BrandStream,
  env: BrandEnv = process.env,
  options: BrandArtOptions = {},
): Promise<void> {
  if (mode === 'machine' || !stream) return;

  const parts = artPartsFor(mode);
  if (!parts) return;

  if (!brandArtFitsTerminal(mode, stream)) {
    stream.write(formatOneLineBrand(mode, stream, env));
    return;
  }

  const delayMs = options.delayMs ?? DEFAULT_BRAND_ANIMATE_MS;
  const animate = shouldAnimateBrandArt(mode, stream, env, options);

  if (!animate) {
    const art = formatBrandArt(mode, stream, env);
    if (art) stream.write(art);
    return;
  }

  const firstBand = parts[0];
  if (!firstBand) return;
  const lineCount = firstBand.length;
  for (let visible = 1; visible <= parts.length; visible += 1) {
    if (visible > 1) stream.write(`\x1b[${lineCount}A`);
    const frame = paintArt(parts.slice(0, visible), stream, env);
    stream.write(`${frame.map((line) => `${line}\x1b[K`).join('\n')}\n`);
    if (visible < parts.length && delayMs > 0) await sleep(delayMs);
  }
}

export type { BrandArtOptions, BrandStream, DisplayMode };
export {
  BRAND_ART_ASCII,
  BRAND_ART_RICH,
  brandArtFitsTerminal,
  brandArtLineCount,
  brandArtWidth,
  DEFAULT_BRAND_ANIMATE_MS,
  formatBrandArt,
  formatOneLineBrand,
  MAX_ART_WIDTH,
  shouldAnimateBrandArt,
  writeBrandArt,
};
