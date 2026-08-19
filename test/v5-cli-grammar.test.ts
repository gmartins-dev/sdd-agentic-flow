import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const cli = path.resolve(__dirname, '../dist/sdd-agentic-flow.js');

function run(args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

test('v5 rejects removed top-level commands before domain work', () => {
  for (const command of ['discover', 'configure']) {
    const result = run([command]);
    assert.equal(result.status, 1, command);
    assert.match(result.stderr, new RegExp(`unknown command: ${command}`));
    assert.match(result.stderr, /removed from the v5 canonical interface/);
  }
});

test('v5 completion emits one deterministic stdout script per supported shell', () => {
  for (const shell of ['bash', 'zsh', 'fish']) {
    const first = run(['completion', shell]);
    const second = run(['completion', shell]);
    assert.equal(first.status, 0, shell);
    assert.equal(first.stderr, '', shell);
    assert.equal(first.stdout, second.stdout, shell);
    assert.match(first.stdout, /sdd-agentic-flow/);
    assert.match(first.stdout, /config/);
    assert.doesNotMatch(first.stdout, /discover|configure/);
  }
});

test('v5 rejects lexical flag conflicts before command preflight', () => {
  const result = run(['doctor', '--json', '--interactive']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot be combined/);
});

test('v5 uninstall uses --plan for preview and --yes for local apply', () => {
  const plan = run(['uninstall', '--plan']);
  assert.equal(plan.status, 0);
  assert.match(plan.stdout, /Uninstall plan/);
  assert.equal(run(['uninstall', '--apply']).status, 1);
});
