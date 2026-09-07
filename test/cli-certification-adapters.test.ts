import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  type CliExecutionAdapter,
  createDistAdapter,
  createPackedAdapter,
  createSandbox,
  removeSandbox,
} from '../scripts/cli-certification/adapters.js';
import { readInstallConfig, writeInstallConfig } from '../src/install-domain';

const repoRoot = path.join(__dirname, '..');
const version = (
  JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string }
).version;

function withAdapter(
  adapter: CliExecutionAdapter,
  callback: (sandbox: ReturnType<typeof createSandbox>) => void,
) {
  const sandbox = createSandbox(adapter.name);
  try {
    callback(sandbox);
  } finally {
    removeSandbox(sandbox);
  }
}

test('dist adapter executes the compiled CLI in an isolated sandbox', (t) => {
  if (!fs.existsSync(path.join(repoRoot, 'dist', 'sdd-agentic-flow.js'))) {
    t.skip('dist is not built');
    return;
  }
  const adapter = createDistAdapter(repoRoot);
  withAdapter(adapter, (sandbox) => {
    const result = adapter.run(['version'], sandbox);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`${version.replace(/\./g, '\\.')}|version`, 'i'));
    assert.deepEqual(fs.readdirSync(sandbox.cwd), ['.git']);
  });
});

test('sandbox roots are separate from the repository and are disposable', () => {
  const sandbox = createSandbox('layout');
  assert.notEqual(sandbox.cwd, repoRoot);
  assert.ok(sandbox.home.startsWith(os.tmpdir()));
  removeSandbox(sandbox);
  assert.equal(fs.existsSync(sandbox.root), false);
});

test('packed adapter releases its tarball and cache after consumer verification', () => {
  const adapter = createPackedAdapter(repoRoot);
  const sandbox = createSandbox('packed-cleanup');
  const tarball = adapter.ptyCommand(sandbox).match(/'file:([^']+)'/)?.[1];
  try {
    assert.ok(tarball);
    assert.equal(fs.existsSync(tarball), true);
    assert.equal(adapter.run(['version'], sandbox).status, 0);
  } finally {
    adapter.dispose?.();
    removeSandbox(sandbox);
  }
  assert.ok(tarball);
  assert.equal(fs.existsSync(path.dirname(tarball)), false);
});

test('normal uninstall preserves an official-name collision without provenance', () => {
  const adapter = createDistAdapter(repoRoot);
  withAdapter(adapter, (sandbox) => {
    const foreign = path.join(sandbox.home, '.agents', 'skills', 'saf-route', 'SKILL.md');
    fs.mkdirSync(path.dirname(foreign), { recursive: true });
    fs.writeFileSync(foreign, 'foreign skill');
    const result = adapter.run(['uninstall', '--yes', '--target', 'agents'], sandbox);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(foreign, 'utf8'), 'foreign skill');
  });
});

test('scoped uninstall preserves unlisted files, other targets, and workspace intent', () => {
  const adapter = createDistAdapter(repoRoot);
  withAdapter(adapter, (sandbox) => {
    const install = adapter.run(['install', '--target', 'agents', '--target', 'claude'], sandbox);
    assert.equal(install.status, 0, install.stderr);
    const intent = readInstallConfig(sandbox.home);
    assert.ok(intent);
    intent.projects.other = {
      git_common_dir: '/another/project/.git',
      project_relative_path: '.',
      adoption_mode: 'team',
    };
    writeInstallConfig(intent, sandbox.home);
    const note = path.join(sandbox.home, '.agents', 'skills', 'saf-route', 'personal.md');
    fs.writeFileSync(note, 'keep my notes');
    const result = adapter.run(['uninstall', '--yes', '--target', 'agents'], sandbox);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(note, 'utf8'), 'keep my notes');
    assert.equal(fs.existsSync(path.join(path.dirname(note), 'SKILL.md')), false);
    const remaining = readInstallConfig(sandbox.home);
    assert.deepEqual(remaining?.user.targets, ['claude']);
    assert.deepEqual(remaining?.projects, intent.projects);
    assert.equal(fs.existsSync(path.join(sandbox.home, '.claude/skills/saf-route/SKILL.md')), true);
  });
});
