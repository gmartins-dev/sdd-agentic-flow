import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs, { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const cli = path.resolve(__dirname, '../dist/sdd-agentic-flow.js');
const testHome = mkdtempSync(path.join(os.tmpdir(), 'saf-cli-grammar-home-'));
// A registry answer newer than the running package, derived so a version bump cannot break it.
const packageVersion: string = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'),
).version;
const newerVersion = `${Number(packageVersion.split('.')[0]) + 1}.0.0`;
const newerPattern = newerVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function run(args: string[], extraEnv: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: testHome, ...extraEnv },
  });
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

test('upgrade plan pins the checked version and remains read-only', () => {
  const result = spawnSync(process.execPath, [cli, 'upgrade', '--plan'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: testHome,
      SDD_AGENTIC_FLOW_TEST_LATEST_VERSION: newerVersion,
    },
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, new RegExp(`Latest CLI: ${newerPattern}`));
  assert.match(
    result.stdout,
    new RegExp(`npm exec --yes sdd-agentic-flow@${newerPattern} -- upgrade --skills-only`),
  );
  assert.match(result.stdout, /No changes were made\./);
});

test('doctor renders the checks label only once', () => {
  const result = run(['doctor']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Checks: \d+ PASS, \d+ INFO, \d+ WARN, \d+ FAIL/);
  assert.doesNotMatch(result.stdout, /Checks: Checks:/);
});

test('upgrade check is read-only and reports the checked version', () => {
  const result = run(['upgrade', '--check'], {
    SDD_AGENTIC_FLOW_TEST_LATEST_VERSION: newerVersion,
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, new RegExp(`Latest version: ${newerPattern}`));
  assert.match(result.stdout, /Update available: yes/);
  assert.doesNotMatch(result.stdout, /npm install|npm exec/);
});

test('skills-only plan skips the registry and remains read-only', () => {
  const result = run(['upgrade', '--skills-only', '--plan'], {
    SDD_AGENTIC_FLOW_TEST_LATEST_VERSION: 'offline',
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Registry check: none \(--skills-only\)/);
  assert.match(result.stdout, /No changes were made\./);
});

test('non-interactive upgrade never mutates after finding an update', () => {
  const result = run(['upgrade'], { SDD_AGENTIC_FLOW_TEST_LATEST_VERSION: newerVersion });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /This invocation is non-interactive; no mutations were performed/);
  assert.doesNotMatch(result.stdout, /Updating the global SAF installation/);
});

test('offline upgrade check fails clearly without claiming current state', () => {
  const result = run(['upgrade', '--check'], { SDD_AGENTIC_FLOW_TEST_LATEST_VERSION: 'offline' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /No changes were made\./);
  assert.match(result.stdout, /unable to check for updates/i);
  assert.doesNotMatch(result.stdout, /Update available: no/);
});

test('upgrade rejects mutually exclusive check and skills-only modes', () => {
  const result = run(['upgrade', '--check', '--skills-only']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot be combined/);
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

test('malformed human override is rejected before resume flags can mutate state', () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'saf-v7-invalid-override-'));
  spawnSync('git', ['init', '--quiet'], { cwd });
  const loopState = path.join(cwd, '.sdd-agentic-flow/autonomy/loop-state.md');
  fs.mkdirSync(path.dirname(loopState), { recursive: true });
  const original =
    '# Loop state\n\n## Current State\n\n- Skill: saf-implement\n- Status: paused\n- Human override: pause: true, stop: false\n';
  fs.writeFileSync(loopState, original);
  for (const args of [
    ['autonomous-resume'],
    ['autonomous-resume', '--force'],
    ['autonomous-resume', '--override-guard=3', '--reason=verified'],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, HOME: cwd },
    });
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /invalid .*loop-state|invalid/i);
    assert.equal(fs.readFileSync(loopState, 'utf8'), original);
  }
});

test('doctor fails closed on duplicate overrides even when the first is active', () => {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'saf-v7-duplicate-override-'));
  spawnSync('git', ['init', '--quiet'], { cwd });
  const loopState = path.join(cwd, '.sdd-agentic-flow/autonomy/loop-state.md');
  fs.mkdirSync(path.dirname(loopState), { recursive: true });
  fs.writeFileSync(
    loopState,
    '# Loop state\n\n## Current State\n\n- Skill: saf-implement\n- Status: paused\n- Next: saf-check-task\n- Guardrails: PASS\n- Human override: pause=true, stop=false\n- Human override: pause=false, stop=false\n',
  );
  const result = spawnSync(process.execPath, [cli, 'doctor', '--json', '--autonomy'], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, HOME: cwd },
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /"name":"autonomy_loop_state","status":"FAIL"/);
  assert.match(result.stdout, /duplicate-override/);
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

test('project installation intent outside Git is a handled failure, not an internal error', () => {
  const outsideGit = mkdtempSync(path.join(os.tmpdir(), 'saf-non-git-'));
  for (const args of [
    ['config', 'installation', '--plan', '--scope', 'project'],
    ['config', 'installation', '--yes', '--scope', 'project'],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      cwd: outsideGit,
      encoding: 'utf8',
      env: { ...process.env, HOME: testHome, CI: '1', GIT_CEILING_DIRECTORIES: os.tmpdir() },
    });
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /Git repository metadata is required/);
  }
  fs.rmSync(outsideGit, { recursive: true, force: true });
});

test('fail-closed installation state refusals exit 1 with an actionable message', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'saf-state-refusal-'));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  fs.mkdirSync(project, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: project });
  const provenance = path.join(home, '.agents', 'skills', 'sdd-agentic-flow-shared');
  fs.mkdirSync(provenance, { recursive: true });
  const write = (applyState: string, skill: string) =>
    fs.writeFileSync(
      path.join(provenance, 'install-provenance.yml'),
      [
        'package: sdd-agentic-flow',
        'package_version: 8.1.2',
        'schema: saf-install-provenance/v3',
        `apply_state: ${applyState}`,
        'scope: user',
        'target: agents',
        'managed_skills:',
        `  - ${skill}`,
        '',
      ].join('\n'),
    );
  const runIn = (args: string[]) =>
    spawnSync(process.execPath, [cli, ...args], {
      cwd: project,
      encoding: 'utf8',
      env: { ...process.env, HOME: home, CI: '1' },
    });
  write('applying', 'saf-route');
  const interrupted = runIn(['uninstall', '--plan']);
  assert.equal(interrupted.status, 1);
  assert.match(interrupted.stderr, /interrupted apply/);
  write('complete', '../../outside');
  for (const args of [['uninstall', '--plan'], ['install', '--plan'], ['doctor']]) {
    const unsafe = runIn(args);
    assert.equal(unsafe.status, 1, args.join(' '));
    assert.match(`${unsafe.stdout}${unsafe.stderr}`, /unsafe installation provenance/);
  }
  fs.rmSync(root, { recursive: true, force: true });
});
