import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { autonomyStateReport, discoverProject } from '../src/project-context';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-project-context-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

function captureStdout(run: () => void): string {
  const original = process.stdout.write;
  let output = '';
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  try {
    run();
  } finally {
    process.stdout.write = original;
  }
  return output;
}

test('generated project context has no manual section', () => {
  const cwd = path.join(temporary, 'generated');
  fs.mkdirSync(cwd, { recursive: true });
  assert.equal(discoverProject(cwd, { quiet: true }), true);
  const content = fs.readFileSync(
    path.join(cwd, '.sdd-agentic-flow', 'context', 'project-context.md'),
    'utf8',
  );
  assert.doesNotMatch(content, /## Notes|manual context/i);
});

test('autonomy state uses effective defaults when config is absent', () => {
  const cwd = path.join(temporary, 'defaults');
  fs.mkdirSync(cwd, { recursive: true });
  const output = captureStdout(() => autonomyStateReport(cwd));
  assert.match(output, /execution_mode: apply/);
  assert.match(output, /autonomy_level: supervised/);
});
