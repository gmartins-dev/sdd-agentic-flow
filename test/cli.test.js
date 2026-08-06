'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const { spawnSync } = require('node:child_process');

const cli = path.resolve(__dirname, '../bin/sdd-agentic-flow.js');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-test-'));

after(() => fs.rmSync(temporary, { recursive: true, force: true }));

function run(args, cwd = temporary, input) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, input, encoding: 'utf8' });
}

test('help, version, and list are available', () => {
  assert.match(run(['help']).stdout, /uninstall --plan/);
  assert.equal(run(['version']).stdout.trim(), '0.2.0');
  assert.match(run(['list']).stdout, /PACK core/);
});

test('init and install core are idempotent', () => {
  assert.equal(run(['init']).status, 0);
  assert.ok(fs.existsSync(path.join(temporary, '.sdd/config.yml')));
  assert.equal(run(['install', 'core']).status, 0);
  assert.match(run(['install', 'core']).stdout, /preserved/);
  assert.equal(run(['doctor']).status, 0);
});

test('interactive init writes selected safe configuration and preserves existing config', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-interactive-'));
  const input = 'task-app\nmain\ncodex\npt-BR\ngithub-guidance\nmulti\ntrue\nfalse\n';
  assert.equal(run(['init', '--interactive'], cwd, input).status, 0);
  const config = fs.readFileSync(path.join(cwd, '.sdd/config.yml'), 'utf8');
  assert.match(config, /name: task-app/);
  assert.match(config, /target: codex/);
  assert.match(config, /allow_multi_worktree: true/);
  assert.match(run(['init', '--interactive'], cwd, input).stdout, /will not overwrite/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('doctor JSON is parseable and smoke is isolated', () => {
  const result = run(['doctor', '--json']);
  const report = JSON.parse(result.stdout);
  assert.equal(report.version, '0.2.0');
  assert.ok(Array.isArray(report.checks));
  assert.equal(run(['doctor', '--smoke']).status, 0);
});

test('uninstall plans and removes only toolkit assets', () => {
  assert.match(run(['uninstall', '--plan']).stdout, /sdd-agentic-flow-shared/);
  assert.equal(run(['uninstall', '--apply']).status, 0);
  assert.ok(fs.existsSync(path.join(temporary, '.sdd/config.yml')));
  assert.ok(fs.existsSync(path.join(temporary, '.specs/features')));
  assert.ok(!fs.existsSync(path.join(temporary, '.agents/skills/sdd-agentic-flow-shared')));
  assert.equal(run(['uninstall', '--apply', '--include-config']).status, 0);
  assert.ok(!fs.existsSync(path.join(temporary, '.sdd/config.yml')));
});

test('invalid packs and flags fail', () => {
  assert.equal(run(['install', 'missing-pack']).status, 1);
  assert.equal(run(['uninstall']).status, 1);
  assert.equal(run(['doctor', '--unknown']).status, 1);
});
