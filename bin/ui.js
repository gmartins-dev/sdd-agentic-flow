'use strict';

// Minimal, hand-rolled terminal styling (Milestone 4 — v1.4.0 CLI UX). Not chalk/picocolors —
// this repository has zero runtime dependencies as a mechanically-enforced invariant (see the
// `package_integrity` check in bin/sdd-agentic-flow.js), so a styling dependency would break
// that promise. Colors are opt-out via NO_COLOR (https://no-color.org) and always disabled when
// the target stream isn't a real TTY, so every non-interactive invocation (CI, pipes, the
// spawnSync-based test suite) sees byte-identical plain text.

const STATUS_COLORS = {
  PASS: '32',
  WARN: '33',
  FAIL: '31',
  INFO: '36',
  PLAN: '35',
  PACK: '2',
};

function colorEnabled(stream, env = process.env) {
  if (env.NO_COLOR !== undefined) return false;
  return Boolean(stream?.isTTY);
}

function styleStatus(status, stream, env = process.env) {
  const code = STATUS_COLORS[status];
  if (!code || !colorEnabled(stream, env)) return status;
  return `\x1b[${code}m${status}\x1b[0m`;
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

module.exports = { colorEnabled, styleStatus, didYouMean };
