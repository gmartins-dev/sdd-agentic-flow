import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  materializeCleanClone,
  materializeDirtyGitClone,
  materializeDirtySnapshot,
} from '../scripts/cli-audit-source.js';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'SAF test',
      GIT_AUTHOR_EMAIL: 'saf-test@example.invalid',
      GIT_COMMITTER_NAME: 'SAF test',
      GIT_COMMITTER_EMAIL: 'saf-test@example.invalid',
    },
  }).trim();
}

test('materializes a clean candidate in an independent Git clone', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-audit-source-'));
  const source = path.join(root, 'source');
  const clone = path.join(root, 'clone');
  fs.mkdirSync(source);
  git(source, ['init', '-q']);
  fs.writeFileSync(path.join(source, 'tracked.txt'), 'v1\n');
  git(source, ['add', 'tracked.txt']);
  git(source, ['commit', '-q', '-m', 'fixture']);
  const commit = git(source, ['rev-parse', 'HEAD']);

  const identity = materializeCleanClone(source, clone);

  assert.deepEqual(identity, { baseCommit: commit, dirty: false, candidateType: 'commit-clone' });
  assert.equal(fs.readFileSync(path.join(clone, 'tracked.txt'), 'utf8'), 'v1\n');
  assert.equal(git(clone, ['rev-parse', 'HEAD']), commit);
  assert.notEqual(
    fs.realpathSync(path.join(source, '.git')),
    fs.realpathSync(path.join(clone, '.git')),
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('materializes a dirty snapshot without local build and workflow state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-audit-source-'));
  const source = path.join(root, 'source');
  const snapshot = path.join(root, 'snapshot');
  fs.mkdirSync(source);
  git(source, ['init', '-q']);
  fs.writeFileSync(path.join(source, 'tracked.txt'), 'initial\n');
  git(source, ['add', 'tracked.txt']);
  git(source, ['commit', '-q', '-m', 'fixture']);
  fs.writeFileSync(path.join(source, 'tracked.txt'), 'changed working tree\n');
  fs.mkdirSync(path.join(source, 'dist'));
  fs.writeFileSync(path.join(source, 'dist', 'generated.js'), 'generated\n');
  fs.mkdirSync(path.join(source, '.local'));

  const identity = materializeDirtySnapshot(source, snapshot);

  assert.equal(identity.candidateType, 'working-tree-snapshot');
  assert.equal(identity.dirty, true);
  assert.equal(
    fs.readFileSync(path.join(snapshot, 'tracked.txt'), 'utf8'),
    'changed working tree\n',
  );
  assert.equal(fs.existsSync(path.join(snapshot, '.git')), false);
  assert.equal(fs.existsSync(path.join(snapshot, 'dist')), false);
  assert.equal(fs.existsSync(path.join(snapshot, '.local')), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('materializes a dirty candidate with independent Git metadata', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-audit-source-'));
  const source = path.join(root, 'source');
  const clone = path.join(root, 'dirty-git');
  fs.mkdirSync(source);
  git(source, ['init', '-q']);
  fs.writeFileSync(path.join(source, 'tracked.txt'), 'initial\n');
  git(source, ['add', 'tracked.txt']);
  git(source, ['commit', '-q', '-m', 'fixture']);
  fs.writeFileSync(path.join(source, 'tracked.txt'), 'changed\n');

  const identity = materializeDirtyGitClone(source, clone);

  assert.deepEqual(identity, {
    baseCommit: git(source, ['rev-parse', 'HEAD']),
    dirty: true,
    candidateType: 'working-tree-git-clone',
  });
  assert.equal(fs.readFileSync(path.join(clone, 'tracked.txt'), 'utf8'), 'changed\n');
  assert.equal(git(clone, ['status', '--porcelain']).includes('tracked.txt'), true);
  fs.rmSync(root, { recursive: true, force: true });
});
