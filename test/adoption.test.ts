import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import {
  ADOPTION_MODES,
  adoptionModeForScope,
  applyAdoption,
  inspectAdoption,
  normalizeSpecsRoot,
  removeManagedExcludeBlocksFromFile,
  removeUntrackedProjectAssets,
} from '../src/adoption';
import { configureIntent } from '../src/configure';
import { readInstallConfig } from '../src/install-domain';
import { collectPurgeTargets } from '../src/uninstall';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-adoption-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

function project(name: string, specsRoot = 'specs/features'): string {
  const cwd = path.join(temporary, name);
  fs.mkdirSync(cwd, { recursive: true });
  execFileSync('git', ['init'], { cwd, stdio: 'ignore' });
  fs.writeFileSync(path.join(cwd, '.git', 'info', 'exclude'), 'foreign-pattern\n', 'utf8');
  fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, '.sdd-agentic-flow', 'config.yml'),
    `schema: saf-config/v3\n\nspecs:\n  root: ${specsRoot}\n`,
    'utf8',
  );
  return cwd;
}

test('adoption presets keep skill scope independent and are explicit', () => {
  assert.deepEqual(ADOPTION_MODES, ['personal', 'specs-shared', 'team']);
  assert.equal(adoptionModeForScope('personal'), 'user');
  assert.equal(adoptionModeForScope('specs-shared'), 'user');
  assert.equal(adoptionModeForScope('team'), 'project');
});

test('specs.root is repository-relative and traversal-safe', () => {
  assert.equal(normalizeSpecsRoot(temporary, 'specs/features').ok, true);
  assert.equal(normalizeSpecsRoot(temporary, '/tmp/specs').ok, false);
  assert.equal(normalizeSpecsRoot(temporary, 'specs/../outside').ok, false);
});

test('personal uses a custom specs root and never edits .gitignore', () => {
  const cwd = project('custom-root', 'docs/specs');
  const gitignore = path.join(cwd, '.gitignore');
  fs.writeFileSync(gitignore, 'foreign-ignore\n', 'utf8');
  applyAdoption(cwd, 'personal', path.join(cwd, 'home'));
  const exclude = fs.readFileSync(path.join(cwd, '.git/info/exclude'), 'utf8');
  assert.match(exclude, /docs\/specs\//);
  assert.equal(fs.readFileSync(gitignore, 'utf8'), 'foreign-ignore\n');
});

test('personal excludes state and the exact specs root in separate SAF blocks', () => {
  const cwd = project('personal');
  const home = path.join(cwd, 'home');
  configureIntent({ homeDir: home, cwd, scope: 'user', packs: ['full'], adoptionMode: 'personal' });
  const content = fs.readFileSync(path.join(cwd, '.git/info/exclude'), 'utf8');
  assert.match(content, /managed excludes: specs/);
  assert.match(content, /specs\/features\//);
  assert.match(content, /managed excludes: state/);
  assert.match(content, /\.sdd-agentic-flow\//);
  assert.match(content, /foreign-pattern/);
  assert.equal(
    readInstallConfig(home)?.projects[Object.keys(readInstallConfig(home)?.projects || {})[0] || '']
      ?.adoption_mode,
    'personal',
  );
});

test('specs-shared exposes specs while hiding toolkit state', () => {
  const cwd = project('specs-shared');
  applyAdoption(cwd, 'specs-shared', path.join(cwd, 'home'));
  const content = fs.readFileSync(path.join(cwd, '.git/info/exclude'), 'utf8');
  assert.doesNotMatch(content, /specs\/features/);
  assert.match(content, /managed excludes: state/);
  assert.match(content, /foreign-pattern/);
});

test('team keeps official project assets visible and hides only derived state', () => {
  const cwd = project('team');
  const result = applyAdoption(cwd, 'team', path.join(cwd, 'home'));
  const content = fs.readFileSync(path.join(cwd, '.git/info/exclude'), 'utf8');
  assert.equal(result.expected.includes('.agents/skills/'), false);
  assert.doesNotMatch(content, /\.agents\/skills\//);
  assert.match(content, /context\/project-context\.md/);
  assert.match(content, /workspace\.yml/);
  assert.match(content, /reports\//);
  assert.match(content, /foreign-pattern/);
});

test('subprojects anchor specs and local state to the SAF project root', () => {
  const root = path.join(temporary, 'monorepo');
  const cwd = path.join(root, 'apps', 'payments');
  fs.mkdirSync(cwd, { recursive: true });
  execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' });
  fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, '.sdd-agentic-flow', 'config.yml'),
    'schema: saf-config/v3\n\nspecs:\n  root: docs/specs\n',
    'utf8',
  );
  const home = path.join(root, 'home');
  applyAdoption(cwd, 'personal', home);
  const content = fs.readFileSync(path.join(root, '.git', 'info', 'exclude'), 'utf8');
  assert.match(content, /apps\/payments\/docs\/specs\//);
  assert.match(content, /apps\/payments\/\.sdd-agentic-flow\//);
  assert.doesNotMatch(content, /^docs\/specs\//m);
});

test('unclassified intent reports no drift and does not change visibility', () => {
  const cwd = project('unclassified');
  const before = fs.readFileSync(path.join(cwd, '.git/info/exclude'), 'utf8');
  const result = inspectAdoption(cwd, path.join(cwd, 'home'));
  assert.equal(result.mode, 'unclassified');
  assert.deepEqual(result.drift, []);
  assert.equal(fs.readFileSync(path.join(cwd, '.git/info/exclude'), 'utf8'), before);
});

test('missing Git metadata is non-fatal and does not create an exclude file', () => {
  const cwd = path.join(temporary, 'no-git');
  fs.mkdirSync(cwd, { recursive: true });
  const result = applyAdoption(cwd, 'personal', path.join(cwd, 'home'));
  assert.equal(result.changed, false);
  assert.match(result.warning || '', /Git metadata/);
});

test('invalid Git metadata is preserved without an exclude mutation', () => {
  const cwd = path.join(temporary, 'invalid-git');
  fs.mkdirSync(cwd, { recursive: true });
  fs.writeFileSync(path.join(cwd, '.git'), 'gitdir: missing-metadata\n', 'utf8');
  const result = applyAdoption(cwd, 'personal', path.join(cwd, 'home'));
  assert.equal(result.changed, false);
  assert.equal(fs.existsSync(path.join(cwd, '.git', 'info', 'exclude')), false);
});

test('worktree Git metadata receives SAF blocks in the linked metadata directory', () => {
  const cwd = project('worktree');
  const linked = path.join(temporary, 'worktree-metadata');
  fs.rmSync(path.join(cwd, '.git'), { recursive: true, force: true });
  fs.mkdirSync(path.join(linked, 'info'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.git'), `gitdir: ${path.relative(cwd, linked)}\n`, 'utf8');
  applyAdoption(cwd, 'team', path.join(cwd, 'home'));
  assert.match(
    fs.readFileSync(path.join(linked, 'info', 'exclude'), 'utf8'),
    /managed excludes: derived/,
  );
});

test('purge discovery removes only SAF exclude blocks', () => {
  const cwd = project('purge-block');
  applyAdoption(cwd, 'personal', path.join(cwd, 'home'));
  const targets = collectPurgeTargets(cwd, path.join(cwd, 'home'));
  assert.ok(targets.some((target) => target.kind === 'git-exclude-block'));
  removeManagedExcludeBlocksFromFile(path.join(cwd, '.git/info/exclude'));
  assert.match(fs.readFileSync(path.join(cwd, '.git/info/exclude'), 'utf8'), /foreign-pattern/);
});

test('downgrading adoption can remove only untracked SAF project assets', () => {
  const cwd = path.join(temporary, 'tracked-assets');
  fs.mkdirSync(path.join(cwd, '.agents', 'skills', 'saf-route'), { recursive: true });
  fs.mkdirSync(path.join(cwd, '.agents', 'skills', 'saf-setup'), { recursive: true });
  fs.writeFileSync(path.join(cwd, '.agents', 'skills', 'saf-route', 'SKILL.md'), 'tracked\n');
  fs.writeFileSync(path.join(cwd, '.agents', 'skills', 'saf-setup', 'SKILL.md'), 'local\n');
  execFileSync('git', ['init', '-q', cwd]);
  execFileSync('git', ['add', '.agents/skills/saf-route'], { cwd });
  const removed = removeUntrackedProjectAssets(cwd);
  assert.equal(
    removed.some((file) => file.endsWith('saf-setup')),
    true,
  );
  assert.equal(fs.existsSync(path.join(cwd, '.agents/skills/saf-route')), true);
  assert.equal(fs.existsSync(path.join(cwd, '.agents/skills/saf-setup')), false);
});
