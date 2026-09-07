export type ColorDepth = 'none' | 'ansi16' | 'ansi256' | 'truecolor';
export type ColorStream = { isTTY?: boolean };

function normalized(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export function colorEnabled(
  stream: ColorStream | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NO_COLOR === undefined && Boolean(stream?.isTTY);
}

export function detectColorDepth(
  stream: ColorStream | undefined,
  env: NodeJS.ProcessEnv = process.env,
): ColorDepth {
  if (!colorEnabled(stream, env)) return 'none';
  const colorTerminal = normalized(env.COLORTERM);
  const terminal = normalized(env.TERM);
  const program = normalized(env.TERM_PROGRAM).replace(/[\s-]+/g, '_');
  if (
    colorTerminal === 'truecolor' ||
    colorTerminal === '24bit' ||
    terminal.includes('truecolor') ||
    terminal.includes('24bit') ||
    normalized(env.WT_SESSION) ||
    program === 'windows_terminal'
  )
    return 'truecolor';
  if (terminal.includes('256color')) return 'ansi256';
  return 'ansi16';
}
