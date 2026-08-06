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

function run(args, cwd = temporary) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
}

test('help, version, and list are available', () => {
  assert.match(run(['help']).stdout, /install <pack>/);
  assert.equal(run(['version']).stdout.trim(), '0.1.2');
  assert.match(run(['list']).stdout, /PACK core/);
});

test('init and install core are idempotent', () => {
  assert.equal(run(['init']).status, 0);
  assert.ok(fs.existsSync(path.join(temporary, '.sdd/config.yml')));
  assert.equal(run(['install', 'core']).status, 0);
  assert.match(run(['install', 'core']).stdout, /preserved/);
  assert.equal(run(['doctor']).status, 0);
});

test('invalid packs fail', () => {
  assert.equal(run(['install', 'missing-pack']).status, 1);
});
