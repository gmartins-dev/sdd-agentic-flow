import * as clack from '@clack/prompts';

import { type ComponentStatus, renderCard, renderStatus } from './terminal-components';
import { sanitizeTerminalText } from './terminal-safety';
import { type DisplayMode, type PresentationContext, SAF_THEME, terminalCapabilities } from './ui';

type TerminalUiOptions = {
  mode?: DisplayMode;
  output?: NodeJS.WriteStream;
  title?: string;
  color?: boolean;
};

type TerminalSpinner = {
  start: (message: string) => void;
  stop: (message: string) => void;
  error: (message: string) => void;
};

function sanitizeMultilineTerminalText(value: string): string {
  return value.split('\n').map(sanitizeTerminalText).join('\n');
}

function presentationContext(
  mode: DisplayMode,
  output: NodeJS.WriteStream,
  color?: boolean,
): PresentationContext {
  const capabilities = terminalCapabilities({ stdout: output }, process.env);
  const enabled = mode === 'human-rich' && (color ?? capabilities.color);
  return {
    ...capabilities,
    mode,
    color: enabled,
    colorDepth: enabled
      ? capabilities.colorDepth === 'none'
        ? 'ansi16'
        : capabilities.colorDepth
      : 'none',
  };
}

function componentStatus(status: string): ComponentStatus {
  if (status === 'PASS') return 'success';
  if (status === 'WARN') return 'warning';
  if (status === 'FAIL') return 'error';
  if (status === 'INFO') return 'info';
  return 'busy';
}

function terminalLog(
  status: string,
  message: string,
  { mode = 'human-plain', output = process.stdout }: TerminalUiOptions = {},
): void {
  if (mode === 'machine') return;
  const safe = sanitizeTerminalText(message);
  if (mode === 'human-rich') {
    output.write(
      `${renderStatus(componentStatus(status), safe, presentationContext(mode, output))}\n`,
    );
    return;
  }
  output.write(`${status} ${safe}\n`);
}

function terminalNote(
  title: string,
  entries: readonly (readonly [string, string])[],
  { mode = 'human-plain', output = process.stdout, color }: TerminalUiOptions = {},
): void {
  if (mode === 'machine') return;
  const safeTitle = sanitizeTerminalText(title);
  if (mode === 'human-rich') {
    output.write(
      `${renderCard(
        safeTitle,
        entries.map(([key, value]) => ({ key, value })),
        presentationContext(mode, output, color),
      )}\n`,
    );
    return;
  }
  const body = entries
    .map(([key, value]) => `${sanitizeTerminalText(key)}\n${sanitizeMultilineTerminalText(value)}`)
    .join('\n\n');
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

function terminalNext(
  lines: string | readonly string[],
  { mode = 'human-plain', output = process.stdout, title = 'Next action' }: TerminalUiOptions = {},
): void {
  if (mode === 'machine') return;
  const entries = (Array.isArray(lines) ? lines : [lines])
    .filter(Boolean)
    .map(sanitizeTerminalText);
  if (!entries.length) return;
  if (mode === 'human-rich') {
    terminalNote(title, [['Action', entries.join('\n')]], { mode, output });
    return;
  }
  output.write(
    `\n${sanitizeTerminalText(title)}\n${entries.map((entry) => `${' '.repeat(SAF_THEME.spacing.gutter)}${entry}`).join('\n')}\n`,
  );
}

export type { TerminalUiOptions };
export { terminalLog, terminalNext, terminalNote, terminalSpinner };
