function escapedControl(codePoint: number): string {
  if (codePoint === 0x09) return '\\t';
  if (codePoint === 0x0a) return '\\n';
  if (codePoint === 0x0d) return '\\r';
  return `\\x${codePoint.toString(16).padStart(2, '0')}`;
}

/** Presentation-only boundary; callers must keep the original value for all decisions and mutations. */
function sanitizeTerminalText(value: string): string {
  let result = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0) || 0;
    if (codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f))
      result += escapedControl(codePoint);
    else result += character;
  }
  return result;
}

export { sanitizeTerminalText };
