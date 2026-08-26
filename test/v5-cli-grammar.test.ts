import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const cli = path.resolve(__dirname, '../dist/sdd-agentic-flow.js');

function run(args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

test('rejects removed top-level commands before domain work', () => {
  for (const command of ['discover', 'configure']) {
    const result = run([command]);
    assert.equal(result.status, 1, command);
    assert.match(result.stderr, new RegExp(`unknown command: ${command}`));
    assert.match(result.stderr, /not part of the current canonical interface/);
  }
});

test('completion emits one deterministic stdout script per supported shell', () => {
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

test('rejects lexical flag conflicts before command preflight', () => {
  const result = run(['doctor', '--json', '--interactive']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot be combined/);
});

test('uninstall uses --plan for preview and --yes for local apply', () => {
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

test('list is a removed v7 command', () => {
  const result = run(['list', '--not-a-real-flag']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown command: list/);
  assert.match(result.stderr, /not part of the current canonical interface/);
});

test('install help documents the supported non-interactive grammar', () => {
  const result = run(['install', '--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--plan/);
  assert.match(result.stdout, /install .*--plan\|--yes/);
});

test('init plan and doctor use machine schema 2 without bundle-selection data', () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'saf-v7-cli-'));
  spawnSync('git', ['init', '--quiet'], { cwd });
  const invoke = (args: string[]) =>
    spawnSync(process.execPath, [cli, ...args], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, HOME: cwd },
    });
  const init = invoke(['init', '--plan', '--json']);
  assert.equal(init.status, 0);
  const initReport = JSON.parse(init.stdout);
  assert.equal(initReport.schema_version, 2);
  assert.equal(initReport.command, 'init');
  assert.equal(initReport.data.createsConfig, false);
  assert.equal('packs' in initReport.data, false);

  const doctor = invoke(['doctor', '--json']);
  const doctorReport = JSON.parse(doctor.stdout);
  assert.equal(doctorReport.schema_version, 2);
  assert.deepEqual(Object.keys(doctorReport.data.readiness).sort(), [
    'installation',
    'policy',
    'workspace',
  ]);
  assert.equal('config_origin' in doctorReport.data, true);
});
