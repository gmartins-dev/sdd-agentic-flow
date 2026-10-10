import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import {
  doctor,
  doctorChecks,
  installationStatus,
  languageReport,
  resolveConfiguredAgent,
  resolveSkillsRoot,
  severity,
} from '../src/doctor';
import { OFFICIAL_SKILLS } from '../src/skill-identity';

const packageRoot = path.resolve(__dirname, '..');
const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
let root = '';
let home = '';

// Doctor resolves user skill roots from the process home directory, so isolate it.
before(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-doctor-'));
  home = path.join(root, 'home');
  fs.mkdirSync(home);
  process.env.HOME = home;
  process.env.USERPROFILE = home;
});

after(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
  fs.rmSync(root, { recursive: true, force: true });
});

function workspace(name: string, { git = false } = {}): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  if (git) spawnSync('git', ['init', '-q'], { cwd: dir });
  return dir;
}

function writeConfig(cwd: string, content: string) {
  fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.sdd-agentic-flow', 'config.yml'), content);
}

function captureStdout<T>(run: () => Promise<T>): Promise<{ value: T; output: string }> {
  const write = process.stdout.write.bind(process.stdout);
  let output = '';
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  return run().then(
    (value) => {
      process.stdout.write = write;
      return { value, output };
    },
    (error: unknown) => {
      process.stdout.write = write;
      throw error;
    },
  );
}

test('severity reports the worst check status', () => {
  assert.equal(severity([]), 'PASS');
  assert.equal(severity([{ name: 'a', status: 'INFO', message: '' }]), 'PASS');
  assert.equal(
    severity([
      { name: 'a', status: 'PASS', message: '' },
      { name: 'b', status: 'WARN', message: '' },
    ]),
    'WARN',
  );
  assert.equal(
    severity([
      { name: 'a', status: 'WARN', message: '' },
      { name: 'b', status: 'FAIL', message: '' },
    ]),
    'FAIL',
  );
});

test('a workspace outside Git defers project checks instead of failing them', () => {
  const cwd = workspace('outside-git');
  const checks = doctorChecks(cwd, { homeDir: home });
  const byName = new Map(checks.map((check) => [check.name, check]));
  assert.equal(new Set(checks.map((check) => check.name)).size, checks.length);
  assert.equal(byName.get('git_workspace')?.status, 'INFO');
  assert.equal(byName.get('config')?.status, 'INFO');
  assert.equal(byName.get('skills')?.status, 'WARN');
  assert.equal(
    checks.some((check) => check.status === 'FAIL'),
    false,
  );
});

test('the package root passes its own harness checks', () => {
  const checks = doctorChecks(packageRoot, { homeDir: home, harness: true });
  assert.equal(severity(checks), 'PASS');
});

test('configured agent and language profile are read from project configuration', () => {
  const cwd = workspace('configured', { git: true });
  assert.equal(resolveConfiguredAgent(cwd), null);
  assert.equal(languageReport(cwd).status, 'PASS');
  writeConfig(cwd, 'schema: saf-config/v3\nagent:\n  target: cursor\n');
  assert.equal(resolveConfiguredAgent(cwd), 'cursor');
  writeConfig(cwd, 'schema: saf-config/v3\nagent:\n  target: unknown-host\n');
  assert.equal(resolveConfiguredAgent(cwd), null);
  writeConfig(cwd, 'schema: saf-config/v3\nlanguage:\n  profile: xx-YY\n');
  const invalid = languageReport(cwd);
  assert.equal(invalid.status, 'FAIL');
  assert.equal(invalid.profile, 'xx-YY');
});

test('skills root and installation status follow installed official skills', () => {
  const cwd = workspace('skills-root', { git: true });
  const projectRoot = path.join(cwd, '.agents', 'skills');
  assert.equal(resolveSkillsRoot(cwd), projectRoot);
  assert.equal(installationStatus(projectRoot), false);
  const skill = OFFICIAL_SKILLS[0] as string;
  fs.mkdirSync(path.join(projectRoot, skill), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, skill, 'SKILL.md'), '# skill\n');
  assert.equal(installationStatus(projectRoot), true);
  assert.equal(resolveSkillsRoot(cwd), projectRoot);
});

test('doctor --json emits one machine envelope and returns the evaluated report', async () => {
  const cwd = workspace('json-report');
  const { value, output } = await captureStdout(() => doctor(cwd, { json: true, homeDir: home }));
  const envelope = JSON.parse(output);
  assert.equal(envelope.command, 'doctor');
  assert.equal(envelope.data.status, 'WARN');
  assert.ok(value && 'checks' in value);
  assert.equal(envelope.data.checks.length, value.checks.length);
});
