import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { configureIntent } from '../src/configure';
import {
  classifyInstallIntent,
  DEFAULT_USER_TARGETS,
  type InstallConfig,
  parseTargetSelection,
  readInstallConfig,
  repositoryKey,
  shouldUseInteractiveInstall,
  writeInstallConfig,
} from '../src/install-domain';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-install-domain-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

test('v3 intent persistence contains targets and project adoption without packs', () => {
  const config: InstallConfig = {
    schema: 'saf-install-intent/v3',
    user: { targets: [...DEFAULT_USER_TARGETS] },
    projects: {
      abc: {
        git_common_dir: '/repo/.git',
        project_relative_path: 'apps/api',
        adoption_mode: 'team',
      },
    },
  };
  writeInstallConfig(config, temporary);
  assert.deepEqual(readInstallConfig(temporary), config);
  const content = fs.readFileSync(path.join(temporary, '.sdd-agentic-flow', 'install.yml'), 'utf8');
  assert.match(content, /^schema: saf-install-intent\/v3/);
  assert.doesNotMatch(content, /packs:|sharing:|root:/);
});

test('only v3 intent is current and older schemas are cleanup-only', () => {
  for (const [schema, kind] of [
    ['saf-install-intent/v1', 'legacy'],
    ['saf-install-intent/v2', 'legacy'],
    ['saf-install-intent/v3', 'current'],
    ['saf-install-intent/v4', 'future'],
  ] as const) {
    const home = path.join(temporary, schema.replaceAll('/', '-'));
    const file = path.join(home, '.sdd-agentic-flow', 'install.yml');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `schema: ${schema}\n`);
    assert.equal(classifyInstallIntent(home).kind, kind);
    if (kind !== 'current') assert.throws(() => readInstallConfig(home), /clean reinstall/);
  }
});

test('repository keys and interactive eligibility are deterministic', () => {
  execFileSync('git', ['init'], { cwd: temporary, stdio: 'ignore' });
  assert.equal(repositoryKey(temporary), repositoryKey(temporary));
  assert.equal(shouldUseInteractiveInstall({ stdinIsTTY: true, stdoutIsTTY: true }), true);
  assert.equal(
    shouldUseInteractiveInstall({ stdinIsTTY: true, stdoutIsTTY: true, ci: true }),
    false,
  );
});

test('target selection is strict, defaults accurately, and all includes Cursor', () => {
  const empty = parseTargetSelection('');
  assert.ok(empty.ok);
  assert.deepEqual(empty.targets, DEFAULT_USER_TARGETS);
  const all = parseTargetSelection('all');
  assert.ok(all.ok);
  assert.deepEqual(all.targets, ['agents', 'cursor', 'claude', 'copilot']);
  assert.equal(parseTargetSelection('agents, unknown').ok, false);
});

test('configure intent updates bundle targets without pack-shaped fields', () => {
  const home = path.join(temporary, 'configure-home');
  configureIntent({
    homeDir: home,
    cwd: temporary,
    scope: 'user',
    targets: ['agents'],
  });
  assert.deepEqual(readInstallConfig(home)?.user.targets, ['agents']);
});
