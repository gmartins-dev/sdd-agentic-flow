import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { applyProjectSharing, configureIntent } from '../src/configure';
import {
  DEFAULT_USER_TARGETS,
  desiredSkillsForPacks,
  parseTargetSelection,
  readInstallConfig,
  repositoryKey,
  shouldUseInteractiveInstall,
  writeInstallConfig,
} from '../src/install-domain';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-install-domain-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

test('intent persistence round-trips and pack union derives skills', () => {
  const config = {
    version: 1,
    user: { packs: ['core'], targets: [...DEFAULT_USER_TARGETS] },
    projects: {},
  };
  writeInstallConfig(config, temporary);
  assert.deepEqual(readInstallConfig(temporary), config);
  assert.deepEqual(
    desiredSkillsForPacks(['core', 'pr'], {
      core: { skills: ['a', 'b'] },
      pr: { skills: ['b', 'c'] },
    }),
    ['a', 'b', 'c'],
  );
});

test('repository keys and interactive eligibility are deterministic', () => {
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
  const agents = parseTargetSelection('agents, Claude Code');
  assert.ok(agents.ok);
  assert.deepEqual(agents.targets, ['agents', 'claude']);
  assert.equal(parseTargetSelection('agents, unknown').ok, false);
});

test('project configure persists intent and only manages its owned exclude block', () => {
  const project = path.join(temporary, 'project');
  fs.mkdirSync(path.join(project, '.git', 'info'), { recursive: true });
  configureIntent({
    homeDir: temporary,
    cwd: project,
    scope: 'project',
    packs: ['core'],
    sharing: 'local',
  });
  assert.match(
    fs.readFileSync(path.join(project, '.git', 'info', 'exclude'), 'utf8'),
    /\.agents\/skills/,
  );
  applyProjectSharing(project, 'shared');
  assert.doesNotMatch(
    fs.readFileSync(path.join(project, '.git', 'info', 'exclude'), 'utf8'),
    /\.agents\/skills/,
  );
});

test('configure intent replaces a selected pack instead of retaining a stale larger pack', () => {
  const home = path.join(temporary, 'replace-pack-home');
  writeInstallConfig(
    { version: 1, user: { packs: ['full'], targets: [...DEFAULT_USER_TARGETS] }, projects: {} },
    home,
  );
  configureIntent({ homeDir: home, cwd: temporary, scope: 'user', packs: ['core'] });
  const saved = readInstallConfig(home);
  assert.ok(saved);
  assert.deepEqual(saved.user.packs, ['core']);
});

test('project sharing leaves an equivalent user exclusion untouched', () => {
  const project = path.join(temporary, 'project-user-exclude');
  const exclude = path.join(project, '.git', 'info', 'exclude');
  fs.mkdirSync(path.dirname(exclude), { recursive: true });
  fs.writeFileSync(exclude, '.agents/skills/\n', 'utf8');
  applyProjectSharing(project, 'local');
  applyProjectSharing(project, 'shared');
  assert.equal(fs.readFileSync(exclude, 'utf8'), '.agents/skills/\n');
});
