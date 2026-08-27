import readline from 'node:readline';
import { t } from './messages';
import { terminalCapabilities } from './ui';

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
};

function renderSelector(
  question: string,
  options: SelectOption[],
  { multiple = false, activeIndex = 0, selected, locale }: RenderSelectorOptions = {},
): string {
  const selectedValues = new Set(
    (
      selected ||
      options.filter((option) => option.selected && !option.action).map((option) => option.value)
    ).map(optionValueKey),
  );
  const lines = [`\n${question}\n`];
  options.forEach((option, index) => {
    const marker = index === activeIndex ? '>' : ' ';
    const state =
      multiple && !option.action
        ? ` ${selectedValues.has(optionValueKey(option.value)) ? '[x]' : '[ ]'}`
        : '';
    const suffix = option.recommended ? ' (recommended)' : '';
    lines.push(` ${marker}${state} ${index + 1}. ${option.label}${suffix}`);
    if (option.description) lines.push(`      ${option.description}`);
  });
  lines.push(
    multiple
      ? `\n${t(locale ?? 'en-US', 'selector.multiple')}`
      : `\n${t(locale ?? 'en-US', 'selector.single')}`,
  );
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
  const plain = !capabilities.interactive || !capabilities.rawInput || process.env.TERM === 'dumb';
  output.write(`${renderSelector(question, options, { multiple, locale: settings.locale })}\n`);
  if (plain) {
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
    const renderedLines = renderSelector(question, options, {
      multiple,
      locale: settings.locale,
    }).split('\n').length;
    const redraw = () => {
      output.write(
        `\x1b[${renderedLines}F\x1b[J${renderSelector(question, options, {
          multiple,
          activeIndex: index,
          selected,
          locale: settings.locale,
        })}\n`,
      );
    };
    const done = (result: SelectionResult) => {
      input.off('keypress', onKeypress);
      input.off('end', onEnd);
      process.off('SIGINT', onSignal);
      if (input.setRawMode) input.setRawMode(Boolean(wasRaw));
      input.pause();
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
          redraw();
        }
      }
    };
    if (input.setRawMode) input.setRawMode(true);
    input.resume();
    input.on('keypress', onKeypress);
    process.once('SIGINT', onSignal);
    const onEnd = () => done({ cancelled: true });
    input.once('end', onEnd);
  });
}

export type { SelectionResult, SelectOption, SelectSettings };
export { renderSelector, resolveSelection, select };
