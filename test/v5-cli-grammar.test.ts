import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs, { mkdtempSync } from 'node:fs';
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

test('unsupported machine flags and invalid tails fail before durable work', () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'saf-v7-contract-'));
  spawnSync('git', ['init', '--quiet'], { cwd });
  const invoke = (args: string[]) =>
    spawnSync(process.execPath, [cli, ...args], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, HOME: cwd },
    });

  for (const args of [
    ['version', '--json'],
    ['version', 'extra'],
    ['learn-sdd', 'extra'],
    ['help', 'install', 'extra'],
    ['config', 'show', '--unknown'],
  ]) {
    const result = invoke(args);
    assert.equal(result.status, 1, args.join(' '));
  }

  const contextPlan = invoke(['context', 'refresh', '--plan']);
  assert.equal(contextPlan.status, 1);
  assert.equal(
    fs.existsSync(path.join(cwd, '.sdd-agentic-flow/context/project-context.md')),
    false,
  );

  const configJson = invoke(['config', 'policy', '--json', '--yes', '--preset', 'manual']);
  assert.equal(configJson.status, 1);
  assert.equal(fs.existsSync(path.join(cwd, '.sdd-agentic-flow/config.yml')), false);
});

test('invalid autonomous resume preserves an active loop state byte-for-byte', () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'saf-v7-autonomy-'));
  spawnSync('git', ['init', '--quiet'], { cwd });
  const loopState = path.join(cwd, '.sdd-agentic-flow/autonomy/loop-state.md');
  fs.mkdirSync(path.dirname(loopState), { recursive: true });
  fs.writeFileSync(
    loopState,
    '# Loop state\n\nExecution mode: full\nAutonomy level: autonomous\n\n## Current State\n- Skill: saf-implement\n- Status: paused\n- Human override: pause=true, stop=false\n',
  );
  const before = fs.readFileSync(loopState);
  const result = spawnSync(process.execPath, [cli, 'autonomous-resume', '--override-guard=8'], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, HOME: cwd },
  });
  assert.equal(result.status, 1);
  assert.deepEqual(fs.readFileSync(loopState), before);
});

test('project installation rejects user-only targets without mutation', () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'saf-v7-project-target-'));
  spawnSync('git', ['init', '--quiet'], { cwd });
  const invoke = (args: string[]) =>
    spawnSync(process.execPath, [cli, ...args], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, HOME: cwd },
    });
  assert.equal(invoke(['init']).status, 0);
  const result = invoke(['install', '--scope', 'project', '--target', 'agents']);
  assert.equal(result.status, 1);
  assert.equal(fs.existsSync(path.join(cwd, '.agents/skills')), false);
});

test('init JSON is one final document after apply', () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'saf-v7-init-json-'));
  spawnSync('git', ['init', '--quiet'], { cwd });
  const result = spawnSync(process.execPath, [cli, 'init', '--json'], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, HOME: cwd },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout.trim());
  assert.equal(report.ok, true);
  assert.equal(report.data.applied, true);
  assert.equal(result.stdout.trim().split('\n').length, 1);
  assert.ok(fs.existsSync(path.join(cwd, '.sdd-agentic-flow/workspace.yml')));
});
