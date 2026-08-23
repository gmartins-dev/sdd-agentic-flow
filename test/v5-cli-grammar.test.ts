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

test('canonical read-only commands expose help topics and direct --help', () => {
  for (const command of ['learn-sdd', 'completion', 'version']) {
    const topic = run(['help', command]);
    const direct = run([command, '--help']);
    assert.equal(topic.status, 0, command);
    assert.equal(direct.status, 0, command);
    assert.equal(direct.stdout, topic.stdout, command);
    assert.equal(topic.stderr, '', command);
    assert.equal(direct.stderr, '', command);
  }
});

test('list rejects unknown arguments instead of silently ignoring them', () => {
  const result = run(['list', '--not-a-real-flag']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /usage: list \[--help\]/);
  assert.match(result.stderr, /Unknown list argument/);
});

test('install help documents the supported non-interactive grammar', () => {
  const result = run(['install', '--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--plan/);
  assert.doesNotMatch(result.stdout, /install .*--yes/);
});
