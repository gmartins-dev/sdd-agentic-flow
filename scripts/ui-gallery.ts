import fs from 'node:fs';
import path from 'node:path';
import { renderGallery } from '../src/terminal-components.js';
import { stripAnsi } from '../src/terminal-geometry.js';
import { type DisplayMode, resolvePresentationContext } from '../src/ui.js';

function parseArgs(): {
  mode: DisplayMode;
  width: number;
  locale: string;
  catalog: boolean;
  noColor: boolean;
} {
  const values = new Map(
    process.argv.slice(2).map((arg) => {
      const [key, value] = arg.split('=');
      return [key, value ?? 'true'];
    }),
  );
  const mode = values.get('--mode') as DisplayMode | undefined;
  return {
    mode:
      mode === 'machine' || mode === 'human-plain' || mode === 'human-rich' ? mode : 'human-rich',
    width: Number(values.get('--width') ?? 80),
    locale: values.get('--locale') ?? 'en-US',
    catalog: values.has('--catalog'),
    noColor: values.has('--no-color'),
  };
}

function context(mode: DisplayMode, width: number, noColor = false) {
  const input = { isTTY: mode === 'human-rich', setRawMode: () => undefined } as never;
  const output = { isTTY: mode === 'human-rich', columns: width } as never;
  const env =
    mode === 'human-rich' ? (noColor ? { NO_COLOR: '1' } : { COLORTERM: 'truecolor' }) : {};
  const flags =
    mode === 'machine' ? { machine: true } : mode === 'human-plain' ? { quiet: true } : {};
  return resolvePresentationContext({ stdin: input, stdout: output }, env, flags);
}

function catalog(): string {
  const cases: readonly [string, DisplayMode, number, string, boolean][] = [
    ['80 rich + color', 'human-rich', 80, 'en-US', false],
    ['80 rich + NO_COLOR', 'human-rich', 80, 'en-US', true],
    ['60 rich', 'human-rich', 60, 'en-US', false],
    ['54 rich compact', 'human-rich', 54, 'en-US', true],
    ['79 rich compact', 'human-rich', 79, 'en-US', true],
    ['40 rich/minimal', 'human-rich', 40, 'en-US', false],
    ['110 rich canonical', 'human-rich', 110, 'en-US', true],
    ['120 rich', 'human-rich', 120, 'en-US', false],
    ['ASCII', 'human-plain', 40, 'en-US', false],
    ['human-plain', 'human-plain', 80, 'en-US', false],
    ['40 pt-BR', 'human-rich', 40, 'pt-BR', true],
    ['60 pt-BR', 'human-rich', 60, 'pt-BR', true],
    ['pt-BR', 'human-rich', 80, 'pt-BR', true],
    ['120 pt-BR', 'human-rich', 120, 'pt-BR', true],
  ];
  return cases
    .map(
      ([label, mode, width, locale, noColor]) =>
        `## ${label}\n\n\`\`\`text\n${stripAnsi(renderGallery(context(mode, width, noColor), locale))}\n\`\`\``,
    )
    .join('\n\n');
}

function main(): void {
  const options = parseArgs();
  if (options.catalog) {
    const target = path.resolve('test/fixtures/terminal-catalog.md');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `# SAF terminal catalog\n\n${catalog()}\n`);
    return;
  }
  const output = renderGallery(
    context(options.mode, options.width, options.noColor),
    options.locale,
  );
  process.stdout.write(`${output}\n`);
}

main();
