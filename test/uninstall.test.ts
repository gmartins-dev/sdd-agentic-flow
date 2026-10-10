import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, afterEach, before, test } from 'node:test';

import { install } from '../src/install';
import { OFFICIAL_SKILLS } from '../src/skill-identity';
import { collectPurgeTargets, uninstall } from '../src/uninstall';

const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
let root = '';
let home = '';

// uninstall resolves user targets from the process home directory, so isolate it.
before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-uninstall-'));
  home = path.join(root, 'home');
  fs.mkdirSync(home);
  process.env.HOME = home;
  process.env.USERPROFILE = home;
});

afterEach(() => {
  process.exitCode = undefined;
});

after(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
  fs.rmSync(root, { recursive: true, force: true });
});

function gitProject(name: string): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

function quietly<T>(run: () => T): { value: T; output: string } {
  const stdout = process.stdout.write.bind(process.stdout);
  const stderr = process.stderr.write.bind(process.stderr);
  let output = '';
  const capture = ((chunk: string | Uint8Array) => {
    output += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  process.stdout.write = capture;
  process.stderr.write = capture;
  try {
    return { value: run(), output };
  } finally {
    process.stdout.write = stdout;
    process.stderr.write = stderr;
  }
}

test('invalid uninstall arguments fail as handled usage errors before touching state', () => {
  const cwd = gitProject('usage');
  for (const args of [
    ['--plan', '--scope', 'galaxy'],
    ['--plan', '--target', 'unknown'],
    ['--plan', '--bogus'],
    ['--plan', '--scope', 'project', '--target', 'agents'],
    ['--purge'],
    ['--purge', '--plan', '--scope', 'user'],
  ]) {
    const { value } = quietly(() => uninstall(args, cwd));
    assert.equal(value, false, args.join(' '));
    assert.equal(process.exitCode, 1, args.join(' '));
    process.exitCode = undefined;
  }
});

test('uninstall plans and removes only managed user-scope skills', () => {
  const cwd = gitProject('user-scope');
  const skillsRoot = path.join(home, '.agents', 'skills');
  const installed = quietly(() =>
    install(cwd, { homeDir: home, scope: 'user', targets: ['agents'], quiet: true }),
  );
  assert.equal(installed.value, true, installed.output);
  const foreign = path.join(skillsRoot, 'someone-else', 'SKILL.md');
  fs.mkdirSync(path.dirname(foreign), { recursive: true });
  fs.writeFileSync(foreign, '# foreign\n');

  const plan = quietly(() => uninstall(['--plan', '--scope', 'user', '--target', 'agents'], cwd));
  assert.notEqual(plan.value, false, plan.output);
  for (const skill of OFFICIAL_SKILLS) assert.ok(fs.existsSync(path.join(skillsRoot, skill)));

  const applied = quietly(() =>
    uninstall(['--yes', '--scope', 'user', '--target', 'agents', '--quiet'], cwd),
  );
  assert.notEqual(applied.value, false, applied.output);
  for (const skill of OFFICIAL_SKILLS)
    assert.equal(fs.existsSync(path.join(skillsRoot, skill)), false, skill);
  assert.equal(fs.readFileSync(foreign, 'utf8'), '# foreign\n');
});

test('purge removes recognized project state files and preserves specifications', () => {
  const cwd = gitProject('purge');
  fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, '.sdd-agentic-flow', 'config.yml'),
    'schema: saf-config/v3\nproject:\n  name: purge\n',
  );
  const spec = path.join(cwd, '.specs', 'features', 'keep', 'spec.md');
  fs.mkdirSync(path.dirname(spec), { recursive: true });
  fs.writeFileSync(spec, '# keep\n');

  const config = path.join(cwd, '.sdd-agentic-flow', 'config.yml');
  const targets = collectPurgeTargets(cwd, home);
  assert.ok(targets.some((target) => target.path === config && !target.preserve));

  const plan = quietly(() => uninstall(['--purge', '--plan'], cwd));
  assert.match(plan.output, /recognized SAF targets/);
  assert.ok(fs.existsSync(config));

  const applied = quietly(() => uninstall(['--purge', '--yes', '--quiet'], cwd));
  assert.equal(applied.value, true, applied.output);
  assert.equal(fs.existsSync(config), false);
  assert.equal(fs.readFileSync(spec, 'utf8'), '# keep\n');
});

test('the rich purge plan points at the canonical --yes confirmation', () => {
  const cwd = gitProject('purge-rich');
  const descriptors = {
    stdin: Object.getOwnPropertyDescriptor(process.stdin, 'isTTY'),
    stdout: Object.getOwnPropertyDescriptor(process.stdout, 'isTTY'),
  };
  const env = { CI: process.env.CI, TERM: process.env.TERM, NO_COLOR: process.env.NO_COLOR };
  Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true });
  Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
  delete process.env.CI;
  delete process.env.NO_COLOR;
  process.env.TERM = 'xterm-256color';
  try {
    const plan = quietly(() => uninstall(['--purge', '--plan'], cwd));
    assert.match(plan.output, /uninstall --yes --purge/);
    assert.doesNotMatch(plan.output, /--apply/);
  } finally {
    for (const [stream, descriptor] of [
      [process.stdin, descriptors.stdin],
      [process.stdout, descriptors.stdout],
    ] as const) {
      if (descriptor) Object.defineProperty(stream, 'isTTY', descriptor);
      else delete (stream as { isTTY?: boolean }).isTTY;
    }
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
