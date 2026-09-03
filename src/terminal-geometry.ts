const ANSI_SEQUENCE = new RegExp(
  `[${String.fromCharCode(27)}${String.fromCharCode(0x9b)}][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d/#&.:=?%@~_]+)*)?${String.fromCharCode(7)})|(?:(?:\\d{1,4}(?:[;:]\\d{0,4})*)?[0-?]*[ -/]*[@-~]))`,
  'g',
);

function stripAnsi(value: string): string {
  return value.replace(ANSI_SEQUENCE, '');
}

function isCombining(codePoint: number): boolean {
  return (
    (codePoint >= 0x300 && codePoint <= 0x36f) ||
    (codePoint >= 0x1ab0 && codePoint <= 0x1aff) ||
    (codePoint >= 0x1dc0 && codePoint <= 0x1dff) ||
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0x20d0 && codePoint <= 0x20ff)
  );
}

function isWide(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1f300 && codePoint <= 0x1faff))
  );
}

function codePointWidth(codePoint: number): number {
  if (
    codePoint === 0 ||
    isCombining(codePoint) ||
    codePoint < 0x20 ||
    (codePoint >= 0x7f && codePoint < 0xa0)
  )
    return 0;
  return isWide(codePoint) ? 2 : 1;
}

function displayWidth(value: string): number {
  let width = 0;
  for (const character of stripAnsi(value)) width += codePointWidth(character.codePointAt(0) || 0);
  return width;
}

function centerDisplayLine(value: string, terminalWidth: number): string {
  const padding = Math.max(0, Math.floor((terminalWidth - displayWidth(value)) / 2));
  return `${' '.repeat(padding)}${value}`;
}

function centerDisplayBlock(lines: readonly string[], terminalWidth: number): string[] {
  return lines.map((line) => centerDisplayLine(line, terminalWidth));
}

function truncateDisplayWidth(value: string, maxWidth: number, suffix = '…'): string {
  if (maxWidth <= 0) return '';
  if (displayWidth(value) <= maxWidth) return value;
  const suffixWidth = displayWidth(suffix);
  if (suffixWidth >= maxWidth) return [...stripAnsi(value)].slice(0, maxWidth).join('');
  let result = '';
  let width = 0;
  for (const character of value) {
    const next = codePointWidth(character.codePointAt(0) || 0);
    if (width + next + suffixWidth > maxWidth) break;
    result += character;
    width += next;
  }
  return `${result}${suffix}`;
}

function wrapDisplayWidth(value: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [''];
  const rows: string[] = [];
  for (const originalLine of value.split('\n')) {
    if (!originalLine) {
      rows.push('');
      continue;
    }
    let row = '';
    for (const word of originalLine.split(/\s+/).filter(Boolean)) {
      if (displayWidth(word) > maxWidth) {
        if (row) rows.push(row);
        row = '';
        let chunk = '';
        for (const character of word) {
          if (chunk && displayWidth(`${chunk}${character}`) > maxWidth) {
            rows.push(chunk);
            chunk = '';
          }
          chunk += character;
        }
        row = chunk;
      } else {
        const candidate = row ? `${row} ${word}` : word;
        if (row && displayWidth(candidate) > maxWidth) {
          rows.push(row);
          row = word;
        } else row = candidate;
      }
    }
    rows.push(row);
  }
  return rows;
}

function physicalRows(value: string, maxWidth: number): number {
  return wrapDisplayWidth(value, maxWidth).length;
}

function wrapCopyable(value: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [''];
  return value.split('\n');
}

export {
  centerDisplayBlock,
  centerDisplayLine,
  displayWidth,
  physicalRows,
  stripAnsi,
  truncateDisplayWidth,
  wrapCopyable,
  wrapDisplayWidth,
};
