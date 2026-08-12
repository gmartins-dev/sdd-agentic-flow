'use strict';

// Embedded welcome brand art for the published CLI package (no runtime read of public/).
// Three chevrons from the project symbol — Unicode blocks for human-rich, #/+/ = for ASCII.
// Shown only in human-rich / human-plain; omitted in machine (pipe/CI/agents).

const BRAND_ANSI = ['38;2;75;62;168', '38;2;109;94;240', '38;2;139;125;255'];
const GAP = '  ';

const BRAND_ART_RICH = [
  [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '▓▓',
    '▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓',
    '▓▓',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
  [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '▓',
    '▓▓▓▓',
    '▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓▓▓',
    '▓▓▓▓▓▓',
    '▓▓▓▓',
    '▓',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
  [
    '▒▒▒',
    '▒▒▒▒▒',
    '▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒▒▒',
    '▒▒▒▒▒▒▒',
    '▒▒▒▒▒',
    '▒▒▒',
  ],
];

const BRAND_ART_ASCII = [
  [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '##',
    '######',
    '#########',
    '############',
    '################',
    '################',
    '############',
    '#########',
    '######',
    '##',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
  [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '+',
    '++++',
    '++++++',
    '++++++++',
    '+++++++++++',
    '+++++++++++++',
    '+++++++++++++++',
    '++++++++++++++++++',
    '++++++++++++++++++++',
    '++++++++++++++++++++++',
    '+++++++++++++++++++++++++',
    '+++++++++++++++++++++++++',
    '++++++++++++++++++++++',
    '++++++++++++++++++++',
    '++++++++++++++++++',
    '+++++++++++++++',
    '+++++++++++++',
    '+++++++++++',
    '++++++++',
    '++++++',
    '++++',
    '+',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ],
  [
    '===',
    '=====',
    '=======',
    '=========',
    '==========',
    '============',
    '==============',
    '================',
    '==================',
    '====================',
    '=====================',
    '=======================',
    '=========================',
    '===========================',
    '=============================',
    '===============================',
    '================================',
    '==================================',
    '====================================',
    '====================================',
    '==================================',
    '================================',
    '===============================',
    '=============================',
    '===========================',
    '=========================',
    '=======================',
    '=====================',
    '====================',
    '==================',
    '================',
    '==============',
    '============',
    '==========',
    '=========',
    '=======',
    '=====',
    '===',
  ],
];

function artColorEnabled(stream, env = process.env) {
  if (env.NO_COLOR !== undefined) return false;
  if (!stream?.isTTY) return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0') return true;
  return true;
}

function joinArt(parts) {
  const widths = parts.map((band) => Math.max(0, ...band.map((line) => line.length)));
  return parts[0].map((_, row) =>
    parts
      .map((band, index) => (band[row] || '').padEnd(widths[index], ' '))
      .join(GAP)
      .replace(/\s+$/, ''),
  );
}

function paintArt(parts, stream, env) {
  const widths = parts.map((band) => Math.max(0, ...band.map((line) => line.length)));
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

/** Full brand block for welcome. Empty in machine mode. Trailing newline when non-empty. */
function formatBrandArt(mode = 'human-rich', stream, env = process.env) {
  if (mode === 'machine') return '';
  const parts = mode === 'human-rich' ? BRAND_ART_RICH : BRAND_ART_ASCII;
  const painted = mode === 'human-rich' ? paintArt(parts, stream, env) : joinArt(parts);
  return `${painted.join('\n')}\n`;
}

function brandArtLineCount(mode = 'human-rich') {
  if (mode === 'machine') return 0;
  const parts = mode === 'human-rich' ? BRAND_ART_RICH : BRAND_ART_ASCII;
  return parts[0]?.length || 0;
}

const DEFAULT_BRAND_ANIMATE_MS = 60;

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
 * Write welcome brand art to stream. human-rich TTY reveals bands 1→2→3 (~60ms steps);
 * human-plain / machine / CI / --quiet / SDD_BRAND_ANIMATE=0 stay instant (or empty).
 */
async function writeBrandArt(mode = 'human-rich', stream, env = process.env, options = {}) {
  if (mode === 'machine' || !stream) return;

  const parts = mode === 'human-rich' ? BRAND_ART_RICH : BRAND_ART_ASCII;
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
  writeBrandArt,
  shouldAnimateBrandArt,
  brandArtLineCount,
  BRAND_ART_RICH,
  BRAND_ART_ASCII,
  DEFAULT_BRAND_ANIMATE_MS,
};
