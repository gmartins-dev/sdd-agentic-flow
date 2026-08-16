import assert from 'node:assert/strict';
import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const cli = path.resolve(__dirname, '../dist/sdd-agentic-flow.js');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-config-cli-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

function run(args: string[], cwd = temporary): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
}

function initConfig(cwd: string): void {
  fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, '.sdd-agentic-flow/config.yml'),
    `version: 1
workflow:
  execution_mode: guided
  autonomy_level: manual
  feature_profile: medium_feature
language:
  profile: en-US
`,
    'utf8',
  );
}

test('config show prints policy summary', () => {
  initConfig(temporary);
  const result = run(['config', 'show'], temporary);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /execution_mode=guided|Execution mode/);
  assert.match(result.stdout, /guided/);
});

test('config policy --plan never writes', () => {
  initConfig(temporary);
  const result = run(['config', 'policy', '--plan', '--preset', 'supervised'], temporary);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Policy change preview|Before/);
  const config = fs.readFileSync(path.join(temporary, '.sdd-agentic-flow/config.yml'), 'utf8');
  assert.match(config, /execution_mode: guided/);
});

test('config policy non-TTY without --yes fails', () => {
  initConfig(temporary);
  const result = run(['config', 'policy', '--preset', 'supervised'], temporary);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires --yes/);
});

test('config policy --yes writes in non-TTY', () => {
  initConfig(temporary);
  const result = run(['config', 'policy', '--yes', '--preset', 'supervised'], temporary);
  assert.equal(result.status, 0);
  const config = fs.readFileSync(path.join(temporary, '.sdd-agentic-flow/config.yml'), 'utf8');
  assert.match(config, /execution_mode: apply/);
  assert.match(config, /autonomy_level: supervised/);
});
