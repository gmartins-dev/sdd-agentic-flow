// Minimal, hand-rolled terminal styling (Milestone 4 — v1.4.0 CLI UX; extended v1.12.0).
// Not chalk/picocolors — this repository has zero runtime dependencies as a
// mechanically-enforced invariant (see the `package_integrity` check in
// src/sdd-agentic-flow.ts), so a styling dependency would break that promise.
// Colors are opt-out via NO_COLOR (https://no-color.org), opt-in via FORCE_COLOR
// only when the target stream is a real TTY, and always disabled when the stream
// isn't a TTY, so every non-interactive invocation (CI, pipes, the spawnSync-based
// test suite) sees byte-identical plain text. Branding is presentation, never protocol.

import path from 'node:path';
import { type BrandStream, type DisplayMode, formatBrandArt, writeBrandArt } from './brand-art';
import type { DoctorCheck } from './doctor-view';
import { SAF_ASCII_GLYPHS, SAF_GLYPHS, SAF_THEME, safGlyph, symbol } from './terminal-theme';

const STATUS_COLORS = {
  PASS: '32',
  WARN: '33',
  FAIL: '31',
  INFO: '36',
  PLAN: '35',
  PACK: '2',
} as const;

type StatusName = keyof typeof STATUS_COLORS;
type OutputStreams = {
  stdin?: BrandStream;
  stdout?: BrandStream;
};

type OutputFlags = {
  json?: boolean;
  machine?: boolean;
  quiet?: boolean;
  ascii?: boolean;
};

type OutputFormat = 'human' | 'machine';
type HumanPresentation = 'rich' | 'plain';
type ColorDepth = 'none' | 'ansi16' | 'ansi256' | 'truecolor';
type TerminalBreakpoint = 'wide' | 'compact' | 'narrow' | 'minimal';
type MotionLevel = 'none' | 'instant' | 'active';
type TerminalCapabilities = {
  interactive: boolean;
  color: boolean;
  unicode: boolean;
  cursor: boolean;
  rawInput: boolean;
  animation: boolean;
  width: number;
  height: number | null;
  colorDepth: ColorDepth;
};
type PresentationContext = TerminalCapabilities & { mode: DisplayMode };

type ShortenPathOptions = {
  homeDir?: string;
  cwd?: string;
};

type BrandOptions = {
  quiet?: boolean;
  animate?: boolean;
  delayMs?: number;
  center?: boolean;
};

function colorEnabled(
  stream: BrandStream | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NO_COLOR !== undefined) return false;
  if (!stream?.isTTY) return false;
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0') return true;
  return true;
}

function colorDepth(
  stream: BrandStream | undefined,
  env: NodeJS.ProcessEnv = process.env,
): ColorDepth {
  if (!colorEnabled(stream, env)) return 'none';
  const terminal = env.TERM ?? '';
  const colorTerminal = env.COLORTERM ?? '';
  if (colorTerminal === 'truecolor' || colorTerminal === '24bit') return 'truecolor';
  if (terminal.includes('256color')) return 'ansi256';
  return 'ansi16';
}

function terminalCapabilities(
  streams: OutputStreams = {},
  env: NodeJS.ProcessEnv = process.env,
  flags: OutputFlags = {},
): TerminalCapabilities {
  const interactive = Boolean(streams.stdin?.isTTY && streams.stdout?.isTTY && !env.CI);
  const rawInput =
    interactive &&
    typeof (streams.stdin as (NodeJS.ReadStream & { setRawMode?: unknown }) | undefined)
      ?.setRawMode === 'function';
  const dumb = env.TERM === 'dumb';
  const color = !flags.json && !flags.machine && colorEnabled(streams.stdout, env);
  const plain = Boolean(flags.quiet || flags.ascii || env.SDD_ASCII === '1' || dumb);
  return {
    interactive,
    color: color && !plain,
    unicode: !plain,
    cursor: interactive && !plain && !dumb,
    rawInput,
    animation: interactive && !plain && env.SDD_BRAND_ANIMATE !== '0',
    width: terminalColumns(streams.stdout || process.stdout),
    height: terminalRows(streams.stdout),
    colorDepth: color && !plain ? colorDepth(streams.stdout, env) : 'none',
  };
}

function resolvePresentationContext(
  streams: OutputStreams = {},
  env: NodeJS.ProcessEnv = process.env,
  flags: OutputFlags = {},
): PresentationContext {
  const capabilities = terminalCapabilities(streams, env, flags);
  const machine = Boolean(flags.json || flags.machine);
  const forcedPlain = Boolean(
    flags.quiet || flags.ascii || env.SDD_ASCII === '1' || env.TERM === 'dumb',
  );
  const mode: DisplayMode = machine
    ? 'machine'
    : capabilities.interactive && !forcedPlain
      ? 'human-rich'
      : 'human-plain';
  return { ...capabilities, mode };
}

function clearViewport(
  streams: OutputStreams = {},
  env: NodeJS.ProcessEnv = process.env,
  flags: OutputFlags = {},
): boolean {
  const output = streams.stdout;
  if (!output || !terminalCapabilities(streams, env, flags).cursor) return false;
  output.write('\x1b[H\x1b[2J');
  return true;
}

function styleStatus(
  status: string,
  stream: BrandStream | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const code = STATUS_COLORS[status as StatusName];
  if (!code || !colorEnabled(stream, env)) return status;
  return `\x1b[${code}m${status}\x1b[0m`;
}

function outputMode(
  streams: OutputStreams = {},
  env: NodeJS.ProcessEnv = {},
  flags: OutputFlags = {},
): DisplayMode {
  // A pipe changes presentation, not the semantic contract. JSON is the only
  // public machine protocol; ordinary CI and redirected output stay readable.
  if (flags.json || flags.machine) return 'machine';
  return resolvePresentationContext(streams, env, flags).mode;
}

function terminalBreakpoint(width: number): TerminalBreakpoint {
  if (width >= SAF_THEME.breakpoints.wide) return 'wide';
  if (width >= SAF_THEME.breakpoints.compact) return 'compact';
  if (width >= SAF_THEME.breakpoints.narrow) return 'narrow';
  return 'minimal';
}

function motionLevel(context: PresentationContext): MotionLevel {
  if (!context.interactive || context.mode !== 'human-rich') return 'none';
  return context.animation ? 'active' : 'instant';
}

function isRich(mode: DisplayMode): boolean {
  return mode === 'human-rich';
}

// Full welcome brand block (embedded in src/brand-art.ts). Empty in machine mode.
function styleBrand(
  mode: DisplayMode = 'human-rich',
  stream?: BrandStream,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return formatBrandArt(mode, stream, env);
}

// Write welcome brand (async): left-to-right reveal in human-rich TTY; instant otherwise.
function writeBrand(
  mode: DisplayMode = 'human-rich',
  stream?: BrandStream,
  env: NodeJS.ProcessEnv = process.env,
  options: BrandOptions = {},
): Promise<void> {
  return writeBrandArt(mode, stream, env, options);
}

// Pure Fix/Next lines for the doctor human-rich footer. Empty when there is nothing
// specific to recommend (problems exist but no matched Fix rule).
function doctorFooterLines(checks: DoctorCheck[] = []): string[] {
  const problems = checks.filter((check) => check.status === 'WARN' || check.status === 'FAIL');
  const lines: string[] = [];
  const config = checks.find((check) => check.name === 'config');
  if (
    config &&
    (config.status === 'WARN' || config.status === 'FAIL') &&
    /not found/i.test(config.message ?? '')
  ) {
    lines.push(`Fix: ${renderCliCommand('init')}`);
  }
  const context = checks.find((check) => check.name === 'project_context');
  if (
    context &&
    context.status === 'WARN' &&
    (/changed since generation/i.test(context.message ?? '') ||
      /not found/i.test(context.message ?? ''))
  ) {
    lines.push(`Fix: ${renderCliCommand('context', 'refresh')}`);
  }
  if (!problems.length) {
    lines.push('Next: use your coding agent with the installed SDD workflow');
    lines.push(`Next: ${renderCliCommand('doctor')}`);
  }
  return lines;
}

function terminalColumns(stream: BrandStream = process.stdout, fallback = 80): number {
  const width = stream?.columns;
  return typeof width === 'number' && width > 0 ? width : fallback;
}

function terminalRows(stream?: BrandStream): number | null {
  const rows = stream?.rows;
  return typeof rows === 'number' && rows > 0 ? rows : null;
}

function renderSection(title: string, mode: DisplayMode = 'human-rich'): string[] {
  if (mode === 'machine') return [];
  return [`\n${title}`, `${'-'.repeat(Math.min(title.length, terminalColumns()))}`];
}

function renderKeyValue(key: string, value: string, mode: DisplayMode = 'human-rich'): string[] {
  if (mode === 'machine') return [];
  const width = terminalColumns();
  const available = Math.max(20, width - key.length - 4);
  if (value.length <= available)
    return [`${key}${' '.repeat(Math.max(2, 12 - key.length))}${value}`];
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [key];
  let current = '';
  for (const word of words) {
    if (current && current.length + word.length + 1 > available) {
      lines.push(`  ${current}`);
      current = '';
    }
    current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(`  ${current}`);
  return lines;
}

function renderStep(
  current: number,
  total: number,
  label: string,
  mode: DisplayMode = 'human-rich',
  stepLabel = 'Step',
): string[] {
  if (mode === 'machine') return [`step=${current}/${total} label=${label}`];
  return [`${stepLabel} ${current}/${total}  ${label}`];
}

function renderWarning(message: string, mode: DisplayMode = 'human-rich'): string {
  if (mode === 'machine') return `WARN ${message}`;
  return `${symbol('warn', mode)} ${message}`;
}

function renderSuccess(message: string, mode: DisplayMode = 'human-rich'): string {
  if (mode === 'machine') return `PASS ${message}`;
  return `${symbol('success', mode)} ${message}`;
}

function shortenPath(
  value: string | undefined,
  { homeDir, cwd }: ShortenPathOptions = {},
): string | undefined {
  if (!value) return value;
  if (
    homeDir &&
    (value === homeDir || value.startsWith(`${homeDir}/`) || value.startsWith(`${homeDir}\\`))
  )
    return `~${value.slice(homeDir.length)}`;
  if (cwd) {
    const relative = path.relative(cwd, value);
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) return relative;
  }
  return value;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances = Array.from({ length: rows }, (_, i) => [i, ...Array<number>(cols - 1).fill(0)]);
  for (let col = 1; col < cols; col += 1) {
    const row0 = distances[0];
    if (row0) row0[col] = col;
  }
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      const prevRow = distances[row - 1];
      const curRow = distances[row];
      if (!prevRow || !curRow) continue;
      const up = (prevRow[col] ?? 0) + 1;
      const left = (curRow[col - 1] ?? 0) + 1;
      const diag = (prevRow[col - 1] ?? 0) + cost;
      curRow[col] = Math.min(up, left, diag);
    }
  }
  return distances[rows - 1]?.[cols - 1] ?? 0;
}

const DID_YOU_MEAN_MAX_DISTANCE = 3;

function didYouMean(input: unknown, candidates: string[]): string | null {
  if (!input || !candidates?.length) return null;
  const needle = String(input).toLowerCase();
  let best: string | null = null;
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

export type {
  BrandOptions,
  ColorDepth,
  DisplayMode,
  HumanPresentation,
  MotionLevel,
  OutputFlags,
  OutputFormat,
  OutputStreams,
  PresentationContext,
  TerminalBreakpoint,
  TerminalCapabilities,
};
export {
  clearViewport,
  colorEnabled,
  didYouMean,
  doctorFooterLines,
  isRich,
  motionLevel,
  outputMode,
  renderKeyValue,
  renderSection,
  renderStep,
  renderSuccess,
  renderWarning,
  resolvePresentationContext,
  SAF_ASCII_GLYPHS,
  SAF_GLYPHS,
  SAF_THEME,
  safGlyph,
  shortenPath,
  styleBrand,
  styleStatus,
  symbol,
  terminalBreakpoint,
  terminalCapabilities,
  terminalColumns,
  terminalRows,
  writeBrand,
};

import { renderCliCommand } from './cli-command';
