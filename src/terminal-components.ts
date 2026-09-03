import { type BrandStream, formatBrandArt, formatOneLineBrand } from './brand-art';
import { t } from './messages';
import { displayWidth, wrapCopyable, wrapDisplayWidth } from './terminal-geometry';
import { sanitizeTerminalText } from './terminal-safety';
import { ansiColor, COLORS, type ColorToken, TERMINAL_GLYPHS } from './terminal-theme';
import { type PresentationContext, SAF_THEME, safGlyph, symbol } from './ui';

type ComponentStatus = 'success' | 'warning' | 'error' | 'info' | 'busy';
type JourneyStep = { label: string; state?: 'active' | 'completed' | 'pending' };
type CardEntry = { key: string; value: string; copyable?: boolean };

function sanitizeMultilineTerminalText(value: string): string {
  return value.split('\n').map(sanitizeTerminalText).join('\n');
}

function ansi(context: PresentationContext, value: string, color: ColorToken): string {
  if (!context.color) return value;
  const depth = context.colorDepth === 'none' ? 'ansi16' : context.colorDepth;
  return `\x1b[${ansiColor(color, depth)}m${value}\x1b[0m`;
}

function ansiAtDepth(
  context: PresentationContext,
  value: string,
  color: ColorToken,
  depth: 'ansi16' | 'ansi256' | 'truecolor',
): string {
  if (!context.color) return value;
  return `\x1b[${ansiColor(color, depth)}m${value}\x1b[0m`;
}

type TypographyToken = keyof typeof SAF_THEME.typography;

function typography(context: PresentationContext, value: string, role: TypographyToken): string {
  if (context.mode !== 'human-rich') return value;
  const code =
    SAF_THEME.typography[role] === 'bold'
      ? 1
      : SAF_THEME.typography[role] === 'dim'
        ? 2
        : SAF_THEME.typography[role] === 'italic'
          ? 3
          : 0;
  return code ? `\x1b[${code}m${value}\x1b[0m` : value;
}

function renderText(
  value: string,
  role: TypographyToken,
  context: PresentationContext,
  color?: ColorToken,
): string {
  if (context.mode !== 'human-rich') return value;
  const codes: string[] = [];
  if (context.color && color) {
    const depth = context.colorDepth === 'none' ? 'ansi16' : context.colorDepth;
    codes.push(ansiColor(color, depth));
  }
  const emphasis = SAF_THEME.typography[role];
  if (emphasis === 'bold') codes.push('1');
  if (emphasis === 'dim') codes.push('2');
  if (emphasis === 'italic') codes.push('3');
  return codes.length ? `\x1b[${codes.join(';')}m${value}\x1b[0m` : value;
}

const WELCOME_TITLE = 'SDD-AGENTIC-FLOW (SAF)';

function centeredTextLine(
  value: string,
  context: PresentationContext,
  role: TypographyToken,
  color?: ColorToken,
): string {
  if (context.mode !== 'human-rich') return value;
  const padding = Math.max(0, Math.floor((context.width - displayWidth(value)) / 2));
  return `${' '.repeat(padding)}${renderText(value, role, context, color)}`;
}

function renderWelcomeText(
  context: PresentationContext,
  locale = 'en-US',
  options: { outerSpacing?: boolean } = {},
): string {
  if (context.mode === 'machine') return '';
  const maxWidth = Math.max(12, Math.min(SAF_THEME.spacing.contentWidth, context.width - 2));
  const titleLines = wrapDisplayWidth(WELCOME_TITLE, maxWidth);
  const productLines = wrapDisplayWidth(t(locale, 'welcome.product'), maxWidth);
  const taglineLines = wrapDisplayWidth(t(locale, 'welcome.tagline'), maxWidth);
  const centered = (lines: string[], role: TypographyToken, color?: ColorToken) =>
    lines.map((line) => centeredTextLine(line, context, role, color));
  const blocks = [
    centered(titleLines, 'display', SAF_THEME.colors.brand.primary),
    centered(productLines, 'body'),
    centered(taglineLines, 'tagline', SAF_THEME.colors.brand.accent),
  ];
  const separator =
    context.mode === 'human-rich' ? '\n'.repeat(SAF_THEME.spacing.section + 1) : '\n';
  const outer =
    context.mode === 'human-rich' && options.outerSpacing !== false
      ? '\n'.repeat(SAF_THEME.spacing.major)
      : '';
  return `${outer}${blocks.map((block) => block.join('\n')).join(separator)}${outer}`;
}

function renderWelcomeComposition(
  context: PresentationContext,
  locale = 'en-US',
  stream?: BrandStream,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (context.mode === 'machine') return '';
  if (context.mode !== 'human-rich') return renderWelcomeText(context, locale);
  const artStream =
    stream ??
    ({
      isTTY: true,
      columns: context.width,
      rows: 60,
      write: () => true,
    } satisfies BrandStream);
  const artEnv = context.color ? env : { ...env, NO_COLOR: '1' };
  const art = formatBrandArt('human-rich', artStream, artEnv, { center: true }).trimEnd();
  return `${'\n'.repeat(SAF_THEME.spacing.major)}${art}${'\n'.repeat(SAF_THEME.spacing.brandToContent)}${renderWelcomeText(context, locale)}`;
}

function statusGlyph(status: ComponentStatus, context: PresentationContext): string {
  const glyph =
    status === 'busy'
      ? safGlyph('active', context.mode)
      : symbol(
          status === 'warning'
            ? 'warn'
            : status === 'error'
              ? 'fail'
              : status === 'success'
                ? 'success'
                : 'info',
          context.mode,
        );
  const color =
    status === 'success'
      ? SAF_THEME.colors.status.success
      : status === 'warning'
        ? SAF_THEME.colors.status.warning
        : status === 'error'
          ? SAF_THEME.colors.status.error
          : status === 'busy'
            ? SAF_THEME.colors.status.busy
            : SAF_THEME.colors.status.info;
  return ansi(context, glyph, color);
}

function renderBrand(context: PresentationContext): string {
  if (context.mode === 'machine') return '';
  return ansi(
    context,
    context.mode === 'human-rich' ? 'SAF · terminal design system' : 'SAF - terminal design system',
    SAF_THEME.colors.brand.primary,
  );
}

function renderJourney(steps: readonly JourneyStep[], context: PresentationContext): string {
  if (context.mode === 'machine') return '';
  return steps
    .map((step, index) => {
      const last = index === steps.length - 1;
      const glyph =
        step.state === 'completed'
          ? safGlyph('completed', context.mode)
          : step.state === 'active'
            ? safGlyph('active', context.mode)
            : safGlyph('pending', context.mode);
      const prefix =
        context.mode === 'human-rich'
          ? last
            ? safGlyph('end', context.mode)
            : index === 0
              ? safGlyph('start', context.mode)
              : safGlyph('branch', context.mode)
          : `${index + 1}.`;
      return `${prefix} ${glyph} ${sanitizeTerminalText(step.label)}`;
    })
    .join('\n');
}

function renderStatus(
  status: ComponentStatus,
  message: string,
  context: PresentationContext,
): string {
  if (context.mode === 'machine') return `${status.toUpperCase()} ${sanitizeTerminalText(message)}`;
  return `${statusGlyph(status, context)} ${sanitizeTerminalText(message)}`;
}

function renderCard(
  title: string,
  entries: readonly CardEntry[],
  context: PresentationContext,
): string {
  if (context.mode === 'machine') return '';
  const width = Math.max(20, context.width - SAF_THEME.spacing.gutter * 2);
  const rows = entries.flatMap(({ key, value, copyable }) => {
    const safeKey = sanitizeTerminalText(key);
    const safeValue = sanitizeMultilineTerminalText(value);
    const values = copyable
      ? wrapCopyable(safeValue, width)
      : wrapDisplayWidth(
          safeValue,
          Math.max(12, width - displayWidth(safeKey) - SAF_THEME.spacing.gutter),
        );
    return values.map(
      (line, index) =>
        `${index === 0 ? `${safeKey}: ` : ' '.repeat(displayWidth(safeKey) + SAF_THEME.spacing.gutter)}${line}`,
    );
  });
  const body = [sanitizeTerminalText(title), ...rows].join('\n');
  if (context.mode !== 'human-rich' || context.width < 40) return body;
  if (body.split('\n').some((line) => displayWidth(line) > width)) return body;
  const border = safGlyph('rule', context.mode).repeat(
    Math.min(width, Math.max(12, displayWidth(sanitizeTerminalText(title)) + 4)),
  );
  return `${safGlyph('start', context.mode)}${border}${safGlyph('topRight', context.mode)}\n${safGlyph('continuation', context.mode)} ${body.replaceAll('\n', `\n${safGlyph('continuation', context.mode)} `)}\n${safGlyph('end', context.mode)}${border}${safGlyph('bottomRight', context.mode)}`;
}

function renderFoundationGallery(context: PresentationContext, locale = 'en-US'): string {
  if (context.mode === 'machine') return '';
  const heading = locale === 'pt-BR' ? 'Fundamentos do tema SAF' : 'SAF theme foundations';
  const brandMode = context.mode === 'human-rich' ? 'human-rich' : 'human-plain';
  const galleryStream = (width: number): BrandStream => ({
    isTTY: brandMode === 'human-rich',
    columns: width,
    rows: 60,
    write: () => true,
  });
  const galleryEnv = context.color ? { COLORTERM: 'truecolor' } : { NO_COLOR: '1' };
  const brandSample = (label: string, width: number) => [
    `  ${label}:`,
    ...formatBrandArt(brandMode, galleryStream(width), galleryEnv, {
      center: brandMode === 'human-rich',
      variant: width >= 110 ? 'wide' : 'compact',
    })
      .trimEnd()
      .split('\n')
      .map((line) => (line.trim() ? `  ${line}` : '')),
  ];
  const brandFrames =
    context.mode === 'human-rich'
      ? [1, 2, 3].flatMap((visible, index) => [
          `  frame ${index + 1}: ${['small', 'small + medium', 'small + medium + large'][index]}`,
          ...formatBrandArt('human-rich', galleryStream(110), galleryEnv, {
            center: true,
            visibleParts: visible,
          })
            .trimEnd()
            .split('\n')
            .map((line) => (line.trim() ? `  ${line}` : '')),
        ])
      : [];
  const symbols = Object.entries(TERMINAL_GLYPHS)
    .filter(([group]) => group !== 'brand')
    .flatMap(([group, tokens]) =>
      Object.entries(tokens).map(([name, token]) => [`${group}.${name}`, token.rich, token.ascii]),
    );
  const colors: readonly (readonly [string, ColorToken])[] = Object.entries(COLORS).flatMap(
    ([group, tokens]) => Object.entries(tokens).map(([name, token]) => [`${group}.${name}`, token]),
  );
  const typographyRoles = Object.keys(SAF_THEME.typography) as TypographyToken[];
  return [
    typography(context, heading, 'title'),
    'Brand / Canonical ASCII Assets',
    '  asset: public/ascii/saf-ascii-art.txt (110×46 logical cells)',
    '  preview: public/ascii/saf-ascii-art.png',
    '  identity reference: public/imgs/symbol.svg',
    '  progression: small to medium to large; no scaling',
    ...brandSample('canonical wide (110 columns)', 110),
    ...brandSample('canonical wide (120 columns)', 120),
    ...brandSample('canonical wide (140 columns)', 140),
    ...brandSample('compact fallback (80 columns)', 80),
    `  minimal: ${formatOneLineBrand(brandMode).trim()}`,
    ...brandFrames,
    'Symbols',
    ...symbols.map(([name, rich, ascii]) => `  ${name}: rich=${rich} ascii=${ascii}`),
    'Colors',
    ...colors.map(
      ([name, color]) =>
        `  ${name}: truecolor=${ansiAtDepth(context, 'sample', color, 'truecolor')} ansi256=${ansiAtDepth(context, 'sample', color, 'ansi256')} ansi16=${ansiAtDepth(context, 'sample', color, 'ansi16')} none=sample`,
    ),
    'Typography',
    ...typographyRoles.map((role) => `  ${typography(context, role, role)}`),
    'Spacing / Layout',
    ...Object.entries(SAF_THEME.spacing).map(([name, value]) => `  ${name}: ${value}`),
    ...Object.entries(SAF_THEME.breakpoints).map(
      ([name, value]) => `  breakpoint.${name}: ${value}`,
    ),
  ].join('\n');
}

function renderGallery(context: PresentationContext, locale = 'en-US'): string {
  const ready = locale === 'pt-BR' ? 'Pronto para verificar' : 'Ready to verify';
  const next = locale === 'pt-BR' ? 'Próxima ação: execute o doctor' : 'Next action: run doctor';
  return [
    renderWelcomeComposition(context, locale),
    renderBrand(context),
    renderJourney(
      [
        { label: locale === 'pt-BR' ? 'observar' : 'observe', state: 'completed' },
        { label: locale === 'pt-BR' ? 'planejar' : 'plan', state: 'completed' },
        { label: locale === 'pt-BR' ? 'autorizar' : 'authorize', state: 'active' },
        { label: locale === 'pt-BR' ? 'executar' : 'execute' },
        { label: locale === 'pt-BR' ? 'verificar' : 'verify' },
      ],
      context,
    ),
    renderCard(
      locale === 'pt-BR' ? 'Resumo' : 'Summary',
      [
        { key: 'Status', value: ready },
        { key: 'Command', value: 'npx sdd-agentic-flow doctor --json', copyable: true },
      ],
      context,
    ),
    renderStatus('success', ready, context),
    renderStatus(
      'warning',
      locale === 'pt-BR'
        ? 'Atenção: nenhuma alteração foi necessária'
        : 'Attention: no change was needed',
      context,
    ),
    renderStatus(
      'error',
      locale === 'pt-BR' ? 'Falha: revise a configuração' : 'Failure: review configuration',
      context,
    ),
    `${symbol('next', context.mode)} ${next}`,
    renderFoundationGallery(context, locale),
  ]
    .filter(Boolean)
    .join('\n\n');
}

export type { CardEntry, ComponentStatus, JourneyStep };
export {
  renderBrand,
  renderCard,
  renderFoundationGallery,
  renderGallery,
  renderJourney,
  renderStatus,
  renderText,
  renderWelcomeComposition,
  renderWelcomeText,
};
