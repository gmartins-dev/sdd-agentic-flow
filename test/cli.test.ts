import assert from 'node:assert/strict';
import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import type { DoctorCheck } from '../src/doctor-view';

const cli = path.resolve(__dirname, '../dist/sdd-agentic-flow.js');
const packageRoot = path.resolve(__dirname, '..');
const packageVersion = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))
  .version as string;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-test-'));

after(() => fs.rmSync(temporary, { recursive: true, force: true }));

function run(args: string[], cwd: string = temporary, input?: string): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    ...(input !== undefined ? { input } : {}),
    encoding: 'utf8',
  });
}

// Milestone 1 hygiene rule: scope `user` tests must never write to the real $HOME of the
// machine running the tests. Every such test injects an isolated HOME (and USERPROFILE, for
// Windows) via a dedicated mkdtemp directory, passed only through `env`, and cleans it up.
function runIsolatedHome(
  args: string[],
  cwd: string,
  homeDir: string,
  input?: string,
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    ...(input !== undefined ? { input } : {}),
    encoding: 'utf8',
    env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir },
  });
}

function listAllEntries(root: string, prefix = ''): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory()
      ? [relative, ...listAllEntries(path.join(root, entry.name), relative)]
      : [relative];
  });
}

test('help, version, and list are available', () => {
  assert.match(run(['help']).stdout, /uninstall --plan/);
  assert.match(run(['help']).stdout, /autonomous-resume/);
  assert.equal(run(['version']).stdout.trim(), packageVersion);
  assert.match(run(['list']).stdout, /PACK core/);
});

test('help <command> and <command> --help render identical, detailed content', () => {
  for (const command of [
    'init',
    'config',
    'install',
    'doctor',
    'upgrade',
    'uninstall',
    'discover',
    'context',
    'list',
    'autonomous-resume',
  ]) {
    const viaHelp = run(['help', command]);
    const viaFlag = run([command, '--help']);
    assert.equal(viaHelp.status, 0, command);
    assert.equal(viaFlag.status, 0, command);
    assert.equal(viaHelp.stdout, viaFlag.stdout, command);
    assert.match(viaHelp.stdout, /USAGE/, command);
    assert.ok(viaHelp.stdout.length > 60, command);
  }
  // Bare --help/-h never take a subcommand: unaffected by the help(command) dispatch.
  assert.equal(run(['--help']).stdout, run(['help']).stdout);
  assert.equal(run(['-h']).stdout, run(['help']).stdout);

  const bogus = run(['help', 'bogus-command']);
  assert.equal(bogus.status, 1);
  assert.match(bogus.stderr, /unknown command: bogus-command/);
});

test('unknown commands, packs, and agents suggest the closest known value', () => {
  const unknownCommand = run(['doctro']);
  assert.equal(unknownCommand.status, 1);
  assert.match(unknownCommand.stderr, /unknown command: doctro/);
  assert.match(unknownCommand.stderr, /Did you mean `doctor`\?/);
  assert.match(unknownCommand.stderr, /Reason:/);
  assert.match(unknownCommand.stderr, /Try:/);

  const unknownHelpTopic = run(['help', 'doctro']);
  assert.match(unknownHelpTopic.stderr, /Did you mean `doctor`\?/);

  const unknownPack = run(['install', 'cor']);
  assert.equal(unknownPack.status, 1);
  assert.match(unknownPack.stderr, /unknown pack: cor/);
  assert.match(unknownPack.stderr, /Did you mean `core`\?/);
  assert.match(unknownPack.stderr, /Reason:/);
  assert.match(unknownPack.stderr, /Try:/);

  const unknownAgent = run(['install', 'core', '--agent', 'cursorr', '--plan']);
  assert.equal(unknownAgent.status, 1);
  assert.match(unknownAgent.stderr, /unknown agent: cursorr/);
  assert.match(unknownAgent.stderr, /Did you mean `cursor`\?/);

  // Nothing close enough: no suggestion is appended, not even a bogus one.
  const noSuggestion = run(['xyzzyplugh']);
  assert.equal(noSuggestion.status, 1);
  assert.doesNotMatch(noSuggestion.stderr, /Did you mean/);
});

test('CLI-010: non-TTY output has no brand/connector art and did-you-mean never writes', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-cli010-'));
  const welcome = run([], cwd);
  assert.equal(welcome.status, 0);
  // Machine welcome: no brand art (Unicode blocks, ASCII fills, or connectors).
  assert.doesNotMatch(welcome.stdout, /[◇│›▓▒]/);
  assert.doesNotMatch(welcome.stdout, /#{3,}/);
  assert.doesNotMatch(welcome.stdout, /={8,}/);
  assert.deepEqual(listAllEntries(cwd), []);

  const init = run(['init'], cwd);
  assert.equal(init.status, 0);
  assert.doesNotMatch(init.stdout, /[◇│›▓▒]/);
  assert.doesNotMatch(init.stdout, /#{3,}/);
  // Human-plain keeps deterministic next-step guidance; usage pointer remains.
  assert.match(init.stdout, /Suggested next step/);
  assert.match(init.stdout, /\.sdd-agentic-flow\/usage\.md/);
  const afterInit = listAllEntries(cwd).sort();

  const typo = run(['instlal'], cwd);
  assert.equal(typo.status, 1);
  assert.match(typo.stderr, /Did you mean `install`\?/);
  assert.match(typo.stderr, /Try:/);
  assert.deepEqual(listAllEntries(cwd).sort(), afterInit);

  // Doctor Fix/Next footer is human-rich only — absent in non-TTY machine mode.
  assert.doesNotMatch(run(['doctor'], cwd).stdout, /Fix: npx sdd-agentic-flow/);

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('doctor --json shape stays field-stable; help Useful when blocks exist', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-doctor-footer-'));
  const jsonEmpty = JSON.parse(run(['doctor', '--json'], empty).stdout);
  assert.ok(Array.isArray(jsonEmpty.checks));
  assert.ok(jsonEmpty.checks.every((check: DoctorCheck) => !Object.hasOwn(check, 'section')));
  assert.doesNotMatch(run(['doctor', '--json'], empty).stdout, /Fix: npx/);
  // Non-TTY doctor must not print the human-rich footer.
  assert.doesNotMatch(run(['doctor'], empty).stdout, /Fix: npx sdd-agentic-flow init/);
  fs.rmSync(empty, { recursive: true, force: true });

  assert.match(run(['help', 'init']).stdout, /Useful when:/);
  assert.match(run(['help', 'install']).stdout, /Useful when:/);
  assert.match(run(['help', 'doctor']).stdout, /Useful when:/);
  assert.match(run(['help', 'context']).stdout, /Useful when:/);
  assert.notEqual(run(['help', 'migrate']).status, 0);
});

test('uninstall with neither --plan nor --apply points at --plan as the safe first step', () => {
  const result = run(['uninstall']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /uninstall --plan.*first; it never removes anything/);
});

test('bare invocation shows a contextual, read-only status screen and never mutates the cwd', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-welcome-'));

  const before = run([], cwd);
  assert.equal(before.status, 0);
  assert.match(before.stdout, /^sdd-agentic-flow \d+\.\d+\.\d+/);
  assert.match(before.stdout, /Suggested next step/);
  assert.match(before.stdout, /npx sdd-agentic-flow init/);
  assert.match(before.stdout, /sdd-agentic-flow upgrade/);
  assert.match(before.stdout, /doctor --check-updates/);
  assert.deepEqual(listAllEntries(cwd), []);

  assert.equal(run(['init'], cwd).status, 0);
  const afterInit = run([], cwd);
  assert.match(afterInit.stdout, /npx sdd-agentic-flow install core/);
  const snapshot = listAllEntries(cwd).sort();
  assert.equal(run([], cwd).status, 0);
  assert.deepEqual(listAllEntries(cwd).sort(), snapshot);

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('init and install core are idempotent', () => {
  assert.equal(run(['init']).status, 0);
  assert.ok(fs.existsSync(path.join(temporary, '.sdd-agentic-flow/config.yml')));
  assert.equal(run(['install', 'core', '--scope', 'project']).status, 0);
  assert.match(run(['install', 'core', '--scope', 'project']).stdout, /preserved/);
  assert.equal(run(['doctor']).status, 0);
});

test('--quiet suppresses decorative output on init, install, and uninstall', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-quiet-'));

  const quietInit = run(['init', '--quiet'], cwd);
  assert.equal(quietInit.status, 0);
  assert.doesNotMatch(quietInit.stdout, /Suggested next step/);

  const quietInstall = run(['install', 'core', '--scope', 'project', '--quiet'], cwd);
  assert.equal(quietInstall.status, 0);
  assert.doesNotMatch(quietInstall.stdout, /Suggested next step/);

  const quietPlan = run(['uninstall', '--plan', '--quiet'], cwd);
  assert.equal(quietPlan.status, 0);
  assert.match(quietPlan.stdout, /Uninstall plan/);
  assert.match(quietPlan.stdout, /No changes made/);

  const quietApply = run(['uninstall', '--apply', '--quiet'], cwd);
  assert.equal(quietApply.status, 0);
  assert.match(quietApply.stdout, /PASS removed/);
  assert.doesNotMatch(quietApply.stdout, /preserved project specs/);

  const quietDiscover = run(['discover', '--quiet'], cwd);
  assert.equal(quietDiscover.status, 0);

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('init writes a resolvable usage guide stub and never points at a package docs path', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-usage-guide-'));
  const first = run(['init'], cwd);
  assert.equal(first.status, 0);
  const usagePath = path.join(cwd, '.sdd-agentic-flow/usage.md');
  assert.ok(fs.existsSync(usagePath));
  const usage = fs.readFileSync(usagePath, 'utf8');
  assert.match(usage, /saf-route/);
  assert.match(
    usage,
    /https:\/\/github\.com\/gmartins-dev\/sdd-agentic-flow\/blob\/main\/docs\/sdd-skills-usage-guide\.md/,
  );
  assert.match(first.stdout, /\.sdd-agentic-flow\/usage\.md/);
  assert.match(
    first.stdout,
    /https:\/\/github\.com\/gmartins-dev\/sdd-agentic-flow\/blob\/main\/docs\/sdd-skills-usage-guide\.md/,
  );
  assert.doesNotMatch(first.stdout, /Full guide:\n\s*docs\/sdd-skills-usage-guide\.md/);

  const second = run(['init'], cwd);
  assert.equal(second.status, 0);
  assert.ok(fs.existsSync(usagePath));
  assert.match(second.stdout, /preserved existing/);
  assert.doesNotMatch(second.stdout, /Full guide:\n\s*docs\/sdd-skills-usage-guide\.md/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('install core next-steps point at a resolvable usage guide, not a package docs path', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-install-guide-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-install-guide-home-'));
  assert.equal(run(['init'], cwd).status, 0);
  const result = runIsolatedHome(['install', 'core'], cwd, home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /\.sdd-agentic-flow\/usage\.md/);
  assert.match(
    result.stdout,
    /https:\/\/github\.com\/gmartins-dev\/sdd-agentic-flow\/blob\/main\/docs\/sdd-skills-usage-guide\.md/,
  );
  assert.doesNotMatch(result.stdout, /Full guide:\n\s*docs\/sdd-skills-usage-guide\.md/);
  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

test('init --local-git-exclude is opt-in, idempotent, and degrades without Git', () => {
  const withGit = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-git-exclude-'));
  const git = (gitArgs: string[]) => spawnSync('git', gitArgs, { cwd: withGit, encoding: 'utf8' });
  assert.equal(spawnSync('git', ['--version']).status, 0);
  git(['init', '-q']);
  const excludePath = path.join(withGit, '.git/info/exclude');
  const beforeExclude = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';

  const withoutFlag = run(['init'], withGit);
  assert.equal(withoutFlag.status, 0);
  const afterDefault = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
  assert.equal(afterDefault, beforeExclude);
  assert.doesNotMatch(afterDefault, /sdd-agentic-flow init --local-git-exclude/);

  const withFlag = run(['init', '--local-git-exclude'], withGit);
  assert.equal(withFlag.status, 0);
  const exclude = fs.readFileSync(excludePath, 'utf8');
  assert.match(exclude, /# sdd-agentic-flow init --local-git-exclude/);
  assert.match(exclude, /^\.sdd-agentic-flow\/$/m);
  assert.doesNotMatch(exclude, /^\.specs\/$/m);
  const firstLength = exclude.length;

  const second = run(['init', '--local-git-exclude'], withGit);
  assert.equal(second.status, 0);
  const again = fs.readFileSync(excludePath, 'utf8');
  assert.equal(again, exclude);
  assert.equal(again.length, firstLength);
  fs.rmSync(withGit, { recursive: true, force: true });

  const noGit = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-no-git-exclude-'));
  const degraded = run(['init', '--local-git-exclude'], noGit);
  assert.equal(degraded.status, 0);
  assert.match(degraded.stdout, /no \.git directory/);
  assert.ok(!fs.existsSync(path.join(noGit, '.git')));
  fs.rmSync(noGit, { recursive: true, force: true });
});

test('explanation template requires source-artifact anchors and the required headings', () => {
  const template = fs.readFileSync(
    path.join(packageRoot, 'shared/templates/explanation.template.md'),
    'utf8',
  );
  for (const heading of [
    '## Problem',
    '## Context / current state',
    '## What changes',
    '## How the new flow works',
    '## Important concepts',
    '## Decisions',
    '## Key scenarios',
    '## What this does NOT change',
    '## How to verify',
    '## Glossary',
  ]) {
    assert.ok(template.includes(heading), `missing heading ${heading}`);
  }
  assert.match(template, /Not in source artifacts/);
  assert.match(template, /Never invent/);
  assert.match(template, /spec\.md/);
  assert.match(template, /design\.md/);
  assert.match(template, /tasks\.md/);
});

test('interactive init writes selected safe configuration and preserves existing config', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-interactive-'));
  const input =
    'pt-BR\ntask-app\nmain\ncodex\nlarge_feature\nmanual\nlocal-files\nmulti\ntrue\nfalse\nyes\n';
  assert.equal(run(['init', '--interactive'], cwd, input).status, 0);
  const config = fs.readFileSync(path.join(cwd, '.sdd-agentic-flow/config.yml'), 'utf8');
  assert.match(config, /name: task-app/);
  assert.match(config, /target: codex/);
  assert.match(config, /profile: pt-BR/);
  assert.match(config, /feature_profile: large_feature/);
  assert.match(config, /allow_multi_worktree: true/);
  assert.match(run(['init', '--interactive'], cwd, input).stdout, /will not overwrite/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('doctor localizes the final healthy summary in pt-BR', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-doctor-br-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-doctor-br-home-'));
  try {
    assert.equal(runIsolatedHome(['init', '--br'], cwd, home).status, 0);
    assert.equal(runIsolatedHome(['install', 'core', '--scope', 'project'], cwd, home).status, 0);
    const result = runIsolatedHome(['doctor'], cwd, home);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Verificações: \d+ PASS/);
    assert.match(result.stdout, /Próxima etapa/);
    assert.doesNotMatch(result.stdout, /\nChecks:|\nNext\n/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('interactive init with invalid input exits 1, not the generic unexpected-error code 2', () => {
  // Regression: invalid answers used to fall through main()'s top-level catch, which reserves
  // exit code 2 for genuinely unexpected/internal errors — indistinguishable from a real crash,
  // instead of exit 1 like every other input-validation failure in this CLI.
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-interactive-invalid-'));
  const result = run(['init', '--interactive'], cwd, 'en-US\ntask-app\nmain\nbogus-agent\n');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Agent target must be one of/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('init --non-interactive remains deterministic in a pipe and rejects conflicting flags', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-init-non-interactive-'));
  const result = run(['init', '--non-interactive'], cwd, 'ignored input\n');
  assert.equal(result.status, 0);
  assert.ok(fs.existsSync(path.join(cwd, '.sdd-agentic-flow/config.yml')));
  assert.doesNotMatch(result.stdout, /Where should the skills live/);
  const conflict = run(['init', '--interactive', '--non-interactive'], cwd);
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /cannot combine/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('init auto-discovers project context and discover refreshes it', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-discover-'));
  fs.writeFileSync(path.join(cwd, 'README.md'), '# sample\n');
  fs.writeFileSync(path.join(cwd, 'AGENTS.md'), '# agents\n');
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'sample-app' }));
  assert.equal(run(['init'], cwd).status, 0);
  const contextPath = path.join(cwd, '.sdd-agentic-flow/context/project-context.md');
  assert.ok(fs.existsSync(contextPath));
  const initial = fs.readFileSync(contextPath, 'utf8');
  assert.match(initial, /Package name: sample-app/);
  assert.match(initial, /AGENTS\.md/);

  assert.match(run(['discover'], cwd).stdout, /preserved existing/);
  assert.equal(fs.readFileSync(contextPath, 'utf8'), initial);

  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'renamed-app' }));
  assert.match(
    run(['discover', '--force'], cwd).stdout,
    /created \.sdd-agentic-flow\/context\/project-context\.md/,
  );
  assert.match(fs.readFileSync(contextPath, 'utf8'), /Package name: renamed-app/);

  assert.equal(run(['discover', '--unknown'], cwd).status, 1);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('discover detects architecture, CI, and platform signals', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-discover2-'));
  fs.mkdirSync(path.join(cwd, 'src/domain'), { recursive: true });
  fs.mkdirSync(path.join(cwd, '.github/workflows'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.github/workflows/ci.yml'), 'name: ci\n');
  fs.mkdirSync(path.join(cwd, 'prisma'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'prisma/schema.prisma'), 'datasource db {}\n');
  assert.equal(run(['init'], cwd).status, 0);
  const context = fs.readFileSync(
    path.join(cwd, '.sdd-agentic-flow/context/project-context.md'),
    'utf8',
  );
  assert.match(context, /## Architecture signals/);
  assert.match(context, /src\/domain/);
  assert.match(context, /## CI\/CD signals/);
  assert.match(context, /\.github\/workflows/);
  assert.match(context, /## Platform signals/);
  assert.match(context, /prisma\/schema\.prisma/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('project-context.md carries provenance metadata, gracefully, outside a git repo', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-provenance-'));
  assert.equal(run(['init'], cwd).status, 0);
  const contextPath = path.join(cwd, '.sdd-agentic-flow/context/project-context.md');
  const content = fs.readFileSync(contextPath, 'utf8');
  assert.match(
    content,
    new RegExp(`> Generated by sdd-agentic-flow ${packageVersion.replace(/\./g, '\\.')}`),
  );
  assert.match(content, /> Generated at: \d{4}-\d{2}-\d{2}T/);
  assert.match(content, /> Repository revision: not a git repository/);
  assert.match(content, /> Branch: unknown/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('context status reports not found, then available, without mutating on status alone', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-context-status-'));
  assert.match(run(['context'], cwd).stdout, /status: not found/);
  assert.equal(run(['init'], cwd).status, 0);
  const contextPath = path.join(cwd, '.sdd-agentic-flow/context/project-context.md');
  const before = fs.readFileSync(contextPath, 'utf8');
  const status = run(['context', 'status'], cwd).stdout;
  assert.match(status, /status: available/);
  assert.match(status, /generated at:/);
  assert.match(status, /repository revision: not a git repository/);
  assert.equal(fs.readFileSync(contextPath, 'utf8'), before);
  assert.equal(run(['context', 'status', 'extra'], cwd).status, 1);
  assert.equal(run(['context', 'bogus'], cwd).status, 1);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('context refresh regenerates unconditionally, matching discover --force', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-context-refresh-'));
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'first-name' }));
  assert.equal(run(['init'], cwd).status, 0);
  const contextPath = path.join(cwd, '.sdd-agentic-flow/context/project-context.md');
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'second-name' }));
  assert.match(
    run(['context', 'refresh'], cwd).stdout,
    /created \.sdd-agentic-flow\/context\/project-context\.md/,
  );
  assert.match(fs.readFileSync(contextPath, 'utf8'), /Package name: second-name/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('context status detects repository revision drift in a real git repository', (t) => {
  if (spawnSync('git', ['--version']).status !== 0) {
    t.skip('git CLI not available in this environment');
    return;
  }
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-context-git-'));
  const git = (gitArgs: string[]) => spawnSync('git', gitArgs, { cwd, encoding: 'utf8' });
  git(['init', '-q']);
  git(['config', 'user.email', 'test@example.com']);
  git(['config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(cwd, 'README.md'), '# sample\n');
  git(['add', 'README.md']);
  git(['commit', '-q', '-m', 'init']);

  assert.equal(run(['init'], cwd).status, 0);
  const fresh = run(['context', 'status'], cwd).stdout;
  assert.match(fresh, /repository revision: [0-9a-f]{7,40}/);
  assert.match(fresh, /branch: /);
  assert.doesNotMatch(fresh, /Repository has changed/);

  fs.appendFileSync(path.join(cwd, 'README.md'), 'more\n');
  git(['add', 'README.md']);
  git(['commit', '-q', '-m', 'change']);

  const drifted = run(['context', 'status'], cwd).stdout;
  assert.match(drifted, /Repository has changed since context generation\./);
  assert.match(drifted, /Recommendation: run `sdd-agentic-flow context refresh`\./);

  const doctorReport = JSON.parse(run(['doctor', '--json'], cwd).stdout);
  assert.match(
    doctorReport.checks.find((check: DoctorCheck) => check.name === 'project_context').message,
    /repository has changed since generation/,
  );

  assert.match(
    run(['context', 'refresh'], cwd).stdout,
    /created \.sdd-agentic-flow\/context\/project-context\.md/,
  );
  const refreshed = run(['context', 'status'], cwd).stdout;
  assert.doesNotMatch(refreshed, /Repository has changed/);

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('doctor JSON is parseable and smoke is isolated', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-doctor-'));
  assert.equal(run(['init', '--language', 'pt-BR'], cwd).status, 0);
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);
  const result = run(['doctor', '--json'], cwd);
  const report = JSON.parse(result.stdout);
  assert.equal(report.version, packageVersion);
  assert.ok(Array.isArray(report.checks));
  assert.equal(report.language.profile, 'pt-BR');
  assert.equal(report.language.status, 'PASS');
  assert.equal(
    report.checks.find((check: DoctorCheck) => check.name === 'project_context').status,
    'PASS',
  );
  assert.equal(
    report.checks.find((check: DoctorCheck) => check.name === 'baseline-tlc').status,
    'PASS',
  );
  assert.equal(
    report.checks.find((check: DoctorCheck) => check.name === 'adaptive-sizing').status,
    'PASS',
  );
  assert.equal(
    report.checks.find((check: DoctorCheck) => check.name === 'traceability').status,
    'PASS',
  );
  assert.equal(
    report.checks.find((check: DoctorCheck) => check.name === 'evidence-first').status,
    'PASS',
  );
  assert.equal(
    report.checks.find((check: DoctorCheck) => check.name === 'artifact-contracts').status,
    'PASS',
  );
  assert.ok(
    fs.existsSync(
      path.join(cwd, '.agents/skills/sdd-agentic-flow-shared/references/artifact-contracts.md'),
    ),
  );
  assert.equal(run(['doctor', '--smoke'], cwd).status, 0);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('doctor without --check-updates never includes an update_check row (opt-in only)', () => {
  const report = JSON.parse(run(['doctor', '--json']).stdout);
  assert.equal(
    report.checks.find((check: DoctorCheck) => check.name === 'update_check'),
    undefined,
  );
});

test('doctor --check-updates reports an available update via a local registry stub', (t) => {
  // The SDD_AGENTIC_FLOW_TEST_REGISTRY_URL env var is an internal, undocumented test-only seam
  // (see bin/update-check.js) so this exercises the real flag-wiring and --json shape without
  // ever touching the real npm registry.
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ version: '99.0.0' }));
  });
  server.listen(0);
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const registryUrl = `http://127.0.0.1:${address.port}`;
  const result = spawnSync(process.execPath, [cli, 'doctor', '--check-updates', '--json'], {
    cwd: temporary,
    encoding: 'utf8',
    timeout: 8000,
    env: { ...process.env, SDD_AGENTIC_FLOW_TEST_REGISTRY_URL: registryUrl },
  });
  server.close();
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const updateCheck = report.checks.find((check: DoctorCheck) => check.name === 'update_check');
  assert.ok(updateCheck, 'expected doctor --check-updates --json to include an update_check row');
  if (updateCheck.status === 'INFO') {
    // Some sandboxes isolate a spawned child process's network namespace even for loopback —
    // in that case checkForUpdate()'s bounded timeout correctly degrades to INFO rather than
    // hanging, which is itself the behavior under test, but the WARN-shape assertions below
    // can't be exercised here. Skip rather than fail on an environment limitation.
    t.skip('child-process loopback networking appears unavailable in this sandbox');
    return;
  }
  assert.equal(updateCheck.status, 'WARN');
  assert.match(updateCheck.message, /99\.0\.0/);
  assert.match(updateCheck.message, /sdd-agentic-flow upgrade/);
});

test('doctor --contracts validates installed capability contracts', () => {
  assert.match(run(['help']).stdout, /--contracts/);

  // Isolated HOME: doctor's contract checks now also resolve user-scope installs (the bug fix
  // under test elsewhere), so the "nothing installed yet" assertion below must not see whatever
  // is actually installed globally on the machine running this test.
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-contracts-'));
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-contracts-home-'));
  assert.equal(runIsolatedHome(['init'], cwd, homeDir).status, 0);
  const warnReport = JSON.parse(
    runIsolatedHome(['doctor', '--json', '--contracts'], cwd, homeDir).stdout,
  );
  const warnCheck = warnReport.checks.find(
    (check: DoctorCheck) => check.name === 'capability_contracts',
  );
  assert.equal(warnCheck.status, 'WARN');
  assert.match(warnCheck.message, /no installed skills/);

  assert.equal(runIsolatedHome(['install', 'core', '--scope', 'project'], cwd, homeDir).status, 0);
  const passReport = JSON.parse(
    runIsolatedHome(['doctor', '--json', '--contracts'], cwd, homeDir).stdout,
  );
  assert.equal(
    passReport.checks.find((check: DoctorCheck) => check.name === 'capability_contracts').status,
    'PASS',
  );

  const corruptedSkill = path.join(cwd, '.agents/skills/saf-create-spec/SKILL.md');
  const original = fs.readFileSync(corruptedSkill, 'utf8');
  fs.writeFileSync(corruptedSkill, original.replace(/^produces:.*$/m, ''));
  const failReport = JSON.parse(
    runIsolatedHome(['doctor', '--json', '--contracts'], cwd, homeDir).stdout,
  );
  const failCheck = failReport.checks.find(
    (check: DoctorCheck) => check.name === 'capability_contracts',
  );
  assert.equal(failCheck.status, 'FAIL');
  assert.match(failCheck.message, /saf-create-spec/);
  assert.match(failCheck.message, /produces/);

  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(homeDir, { recursive: true, force: true });
});

test('doctor --contracts detects dangling depends_on references', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-contracts-dangling-'));
  assert.equal(run(['init'], cwd).status, 0);
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);
  const skillPath = path.join(cwd, '.agents/skills/saf-create-spec/SKILL.md');
  const original = fs.readFileSync(skillPath, 'utf8');
  fs.writeFileSync(skillPath, original.replace('depends_on: []', 'depends_on: [not-a-real-skill]'));
  const report = JSON.parse(run(['doctor', '--json', '--contracts'], cwd).stdout);
  const check = report.checks.find((c: DoctorCheck) => c.name === 'capability_contracts');
  assert.equal(check.status, 'FAIL');
  assert.match(check.message, /depends_on references unknown skill 'not-a-real-skill'/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('doctor --contracts detects a depends_on cycle between installed skills', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-contracts-cycle-'));
  assert.equal(run(['init'], cwd).status, 0);
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);
  const specsPath = path.join(cwd, '.agents/skills/saf-create-spec/SKILL.md');
  const taskCheckPath = path.join(cwd, '.agents/skills/saf-check-task/SKILL.md');
  fs.writeFileSync(
    specsPath,
    fs.readFileSync(specsPath, 'utf8').replace('depends_on: []', 'depends_on: [saf-check-task]'),
  );
  fs.writeFileSync(
    taskCheckPath,
    fs
      .readFileSync(taskCheckPath, 'utf8')
      .replace('depends_on: []', 'depends_on: [saf-create-spec]'),
  );
  const report = JSON.parse(run(['doctor', '--json', '--contracts'], cwd).stdout);
  const check = report.checks.find((c: DoctorCheck) => c.name === 'capability_contracts');
  assert.equal(check.status, 'FAIL');
  assert.match(check.message, /contract cycle detected/);
  assert.match(check.message, /saf-create-spec/);
  assert.match(check.message, /saf-check-task/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('doctor --contracts flags conflicting skills that are both installed', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-contracts-conflict-'));
  assert.equal(run(['init'], cwd).status, 0);
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);
  const skillPath = path.join(cwd, '.agents/skills/saf-create-spec/SKILL.md');
  const original = fs.readFileSync(skillPath, 'utf8');
  fs.writeFileSync(skillPath, original.replace('conflicts: []', 'conflicts: [saf-check-task]'));
  const report = JSON.parse(run(['doctor', '--json', '--contracts'], cwd).stdout);
  const check = report.checks.find((c: DoctorCheck) => c.name === 'capability_contracts');
  assert.equal(check.status, 'FAIL');
  assert.match(check.message, /saf-create-spec and saf-check-task declare a conflict/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('doctor --contracts detects an unknown baseline id', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-contracts-baseline-'));
  assert.equal(run(['init'], cwd).status, 0);
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);
  const skillPath = path.join(cwd, '.agents/skills/saf-create-spec/SKILL.md');
  const original = fs.readFileSync(skillPath, 'utf8');
  fs.writeFileSync(
    skillPath,
    original.replace('baseline: [tlc-spec-driven]', 'baseline: [not-a-real-baseline]'),
  );
  const report = JSON.parse(run(['doctor', '--json', '--contracts'], cwd).stdout);
  const check = report.checks.find((c: DoctorCheck) => c.name === 'capability_contracts');
  assert.equal(check.status, 'FAIL');
  assert.match(check.message, /baseline references unknown baseline id 'not-a-real-baseline'/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('doctor --contracts fails deterministically when requires_cli is not satisfied', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-contracts-requires-cli-'));
  assert.equal(run(['init'], cwd).status, 0);
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);
  const skillPath = path.join(cwd, '.agents/skills/saf-create-spec/SKILL.md');
  const original = fs.readFileSync(skillPath, 'utf8');
  fs.writeFileSync(skillPath, original.replace('requires_cli: null', 'requires_cli: >=99.0.0'));
  const report = JSON.parse(run(['doctor', '--json', '--contracts'], cwd).stdout);
  const check = report.checks.find((c: DoctorCheck) => c.name === 'capability_contracts');
  assert.equal(check.status, 'FAIL');
  assert.match(
    check.message,
    new RegExp(
      `saf-create-spec: requires CLI >=99\\.0\\.0, installed CLI is ${packageVersion.replace(/\./g, '\\.')}`,
    ),
  );

  fs.writeFileSync(skillPath, original.replace('requires_cli: null', 'requires_cli: >=0.1.0'));
  const okReport = JSON.parse(run(['doctor', '--json', '--contracts'], cwd).stdout);
  assert.equal(
    okReport.checks.find((c: DoctorCheck) => c.name === 'capability_contracts').status,
    'PASS',
  );
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('init --preset writes the two fields, prints the canonical pair, and rejects XOR / unknown tokens', () => {
  const cases = [
    { args: ['--preset', 'manual'], mode: 'guided', level: 'manual', printed: /preset manual/ },
    {
      args: ['--preset', 'supervised'],
      mode: 'apply',
      level: 'supervised',
      printed: /preset supervised/,
    },
    {
      args: ['--preset', 'autonomous'],
      mode: 'full',
      level: 'autonomous',
      printed: /preset autonomous/,
    },
    {
      args: ['--preset', 'man'],
      mode: 'guided',
      level: 'manual',
      printed: /preset manual \(alias: man\)/,
    },
    {
      args: ['--preset', 'assist'],
      mode: 'apply',
      level: 'supervised',
      printed: /preset supervised \(alias: assist\)/,
    },
    {
      args: ['--preset', 'assisted'],
      mode: 'apply',
      level: 'supervised',
      printed: /preset supervised \(alias: assisted\)/,
    },
    {
      args: ['--preset', 'auto'],
      mode: 'full',
      level: 'autonomous',
      printed: /preset autonomous \(alias: auto\)/,
    },
  ];
  for (const item of cases) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-preset-'));
    const result = run(['init', ...item.args], cwd);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const config = fs.readFileSync(path.join(cwd, '.sdd-agentic-flow/config.yml'), 'utf8');
    assert.match(config, new RegExp(`execution_mode: ${item.mode}`));
    assert.match(config, new RegExp(`autonomy_level: ${item.level}`));
    assert.doesNotMatch(config, /workflow\.mode/);
    assert.match(result.stdout, item.printed);
    assert.match(result.stdout, new RegExp(`execution_mode: ${item.mode}`));
    assert.match(result.stdout, new RegExp(`autonomy_level: ${item.level}`));
    fs.rmSync(cwd, { recursive: true, force: true });
  }

  const xorCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-preset-xor-'));
  const xor = run(['init', '--preset', 'auto', '--autonomy-level', 'manual'], xorCwd);
  assert.equal(xor.status, 1);
  assert.match(xor.stderr, /cannot combine/);
  assert.equal(fs.existsSync(path.join(xorCwd, '.sdd-agentic-flow/config.yml')), false);
  fs.rmSync(xorCwd, { recursive: true, force: true });

  const unknownCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-preset-unknown-'));
  const unknown = run(['init', '--preset', 'autonumous'], unknownCwd);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /unknown --preset/);
  assert.match(unknown.stderr, /man, assist\|assisted, auto/);
  assert.equal(fs.existsSync(path.join(unknownCwd, '.sdd-agentic-flow/config.yml')), false);
  fs.rmSync(unknownCwd, { recursive: true, force: true });

  const execAutoCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-exec-auto-'));
  const execAuto = run(['init', '--execution-mode', 'auto'], execAutoCwd);
  assert.equal(execAuto.status, 1);
  assert.equal(fs.existsSync(path.join(execAutoCwd, '.sdd-agentic-flow/config.yml')), false);
  fs.rmSync(execAutoCwd, { recursive: true, force: true });

  const aliasCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-autonomy-alias-'));
  const alias = run(['init', '--autonomy-level', 'auto', '--execution-mode', 'full'], aliasCwd);
  assert.equal(alias.status, 0, alias.stderr + alias.stdout);
  const aliasConfig = fs.readFileSync(path.join(aliasCwd, '.sdd-agentic-flow/config.yml'), 'utf8');
  assert.match(aliasConfig, /execution_mode: full/);
  assert.match(aliasConfig, /autonomy_level: autonomous/);
  fs.rmSync(aliasCwd, { recursive: true, force: true });

  const guidedAutoCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-guided-auto-'));
  const guidedAuto = run(
    ['init', '--execution-mode', 'guided', '--autonomy-level', 'auto'],
    guidedAutoCwd,
  );
  assert.equal(guidedAuto.status, 1);
  assert.match(guidedAuto.stderr, /cannot combine with/);
  assert.equal(fs.existsSync(path.join(guidedAutoCwd, '.sdd-agentic-flow/config.yml')), false);
  fs.rmSync(guidedAutoCwd, { recursive: true, force: true });
});

test('init --help lists operating presets and aliases', () => {
  const help = run(['init', '--help']).stdout;
  assert.match(help, /--preset manual\|supervised\|autonomous/);
  assert.match(help, /aliases: man, assist\|assisted, auto/);
});

test('init --execution-mode/--autonomy-level writes both fields, and an invalid combination fails without writing a config', () => {
  const validCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-autonomy-init-'));
  assert.equal(
    run(['init', '--execution-mode', 'full', '--autonomy-level', 'autonomous'], validCwd).status,
    0,
  );
  const config = fs.readFileSync(path.join(validCwd, '.sdd-agentic-flow/config.yml'), 'utf8');
  assert.match(config, /execution_mode: full/);
  assert.match(config, /autonomy_level: autonomous/);
  assert.match(config, /autonomy_budget:/);
  assert.match(config, /max_iterations: 50/);
  fs.rmSync(validCwd, { recursive: true, force: true });

  const invalidCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-autonomy-invalid-'));
  const result = run(
    ['init', '--execution-mode', 'plan', '--autonomy-level', 'autonomous'],
    invalidCwd,
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot combine with/);
  assert.equal(fs.existsSync(path.join(invalidCwd, '.sdd-agentic-flow/config.yml')), false);
  fs.rmSync(invalidCwd, { recursive: true, force: true });
});

test('init defaults workflow.execution_mode to guided and autonomy_level to manual', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-autonomy-default-'));
  assert.equal(run(['init'], cwd).status, 0);
  const config = fs.readFileSync(path.join(cwd, '.sdd-agentic-flow/config.yml'), 'utf8');
  assert.match(config, /execution_mode: guided/);
  assert.match(config, /autonomy_level: manual/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('doctor --autonomy validates config, the execution_mode x autonomy_level matrix, and skill support', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-autonomy-doctor-'));
  assert.equal(run(['init'], cwd).status, 0);
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);

  const defaultReport = JSON.parse(run(['doctor', '--json', '--autonomy'], cwd).stdout);
  assert.equal(
    defaultReport.checks.find((c: DoctorCheck) => c.name === 'autonomy_config').status,
    'PASS',
  );
  assert.equal(
    defaultReport.checks.find((c: DoctorCheck) => c.name === 'autonomy_combo').status,
    'PASS',
  );
  assert.equal(
    defaultReport.checks.find((c: DoctorCheck) => c.name === 'autonomy_skills').status,
    'PASS',
  );
  assert.equal(
    defaultReport.checks.find((c: DoctorCheck) => c.name === 'autonomy_loop_state').status,
    'INFO',
  );
  assert.equal(
    defaultReport.checks.some((c: DoctorCheck) => c.name.startsWith('guardrail_')),
    false,
  );

  const verboseReport = JSON.parse(
    run(['doctor', '--json', '--autonomy', '--verbose'], cwd).stdout,
  );
  const guardrailChecks = verboseReport.checks.filter((c: DoctorCheck) =>
    c.name.startsWith('guardrail_'),
  );
  assert.equal(guardrailChecks.length, 7);

  const configPath = path.join(cwd, '.sdd-agentic-flow/config.yml');
  const original = fs.readFileSync(configPath, 'utf8');
  fs.writeFileSync(
    configPath,
    original
      .replace('execution_mode: guided', 'execution_mode: plan')
      .replace('autonomy_level: manual', 'autonomy_level: autonomous'),
  );
  const invalidCombo = JSON.parse(run(['doctor', '--json', '--autonomy'], cwd).stdout);
  const comboCheck = invalidCombo.checks.find((c: DoctorCheck) => c.name === 'autonomy_combo');
  assert.equal(comboCheck.status, 'FAIL');
  assert.match(
    comboCheck.message,
    /execution_mode=plan cannot combine with autonomy_level=autonomous/,
  );
  assert.equal(invalidCombo.status, 'FAIL');

  fs.writeFileSync(
    configPath,
    original.replace('autonomy_level: manual', 'autonomy_level: autonomous'),
  );
  const unsupportedReport = JSON.parse(run(['doctor', '--json', '--autonomy'], cwd).stdout);
  const skillsCheck = unsupportedReport.checks.find(
    (c: DoctorCheck) => c.name === 'autonomy_skills',
  );
  assert.equal(skillsCheck.status, 'WARN');
  assert.match(skillsCheck.message, /saf-route/);

  const skillPath = path.join(cwd, '.agents/skills/saf-create-spec/SKILL.md');
  const skillOriginal = fs.readFileSync(skillPath, 'utf8');
  fs.writeFileSync(
    skillPath,
    skillOriginal.replace(/autonomy_profile:[\s\S]*?evidence_required: \[[^\]]*\]\n/, ''),
  );
  const missingProfileReport = JSON.parse(run(['doctor', '--json', '--autonomy'], cwd).stdout);
  const missingCheck = missingProfileReport.checks.find(
    (c: DoctorCheck) => c.name === 'autonomy_skills',
  );
  assert.equal(missingCheck.status, 'FAIL');
  assert.match(missingCheck.message, /missing autonomy_profile/);
  assert.match(missingCheck.message, /saf-create-spec/);

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('doctor --autonomy on a pre-v1.8.0 config (missing fields) warns rather than fails', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-autonomy-legacy-'));
  assert.equal(run(['init'], cwd).status, 0);
  const configPath = path.join(cwd, '.sdd-agentic-flow/config.yml');
  const legacy = fs
    .readFileSync(configPath, 'utf8')
    .replace(
      /\n {2}execution_mode: guided\n {2}autonomy_level: manual\n\n {2}autonomy_budget:[\s\S]*?pause_on_warning: true\n/,
      '\n',
    );
  fs.writeFileSync(configPath, legacy);
  assert.equal(legacy.includes('execution_mode'), false);
  const report = JSON.parse(run(['doctor', '--json', '--autonomy'], cwd).stdout);
  const configCheck = report.checks.find((c: DoctorCheck) => c.name === 'autonomy_config');
  assert.equal(configCheck.status, 'WARN');
  assert.match(configCheck.message, /not set/);
  assert.notEqual(report.status, 'FAIL');
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('context autonomy-state reports config, then reflects a recorded loop-state.md', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-autonomy-context-'));
  assert.equal(run(['init'], cwd).status, 0);

  const notFound = run(['context', 'autonomy-state'], cwd);
  assert.equal(notFound.status, 0);
  assert.match(notFound.stdout, /execution_mode: guided/);
  assert.match(notFound.stdout, /autonomy_level: manual/);
  assert.match(notFound.stdout, /no \.sdd-agentic-flow\/autonomy\/loop-state\.md found/);

  const loopStateDir = path.join(cwd, '.sdd-agentic-flow/autonomy');
  fs.mkdirSync(loopStateDir, { recursive: true });
  fs.writeFileSync(
    path.join(loopStateDir, 'loop-state.md'),
    [
      '# Loop State',
      '',
      'Execution mode: full',
      'Autonomy level: autonomous',
      '',
      '## Current State',
      '',
      '- Skill: saf-check-task (completed)',
      '- Status: PASS',
      '- Next: saf-validate',
      '- Guardrails: PASS',
      '- Human override: pause=false, stop=false',
      '',
    ].join('\n'),
    'utf8',
  );
  const found = run(['context', 'autonomy-state'], cwd);
  assert.equal(found.status, 0);
  assert.match(found.stdout, /status: available/);
  assert.match(found.stdout, /current skill: saf-check-task \(completed\)/);
  assert.match(found.stdout, /next: saf-validate/);
  assert.match(found.stdout, /human override: none/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('autonomous-resume fails with no state, clears pause/stop with an audit entry, and is a no-op afterward', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-autonomy-resume-'));
  assert.equal(run(['init'], cwd).status, 0);

  const noState = run(['autonomous-resume'], cwd);
  assert.equal(noState.status, 1);
  assert.match(noState.stderr, /nothing to resume/);

  const loopStateDir = path.join(cwd, '.sdd-agentic-flow/autonomy');
  fs.mkdirSync(loopStateDir, { recursive: true });
  const loopStatePath = path.join(loopStateDir, 'loop-state.md');
  fs.writeFileSync(
    loopStatePath,
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
    'utf8',
  );

  const missingReason = run(['autonomous-resume', '--override-guard=3'], cwd);
  assert.equal(missingReason.status, 1);
  assert.match(missingReason.stderr, /--reason/);

  const resumed = run(
    ['autonomous-resume', '--override-guard=3', '--reason=flaky test, verified manually'],
    cwd,
  );
  assert.equal(resumed.status, 0);
  assert.match(resumed.stdout, /resumed: cleared human override/);
  assert.match(resumed.stdout, /next skill: saf-check-task/);
  const afterResume = fs.readFileSync(loopStatePath, 'utf8');
  assert.match(afterResume, /Human override: pause=false, stop=false/);
  assert.match(afterResume, /## Override Log/);
  assert.match(
    afterResume,
    /guardrail 3 overridden by human\. Reason: flaky test, verified manually/,
  );

  const nothingToResume = run(['autonomous-resume'], cwd);
  assert.equal(nothingToResume.status, 0);
  assert.match(nothingToResume.stdout, /nothing to resume/);

  fs.rmSync(cwd, { recursive: true, force: true });
});

function writeMultiBlockLoopState(cwd: string) {
  const dir = path.join(cwd, '.sdd-agentic-flow/autonomy');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'loop-state.md');
  fs.writeFileSync(
    file,
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
      '## Current State',
      '',
      '- Skill: saf-check-task (completed)',
      '- Status: PASS',
      '- Next: saf-validate',
      '- Guardrails: PASS',
      '- Human override: pause=false, stop=false',
      '',
    ].join('\n'),
    'utf8',
  );
  return file;
}

test('context autonomy-state and doctor --autonomy read the LATEST of multiple Current State blocks, not the first', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-autonomy-multiblock-'));
  assert.equal(run(['init'], cwd).status, 0);
  writeMultiBlockLoopState(cwd);

  const contextOut = run(['context', 'autonomy-state'], cwd).stdout;
  assert.match(contextOut, /current skill: saf-check-task \(completed\)/);
  assert.doesNotMatch(contextOut, /saf-implement/);
  assert.match(contextOut, /next: saf-validate/);
  assert.match(contextOut, /human override: none/);

  const report = JSON.parse(run(['doctor', '--json', '--autonomy'], cwd).stdout);
  const loopCheck = report.checks.find((c: DoctorCheck) => c.name === 'autonomy_loop_state');
  assert.equal(loopCheck.status, 'PASS');
  assert.match(loopCheck.message, /saf-check-task/);
  assert.doesNotMatch(loopCheck.message, /saf-implement/);

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('autonomous-resume clears the override on the LATEST block only, leaving earlier history untouched', () => {
  const cwd = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdd-agentic-flow-autonomy-multiblock-resume-'),
  );
  assert.equal(run(['init'], cwd).status, 0);
  const file = writeMultiBlockLoopState(cwd);
  // Make both blocks stopped, so resume has real work to do and we can tell which one it touched.
  fs.writeFileSync(
    file,
    fs
      .readFileSync(file, 'utf8')
      .replace(
        '- Human override: pause=false, stop=false',
        '- Human override: pause=false, stop=true',
      ),
  );

  const resumed = run(['autonomous-resume'], cwd);
  assert.equal(resumed.status, 0);
  assert.match(resumed.stdout, /saf-check-task/);

  const after = fs.readFileSync(file, 'utf8');
  const blocks = after.split('## Current State');
  assert.ok(blocks[1] && blocks[2]);
  assert.match(blocks[1], /stop=true/); // first (historical) block untouched
  assert.match(blocks[2], /stop=false/); // latest block cleared

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('workflow.skill_overrides lets a per-skill autonomy_level override the workflow default', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-autonomy-override-'));
  assert.equal(
    run(['init', '--execution-mode', 'full', '--autonomy-level', 'autonomous'], cwd).status,
    0,
  );
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);

  const before = JSON.parse(run(['doctor', '--json', '--autonomy'], cwd).stdout);
  const beforeCheck = before.checks.find((c: DoctorCheck) => c.name === 'autonomy_skills');
  assert.equal(beforeCheck.status, 'WARN');
  assert.match(beforeCheck.message, /saf-route/);

  const configPath = path.join(cwd, '.sdd-agentic-flow/config.yml');
  fs.appendFileSync(
    configPath,
    '\n  skill_overrides:\n    saf-route:\n      autonomy_level: supervised\n    saf-setup:\n      autonomy_level: supervised\n',
  );

  const after = JSON.parse(run(['doctor', '--json', '--autonomy'], cwd).stdout);
  const afterCheck = after.checks.find((c: DoctorCheck) => c.name === 'autonomy_skills');
  assert.equal(afterCheck.status, 'PASS');

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('doctor --autonomy reports autonomy_combo FAIL (not a misleading PASS) when autonomy_level is an invalid explicit value', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-autonomy-combo-invalid-'));
  assert.equal(run(['init'], cwd).status, 0);
  const configPath = path.join(cwd, '.sdd-agentic-flow/config.yml');
  fs.writeFileSync(
    configPath,
    fs
      .readFileSync(configPath, 'utf8')
      .replace('autonomy_level: manual', 'autonomy_level: bogus-value'),
  );

  const report = JSON.parse(run(['doctor', '--json', '--autonomy'], cwd).stdout);
  assert.equal(report.checks.find((c: DoctorCheck) => c.name === 'autonomy_config').status, 'FAIL');
  const comboCheck = report.checks.find((c: DoctorCheck) => c.name === 'autonomy_combo');
  assert.equal(comboCheck.status, 'FAIL');
  assert.match(comboCheck.message, /not evaluated/);

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('feature profile flag configures workflow and invalid values fail', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-feature-profile-'));
  assert.equal(run(['init', '--feature-profile', 'epic'], cwd).status, 0);
  assert.match(
    fs.readFileSync(path.join(cwd, '.sdd-agentic-flow/config.yml'), 'utf8'),
    /feature_profile: epic/,
  );
  const invalidCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-feature-invalid-'));
  assert.equal(run(['init', '--feature-profile', 'huge'], invalidCwd).status, 1);
  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(invalidCwd, { recursive: true, force: true });
});

test('doctor validates the TDD baseline in package and installed shared layers', () => {
  const packageReport = JSON.parse(run(['doctor', '--json'], packageRoot).stdout);
  assert.equal(packageReport.status, 'PASS');
  assert.ok(packageReport.checks.some((check: DoctorCheck) => check.name === 'tdd-baseline'));

  for (const pack of ['core', 'execution']) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `sdd-agentic-flow-tdd-${pack}-`));
    assert.equal(run(['init'], cwd).status, 0);
    assert.equal(run(['install', pack, '--scope', 'project'], cwd).status, 0);
    assert.ok(
      fs.existsSync(
        path.join(cwd, '.agents/skills/sdd-agentic-flow-shared/references/tdd-baseline.md'),
      ),
    );
    const report = JSON.parse(run(['doctor', '--json'], cwd).stdout);
    assert.equal(
      report.checks.find((check: DoctorCheck) => check.name === 'tdd-baseline').status,
      'PASS',
    );
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('routing skill is listed, installed by public packs, and removed by uninstall', () => {
  assert.match(run(['list']).stdout, /saf-route/);

  for (const pack of ['core', 'planning', 'execution', 'pr']) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `sdd-agentic-flow-route-${pack}-`));
    assert.equal(run(['init'], cwd).status, 0);
    assert.equal(run(['install', pack, '--scope', 'project'], cwd).status, 0);
    assert.ok(fs.existsSync(path.join(cwd, '.agents/skills/saf-route/SKILL.md')));
    fs.rmSync(cwd, { recursive: true, force: true });
  }

  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-route-uninstall-'));
  assert.equal(run(['init'], cwd).status, 0);
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);
  assert.equal(run(['uninstall', '--apply'], cwd).status, 0);
  assert.ok(!fs.existsSync(path.join(cwd, '.agents/skills/saf-route')));
  assert.ok(fs.existsSync(path.join(cwd, '.sdd-agentic-flow/config.yml')));
  assert.ok(fs.existsSync(path.join(cwd, '.specs/features')));
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('language flag generates profiles and invalid values fail', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-language-'));
  assert.equal(run(['init', '--language', 'pt-BR'], cwd).status, 0);
  const config = fs.readFileSync(path.join(cwd, '.sdd-agentic-flow/config.yml'), 'utf8');
  assert.match(config, /profile: pt-BR/);
  assert.match(config, /bilingual_mode: technical-canonical/);
  const invalidCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-invalid-'));
  assert.equal(run(['init', '--language', 'de-DE'], invalidCwd).status, 1);
  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(invalidCwd, { recursive: true, force: true });
});

test('--br and --en are aliases for --language pt-BR/en-US, last flag wins', () => {
  const brCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-br-'));
  assert.equal(run(['init', '--br'], brCwd).status, 0);
  assert.match(
    fs.readFileSync(path.join(brCwd, '.sdd-agentic-flow/config.yml'), 'utf8'),
    /profile: pt-BR/,
  );

  const enCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-en-'));
  assert.equal(run(['init', '--en'], enCwd).status, 0);
  assert.match(
    fs.readFileSync(path.join(enCwd, '.sdd-agentic-flow/config.yml'), 'utf8'),
    /profile: en-US/,
  );

  const precedenceCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-precedence-'));
  assert.equal(run(['init', '--language', 'en-US', '--br'], precedenceCwd).status, 0);
  assert.match(
    fs.readFileSync(path.join(precedenceCwd, '.sdd-agentic-flow/config.yml'), 'utf8'),
    /profile: pt-BR/,
  );

  fs.rmSync(brCwd, { recursive: true, force: true });
  fs.rmSync(enCwd, { recursive: true, force: true });
  fs.rmSync(precedenceCwd, { recursive: true, force: true });
});

test('interactive language default and legacy config warning are supported', () => {
  const interactiveCwd = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdd-agentic-flow-language-interactive-'),
  );
  const input =
    '\nlanguage-app\nmain\ngeneric\nmedium_feature\nmanual\nlocal-files\nsingle\nfalse\nfalse\nyes\n';
  assert.equal(
    run(['init', '--interactive', '--language', 'pt-BR'], interactiveCwd, input).status,
    0,
  );
  const interactiveConfig = fs.readFileSync(
    path.join(interactiveCwd, '.sdd-agentic-flow/config.yml'),
    'utf8',
  );
  assert.match(interactiveConfig, /profile: pt-BR/);
  assert.match(interactiveConfig, /feature_profile: medium_feature/);
  fs.rmSync(interactiveCwd, { recursive: true, force: true });

  const legacyCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-language-legacy-'));
  fs.mkdirSync(path.join(legacyCwd, '.sdd-agentic-flow'), { recursive: true });
  fs.writeFileSync(
    path.join(legacyCwd, '.sdd-agentic-flow/config.yml'),
    'language:\n  human_outputs: en-US\n  technical_tokens: canonical\n',
  );
  const report = JSON.parse(run(['doctor', '--json'], legacyCwd).stdout);
  assert.equal(report.language.status, 'WARN');
  assert.equal(report.language.profile, null);
  fs.rmSync(legacyCwd, { recursive: true, force: true });
});

test('pt-BR localizes guided prompts and plans while exact plan commands preserve intent', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-v310-locale-'));
  const init = run(
    ['init', '--interactive', '--language', 'pt-BR'],
    cwd,
    '\napp\nmain\ngeneric\nsmall_fix\nmanual\nlocal-files\nsingle\nfalse\nfalse\nyes\n',
  );
  assert.equal(init.status, 0);
  assert.match(init.stdout, /Etapa 2\/7/);
  assert.match(init.stdout, /Nome do projeto/);
  assert.match(init.stdout, /Criar configuração\? \[S\/n\]/);

  const plan = run(
    ['configure', '--plan', '--scope', 'project', '--pack', 'core', '--sharing', 'local'],
    cwd,
  );
  assert.equal(plan.status, 0);
  assert.match(
    plan.stdout,
    /Salvar intenção: sdd-agentic-flow configure --scope project --pack core --sharing local/,
  );
  assert.match(plan.stdout, /Reconciliar: {3}sdd-agentic-flow install core --scope project/);
  assert.match(plan.stdout, /Plano de instalação/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('persisted pt-BR localizes welcome, config, install, and uninstall human surfaces', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-v310-surfaces-'));
  assert.equal(run(['init', '--br'], cwd).status, 0);
  assert.match(run([], cwd).stdout, /configuração encontrada|Próxima etapa sugerida/);
  assert.match(run(['config', 'show'], cwd).stdout, /Política operacional/);
  assert.match(run(['install', 'core', '--scope', 'project'], cwd).stdout, /instalado|preservado/);
  assert.match(
    run(['uninstall', '--plan', '--scope', 'project'], cwd).stdout,
    /Plano de desinstalação/,
  );
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('uninstall plans and removes only toolkit assets', () => {
  assert.match(run(['uninstall', '--plan']).stdout, /shared support/);
  assert.equal(run(['uninstall', '--apply']).status, 0);
  assert.ok(fs.existsSync(path.join(temporary, '.sdd-agentic-flow/config.yml')));
  assert.ok(fs.existsSync(path.join(temporary, '.specs/features')));
  assert.ok(!fs.existsSync(path.join(temporary, '.agents/skills/sdd-agentic-flow-shared')));
  assert.equal(run(['uninstall', '--apply', '--include-config']).status, 0);
  assert.ok(!fs.existsSync(path.join(temporary, '.sdd-agentic-flow/config.yml')));
});

test('uninstall --full clears config and regenerable state, never .specs/features', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-uninstall-full-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-uninstall-full-home-'));
  assert.equal(run(['init'], cwd).status, 0);
  assert.equal(runIsolatedHome(['install', 'core'], cwd, home).status, 0);
  fs.writeFileSync(path.join(cwd, '.specs/features/.keep'), 'kept\n');

  // --full is --apply only, same convention as --include-config.
  assert.equal(runIsolatedHome(['uninstall', '--plan', '--full'], cwd, home).status, 1);

  const result = runIsolatedHome(['uninstall', '--apply', '--full'], cwd, home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /project-context\.md/);
  assert.match(result.stdout, /snapshots/);
  assert.match(result.stdout, /reports/);
  assert.match(result.stdout, /usage\.md/);
  assert.match(result.stdout, /preserved project specs, source code/);
  assert.ok(!fs.existsSync(path.join(cwd, '.sdd-agentic-flow/config.yml')));
  assert.ok(!fs.existsSync(path.join(cwd, '.sdd-agentic-flow/context/project-context.md')));
  assert.ok(!fs.existsSync(path.join(cwd, '.sdd-agentic-flow/snapshots')));
  assert.ok(!fs.existsSync(path.join(cwd, '.sdd-agentic-flow/reports')));
  assert.ok(!fs.existsSync(path.join(cwd, '.sdd-agentic-flow/usage.md')));
  assert.ok(fs.existsSync(path.join(cwd, '.specs/features/.keep')));
  assert.ok(!fs.existsSync(path.join(home, '.agents/skills/saf-create-spec')));

  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

test('invalid packs and flags fail', () => {
  assert.equal(run(['install', 'missing-pack']).status, 1);
  assert.equal(run(['uninstall']).status, 1);
  assert.equal(run(['doctor', '--unknown']).status, 1);
});

test('doctor --json with invalid flags still sets exit code 1', () => {
  // Regression: this used to print a status: "FAIL" JSON body but leave process.exitCode
  // unset, contradicting doctor()'s own contract that a FAIL result means a non-zero exit.
  const result = run(['doctor', '--json', '--unknown']);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'FAIL');
});

test('install core (default scope user) never writes into the consumer project', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-scope-user-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-scope-user-home-'));
  const git = (gitArgs: string[]) => spawnSync('git', gitArgs, { cwd, encoding: 'utf8' });
  if (spawnSync('git', ['--version']).status === 0) {
    git(['init', '-q']);
    git(['config', 'user.email', 'test@example.com']);
    git(['config', 'user.name', 'Test']);
  }
  const before = listAllEntries(cwd).sort();
  const result = runIsolatedHome(['install', 'core'], cwd, home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Repository changes: none/);
  const after = listAllEntries(cwd).sort();
  assert.deepEqual(
    after,
    before,
    'install core with default scope must not create any file in cwd',
  );

  for (const target of [
    path.join(home, '.agents', 'skills'),
    path.join(home, '.claude', 'skills'),
    path.join(home, '.copilot', 'skills'),
  ]) {
    assert.ok(fs.existsSync(path.join(target, 'saf-create-spec', 'SKILL.md')), target);
  }
  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

test('install --agent restricts scope-user writes to a single agent target', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-scope-agent-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-scope-agent-home-'));
  const result = runIsolatedHome(['install', 'core', '--agent', 'claude-code'], cwd, home);
  assert.equal(result.status, 0);
  assert.ok(fs.existsSync(path.join(home, '.claude', 'skills', 'saf-create-spec', 'SKILL.md')));
  assert.ok(!fs.existsSync(path.join(home, '.agents', 'skills')));
  assert.ok(!fs.existsSync(path.join(home, '.copilot', 'skills')));
  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

test('install --scope project behaves exactly like the pre-v0.9.0 default', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-scope-project-'));
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);
  assert.ok(fs.existsSync(path.join(cwd, '.agents/skills/saf-create-spec/SKILL.md')));
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('install --plan is a dry run in both scopes and touches nothing', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-plan-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-plan-home-'));

  const projectPlan = run(['install', 'core', '--scope', 'project', '--plan'], cwd);
  assert.equal(projectPlan.status, 0);
  assert.match(projectPlan.stdout, /Scope +project/);
  assert.ok(!fs.existsSync(path.join(cwd, '.agents')));

  const userPlan = runIsolatedHome(['install', 'core', '--plan'], cwd, home);
  assert.equal(userPlan.status, 0);
  assert.match(userPlan.stdout, /Scope +user/);
  assert.match(userPlan.stdout, /Repository footprint/);
  assert.ok(!fs.existsSync(path.join(cwd, '.agents')));
  assert.ok(!fs.existsSync(path.join(home, '.agents')));
  assert.ok(!fs.existsSync(path.join(home, '.claude')));
  assert.ok(!fs.existsSync(path.join(home, '.copilot')));

  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

test('doctor reports an Installation section for both scopes with no false FAIL', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-doctor-install-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-doctor-install-home-'));
  assert.equal(run(['init'], cwd).status, 0);
  const before = JSON.parse(runIsolatedHome(['doctor', '--json'], cwd, home).stdout);
  const installationChecks = before.checks.filter((check: DoctorCheck) =>
    check.name.startsWith('installation'),
  );
  assert.ok(installationChecks.length >= 2);
  assert.ok(installationChecks.every((check: DoctorCheck) => check.status !== 'FAIL'));
  assert.ok(
    installationChecks.some((check: DoctorCheck) =>
      check.message?.includes('No project files created by installation'),
    ),
  );

  assert.equal(runIsolatedHome(['install', 'core'], cwd, home).status, 0);
  const after = JSON.parse(runIsolatedHome(['doctor', '--json'], cwd, home).stdout);
  const userInstalled = after.checks.filter(
    (check: DoctorCheck) => check.name.startsWith('installation_user_') && check.status === 'PASS',
  );
  assert.ok(userInstalled.length >= 1);

  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

test('doctor does not false-WARN skills/shared_layer/baseline checks after the default (user-scope) install', () => {
  // Regression: doctor's skills/shared_layer/tdd-baseline/baseline-compliance/language checks
  // used to be hardcoded to project scope (cwd/.agents/skills), so they contradicted doctor's
  // own Installation section and reported WARN after the exact README Quick Start flow
  // (`init` then `install core`, which defaults to --scope user).
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-doctor-userscope-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-doctor-userscope-home-'));
  assert.equal(runIsolatedHome(['init'], cwd, home).status, 0);
  assert.equal(runIsolatedHome(['install', 'core'], cwd, home).status, 0);
  const report = JSON.parse(runIsolatedHome(['doctor', '--json', '--contracts'], cwd, home).stdout);
  assert.equal(report.status, 'PASS');
  for (const name of [
    'skills',
    'shared_layer',
    'project_readiness',
    'tdd-baseline',
    'baseline-tlc',
    'adaptive-sizing',
    'traceability',
    'artifact-contracts',
    'capability_contracts',
  ])
    assert.equal(
      report.checks.find((check: DoctorCheck) => check.name === name).status,
      'PASS',
      name,
    );
  assert.equal(report.language.status, 'PASS');

  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

test('doctor and the bare-invocation screen both detect a partial core skill install', () => {
  // Simulates an interrupted/broken install: only 2 of the 5 CORE_SKILLS present at project
  // scope. Must be distinguished from "none installed" (a WARN, not the false PASS a purely
  // binary "some skill exists" check would give, and not the plain "no skills installed yet"
  // INFO message either).
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-partial-install-'));
  for (const skill of ['saf-setup', 'saf-create-spec']) {
    const skillDir = path.join(cwd, '.agents', 'skills', skill);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `# ${skill}\n`);
  }

  const doctorResult = run(['doctor'], cwd);
  assert.match(doctorResult.stdout, /partial core skill install detected \(2\/5 present/);
  assert.match(doctorResult.stdout, /install core/);
  const doctorJson = JSON.parse(run(['doctor', '--json'], cwd).stdout);
  assert.equal(
    doctorJson.checks.find((check: DoctorCheck) => check.name === 'skills').status,
    'WARN',
  );

  const bareResult = run([], cwd);
  assert.match(bareResult.stdout, /partial core skill install detected \(2\/5 present\)/);
  assert.match(bareResult.stdout, /npx sdd-agentic-flow init/);

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('doctor Installation checks ignore unrelated skills already present in a shared skills directory', () => {
  // Regression: `~/.agents/skills` is a shared convention across several tools. A user who
  // already has *other* skills there (nothing named after this package) must not see a false
  // "installation found" — only this package's own official skill names count.
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-doctor-unrelated-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-doctor-unrelated-home-'));
  const unrelatedSkillDir = path.join(home, '.agents', 'skills', 'some-other-tools-skill');
  fs.mkdirSync(unrelatedSkillDir, { recursive: true });
  fs.writeFileSync(path.join(unrelatedSkillDir, 'SKILL.md'), '# Not sdd-agentic-flow\n');

  assert.equal(run(['init'], cwd).status, 0);
  const report = JSON.parse(runIsolatedHome(['doctor', '--json'], cwd, home).stdout);
  const agentsSkillsCheck = report.checks.find(
    (check: DoctorCheck) => check.name === 'installation_user_agents',
  );
  assert.equal(agentsSkillsCheck.status, 'INFO');
  assert.match(agentsSkillsCheck.message, /no user-scope installation found/);

  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

test('doctor reports a Platform section that never FAILs on shell or git absence', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-doctor-platform-'));
  assert.equal(run(['init'], cwd).status, 0);
  const report = JSON.parse(run(['doctor', '--json'], cwd).stdout);
  const platformChecks = report.checks.filter((check: DoctorCheck) =>
    check.name.startsWith('platform_'),
  );
  assert.ok(platformChecks.length >= 4);
  assert.ok(platformChecks.every((check: DoctorCheck) => check.status !== 'FAIL'));
  assert.ok(platformChecks.some((check: DoctorCheck) => check.message?.startsWith('OS: ')));
  assert.ok(platformChecks.some((check: DoctorCheck) => check.message === 'Filesystem writable'));
  assert.ok(platformChecks.some((check: DoctorCheck) => check.message?.startsWith('Shell: ')));
  assert.ok(
    platformChecks.some(
      (check: DoctorCheck) =>
        check.message === 'Git: available' || check.message === 'Git: not available',
    ),
  );
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('uninstall --scope removes only the requested scope', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-uninstall-scope-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-uninstall-scope-home-'));
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);
  assert.equal(runIsolatedHome(['install', 'core'], cwd, home).status, 0);

  assert.equal(
    runIsolatedHome(['uninstall', '--apply', '--scope', 'project'], cwd, home).status,
    0,
  );
  assert.ok(!fs.existsSync(path.join(cwd, '.agents/skills/saf-create-spec')));
  assert.ok(fs.existsSync(path.join(home, '.agents/skills/saf-create-spec/SKILL.md')));

  assert.equal(runIsolatedHome(['uninstall', '--apply', '--scope', 'user'], cwd, home).status, 0);
  assert.ok(!fs.existsSync(path.join(home, '.agents/skills/saf-create-spec')));
  assert.ok(!fs.existsSync(path.join(home, '.claude/skills/saf-create-spec')));

  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

test('golden flow: greenfield init -> install core -> copy spec artifacts -> doctor PASS', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-golden-greenfield-'));
  assert.equal(run(['init'], cwd).status, 0);
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);

  const fixtureDir = path.join(packageRoot, 'examples/golden/task-management');
  const targetDir = path.join(cwd, '.specs/features/task-management');
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of ['context.md', 'spec.md', 'design.md', 'tasks.md'])
    fs.copyFileSync(path.join(fixtureDir, file), path.join(targetDir, file));

  // Mechanically prove the copied artifacts carry the required headers from
  // shared/references/artifact-contracts.md — the same presence contract a real
  // saf-create-spec run has to satisfy.
  const spec = fs.readFileSync(path.join(targetDir, 'spec.md'), 'utf8');
  assert.match(spec, /^# Specification — task-management$/m);
  assert.match(spec, /^## Requirement REQ-1/m);
  assert.match(spec, /^## Acceptance criteria$/m);
  const design = fs.readFileSync(path.join(targetDir, 'design.md'), 'utf8');
  assert.match(design, /^# Design — task-management$/m);
  assert.match(design, /^## Decision$/m);
  assert.match(design, /^## Path ownership$/m);
  const tasks = fs.readFileSync(path.join(targetDir, 'tasks.md'), 'utf8');
  assert.match(tasks, /^# Tasks — task-management$/m);
  assert.match(tasks, /^## T1:/m);
  assert.match(tasks, /^## TDD baseline$/m);

  const report = JSON.parse(run(['doctor', '--json'], cwd).stdout);
  assert.equal(
    report.checks.find((c: DoctorCheck) => c.name === 'artifact-contracts').status,
    'PASS',
  );
  assert.equal(report.checks.find((c: DoctorCheck) => c.name === 'evidence-first').status, 'PASS');
  assert.notEqual(report.status, 'FAIL');

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('golden flow: existing-code mode artifacts carry Observed/Inferred/Unknown labels and are accepted', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-golden-existing-code-'));
  assert.equal(run(['init'], cwd).status, 0);
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);

  const fixtureDir = path.join(packageRoot, 'examples/golden/existing-code-mode');
  const targetDir = path.join(cwd, '.specs/features/discount-calculator');
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of ['context.md', 'spec.md', 'design.md'])
    fs.copyFileSync(path.join(fixtureDir, file), path.join(targetDir, file));

  const spec = fs.readFileSync(path.join(targetDir, 'spec.md'), 'utf8');
  assert.match(spec, /^# Specification — discount-calculator$/m);
  assert.match(spec, /\(Observed\)/);
  assert.match(spec, /\(Unknown\)/);
  assert.match(spec, /^## Acceptance criteria$/m);
  const design = fs.readFileSync(path.join(targetDir, 'design.md'), 'utf8');
  assert.match(design, /^# Design — discount-calculator$/m);
  assert.match(design, /Observed:/);
  assert.match(design, /Inferred:/);

  const report = JSON.parse(run(['doctor', '--json'], cwd).stdout);
  assert.notEqual(report.status, 'FAIL');

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('golden flow: idea to spec — brainstorm brief converges into a saf-create-spec package', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-golden-idea-to-spec-'));
  assert.equal(run(['init'], cwd).status, 0);
  assert.equal(run(['install', 'planning', '--scope', 'project'], cwd).status, 0);
  assert.ok(
    fs.existsSync(path.join(cwd, '.agents/skills/saf-brainstorm/SKILL.md')),
    'planning pack must install saf-brainstorm',
  );

  const fixtureDir = path.join(packageRoot, 'examples/golden/idea-to-spec');
  const targetDir = path.join(cwd, '.specs/features/quiet-hours-notifications');
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of ['brief.md', 'context.md', 'spec.md', 'design.md', 'tasks.md'])
    fs.copyFileSync(path.join(fixtureDir, file), path.join(targetDir, file));

  // saf-brainstorm only ever hands off brief.md; saf-create-spec is what produces the spec
  // package. Proving both live at the same feature path, with the package carrying the
  // required headers from shared/references/artifact-contracts.md, is the same handoff a real
  // brainstorm -> create-specs run has to complete.
  assert.match(fs.readFileSync(path.join(targetDir, 'brief.md'), 'utf8'), /^## Decided approach$/m);
  const spec = fs.readFileSync(path.join(targetDir, 'spec.md'), 'utf8');
  assert.match(spec, /^# Specification — quiet-hours-notifications$/m);
  assert.match(spec, /^## Requirement REQ-1/m);
  assert.match(spec, /^## Acceptance criteria$/m);
  const design = fs.readFileSync(path.join(targetDir, 'design.md'), 'utf8');
  assert.match(design, /^# Design — quiet-hours-notifications$/m);
  assert.match(design, /^## Decision$/m);
  assert.match(design, /^## Path ownership$/m);
  const tasks = fs.readFileSync(path.join(targetDir, 'tasks.md'), 'utf8');
  assert.match(tasks, /^# Tasks — quiet-hours-notifications$/m);
  assert.match(tasks, /^## T1:/m);
  assert.match(tasks, /^## TDD baseline$/m);

  const report = JSON.parse(run(['doctor', '--json'], cwd).stdout);
  assert.equal(
    report.checks.find((c: DoctorCheck) => c.name === 'artifact-contracts').status,
    'PASS',
  );
  assert.equal(report.checks.find((c: DoctorCheck) => c.name === 'evidence-first').status, 'PASS');
  assert.notEqual(report.status, 'FAIL');

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('golden flow: PR fixtures match the pr-* template presence contract from artifact-contracts.md', () => {
  for (const template of ['pr-description', 'pr-review', 'pr-fix'])
    assert.ok(fs.existsSync(path.join(packageRoot, `shared/templates/${template}.template.md`)));

  const fixtureDir = path.join(packageRoot, 'examples/golden/pr-flow');
  const prPackage = fs.readFileSync(path.join(fixtureDir, 'pr-package.md'), 'utf8');
  assert.match(prPackage, /^# task-management — T1$/m);
  assert.match(prPackage, /^## Scope$/m);
  assert.match(prPackage, /^## Evidence$/m);
  const review = fs.readFileSync(path.join(fixtureDir, 'review-findings.md'), 'utf8');
  assert.match(review, /^# PR review — T1$/m);
  assert.match(review, /^## Findings$/m);
  const fix = fs.readFileSync(path.join(fixtureDir, 'fix-evidence.md'), 'utf8');
  assert.match(fix, /^# PR fix — T1$/m);
  assert.match(fix, /^## Actionable findings$/m);
});

test('golden flow: upgrading from a v0.8.0-shaped installation is safe under the new install default', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-golden-migration-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-golden-migration-home-'));

  // Simulate a pre-v0.9.0 installation: `install` always wrote into the project (today's
  // `--scope project`), since no other scope existed yet.
  assert.equal(run(['init'], cwd).status, 0);
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);
  const preExistingFiles = listAllEntries(path.join(cwd, '.agents/skills')).sort();
  assert.ok(preExistingFiles.length > 0);

  // Upgrading: the current binary's default `install` (scope user) must not touch or remove
  // the pre-existing project-scope installation — different scopes, no interference.
  const defaultInstall = runIsolatedHome(['install', 'core'], cwd, home);
  assert.equal(defaultInstall.status, 0);
  assert.deepEqual(listAllEntries(path.join(cwd, '.agents/skills')).sort(), preExistingFiles);

  // Explicit `--scope project` continues to behave exactly as install always did: it updates
  // (here, preserves, since files already exist) the existing project installation.
  const projectInstall = run(['install', 'core', '--scope', 'project'], cwd);
  assert.equal(projectInstall.status, 0);
  assert.match(projectInstall.stdout, /preserved/);

  const doctorReport = JSON.parse(
    runIsolatedHome(['doctor', '--json', '--contracts'], cwd, home).stdout,
  );
  assert.notEqual(doctorReport.status, 'FAIL');
  assert.equal(
    doctorReport.checks.find((c: DoctorCheck) => c.name === 'capability_contracts').status,
    'PASS',
  );

  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

test('a real npm pack tarball installs and its extracted CLI passes init/discover/install/doctor', (t) => {
  if (spawnSync('tar', ['--version']).status !== 0) {
    t.skip('tar CLI not available in this environment');
    return;
  }

  const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-pack-'));
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-pack-cache-'));
  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-extract-'));
  const consumerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-pack-consumer-'));

  try {
    const pack = spawnSync(
      'npm',
      ['pack', '--json', '--pack-destination', packDir, '--cache', cacheDir],
      // Windows can't spawn the `npm.cmd` shim directly without a shell (EINVAL/null status)
      // since Node's CVE-2024-27980 hardening; POSIX doesn't need it.
      { cwd: packageRoot, encoding: 'utf8', shell: process.platform === 'win32' },
    );
    assert.equal(pack.status, 0, pack.stderr);
    const jsonStart = pack.stdout.indexOf('[');
    const [meta] = JSON.parse(pack.stdout.slice(jsonStart));
    const tarballPath = path.join(packDir, meta.filename);
    assert.ok(fs.existsSync(tarballPath));

    const extract = spawnSync('tar', ['-xzf', tarballPath, '-C', extractDir]);
    assert.equal(extract.status, 0, String(extract.stderr));

    const installedCli = path.join(extractDir, 'package', 'dist', 'sdd-agentic-flow.js');
    assert.ok(fs.existsSync(installedCli));
    assert.notEqual(installedCli, cli);

    assert.ok(!fs.existsSync(path.join(extractDir, 'package', 'test')));

    const runPacked = (args: string[], input?: string) =>
      spawnSync(process.execPath, [installedCli, ...args], {
        cwd: consumerDir,
        ...(input !== undefined ? { input } : {}),
        encoding: 'utf8',
      });

    assert.equal(runPacked(['version']).stdout.trim(), packageVersion);
    assert.equal(runPacked(['init']).status, 0);
    assert.equal(runPacked(['discover']).status, 0);
    assert.equal(runPacked(['install', 'core', '--scope', 'project']).status, 0);

    const doctorResult = runPacked(['doctor', '--contracts', '--json']);
    assert.equal(doctorResult.status, 0);
    const report = JSON.parse(doctorResult.stdout);
    assert.equal(
      report.checks.find((check: DoctorCheck) => check.name === 'capability_contracts').status,
      'PASS',
    );
    assert.equal(
      report.checks.find((check: DoctorCheck) => check.name === 'skills').status,
      'PASS',
    );
    assert.equal(
      report.checks.find((check: DoctorCheck) => check.name === 'shared_layer').status,
      'PASS',
    );
  } finally {
    for (const dir of [packDir, cacheDir, extractDir, consumerDir])
      fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a packed tarball CLI completes the full install lifecycle with zero project footprint', (t) => {
  if (spawnSync('tar', ['--version']).status !== 0) {
    t.skip('tar CLI not available in this environment');
    return;
  }

  const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-lifecycle-pack-'));
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-lifecycle-cache-'));
  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-lifecycle-extract-'));
  const consumerDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'sdd-agentic-flow-lifecycle-consumer-'),
  );
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-lifecycle-home-'));

  try {
    const pack = spawnSync(
      'npm',
      ['pack', '--json', '--pack-destination', packDir, '--cache', cacheDir],
      // Windows can't spawn the `npm.cmd` shim directly without a shell (EINVAL/null status)
      // since Node's CVE-2024-27980 hardening; POSIX doesn't need it.
      { cwd: packageRoot, encoding: 'utf8', shell: process.platform === 'win32' },
    );
    assert.equal(pack.status, 0, pack.stderr);
    const jsonStart = pack.stdout.indexOf('[');
    const [meta] = JSON.parse(pack.stdout.slice(jsonStart));
    const tarballPath = path.join(packDir, meta.filename);

    const extract = spawnSync('tar', ['-xzf', tarballPath, '-C', extractDir]);
    assert.equal(extract.status, 0, String(extract.stderr));

    const installedCli = path.join(extractDir, 'package', 'dist', 'sdd-agentic-flow.js');
    assert.ok(fs.existsSync(installedCli));

    const runStep = (args: string[]) =>
      spawnSync(process.execPath, [installedCli, ...args], {
        cwd: consumerDir,
        encoding: 'utf8',
        env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir },
      });

    assert.equal(runStep(['init']).status, 0);
    const before = listAllEntries(consumerDir).sort();

    // Default scope (no --scope) is user-scope: must write nothing under cwd.
    assert.equal(runStep(['install', 'core']).status, 0);
    assert.deepEqual(
      listAllEntries(consumerDir).sort(),
      before,
      'install core with default scope must not create any file in cwd',
    );

    assert.equal(runStep(['doctor']).status, 0);
    assert.equal(runStep(['context', 'status']).status, 0);
    assert.equal(runStep(['uninstall', '--plan']).status, 0);
    assert.equal(runStep(['uninstall', '--apply']).status, 0);
  } finally {
    for (const dir of [packDir, cacheDir, extractDir, consumerDir, homeDir])
      fs.rmSync(dir, { recursive: true, force: true });
  }
});

function copyGoldenLoopState(cwd: string, flowId: string) {
  const fixtureDir = path.join(packageRoot, 'examples/golden', flowId);
  const targetDir = path.join(cwd, '.sdd-agentic-flow/autonomy');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(path.join(fixtureDir, 'loop-state.md'), path.join(targetDir, 'loop-state.md'));
}

test('migrate is not a command; doctor WARNs leftover .sdd/ without migrate --apply', () => {
  const unknown = run(['migrate', '--help']);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /unknown command: migrate/);

  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-legacy-sdd-'));
  fs.mkdirSync(path.join(cwd, '.sdd/context'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.sdd/config.yml'), 'version: 1\n', 'utf8');
  const report = JSON.parse(run(['doctor', '--json'], cwd).stdout);
  const legacy = report.checks.find((c: DoctorCheck) => c.name === 'legacy_sdd_root');
  assert.equal(legacy.status, 'WARN');
  assert.match(legacy.message, /rename \.sdd\/ to \.sdd-agentic-flow\/ yourself/);
  assert.doesNotMatch(legacy.message, /migrate --apply/);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('golden flow: autonomy AUTO-001 — brainstorm handoff to create-specs under autonomous config', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-golden-auto-001-'));
  assert.equal(
    run(['init', '--execution-mode', 'full', '--autonomy-level', 'autonomous'], cwd).status,
    0,
  );
  assert.equal(run(['install', 'planning', '--scope', 'project'], cwd).status, 0);

  const fixtureDir = path.join(packageRoot, 'examples/golden/idea-to-spec');
  const targetDir = path.join(cwd, '.specs/features/quiet-hours-notifications');
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of ['brief.md', 'context.md', 'spec.md', 'design.md', 'tasks.md'])
    fs.copyFileSync(path.join(fixtureDir, file), path.join(targetDir, file));
  copyGoldenLoopState(cwd, 'autonomy-idea-to-spec');

  const report = JSON.parse(run(['doctor', '--json', '--autonomy'], cwd).stdout);
  assert.equal(report.checks.find((c: DoctorCheck) => c.name === 'autonomy_config').status, 'PASS');
  assert.equal(report.checks.find((c: DoctorCheck) => c.name === 'autonomy_combo').status, 'PASS');
  const loop = report.checks.find((c: DoctorCheck) => c.name === 'autonomy_loop_state');
  assert.equal(loop.status, 'PASS');
  assert.match(loop.message, /saf-brainstorm/);
  assert.notEqual(report.status, 'FAIL');

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('golden flow: autonomy AUTO-002 — task-check hands off to validation', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-golden-auto-002-'));
  assert.equal(
    run(['init', '--execution-mode', 'full', '--autonomy-level', 'autonomous'], cwd).status,
    0,
  );
  assert.equal(run(['install', 'core', '--scope', 'project'], cwd).status, 0);
  copyGoldenLoopState(cwd, 'autonomy-spec-to-validate');

  const report = JSON.parse(run(['doctor', '--json', '--autonomy', '--verbose'], cwd).stdout);
  assert.equal(report.checks.filter((c: DoctorCheck) => c.name.startsWith('guardrail_')).length, 7);
  const loop = report.checks.find((c: DoctorCheck) => c.name === 'autonomy_loop_state');
  assert.equal(loop.status, 'PASS');
  assert.match(loop.message, /saf-validate/);

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('golden flow: autonomy AUTO-003 — autonomous-resume clears pause', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-golden-auto-003-'));
  assert.equal(
    run(['init', '--execution-mode', 'full', '--autonomy-level', 'autonomous'], cwd).status,
    0,
  );
  copyGoldenLoopState(cwd, 'autonomy-guardrail-pause-resume');
  const loopStatePath = path.join(cwd, '.sdd-agentic-flow/autonomy/loop-state.md');

  const resumed = run(['autonomous-resume'], cwd);
  assert.equal(resumed.status, 0);
  assert.match(resumed.stdout, /saf-check-task/);
  assert.match(fs.readFileSync(loopStatePath, 'utf8'), /pause=false, stop=false/);

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('golden flow: autonomy AUTO-004 — override-guard with audited reason', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-golden-auto-004-'));
  assert.equal(
    run(['init', '--execution-mode', 'full', '--autonomy-level', 'autonomous'], cwd).status,
    0,
  );
  copyGoldenLoopState(cwd, 'autonomy-human-override');
  const loopStatePath = path.join(cwd, '.sdd-agentic-flow/autonomy/loop-state.md');

  const resumed = run(
    ['autonomous-resume', '--override-guard=3', '--reason=flaky test, verified manually'],
    cwd,
  );
  assert.equal(resumed.status, 0);
  const after = fs.readFileSync(loopStatePath, 'utf8');
  assert.match(after, /Human override: pause=false, stop=false/);
  assert.match(after, /guardrail 3 overridden by human/);

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('golden flow: autonomy AUTO-005 — doctor reads budget-exhausted loop state', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-golden-auto-005-'));
  assert.equal(
    run(['init', '--execution-mode', 'full', '--autonomy-level', 'autonomous'], cwd).status,
    0,
  );
  const configPath = path.join(cwd, '.sdd-agentic-flow/config.yml');
  fs.writeFileSync(
    configPath,
    fs.readFileSync(configPath, 'utf8').replace('max_iterations: 50', 'max_iterations: 0'),
  );
  copyGoldenLoopState(cwd, 'autonomy-budget-exhaustion');

  const report = JSON.parse(run(['doctor', '--json', '--autonomy'], cwd).stdout);
  const loop = report.checks.find((c: DoctorCheck) => c.name === 'autonomy_loop_state');
  assert.equal(loop.status, 'PASS');
  assert.match(loop.message, /saf-implement/);

  fs.rmSync(cwd, { recursive: true, force: true });
});

test('upgrade --check is read-only and reports update available via test seam', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-upgrade-check-'));
  const result = spawnSync(process.execPath, [cli, 'upgrade', '--check'], {
    cwd,
    encoding: 'utf8',
    timeout: 8000,
    env: { ...process.env, SDD_AGENTIC_FLOW_TEST_LATEST_VERSION: '99.0.0', CI: '1' },
  });
  fs.rmSync(cwd, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /Update available: yes/);
  assert.match(result.stdout, /99\.0\.0/);
  assert.match(result.stdout, /sdd-agentic-flow upgrade/);
});

test('upgrade --check offline is not up-to-date and exits non-zero in machine mode', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-upgrade-offline-'));
  const result = spawnSync(process.execPath, [cli, 'upgrade', '--check'], {
    cwd,
    encoding: 'utf8',
    timeout: 8000,
    env: {
      ...process.env,
      CI: '1',
      SDD_AGENTIC_FLOW_TEST_LATEST_VERSION: 'offline',
    },
  });
  fs.rmSync(cwd, { recursive: true, force: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /unable to check for updates|Update available: \(unknown\)/);
  assert.doesNotMatch(result.stdout, /up to date/i);
});

test('upgrade --plan may hit registry and never mutates', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-upgrade-plan-'));
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-upgrade-plan-home-'));
  assert.equal(runIsolatedHome(['init'], cwd, homeDir).status, 0);
  assert.equal(runIsolatedHome(['install', 'core'], cwd, homeDir).status, 0);
  const before = listAllEntries(homeDir).sort();
  const result = spawnSync(process.execPath, [cli, 'upgrade', '--plan'], {
    cwd,
    encoding: 'utf8',
    timeout: 8000,
    env: {
      ...process.env,
      HOME: homeDir,
      USERPROFILE: homeDir,
      CI: '1',
      SDD_AGENTIC_FLOW_TEST_LATEST_VERSION: '99.0.0',
      SDD_AGENTIC_FLOW_TEST_EXEC_MODE: 'global',
    },
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /No changes were made/);
  assert.match(result.stdout, /Upgrade CLI|npm install -g|Latest CLI/);
  assert.deepEqual(listAllEntries(homeDir).sort(), before);
  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(homeDir, { recursive: true, force: true });
});

test('upgrade --skills-only refreshes missing files and skips local modifications', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-skills-only-'));
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-skills-only-home-'));
  assert.equal(runIsolatedHome(['init'], cwd, homeDir).status, 0);
  assert.equal(runIsolatedHome(['install', 'core'], cwd, homeDir).status, 0);
  const skillPath = path.join(homeDir, '.agents/skills/saf-create-spec/SKILL.md');
  assert.ok(fs.existsSync(skillPath));
  fs.writeFileSync(skillPath, 'locally-edited-skill\n');
  const result = spawnSync(process.execPath, [cli, 'upgrade', '--skills-only'], {
    cwd,
    encoding: 'utf8',
    timeout: 8000,
    env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir, CI: '1' },
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /differ|skipped|non-interactive/i);
  assert.equal(fs.readFileSync(skillPath, 'utf8'), 'locally-edited-skill\n');
  fs.rmSync(cwd, { recursive: true, force: true });
  fs.rmSync(homeDir, { recursive: true, force: true });
});

test('discover/context unknown args include did-you-mean hints', () => {
  assert.match(run(['discover', '--froce']).stderr, /Did you mean/);
  assert.match(run(['context', 'stauts']).stderr, /Did you mean/);
  assert.match(run(['autonomous-resume', '--froce']).stderr, /Did you mean/);
});

test('machine upgrade does not mutate when an update is available', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-upgrade-machine-'));
  const result = spawnSync(process.execPath, [cli, 'upgrade'], {
    cwd,
    encoding: 'utf8',
    timeout: 8000,
    env: {
      ...process.env,
      CI: '1',
      SDD_AGENTIC_FLOW_TEST_LATEST_VERSION: '99.0.0',
      SDD_AGENTIC_FLOW_TEST_NPM_INSTALL: 'fail',
    },
  });
  fs.rmSync(cwd, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /Update available: yes|non-interactive/);
  assert.doesNotMatch(result.stderr + result.stdout, /simulated npm install failure/);
});

test('doctor --evidence-graph reports feature-scoped paths', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-evidence-graph-cli-'));
  const feature = 'sample-feature';
  const specDir = path.join(cwd, '.specs', 'features', feature);
  fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow', 'reports'), { recursive: true });
  fs.mkdirSync(specDir, { recursive: true });
  const fixtureRoot = path.join(__dirname, 'fixtures', 'v4');
  fs.copyFileSync(path.join(fixtureRoot, 'valid-spec.md'), path.join(specDir, 'spec.md'));
  fs.copyFileSync(path.join(fixtureRoot, 'valid-tasks.md'), path.join(specDir, 'tasks.md'));
  fs.copyFileSync(
    path.join(fixtureRoot, 'valid-check.md'),
    path.join(cwd, '.sdd-agentic-flow', 'reports', 'T1-check.md'),
  );
  const ok = run(['doctor', '--evidence-graph', feature], cwd);
  assert.match(ok.stdout, /REQ-1: current/);
  assert.equal(ok.status, 1, 'incomplete REQ-2 keeps non-zero exit');
  const missing = run(['doctor', '--evidence-graph', 'missing-feature'], cwd);
  assert.equal(missing.status, 2);
  fs.rmSync(cwd, { recursive: true, force: true });
});

test('uninstall --purge requires --plan or --apply and --yes for apply', () => {
  const bad = run(['uninstall', '--purge']);
  assert.equal(bad.status, 1);
  const plan = run(['uninstall', '--plan', '--purge']);
  assert.equal(plan.status, 0);
  assert.match(plan.stdout, /purge/i);
  const applyNoYes = run(['uninstall', '--apply', '--purge']);
  assert.equal(applyNoYes.status, 1);
});

test('uninstall --apply --purge --yes removes owned skills in isolated HOME', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-purge-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-purge-cwd-'));
  const skillRoot = path.join(home, '.agents', 'skills', 'saf-setup');
  fs.mkdirSync(skillRoot, { recursive: true });
  fs.writeFileSync(path.join(skillRoot, 'SKILL.md'), '# setup\n');
  fs.mkdirSync(path.join(cwd, '.specs', 'features', 'keep-me'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.specs', 'features', 'keep-me', 'spec.md'), '# keep\n');
  const applied = runIsolatedHome(['uninstall', '--apply', '--purge', '--yes'], cwd, home);
  assert.equal(applied.status, 0, applied.stderr + applied.stdout);
  assert.equal(fs.existsSync(skillRoot), false);
  assert.equal(fs.existsSync(path.join(cwd, '.specs', 'features', 'keep-me', 'spec.md')), true);
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(cwd, { recursive: true, force: true });
});
