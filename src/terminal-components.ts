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
  if (!context.color || context.mode !== 'human-rich') return value;
  const code =
    SAF_THEME.typography[role] === 'bold' ? 1 : SAF_THEME.typography[role] === 'dim' ? 2 : 0;
  return code ? `\x1b[${code}m${value}\x1b[0m` : value;
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
};
