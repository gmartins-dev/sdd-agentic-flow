'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const {
  DEFAULT_USER_TARGETS,
  desiredSkillsForPacks,
  readInstallConfig,
  repositoryKey,
  shouldUseInteractiveInstall,
  writeInstallConfig,
} = require('../bin/install-domain');
const { applyProjectSharing, configureIntent } = require('../bin/configure');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-install-domain-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

test('intent persistence round-trips and pack union derives skills', () => {
  const config = {
    version: 1,
    user: { packs: ['core'], targets: DEFAULT_USER_TARGETS },
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

test('project sharing leaves an equivalent user exclusion untouched', () => {
  const project = path.join(temporary, 'project-user-exclude');
  const exclude = path.join(project, '.git', 'info', 'exclude');
  fs.mkdirSync(path.dirname(exclude), { recursive: true });
  fs.writeFileSync(exclude, '.agents/skills/\n', 'utf8');
  applyProjectSharing(project, 'local');
  applyProjectSharing(project, 'shared');
  assert.equal(fs.readFileSync(exclude, 'utf8'), '.agents/skills/\n');
});
