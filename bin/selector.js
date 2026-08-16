'use strict';

const readline = require('node:readline');
const { t } = require('./messages');

function resolveSelection(raw, options, selected = null, multiple = false, cancelValues = []) {
  const value = String(raw ?? '').trim();
  if (value === '\u001b' || cancelValues.includes(value.toLowerCase())) return { cancelled: true };
  if (!multiple) {
    const index = value === '' ? 0 : Number(value) - 1;
    return Number.isInteger(index) && options[index]
      ? { value: options[index].value }
      : { invalid: true };
  }
  const current = new Set(
    selected || options.filter((option) => option.selected).map((option) => option.value),
  );
  if (value === '') return { value: [...current] };
  const index = Number(value) - 1;
  if (!Number.isInteger(index) || !options[index]) return { invalid: true };
  const item = options[index].value;
  if (current.has(item)) current.delete(item);
  else current.add(item);
  return { value: [...current], pending: true };
}

function renderSelector(
  question,
  options,
  { multiple = false, activeIndex = 0, selected, locale } = {},
) {
  const selectedValues = new Set(
    selected || options.filter((option) => option.selected).map((option) => option.value),
  );
  const lines = [`\n${question}\n`];
  options.forEach((option, index) => {
    const marker = index === activeIndex ? '>' : ' ';
    const state = multiple ? ` ${selectedValues.has(option.value) ? '[x]' : '[ ]'}` : '';
    lines.push(` ${marker}${state} ${index + 1}. ${option.label}`);
  });
  lines.push(
    multiple ? `\n${t(locale, 'selector.multiple')}` : `\n${t(locale, 'selector.single')}`,
  );
  return lines.join('\n');
}

async function select(question, options, settings = {}) {
  const input = settings.input || process.stdin;
  const output = settings.output || process.stdout;
  const multiple = Boolean(settings.multiple);
  const cancelValues = (settings.cancelValues || []).map((value) => String(value).toLowerCase());
  const plain =
    settings.ascii ||
    process.env.NO_COLOR !== undefined ||
    !input.isTTY ||
    !output.isTTY ||
    typeof input.setRawMode !== 'function';
  output.write(`${renderSelector(question, options, { multiple, locale: settings.locale })}\n`);
  if (plain) {
    const rl = readline.createInterface({ input, output, terminal: false });
    try {
      let selected = options.filter((option) => option.selected).map((option) => option.value);
      for (;;) {
        const result = resolveSelection(
          await new Promise((resolve) => rl.question('Select: ', resolve)),
          options,
          selected,
          multiple,
          cancelValues,
        );
        if (result.cancelled || (!result.invalid && !result.pending)) return result;
        if (!result.invalid) selected = result.value;
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
    let selected = options.filter((option) => option.selected).map((option) => option.value);
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
    const done = (result) => {
      input.off('keypress', onKeypress);
      input.off('end', onEnd);
      if (input.setRawMode) input.setRawMode(Boolean(wasRaw));
      input.pause();
      output.write('\n');
      resolve(result);
    };
    const onKeypress = (_char, key = {}) => {
      if (
        (key.ctrl && key.name === 'c') ||
        key.name === 'escape' ||
        cancelValues.includes(String(_char || '').toLowerCase())
      )
        return done({ cancelled: true });
      if (key.name === 'return') return done({ value: multiple ? selected : options[index].value });
      if (key.name === 'up') {
        index = (index + options.length - 1) % options.length;
        redraw();
      } else if (key.name === 'down') {
        index = (index + 1) % options.length;
        redraw();
      } else if (multiple && key.name === 'space') {
        const value = options[index].value;
        selected = selected.includes(value)
          ? selected.filter((item) => item !== value)
          : [...selected, value];
        redraw();
      } else if (/^[1-9]$/.test(_char || '')) {
        const choice = Number(_char) - 1;
        if (options[choice]) {
          index = choice;
          if (!multiple) return done({ value: options[index].value });
          redraw();
        }
      }
    };
    if (input.setRawMode) input.setRawMode(true);
    input.resume();
    input.on('keypress', onKeypress);
    const onEnd = () => done({ cancelled: true });
    input.once('end', onEnd);
  });
}

module.exports = { resolveSelection, renderSelector, select };
