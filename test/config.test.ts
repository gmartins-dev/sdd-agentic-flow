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
    `schema: saf-config/v3
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
  assert.match(result.stdout, /Workflow/);
  assert.match(result.stdout, /Manual/);
});

test('public config commands ignore same-named keys outside their sections', () => {
  const cwd = path.join(temporary, 'repeated-sections');
  fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow'), { recursive: true });
  const configPath = path.join(cwd, '.sdd-agentic-flow/config.yml');
  fs.writeFileSync(
    configPath,
    `schema: saf-config/v3
project:
  execution_mode: plan
  profile: project-profile
workflow:
  execution_mode: guided
  autonomy_level: manual
  feature_profile: medium_feature
language:
  profile: en-US
  human_outputs: en-US
`,
    'utf8',
  );
  const shown = run(['config', 'show'], cwd);
  assert.equal(shown.status, 0);
  assert.match(shown.stdout, /Manual/);
  const preview = run(['config', 'policy', '--plan', '--preset', 'supervised'], cwd);
  assert.equal(preview.status, 0);
  assert.match(preview.stdout, /Before\s+Manual/);
  const applied = run(['config', 'policy', '--yes', '--preset', 'supervised'], cwd);
  assert.equal(applied.status, 0);
  const updated = fs.readFileSync(configPath, 'utf8');
  assert.match(updated, /project:\n {2}execution_mode: plan/);
  assert.match(updated, /workflow:\n {2}execution_mode: apply/);
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
