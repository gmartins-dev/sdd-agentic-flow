import * as clack from '@clack/prompts';
import pc from 'picocolors';

import { sanitizeTerminalText } from './terminal-safety';
import type { DisplayMode } from './ui';

type TerminalUiOptions = {
  mode?: DisplayMode;
  output?: NodeJS.WriteStream;
};

type TerminalSpinner = {
  start: (message: string) => void;
  stop: (message: string) => void;
  error: (message: string) => void;
};

function sanitizeMultilineTerminalText(value: string): string {
  return value.split('\n').map(sanitizeTerminalText).join('\n');
}

function terminalLog(
  status: string,
  message: string,
  { mode = 'human-plain', output = process.stdout }: TerminalUiOptions = {},
): void {
  if (mode === 'machine') return;
  const safe = sanitizeTerminalText(message);
  if (mode === 'human-rich') {
    const opts = { output };
    if (status === 'PASS') clack.log.success(safe, opts);
    else if (status === 'WARN') clack.log.warn(safe, opts);
    else if (status === 'FAIL') clack.log.error(safe, opts);
    else clack.log.step(safe, opts);
    return;
  }
  output.write(`${status} ${safe}\n`);
}

function terminalNote(
  title: string,
  entries: readonly (readonly [string, string])[],
  { mode = 'human-plain', output = process.stdout }: TerminalUiOptions = {},
): void {
  if (mode === 'machine') return;
  const colors = pc.createColors(mode === 'human-rich');
  const safeTitle = sanitizeTerminalText(title);
  const body = entries
    .map(
      ([key, value]) =>
        `${colors.bold(sanitizeTerminalText(key))}\n${sanitizeMultilineTerminalText(value)}`,
    )
    .join('\n\n');
  if (mode === 'human-rich') {
    clack.note(body, safeTitle, { output });
    return;
  }
  output.write(`${safeTitle}\n${body}\n`);
}

function terminalSpinner({
  mode = 'human-plain',
  output = process.stdout,
}: TerminalUiOptions = {}): TerminalSpinner {
  if (mode === 'human-rich') {
    const spinner = clack.spinner({ output });
    return {
      start: (message) => spinner.start(sanitizeTerminalText(message)),
      stop: (message) => spinner.stop(sanitizeTerminalText(message)),
      error: (message) => spinner.error(sanitizeTerminalText(message)),
    };
  }
  return {
    start: (message) => terminalLog('INFO', message, { mode, output }),
    stop: (message) => terminalLog('PASS', message, { mode, output }),
    error: (message) => terminalLog('FAIL', message, { mode, output }),
  };
}

export type { TerminalUiOptions };
export { terminalLog, terminalNote, terminalSpinner };
