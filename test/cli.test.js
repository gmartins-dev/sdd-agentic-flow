'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const { spawnSync } = require('node:child_process');

const cli = path.resolve(__dirname, '../bin/sdd-agentic-flow.js');
const packageRoot = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-test-'));

after(() => fs.rmSync(temporary, { recursive: true, force: true }));

function run(args, cwd = temporary, input) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, input, encoding: 'utf8' });
}

test('help, version, and list are available', () => {
  assert.match(run(['help']).stdout, /uninstall --plan/);
  assert.equal(run(['version']).stdout.trim(), '0.6.0');
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
  const input =
    'task-app\nmain\ncodex\npt-BR\ngithub-guidance\nmulti\nlarge_feature\ntrue\nfalse\n';
  assert.equal(run(['init', '--interactive'], cwd, input).status, 0);
  const config = fs.readFileSync(path.join(cwd, '.sdd/config.yml'), 'utf8');
  assert.match(config, /name: task-app/);
  assert.match(config, /target: codex/);
  assert.match(config, /profile: pt-BR/);
  assert.match(config, /feature_profile: large_feature/);
  assert.match(config, /allow_multi_worktree: true/);
  assert.match(run(['init', '--interactive'], cwd, input).stdout, /will not overwrite/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('init auto-discovers project context and discover refreshes it', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-discover-'));
  fs.writeFileSync(path.join(cwd, 'README.md'), '# sample\n');
  fs.writeFileSync(path.join(cwd, 'AGENTS.md'), '# agents\n');
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'sample-app' }));
  assert.equal(run(['init'], cwd).status, 0);
  const contextPath = path.join(cwd, '.sdd/context/project-context.md');
  assert.ok(fs.existsSync(contextPath));
  const initial = fs.readFileSync(contextPath, 'utf8');
  assert.match(initial, /Package name: sample-app/);
  assert.match(initial, /AGENTS\.md/);

  assert.match(run(['discover'], cwd).stdout, /preserved existing/);
  assert.equal(fs.readFileSync(contextPath, 'utf8'), initial);

  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'renamed-app' }));
  assert.match(
    run(['discover', '--force'], cwd).stdout,
    /created \.sdd\/context\/project-context\.md/,
  );
  assert.match(fs.readFileSync(contextPath, 'utf8'), /Package name: renamed-app/);

  assert.equal(run(['discover', '--unknown'], cwd).status, 1);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('doctor JSON is parseable and smoke is isolated', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-doctor-'));
  assert.equal(run(['init', '--language', 'pt-BR'], cwd).status, 0);
  assert.equal(run(['install', 'core'], cwd).status, 0);
  const result = run(['doctor', '--json'], cwd);
  const report = JSON.parse(result.stdout);
  assert.equal(report.version, '0.6.0');
  assert.ok(Array.isArray(report.checks));
  assert.equal(report.language.profile, 'pt-BR');
  assert.equal(report.language.status, 'PASS');
  assert.equal(report.checks.find((check) => check.name === 'project_context').status, 'PASS');
  assert.equal(report.checks.find((check) => check.name === 'baseline-tlc').status, 'PASS');
  assert.equal(report.checks.find((check) => check.name === 'adaptive-sizing').status, 'PASS');
  assert.equal(report.checks.find((check) => check.name === 'traceability').status, 'PASS');
  assert.equal(report.checks.find((check) => check.name === 'evidence-first').status, 'PASS');
  assert.equal(run(['doctor', '--smoke'], cwd).status, 0);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('feature profile flag configures workflow and invalid values fail', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-feature-profile-'));
  assert.equal(run(['init', '--feature-profile', 'epic'], cwd).status, 0);
  assert.match(fs.readFileSync(path.join(cwd, '.sdd/config.yml'), 'utf8'), /feature_profile: epic/);
  const invalidCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-feature-invalid-'));
  assert.equal(run(['init', '--feature-profile', 'huge'], invalidCwd).status, 1);
  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(invalidCwd, { recursive: true, force: true });
});

test('doctor validates the TDD baseline in package and installed shared layers', () => {
  const packageReport = JSON.parse(run(['doctor', '--json'], packageRoot).stdout);
  assert.equal(packageReport.status, 'PASS');
  assert.ok(packageReport.checks.some((check) => check.name === 'tdd-baseline'));

  for (const pack of ['core', 'execution']) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `sdd-agentic-flow-tdd-${pack}-`));
    assert.equal(run(['init'], cwd).status, 0);
    assert.equal(run(['install', pack], cwd).status, 0);
    assert.ok(
      fs.existsSync(
        path.join(cwd, '.agents/skills/sdd-agentic-flow-shared/references/tdd-baseline.md'),
      ),
    );
    const report = JSON.parse(run(['doctor', '--json'], cwd).stdout);
    assert.equal(report.checks.find((check) => check.name === 'tdd-baseline').status, 'PASS');
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('routing skill is listed, installed by public packs, and removed by uninstall', () => {
  assert.match(run(['list']).stdout, /sdd-route/);

  for (const pack of ['core', 'planning', 'execution', 'pr']) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `sdd-agentic-flow-route-${pack}-`));
    assert.equal(run(['init'], cwd).status, 0);
    assert.equal(run(['install', pack], cwd).status, 0);
    assert.ok(fs.existsSync(path.join(cwd, '.agents/skills/sdd-route/SKILL.md')));
    fs.rmSync(cwd, { recursive: true, force: true });
  }

  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-route-uninstall-'));
  assert.equal(run(['init'], cwd).status, 0);
  assert.equal(run(['install', 'core'], cwd).status, 0);
  assert.equal(run(['uninstall', '--apply'], cwd).status, 0);
  assert.ok(!fs.existsSync(path.join(cwd, '.agents/skills/sdd-route')));
  assert.ok(fs.existsSync(path.join(cwd, '.sdd/config.yml')));
  assert.ok(fs.existsSync(path.join(cwd, '.specs/features')));
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('language flag generates profiles and invalid values fail', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-language-'));
  assert.equal(run(['init', '--language', 'pt-BR'], cwd).status, 0);
  const config = fs.readFileSync(path.join(cwd, '.sdd/config.yml'), 'utf8');
  assert.match(config, /profile: pt-BR/);
  assert.match(config, /bilingual_mode: technical-canonical/);
  const invalidCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-invalid-'));
  assert.equal(run(['init', '--language', 'de-DE'], invalidCwd).status, 1);
  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(invalidCwd, { recursive: true, force: true });
});

test('interactive language default and legacy config warning are supported', () => {
  const interactiveCwd = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdd-agentic-flow-language-interactive-'),
  );
  const input = 'language-app\nmain\ngeneric\n\nlocal-files\nsingle\n\nfalse\nfalse\n';
  assert.equal(
    run(['init', '--interactive', '--language', 'pt-BR'], interactiveCwd, input).status,
    0,
  );
  const interactiveConfig = fs.readFileSync(path.join(interactiveCwd, '.sdd/config.yml'), 'utf8');
  assert.match(interactiveConfig, /profile: pt-BR/);
  assert.match(interactiveConfig, /feature_profile: medium_feature/);
  fs.rmSync(interactiveCwd, { recursive: true, force: true });

  const legacyCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-language-legacy-'));
  fs.mkdirSync(path.join(legacyCwd, '.sdd'), { recursive: true });
  fs.writeFileSync(
    path.join(legacyCwd, '.sdd/config.yml'),
    'language:\n  human_outputs: en-US\n  technical_tokens: canonical\n',
  );
  const report = JSON.parse(run(['doctor', '--json'], legacyCwd).stdout);
  assert.equal(report.language.status, 'WARN');
  assert.equal(report.language.profile, null);
  fs.rmSync(legacyCwd, { recursive: true, force: true });
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
