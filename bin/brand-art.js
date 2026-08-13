'use strict';

// Compact welcome brand art (v1.13.1) — three chevrons, terminal-safe size.
// Target: ~7–10 lines, ≤52 columns (CLIG / Hermes ASCII sizing). No public/ runtime read.
// Shown only in human-rich / human-plain; omitted in machine (pipe/CI/agents).

const BRAND_ANSI = ['38;2;75;62;168', '38;2;109;94;240', '38;2;139;125;255'];
const GAP = '  ';
const DEFAULT_BRAND_ANIMATE_MS = 160;
const MAX_ART_WIDTH = 52;
const ONE_LINE_RICH = ['›', '›', '›'];
const ONE_LINE_PLAIN = '>>>';

// Compact three-chevron bands (height 9). Joined width stays well under 52 columns.
const BRAND_ART_RICH = [
  ['▓', '▓▓', '▓▓▓▓', '▓▓▓▓▓▓', '▓▓▓▓▓▓▓▓', '▓▓▓▓▓▓', '▓▓▓▓', '▓▓', '▓'],
  ['▓▓', '▓▓▓▓', '▓▓▓▓▓▓', '▓▓▓▓▓▓▓▓', '▓▓▓▓▓▓▓▓▓▓', '▓▓▓▓▓▓▓▓', '▓▓▓▓▓▓', '▓▓▓▓', '▓▓'],
  ['▒▒', '▒▒▒▒', '▒▒▒▒▒▒', '▒▒▒▒▒▒▒▒', '▒▒▒▒▒▒▒▒▒▒', '▒▒▒▒▒▒▒▒', '▒▒▒▒▒▒', '▒▒▒▒', '▒▒'],
];

const BRAND_ART_ASCII = [
  ['#', '##', '####', '######', '########', '######', '####', '##', '#'],
  ['++', '++++', '++++++', '++++++++', '++++++++++', '++++++++', '++++++', '++++', '++'],
  ['==', '====', '======', '========', '==========', '========', '======', '====', '=='],
];

function artColorEnabled(stream, env = process.env) {
  if (env.NO_COLOR !== undefined) return false;
  if (!stream?.isTTY) return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0') return true;
  return true;
}

function bandWidths(parts) {
  return parts.map((band) => Math.max(0, ...band.map((line) => line.length)));
}

function joinedWidth(parts) {
  if (!parts?.length) return 0;
  const widths = bandWidths(parts);
  return widths.reduce((sum, width) => sum + width, 0) + GAP.length * (parts.length - 1);
}

function joinArt(parts) {
  const widths = bandWidths(parts);
  return parts[0].map((_, row) =>
    parts
      .map((band, index) => (band[row] || '').padEnd(widths[index], ' '))
      .join(GAP)
      .replace(/\s+$/, ''),
  );
}

function paintArt(parts, stream, env) {
  const widths = bandWidths(parts);
  const colorOn = artColorEnabled(stream, env);
  return parts[0].map((_, row) =>
    parts
      .map((band, index) => {
        const cell = (band[row] || '').padEnd(widths[index], ' ');
        if (!colorOn) return cell;
        const code = BRAND_ANSI[index] || BRAND_ANSI[0];
        return cell.replace(/(\S+)/g, (ink) => `\x1b[${code}m${ink}\x1b[0m`);
      })
      .join(GAP)
      .replace(/\s+$/, ''),
  );
}

function artPartsFor(mode) {
  if (mode === 'machine') return null;
  return mode === 'human-rich' ? BRAND_ART_RICH : BRAND_ART_ASCII;
}

/** Full brand block for welcome. Empty in machine mode. Trailing newline when non-empty. */
function formatBrandArt(mode = 'human-rich', stream, env = process.env) {
  const parts = artPartsFor(mode);
  if (!parts) return '';
  const painted = mode === 'human-rich' ? paintArt(parts, stream, env) : joinArt(parts);
  return `${painted.join('\n')}\n`;
}

function brandArtLineCount(mode = 'human-rich') {
  const parts = artPartsFor(mode);
  return parts?.[0]?.length || 0;
}

function brandArtWidth(mode = 'human-rich') {
  const parts = artPartsFor(mode);
  return parts ? joinedWidth(parts) : 0;
}

function formatOneLineBrand(mode = 'human-rich', stream, env = process.env) {
  if (mode === 'machine') return '';
  if (mode !== 'human-rich') return `${ONE_LINE_PLAIN}\n`;
  if (!artColorEnabled(stream, env)) return `${ONE_LINE_RICH.join('')}\n`;
  return `${ONE_LINE_RICH.map((mark, index) => {
    const code = BRAND_ANSI[index] || BRAND_ANSI[0];
    return `\x1b[${code}m${mark}\x1b[0m`;
  }).join('')}\n`;
}

/** False when the TTY reports columns/rows too small for the compact block. */
function brandArtFitsTerminal(mode, stream) {
  const parts = artPartsFor(mode);
  if (!parts) return false;
  const height = parts[0].length;
  const width = joinedWidth(parts);
  if (typeof stream?.columns === 'number' && stream.columns > 0 && stream.columns < width)
    return false;
  if (typeof stream?.rows === 'number' && stream.rows > 0 && stream.rows < height + 10)
    return false;
  return true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Left→right chevron reveal: human-rich TTY only. Never in machine/plain/CI/--quiet. */
function shouldAnimateBrandArt(mode, stream, env = process.env, options = {}) {
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
async function writeBrandArt(mode = 'human-rich', stream, env = process.env, options = {}) {
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

  const lineCount = parts[0].length;
  for (let visible = 1; visible <= parts.length; visible += 1) {
    if (visible > 1) stream.write(`\x1b[${lineCount}A`);
    const frame = paintArt(parts.slice(0, visible), stream, env);
    stream.write(`${frame.map((line) => `${line}\x1b[K`).join('\n')}\n`);
    if (visible < parts.length && delayMs > 0) await sleep(delayMs);
  }
}

module.exports = {
  formatBrandArt,
  formatOneLineBrand,
  writeBrandArt,
  shouldAnimateBrandArt,
  brandArtFitsTerminal,
  brandArtLineCount,
  brandArtWidth,
  BRAND_ART_RICH,
  BRAND_ART_ASCII,
  DEFAULT_BRAND_ANIMATE_MS,
  MAX_ART_WIDTH,
};
