import type { DisplayMode } from './brand-art';

type GlyphToken = {
  rich: string;
  ascii: string;
};

type ColorToken = {
  truecolor: string;
  ansi256: number;
  ansi16: number;
};

type TypographyRole = 'normal' | 'bold' | 'dim' | 'italic';

const TERMINAL_GLYPHS = {
  journey: {
    start: { rich: '┌', ascii: '+' },
    continuation: { rich: '│', ascii: '|' },
    branch: { rich: '├', ascii: '+' },
    end: { rich: '└', ascii: '+' },
    rule: { rich: '─', ascii: '-' },
    topRight: { rich: '┐', ascii: '+' },
    bottomRight: { rich: '┘', ascii: '+' },
  },
  stage: {
    completed: { rich: '◇', ascii: '*' },
    active: { rich: '◆', ascii: '*' },
    pending: { rich: '○', ascii: 'o' },
  },
  status: {
    success: { rich: '✓', ascii: 'OK' },
    warning: { rich: '!', ascii: 'WARN' },
    error: { rich: '✗', ascii: 'FAIL' },
    info: { rich: 'i', ascii: 'INFO' },
  },
  selection: {
    radioFocused: { rich: '◉', ascii: '(*)' },
    radioSelected: { rich: '●', ascii: '(*)' },
    radioUnselected: { rich: '○', ascii: '( )' },
    checkboxFocused: { rich: '▣', ascii: '[*]' },
    checkboxSelected: { rich: '■', ascii: '[x]' },
    checkboxUnselected: { rich: '□', ascii: '[ ]' },
  },
  navigation: {
    next: { rich: '→', ascii: '->' },
    back: { rich: '←', ascii: '<-' },
    up: { rich: '↑', ascii: 'Up' },
    down: { rich: '↓', ascii: 'Down' },
    child: { rich: '↳', ascii: '->' },
    active: { rich: '▸', ascii: '>' },
    inactive: { rich: '▹', ascii: '-' },
  },
  brand: {
    chevron: { rich: '›', ascii: '>' },
    lockup: { rich: '›  ››  ›››', ascii: '>  >>  >>>' },
  },
} as const satisfies Record<string, Record<string, GlyphToken>>;

const COLORS = {
  brand: {
    primary: { truecolor: '#6d5ef0', ansi256: 99, ansi16: 95 },
    secondary: { truecolor: '#4b3ea8', ansi256: 61, ansi16: 35 },
    accent: { truecolor: '#8b7dff', ansi256: 105, ansi16: 95 },
  },
  text: {
    primary: { truecolor: '', ansi256: 39, ansi16: 39 },
    secondary: { truecolor: '', ansi256: 39, ansi16: 39 },
    muted: { truecolor: '', ansi256: 39, ansi16: 39 },
  },
  interactive: {
    active: { truecolor: '#b8adff', ansi256: 147, ansi16: 95 },
    selected: { truecolor: '#b8adff', ansi256: 147, ansi16: 95 },
    disabled: { truecolor: '', ansi256: 39, ansi16: 39 },
  },
  status: {
    success: { truecolor: '#65d39a', ansi256: 78, ansi16: 32 },
    warning: { truecolor: '#f4c76b', ansi256: 221, ansi16: 33 },
    error: { truecolor: '#ff7d8d', ansi256: 210, ansi16: 31 },
    info: { truecolor: '#72c9e8', ansi256: 117, ansi16: 36 },
    busy: { truecolor: '#b8adff', ansi256: 147, ansi16: 95 },
  },
  structure: {
    default: { truecolor: '', ansi256: 39, ansi16: 39 },
    subtle: { truecolor: '#6e63c7', ansi256: 99, ansi16: 35 },
  },
} as const satisfies Record<string, Record<string, ColorToken>>;

const TYPOGRAPHY = {
  display: 'bold',
  title: 'bold',
  section: 'bold',
  body: 'normal',
  value: 'bold',
  supporting: 'dim',
  command: 'normal',
  path: 'normal',
  keyboardHint: 'dim',
  tagline: 'italic',
} as const satisfies Record<string, TypographyRole>;

const SPACING = {
  inline: 1,
  gutter: 2,
  indent: 2,
  nested: 4,
  compact: 0,
  section: 1,
  major: 2,
  brandToContent: 4,
  card: 1,
  journey: 2,
  contentWidth: 72,
} as const;

const BREAKPOINTS = {
  wide: 80,
  compact: 60,
  stacked: 40,
  narrow: 40,
} as const;

const SAF_THEME = {
  colors: COLORS,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  breakpoints: BREAKPOINTS,
  motion: { none: 'none', instant: 'instant', active: 'active' } as const,
} as const;

const SYMBOLS = {
  success: TERMINAL_GLYPHS.status.success,
  warn: TERMINAL_GLYPHS.status.warning,
  fail: TERMINAL_GLYPHS.status.error,
  next: TERMINAL_GLYPHS.navigation.next,
  info: TERMINAL_GLYPHS.status.info,
  // Compact inline echo; welcome uses the canonical embedded ASCII mask via styleBrand/formatBrandArt.
  brand: TERMINAL_GLYPHS.brand.lockup,
} as const;

const SAF_GLYPHS = {
  start: TERMINAL_GLYPHS.journey.start.rich,
  continuation: TERMINAL_GLYPHS.journey.continuation.rich,
  branch: TERMINAL_GLYPHS.journey.branch.rich,
  end: TERMINAL_GLYPHS.journey.end.rich,
  rule: TERMINAL_GLYPHS.journey.rule.rich,
  topRight: TERMINAL_GLYPHS.journey.topRight.rich,
  bottomRight: TERMINAL_GLYPHS.journey.bottomRight.rich,
  completed: TERMINAL_GLYPHS.stage.completed.rich,
  active: TERMINAL_GLYPHS.stage.active.rich,
  pending: TERMINAL_GLYPHS.stage.pending.rich,
  selected: TERMINAL_GLYPHS.selection.radioSelected.rich,
  unselected: TERMINAL_GLYPHS.selection.radioUnselected.rich,
  radioFocused: TERMINAL_GLYPHS.selection.radioFocused.rich,
  checkboxFocused: TERMINAL_GLYPHS.selection.checkboxFocused.rich,
  checkboxSelected: TERMINAL_GLYPHS.selection.checkboxSelected.rich,
  checkboxUnselected: TERMINAL_GLYPHS.selection.checkboxUnselected.rich,
  next: TERMINAL_GLYPHS.navigation.next.rich,
  back: TERMINAL_GLYPHS.navigation.back.rich,
  up: TERMINAL_GLYPHS.navigation.up.rich,
  down: TERMINAL_GLYPHS.navigation.down.rich,
  child: TERMINAL_GLYPHS.navigation.child.rich,
  pointerActive: TERMINAL_GLYPHS.navigation.active.rich,
  pointerInactive: TERMINAL_GLYPHS.navigation.inactive.rich,
  brandChevron: TERMINAL_GLYPHS.brand.chevron.rich,
} as const;

const SAF_ASCII_GLYPHS = {
  start: TERMINAL_GLYPHS.journey.start.ascii,
  continuation: TERMINAL_GLYPHS.journey.continuation.ascii,
  branch: TERMINAL_GLYPHS.journey.branch.ascii,
  end: TERMINAL_GLYPHS.journey.end.ascii,
  rule: TERMINAL_GLYPHS.journey.rule.ascii,
  topRight: TERMINAL_GLYPHS.journey.topRight.ascii,
  bottomRight: TERMINAL_GLYPHS.journey.bottomRight.ascii,
  completed: TERMINAL_GLYPHS.stage.completed.ascii,
  active: TERMINAL_GLYPHS.stage.active.ascii,
  pending: TERMINAL_GLYPHS.stage.pending.ascii,
  selected: TERMINAL_GLYPHS.selection.radioSelected.ascii,
  unselected: TERMINAL_GLYPHS.selection.radioUnselected.ascii,
  radioFocused: TERMINAL_GLYPHS.selection.radioFocused.ascii,
  checkboxFocused: TERMINAL_GLYPHS.selection.checkboxFocused.ascii,
  checkboxSelected: TERMINAL_GLYPHS.selection.checkboxSelected.ascii,
  checkboxUnselected: TERMINAL_GLYPHS.selection.checkboxUnselected.ascii,
  next: TERMINAL_GLYPHS.navigation.next.ascii,
  back: TERMINAL_GLYPHS.navigation.back.ascii,
  up: TERMINAL_GLYPHS.navigation.up.ascii,
  down: TERMINAL_GLYPHS.navigation.down.ascii,
  child: TERMINAL_GLYPHS.navigation.child.ascii,
  pointerActive: TERMINAL_GLYPHS.navigation.active.ascii,
  pointerInactive: TERMINAL_GLYPHS.navigation.inactive.ascii,
  brandChevron: TERMINAL_GLYPHS.brand.chevron.ascii,
} as const;

type LegacyGlyphName = keyof typeof SAF_GLYPHS;

function symbol(name: keyof typeof SYMBOLS, mode: DisplayMode = 'human-rich'): string {
  const entry = SYMBOLS[name];
  if (!entry) return '';
  return mode === 'human-rich' ? entry.rich : entry.ascii;
}

function safGlyph(name: LegacyGlyphName, mode: DisplayMode = 'human-rich'): string {
  return mode === 'human-rich' ? SAF_GLYPHS[name] : SAF_ASCII_GLYPHS[name];
}

function ansiColor(token: ColorToken, depth: 'ansi16' | 'ansi256' | 'truecolor'): string {
  if (depth === 'truecolor' && token.truecolor) {
    const hex = token.truecolor.slice(1);
    return `38;2;${Number.parseInt(hex.slice(0, 2), 16)};${Number.parseInt(hex.slice(2, 4), 16)};${Number.parseInt(hex.slice(4, 6), 16)}`;
  }
  if (depth === 'ansi256') return `38;5;${token.ansi256}`;
  return String(token.ansi16);
}

export type { ColorToken, TypographyRole };
export {
  ansiColor,
  BREAKPOINTS,
  COLORS,
  SAF_ASCII_GLYPHS,
  SAF_GLYPHS,
  SAF_THEME,
  SPACING,
  SYMBOLS,
  safGlyph,
  symbol,
  TERMINAL_GLYPHS,
  TYPOGRAPHY,
};
