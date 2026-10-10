// Shared human CLI output for command modules. It is deliberately free of domain imports so
// any command module can use it; callers resolve their locale and pass it in.
import { t, translateText } from './messages';
import { terminalLog, terminalNext } from './terminal-ui';
import { type DisplayMode, didYouMean, outputMode, styleStatus } from './ui';

type ModeFlags = {
  ascii?: boolean | undefined;
  quiet?: boolean | undefined;
  json?: boolean | undefined;
};

type FailOptions = { code?: number; reason?: string | null; try?: string[] };

function resolveMode(flags: ModeFlags = {}): DisplayMode {
  return outputMode({ stdout: process.stdout, stdin: process.stdin }, process.env, {
    ascii:
      Boolean(flags.ascii) || process.argv.includes('--ascii') || process.env.SDD_ASCII === '1',
    quiet: Boolean(flags.quiet),
    json: Boolean(flags.json),
  });
}

function logStatus(status: string, message: string, locale: string): void {
  terminalLog(status, translateText(locale, message), { mode: resolveMode() });
}

// Structured stderr errors (What / Reason / Try). The second argument is an exit code or
// `{ code, reason, try }`. Did-you-mean suggestions belong in Try and are never executed.
// Every handled failure sets the exit code and returns false.
function fail(message: string, codeOrOptions: number | FailOptions = 1): false {
  const options = typeof codeOrOptions === 'number' ? { code: codeOrOptions } : codeOrOptions;
  let out = `${styleStatus('FAIL', process.stderr)} ${message}\n`;
  if (options.reason) out += `\nReason:\n  ${options.reason}\n`;
  const tryLines = options.try ?? [];
  if (tryLines.length) out += `\nTry:\n${tryLines.map((line) => `  ${line}`).join('\n')}\n`;
  process.stderr.write(out);
  process.exitCode = options.code ?? 1;
  return false;
}

// Suggested-next-step block for human-rich and human-plain output only. Suppressed by --quiet
// and by machine mode (pipe, CI, non-TTY, or --json).
function renderNextStep(
  line: string | string[],
  options: ModeFlags & { mode?: DisplayMode | undefined },
  locale: string,
): void {
  if (options.quiet) return;
  const mode = options.mode ?? resolveMode(options);
  if (mode === 'machine') return;
  const list = (Array.isArray(line) ? line : [line]).filter(Boolean);
  if (!list.length) return;
  terminalNext(list, { mode, title: t(locale, 'init.next') });
}

function didYouMeanTry(input: string, candidates: string[]): string | null {
  const match = didYouMean(input, candidates);
  return match ? `Did you mean \`${match}\`?` : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type { FailOptions, ModeFlags };
export { asString, didYouMeanTry, errorMessage, fail, logStatus, renderNextStep, resolveMode };
