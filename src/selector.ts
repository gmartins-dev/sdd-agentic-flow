import readline from 'node:readline';
import { t } from './messages';
import { physicalRows, wrapDisplayWidth } from './terminal-geometry';
import { sanitizeTerminalText } from './terminal-safety';
import { safGlyph, terminalCapabilities } from './ui';

type SelectOption = {
  value: unknown;
  label: string;
  action?: boolean;
  description?: string;
  recommended?: boolean;
  selected?: boolean;
};

type SelectionResult = {
  cancelled?: boolean;
  invalid?: boolean;
  value?: unknown;
  pending?: boolean;
};

type SelectSettings = {
  input?: NodeJS.ReadStream & {
    isTTY?: boolean;
    isRaw?: boolean;
    setRawMode?: (mode: boolean) => void;
  };
  output?: NodeJS.WriteStream;
  multiple?: boolean;
  cancelValues?: string[];
  ascii?: boolean;
  locale?: string;
};

function optionValueKey(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function resolveSelection(
  raw: unknown,
  options: SelectOption[],
  selected: unknown[] | null = null,
  multiple = false,
  cancelValues: string[] = [],
): SelectionResult {
  const value = String(raw ?? '').trim();
  if (value === '\u001b' || cancelValues.includes(value.toLowerCase())) return { cancelled: true };
  if (!multiple) {
    const index = value === '' ? 0 : Number(value) - 1;
    const option = options[index];
    return Number.isInteger(index) && option ? { value: option.value } : { invalid: true };
  }
  const index = Number(value) - 1;
  const option = options[index];
  if (option?.action) return { value: option.value };
  const current = new Set(
    (
      selected ||
      options.filter((option) => option.selected && !option.action).map((option) => option.value)
    ).map(optionValueKey),
  );
  const currentValues = new Map(
    (
      selected ||
      options.filter((option) => option.selected && !option.action).map((option) => option.value)
    ).map((item) => [optionValueKey(item), item]),
  );
  if (value === '') return { value: [...currentValues.values()] };
  if (!Number.isInteger(index) || !option) return { invalid: true };
  const item = option.value;
  const key = optionValueKey(item);
  if (current.has(key)) {
    current.delete(key);
    currentValues.delete(key);
  } else {
    current.add(key);
    currentValues.set(key, item);
  }
  return { value: [...currentValues.values()], pending: true };
}

type RenderSelectorOptions = {
  multiple?: boolean;
  activeIndex?: number;
  selected?: unknown[];
  locale?: string | undefined;
  plain?: boolean;
  collapsed?: boolean;
  width?: number;
};

function renderSelector(
  question: string,
  options: SelectOption[],
  {
    multiple = false,
    activeIndex = 0,
    selected,
    locale,
    plain = false,
    collapsed = false,
    width = 80,
  }: RenderSelectorOptions = {},
): string {
  const maxWidth = Math.max(12, width);
  const selectedValues = new Set(
    (
      selected ||
      options.filter((option) => option.selected && !option.action).map((option) => option.value)
    ).map(optionValueKey),
  );
  const safeQuestion = sanitizeTerminalText(question);
  if (collapsed) {
    const chosen = options
      .filter((option) => !option.action && selectedValues.has(optionValueKey(option.value)))
      .map((option) => sanitizeTerminalText(option.label));
    return wrapDisplayWidth(
      `${plain ? 'OK' : safGlyph('completed', 'human-rich')} ${safeQuestion}: ${chosen.join(', ') || 'confirmed'}`,
      maxWidth,
    ).join('\n');
  }
  const lines = ['', ...wrapDisplayWidth(safeQuestion, maxWidth), ''];
  const hasDescriptions = options.some((option) => option.description);
  options.forEach((option, index) => {
    const action = Boolean(option.action);
    const active = index === activeIndex;
    const displayMode = plain ? 'human-plain' : 'human-rich';
    const marker = action
      ? safGlyph(active ? 'pointerActive' : 'pointerInactive', displayMode)
      : active
        ? safGlyph(multiple ? 'checkboxFocused' : 'radioFocused', displayMode)
        : safGlyph(
            multiple
              ? selectedValues.has(optionValueKey(option.value))
                ? 'checkboxSelected'
                : 'checkboxUnselected'
              : 'unselected',
            displayMode,
          );
    const suffix = option.recommended ? ` ${t(locale ?? 'en-US', 'selector.recommended')}` : '';
    const prefix = ` ${marker} ${index + 1}. `;
    const labelLines = wrapDisplayWidth(
      `${sanitizeTerminalText(option.label)}${suffix}`,
      Math.max(1, maxWidth - prefix.length),
    );
    lines.push(`${prefix}${labelLines[0] ?? ''}`);
    for (const line of labelLines.slice(1)) lines.push(`${' '.repeat(prefix.length)}${line}`);
    if (hasDescriptions) {
      const description = option.description ? sanitizeTerminalText(option.description) : '';
      const descriptionLines = wrapDisplayWidth(description, Math.max(1, maxWidth - 6));
      lines.push(...descriptionLines.map((line) => `      ${line}`));
    }
  });
  const hint = t(
    locale ?? 'en-US',
    plain
      ? multiple
        ? 'selector.plainMultiple'
        : 'selector.plainSingle'
      : multiple
        ? 'selector.multiple'
        : 'selector.single',
  );
  lines.push('', ...wrapDisplayWidth(hint, maxWidth));
  return lines.join('\n');
}

async function select(
  question: string,
  options: SelectOption[],
  settings: SelectSettings = {},
): Promise<SelectionResult> {
  const input = settings.input || process.stdin;
  const output = settings.output || process.stdout;
  const multiple = Boolean(settings.multiple);
  const cancelValues = (settings.cancelValues || []).map((entry) => String(entry).toLowerCase());
  const capabilities = terminalCapabilities(
    { stdin: input, stdout: output },
    process.env,
    settings.ascii === undefined ? {} : { ascii: settings.ascii },
  );
  const plain =
    !capabilities.interactive ||
    !capabilities.rawInput ||
    !capabilities.unicode ||
    !capabilities.cursor;
  const initialRender = renderSelector(question, options, {
    multiple,
    locale: settings.locale,
    plain,
    width: capabilities.width,
  });
  if (plain) {
    output.write(`${initialRender}\n`);
    const rl = readline.createInterface({ input, output, terminal: false });
    try {
      let selected = options
        .filter((option) => option.selected && !option.action)
        .map((option) => option.value);
      for (;;) {
        const result = resolveSelection(
          await new Promise<string>((resolve) => rl.question('Select: ', resolve)),
          options,
          selected,
          multiple,
          cancelValues,
        );
        if (result.cancelled || (!result.invalid && !result.pending)) return result;
        if (!result.invalid && Array.isArray(result.value)) selected = result.value;
        else output.write('Choose a listed number.\n');
      }
    } finally {
      rl.close();
    }
  }
  return new Promise((resolve) => {
    readline.emitKeypressEvents(input);
    const wasRaw = input.isRaw;
    let index = 0;
    let selected = options
      .filter((option) => option.selected && !option.action)
      .map((option) => option.value);
    const rendered = renderSelector(question, options, {
      multiple,
      locale: settings.locale,
      width: capabilities.width,
    });
    const renderedLines = physicalRows(rendered, capabilities.width);
    const redraw = () => {
      output.write(
        `\x1b[${renderedLines}F\x1b[J${renderSelector(question, options, {
          multiple,
          activeIndex: index,
          selected,
          locale: settings.locale,
          width: capabilities.width,
        })}\n`,
      );
    };
    const done = (result: SelectionResult) => {
      input.off('keypress', onKeypress);
      input.off('end', onEnd);
      process.off('SIGINT', onSignal);
      if (input.setRawMode) input.setRawMode(Boolean(wasRaw));
      input.pause();
      if (!result.cancelled) {
        const committed = Array.isArray(result.value)
          ? result.value
          : result.value === undefined
            ? []
            : [result.value];
        output.write(
          `${renderSelector(question, options, {
            multiple,
            selected: committed,
            locale: settings.locale,
            plain,
            collapsed: true,
            width: capabilities.width,
          })}\n`,
        );
      }
      output.write('\n');
      resolve(result);
    };
    const onSignal = () => done({ cancelled: true });
    const onKeypress = (char: string | undefined, key: readline.Key = {}) => {
      if (
        (key.ctrl && key.name === 'c') ||
        key.name === 'escape' ||
        cancelValues.includes(String(char || '').toLowerCase())
      )
        return done({ cancelled: true });
      if (key.name === 'return') {
        const option = options[index];
        if (option?.action) return done({ value: option.value });
        return done({ value: multiple ? selected : option?.value });
      }
      if (key.name === 'up') {
        index = (index + options.length - 1) % options.length;
        redraw();
      } else if (key.name === 'down') {
        index = (index + 1) % options.length;
        redraw();
      } else if (multiple && key.name === 'space') {
        const option = options[index];
        if (!option || option.action) return;
        const value = option.value;
        const keyValue = optionValueKey(value);
        const selectedKeys = new Set(selected.map(optionValueKey));
        selected = selectedKeys.has(keyValue)
          ? selected.filter((item) => optionValueKey(item) !== keyValue)
          : [...selected, value];
        redraw();
      } else if (/^[1-9]$/.test(char || '')) {
        const choice = Number(char) - 1;
        if (options[choice]) {
          index = choice;
          const option = options[index];
          if (!multiple && option) return done({ value: option.value });
          if (multiple && option && !option.action) {
            const keyValue = optionValueKey(option.value);
            const selectedKeys = new Set(selected.map(optionValueKey));
            selected = selectedKeys.has(keyValue)
              ? selected.filter((item) => optionValueKey(item) !== keyValue)
              : [...selected, option.value];
          }
          redraw();
        }
      }
    };
    input.on('keypress', onKeypress);
    process.once('SIGINT', onSignal);
    const onEnd = () => done({ cancelled: true });
    input.once('end', onEnd);
    if (input.setRawMode) input.setRawMode(true);
    input.resume();
    output.write(`${initialRender}\n`);
  });
}

export type { SelectionResult, SelectOption, SelectSettings };
export { renderSelector, resolveSelection, select };
