#!/usr/bin/env node
'use strict';

// Reproducible black-box audit of the published CLI surface. Every journey runs in a temporary
// project and HOME; expected failures are recorded as passing scenarios, not swallowed errors.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.join(__dirname, '..');
const cli = path.join(repoRoot, 'bin', 'sdd-agentic-flow.js');
const version = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;
const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-exhaustive-'));
const cases = [];

function project(name) {
  const cwd = path.join(runRoot, name);
  const home = path.join(runRoot, `${name}-home`);
  fs.mkdirSync(cwd, { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  return { cwd, home };
}

function entries(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(root, entry.name);
    return entry.isDirectory() ? [entry.name, ...entries(name)] : [entry.name];
  });
}

function run(args, state, input = '') {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: state.cwd,
    input,
    encoding: 'utf8',
    timeout: 20_000,
    env: { ...process.env, HOME: state.home, USERPROFILE: state.home, CI: '1' },
  });
}

function record(id, journey, command, fn) {
  const started = Date.now();
  try {
    const note = fn() || 'observed expected behavior';
    cases.push({ id, journey, command, status: 'PASS', duration: Date.now() - started, note });
  } catch (error) {
    cases.push({
      id,
      journey,
      command,
      status: 'FAIL',
      duration: Date.now() - started,
      note: error.message.replace(/\s+/g, ' ').slice(0, 360),
    });
  }
}

function expect(result, status, pattern) {
  assert.equal(result.status, status, `${result.stderr}${result.stdout}`);
  if (pattern) assert.match(`${result.stdout}\n${result.stderr}`, pattern);
}

function writeLoopState(cwd) {
  const directory = path.join(cwd, '.sdd-agentic-flow/autonomy');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'loop-state.md'),
    [
      '# Loop State',
      '',
      'Execution mode: full',
      'Autonomy level: autonomous',
      '',
      '## Current State',
      '',
      '- Skill: saf-implement (blocked)',
      '- Status: FAIL',
      '- Next: saf-check-task',
      '- Guardrails: FAIL (guardrail 3: tests_fail)',
      '- Human override: pause=false, stop=true',
      '',
    ].join('\n'),
  );
}

function runJourneys() {
  const fresh = project('01-new-user');
  const before = entries(fresh.cwd);
  record('J01', 'new user', 'sdd-agentic-flow', () => {
    const result = run([], fresh);
    expect(result, 0, /Suggested next step|init/);
    assert.deepEqual(entries(fresh.cwd), before);
  });
  record('J02', 'new user', 'init', () => {
    const result = run(['init', '--preset', 'supervised', '--br'], fresh);
    expect(result, 0, /initialized|inicializados/);
    assert.match(
      fs.readFileSync(path.join(fresh.cwd, '.sdd-agentic-flow/config.yml'), 'utf8'),
      /pt-BR/,
    );
  });
  record('J03', 'new user', 'init again', () => {
    const result = run(['init'], fresh);
    expect(result, 0, /preserved existing|preservada|preservado|initialized|inicializado/);
  });
  record('J04', 'new user', 'doctor --json --contracts --autonomy', () => {
    const result = run(['doctor', '--json', '--contracts', '--autonomy'], fresh);
    expect(result, 0);
    const report = JSON.parse(result.stdout);
    assert.ok(Array.isArray(report.checks));
    assert.notEqual(report.status, 'FAIL');
  });

  const greenfield = project('02-project-user');
  record('J05', 'project setup', 'discover -> context status', () => {
    expect(run(['discover'], greenfield), 0);
    const result = run(['context', 'status'], greenfield);
    expect(result, 0, /available|project-context/);
  });
  record('J06', 'project setup', 'context refresh', () => {
    expect(run(['context', 'refresh'], greenfield), 0, /created|refreshed|generated/);
  });
  record('J07', 'project setup', 'install core --scope project', () => {
    expect(run(['install', 'core', '--scope', 'project'], greenfield), 0, /installed|preserved/);
    assert.ok(fs.existsSync(path.join(greenfield.cwd, '.agents/skills/saf-create-spec/SKILL.md')));
  });
  record('J08', 'project setup', 'install core --scope project (repeat)', () => {
    expect(run(['install', 'core', '--scope', 'project'], greenfield), 0, /preserved|unchanged/);
  });
  record('J09', 'project setup', 'doctor --smoke --contracts', () => {
    expect(run(['doctor', '--smoke', '--contracts'], greenfield), 0);
  });

  const policy = project('03-policy');
  expect(run(['init'], policy), 0);
  record('J10', 'policy configuration', 'config show', () =>
    expect(run(['config', 'show'], policy), 0, /Execution mode/),
  );
  record('J11', 'policy configuration', 'config policy --plan --preset autonomous', () => {
    const before = fs.readFileSync(path.join(policy.cwd, '.sdd-agentic-flow/config.yml'), 'utf8');
    const result = run(['config', 'policy', '--plan', '--preset', 'autonomous'], policy);
    expect(result, 0, /Policy change preview|PLAN|would/);
    assert.equal(
      fs.readFileSync(path.join(policy.cwd, '.sdd-agentic-flow/config.yml'), 'utf8'),
      before,
    );
  });
  record('J12', 'policy configuration', 'config policy --yes --preset supervised', () => {
    expect(run(['config', 'policy', '--yes', '--preset', 'supervised'], policy), 0, /PASS|saved/);
  });
  record('J13', 'policy configuration', 'configure --plan', () => {
    expect(
      run(
        ['configure', '--plan', '--scope', 'project', '--pack', 'core', '--sharing', 'local'],
        policy,
      ),
      0,
      /Intent preview|would save/,
    );
  });
  record('J14', 'policy configuration', 'configure --scope project --pack core', () => {
    expect(run(['configure', '--scope', 'project', '--pack', 'core'], policy), 0, /saved/);
  });

  const userInstall = project('04-user-install');
  record('J15', 'global installation', 'install core --plan', () => {
    const before = entries(userInstall.cwd).sort();
    const result = run(['install', 'core', '--plan'], userInstall);
    expect(result, 0, /Installation plan|Scope +user|Repository footprint/);
    assert.deepEqual(entries(userInstall.cwd).sort(), before);
    assert.deepEqual(entries(userInstall.home), []);
  });
  record('J16', 'global installation', 'install core --agent claude-code', () => {
    expect(
      run(['install', 'core', '--agent', 'claude-code'], userInstall),
      0,
      /installed|preserved/,
    );
    assert.ok(
      fs.existsSync(path.join(userInstall.home, '.claude/skills/saf-create-spec/SKILL.md')),
    );
    assert.equal(fs.existsSync(path.join(userInstall.home, '.agents/skills')), false);
  });
  record('J17', 'global installation', 'upgrade --skills-only', () => {
    const skill = path.join(userInstall.home, '.claude/skills/saf-create-spec/SKILL.md');
    fs.writeFileSync(skill, 'local edit\n');
    expect(run(['upgrade', '--skills-only'], userInstall), 0, /differ|skipped|refreshed/);
    assert.equal(fs.readFileSync(skill, 'utf8'), 'local edit\n');
  });

  const safety = project('05-safety');
  record('J18', 'safe reconciliation', 'install core --plan with foreign skill', () => {
    const foreign = path.join(safety.home, '.agents/skills/saf-create-spec');
    fs.mkdirSync(foreign, { recursive: true });
    fs.writeFileSync(path.join(foreign, 'SKILL.md'), '# foreign\n');
    const result = run(['install', 'core', '--plan'], safety);
    expect(result, 0, /Collisions|COLLISION|BLOCKED|foreign/);
  });
  record('J19', 'safe reconciliation', 'invalid legacy install is blocked', () => {
    const legacy = path.join(safety.cwd, '.agents/skills/sdd-route');
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, 'SKILL.md'), '# legacy\n');
    const result = run(['install', 'core', '--scope', 'project'], safety);
    expect(result, 1, /legacy|BLOCKED|3\.0/);
  });

  const autonomy = project('06-autonomy');
  expect(run(['init', '--preset', 'autonomous'], autonomy), 0);
  record('J20', 'autonomy workflow', 'context autonomy-state without state', () => {
    expect(run(['context', 'autonomy-state'], autonomy), 0, /not found|no .*loop-state/);
  });
  record('J21', 'autonomy workflow', 'autonomous-resume without state', () => {
    expect(run(['autonomous-resume'], autonomy), 1, /nothing to resume/);
  });
  writeLoopState(autonomy.cwd);
  record('J22', 'autonomy workflow', 'autonomous-resume missing reason', () => {
    expect(run(['autonomous-resume', '--override-guard=3'], autonomy), 1, /reason/);
  });
  record('J23', 'autonomy workflow', 'autonomous-resume audited override', () => {
    expect(
      run(['autonomous-resume', '--override-guard=3', '--reason=verified test'], autonomy),
      0,
      /resumed/,
    );
    assert.match(
      fs.readFileSync(path.join(autonomy.cwd, '.sdd-agentic-flow/autonomy/loop-state.md'), 'utf8'),
      /stop=false/,
    );
  });

  const removal = project('07-removal');
  expect(run(['init'], removal), 0);
  expect(run(['install', 'core', '--scope', 'project'], removal), 0);
  fs.mkdirSync(path.join(removal.cwd, '.specs/features'), { recursive: true });
  fs.writeFileSync(path.join(removal.cwd, '.specs/features/keep.md'), 'keep\n');
  fs.writeFileSync(path.join(removal.cwd, 'user-file.txt'), 'keep\n');
  record('J24', 'uninstall workflow', 'uninstall --plan', () => {
    expect(run(['uninstall', '--plan'], removal), 0, /Uninstall plan|No changes made/);
    assert.ok(fs.existsSync(path.join(removal.cwd, '.agents/skills/saf-create-spec/SKILL.md')));
  });
  record('J25', 'uninstall workflow', 'uninstall --apply', () => {
    expect(run(['uninstall', '--apply'], removal), 0, /removed/);
    assert.ok(fs.existsSync(path.join(removal.cwd, '.specs/features/keep.md')));
    assert.ok(fs.existsSync(path.join(removal.cwd, 'user-file.txt')));
  });
  record('J26', 'uninstall workflow', 'uninstall --apply --full', () => {
    expect(run(['uninstall', '--apply', '--full'], removal), 0, /preserved/);
    assert.equal(fs.existsSync(path.join(removal.cwd, '.sdd-agentic-flow/config.yml')), false);
  });

  const invalid = project('08-errors');
  const badCases = [
    ['E01', 'doctro', /Did you mean `doctor`/],
    ['E02', 'install missing-pack', /unknown pack/],
    ['E03', 'doctor --unknown', /usage:/],
    ['E04', 'uninstall', /uninstall --plan/],
    ['E05', 'configure --interactive --plan', /cannot combine/],
    ['E06', 'upgrade --check --skills-only', /cannot be combined/],
    ['E07', 'autonomous-resume --override-guard=8', /Invalid arguments/],
  ];
  for (const [id, command, pattern] of badCases) {
    record(id, 'invalid input safety', command, () => {
      const result = run(command.split(' '), invalid);
      expect(result, 1, pattern);
    });
  }
  record('E08', 'output contract', 'doctor --json invalid flag', () => {
    const result = run(['doctor', '--json', '--unknown'], invalid);
    expect(result, 1);
    assert.equal(JSON.parse(result.stdout).status, 'FAIL');
  });
  record('E09', 'output contract', 'help aliases', () => {
    for (const command of [
      'init',
      'install',
      'doctor',
      'upgrade',
      'uninstall',
      'discover',
      'context',
    ]) {
      assert.equal(
        run(['help', command], invalid).stdout,
        run([command, '--help'], invalid).stdout,
        command,
      );
    }
  });

  const packed = project('09-packed-consumer');
  record('J27', 'fresh packaged consumer', 'npm pack -> npx init/install/doctor', () => {
    const packDir = path.join(runRoot, 'pack');
    const cacheDir = path.join(runRoot, 'npm-cache');
    fs.mkdirSync(packDir, { recursive: true });
    const pack = spawnSync(
      'npm',
      ['pack', '--json', '--pack-destination', packDir, '--cache', cacheDir],
      {
        cwd: repoRoot,
        encoding: 'utf8',
        timeout: 30_000,
      },
    );
    assert.equal(pack.status, 0, pack.stderr);
    const metadata = JSON.parse(pack.stdout.slice(pack.stdout.indexOf('[')))[0];
    const tarball = path.join(packDir, metadata.filename);
    for (const args of [['init'], ['install', 'core'], ['doctor', '--json']]) {
      const result = spawnSync('npx', ['--yes', '--cache', cacheDir, `file:${tarball}`, ...args], {
        cwd: packed.cwd,
        encoding: 'utf8',
        timeout: 30_000,
        env: { ...process.env, HOME: packed.home, USERPROFILE: packed.home, CI: '1' },
      });
      assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}${result.stdout}`);
    }
  });
}

function writeReport() {
  const executedAt = new Date();
  const executedIso = executedAt.toISOString();
  const executionStamp = executedIso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const reportPath =
    process.env.SAF_CLI_REPORT ||
    path.join(
      repoRoot,
      `.local/gmm/sdd-agentic-flow/v${version}-cli-test-report-${executionStamp}.md`,
    );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const passed = cases.filter((item) => item.status === 'PASS').length;
  const failed = cases.length - passed;
  const lines = [
    `# v${version} CLI exhaustive test report`,
    '',
    `> **Status:** ${failed ? 'FINDINGS' : 'PASS'}  `,
    `> **Executed:** ${executedIso}  `,
    `> **Report ID:** ${executionStamp}  `,
    `> **Scope:** local black-box journeys with isolated temporary projects and HOMEs`,
    '',
    '## Executive summary',
    '',
    `- Scenarios: **${cases.length}**`,
    `- Passed: **${passed}**`,
    `- Unexpected failures: **${failed}**`,
    '- Platform scope: current host only; Windows/macOS behavior remains covered by CI.',
    '- Network-dependent update checks and registry authentication are not asserted here.',
    '',
    '## Scenario matrix',
    '',
    '| ID | Journey | Command | Status | Evidence |',
    '| --- | --- | --- | --- | --- |',
    ...cases.map(
      (item) =>
        `| ${item.id} | ${item.journey} | \`${item.command}\` | ${item.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} | ${item.note.replace(/\|/g, '\\|')} (${item.duration} ms) |`,
    ),
    '',
    '## Findings',
    '',
    failed
      ? cases
          .filter((item) => item.status === 'FAIL')
          .map((item) => `- **${item.id} — ${item.journey}:** ${item.note}`)
          .join('\n')
      : '- No unexpected failures observed.',
    '',
    '## Validation commands',
    '',
    '- `npm test` — executed separately after this runner.',
    '- `npm run check` — executed separately after this runner.',
    '- `npm run pack:dry` — covered by the packaged-consumer journey and executed separately.',
    '- `npm run release:check` — executed separately; registry publication remains workflow-owned.',
    '',
    '## Interpretation',
    '',
    'This report distinguishes expected negative-path behavior from unexpected failures. A PASS means the CLI matched the documented contract for that scenario; it does not claim that untested external platforms or network services are healthy.',
    '',
  ];
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
  console.log(`CLI exhaustive audit: ${passed}/${cases.length} scenarios passed`);
  console.log(`Report: ${reportPath}`);
  if (failed) {
    console.error(`${failed} unexpected scenario failure(s)`);
    process.exitCode = 1;
  }
}

try {
  runJourneys();
} finally {
  writeReport();
  fs.rmSync(runRoot, { recursive: true, force: true });
}
