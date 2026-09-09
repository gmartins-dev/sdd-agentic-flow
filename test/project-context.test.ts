import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, mock, test } from 'node:test';

import {
  autonomousResume,
  autonomyStateReport,
  discoverProject,
  readLoopState,
} from '../src/project-context';

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

function captureStderr(run: () => void): string {
  const original = process.stderr.write;
  let output = '';
  process.stderr.write = ((chunk: string | Uint8Array) => {
    output += chunk.toString();
    return true;
  }) as typeof process.stderr.write;
  try {
    run();
  } finally {
    process.stderr.write = original;
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

test('loop state distinguishes canonical, missing, and malformed overrides', () => {
  const cwd = path.join(temporary, 'state-validity');
  const file = path.join(cwd, '.sdd-agentic-flow/autonomy/loop-state.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const base = (override: string) =>
    `# Loop State\n\nExecution mode: full\nAutonomy level: autonomous\n\n## Current State\n\n- Skill: saf-implement\n- Status: paused\n- Next: saf-check-task\n- Guardrails: PASS\n${override}\n`;
  fs.writeFileSync(file, base('- Human override: pause=true, stop=true'));
  assert.equal(readLoopState(cwd)?.stateValidity, 'valid');
  assert.equal(readLoopState(cwd)?.pause, true);
  assert.equal(readLoopState(cwd)?.stop, true);
  fs.writeFileSync(file, base('- Human override: pause: true, stop: false'));
  assert.equal(readLoopState(cwd)?.stateValidity, 'invalid-override');
  fs.writeFileSync(
    file,
    base('- Human override: pause=true, stop=false\n- Human override: pause=false, stop=false'),
  );
  assert.equal(readLoopState(cwd)?.stateValidity, 'duplicate-override');
  fs.writeFileSync(file, base(''));
  assert.equal(readLoopState(cwd)?.stateValidity, 'missing-override');
});

test('stop takes precedence when both override flags are true', () => {
  const cwd = path.join(temporary, 'state-precedence');
  const file = path.join(cwd, '.sdd-agentic-flow/autonomy/loop-state.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    '# Loop State\n\n## Current State\n\n- Skill: saf-implement\n- Status: paused\n- Human override: pause=true, stop=true\n',
  );
  const output = captureStdout(() => autonomyStateReport(cwd));
  assert.match(output, /human override: stop=true/);
  assert.doesNotMatch(output, /human override: pause=true —/);
});

test('resume mutates only the current override and preserves later sections and CRLF', () => {
  const cwd = path.join(temporary, 'state-resume');
  const file = path.join(cwd, '.sdd-agentic-flow/autonomy/loop-state.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const content = [
    '# Loop State',
    '',
    'Execution mode: full',
    'Autonomy level: autonomous',
    '',
    '## Current State',
    '',
    '- Skill: saf-implement',
    '- Status: paused',
    '- Next: saf-check-task',
    '- Guardrails: PASS',
    '- Human override: pause=true, stop=false',
    '',
    '## Override Log',
    '',
    '- prior audit',
    '',
    '## Later Section',
    '',
    '- Human override: pause=true, stop=true',
    '',
  ].join('\r\n');
  fs.writeFileSync(file, content, 'utf8');
  const original = process.exitCode;
  process.exitCode = undefined;
  autonomousResume(cwd, { quiet: true });
  assert.equal(process.exitCode, undefined);
  const updated = fs.readFileSync(file, 'utf8');
  assert.match(updated, /Human override: pause=false, stop=false/);
  assert.match(updated, /- prior audit/);
  assert.match(updated, /## Later Section\r\n\r\n- Human override: pause=true, stop=true/);
  assert.match(updated, /resumed via `autonomous-resume`/);
  assert.doesNotMatch(updated, /\n## Later Section\n/);
  process.exitCode = original;
});

test('invalid configuration is not reported as effective autonomy state', () => {
  const cwd = path.join(temporary, 'invalid-config');
  const config = path.join(cwd, '.sdd-agentic-flow/config.yml');
  fs.mkdirSync(path.dirname(config), { recursive: true });
  fs.writeFileSync(config, 'schema: saf-config/v99\nworkflow:\n  execution_mode: full\n');
  const original = process.exitCode;
  process.exitCode = undefined;
  const output = captureStdout(() => {
    const error = captureStderr(() => autonomyStateReport(cwd));
    assert.match(error, /FAIL invalid configuration/);
  });
  assert.equal(output, '');
  assert.equal(process.exitCode, 1);
  process.exitCode = original;
});

test('resume does not announce success when the state write fails', () => {
  const cwd = path.join(temporary, 'state-write-failure');
  const file = path.join(cwd, '.sdd-agentic-flow/autonomy/loop-state.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const originalContent =
    '# Loop State\n\n## Current State\n\n- Skill: saf-implement\n- Human override: pause=true, stop=false\n';
  fs.writeFileSync(file, originalContent, 'utf8');
  const write = mock.method(fs, 'writeFileSync', () => {
    throw new Error('synthetic write failure');
  });
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;
  try {
    const output = captureStdout(() => {
      assert.throws(() => autonomousResume(cwd, { quiet: true }), /synthetic write failure/);
    });
    assert.equal(output, '');
    assert.equal(fs.readFileSync(file, 'utf8'), originalContent);
    assert.equal(process.exitCode, undefined);
  } finally {
    write.mock.restore();
    process.exitCode = originalExitCode;
  }
});
