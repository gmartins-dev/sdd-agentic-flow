'use strict';

// Minimal, hand-rolled terminal styling (Milestone 4 — v1.4.0 CLI UX; extended v1.12.0).
// Not chalk/picocolors — this repository has zero runtime dependencies as a
// mechanically-enforced invariant (see the `package_integrity` check in
// bin/sdd-agentic-flow.js), so a styling dependency would break that promise.
// Colors are opt-out via NO_COLOR (https://no-color.org), opt-in via FORCE_COLOR
// only when the target stream is a real TTY, and always disabled when the stream
// isn't a TTY, so every non-interactive invocation (CI, pipes, the spawnSync-based
// test suite) sees byte-identical plain text. Branding is presentation, never protocol.

const { formatBrandArt, writeBrandArt } = require('./brand-art');

const STATUS_COLORS = {
  PASS: '32',
  WARN: '33',
  FAIL: '31',
  INFO: '36',
  PLAN: '35',
  PACK: '2',
};

const SYMBOLS = {
  success: { rich: '✓', ascii: 'OK' },
  warn: { rich: '!', ascii: 'WARN' },
  fail: { rich: '✗', ascii: 'FAIL' },
  next: { rich: '→', ascii: '->' },
  // Compact inline echo; welcome uses the full embedded block via styleBrand/formatBrandArt.
  brand: { rich: '›››', ascii: '>>>' },
};

function colorEnabled(stream, env = process.env) {
  if (env.NO_COLOR !== undefined) return false;
  if (!stream?.isTTY) return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0') return true;
  return true;
}

function styleStatus(status, stream, env = process.env) {
  const code = STATUS_COLORS[status];
  if (!code || !colorEnabled(stream, env)) return status;
  return `\x1b[${code}m${status}\x1b[0m`;
}

function outputMode(streams = {}, env = {}, flags = {}) {
  const stdoutTty = Boolean(streams.stdout?.isTTY);
  const stdinTty = Boolean(streams.stdin?.isTTY);
  if (flags.json || env.CI || !stdoutTty) return 'machine';
  if (flags.quiet) return 'human-plain';
  const asciiForced = Boolean(flags.ascii) || env.SDD_ASCII === '1';
  const colored = colorEnabled(streams.stdout, env);
  if (asciiForced || !colored || !stdinTty) return 'human-plain';
  return 'human-rich';
}

function isRich(mode) {
  return mode === 'human-rich';
}

function symbol(name, mode = 'human-rich') {
  const entry = SYMBOLS[name];
  if (!entry) return '';
  return mode === 'human-rich' ? entry.rich : entry.ascii;
}

// Full welcome brand block (embedded in bin/brand-art.js). Empty in machine mode.
function styleBrand(mode = 'human-rich', stream, env = process.env) {
  return formatBrandArt(mode, stream, env);
}

// Write welcome brand (async): left→right reveal in human-rich TTY; instant otherwise.
function writeBrand(mode = 'human-rich', stream, env = process.env, options = {}) {
  return writeBrandArt(mode, stream, env, options);
}

// Pure Fix/Next lines for the doctor human-rich footer. Empty when there is nothing
// specific to recommend (problems exist but no matched Fix rule).
function doctorFooterLines(checks = []) {
  const problems = checks.filter((check) => check.status === 'WARN' || check.status === 'FAIL');
  const lines = [];
  const config = checks.find((check) => check.name === 'config');
  if (
    config &&
    (config.status === 'WARN' || config.status === 'FAIL') &&
    /not found/i.test(config.message)
  ) {
    lines.push('Fix: npx sdd-agentic-flow init');
  }
  const context = checks.find((check) => check.name === 'project_context');
  if (
    context &&
    context.status === 'WARN' &&
    (/changed since generation/i.test(context.message) || /not found/i.test(context.message))
  ) {
    lines.push('Fix: npx sdd-agentic-flow discover --force');
  }
  if (!problems.length) lines.push('Next: invoke the sdd-route skill');
  return lines;
}

function levenshtein(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let col = 1; col < cols; col += 1) distances[0][col] = col;
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      distances[row][col] = Math.min(
        distances[row - 1][col] + 1,
        distances[row][col - 1] + 1,
        distances[row - 1][col - 1] + cost,
      );
    }
  }
  return distances[rows - 1][cols - 1];
}

const DID_YOU_MEAN_MAX_DISTANCE = 3;

function didYouMean(input, candidates) {
  if (!input || !candidates?.length) return null;
  const needle = String(input).toLowerCase();
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = levenshtein(needle, candidate.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return bestDistance <= DID_YOU_MEAN_MAX_DISTANCE ? best : null;
}

module.exports = {
  colorEnabled,
  styleStatus,
  outputMode,
  isRich,
  symbol,
  styleBrand,
  writeBrand,
  doctorFooterLines,
  didYouMean,
};
