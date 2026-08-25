import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { gitInfoExcludePath, gitMetadataDir } from '../src/paths';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-git-metadata-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

test('Git metadata resolver handles normal checkout and linked worktree gitfile', () => {
  const normal = path.join(temporary, 'normal');
  const worktree = path.join(temporary, 'worktree');
  const metadata = path.join(temporary, 'metadata');
  fs.mkdirSync(path.join(normal, '.git'), { recursive: true });
  fs.mkdirSync(path.join(metadata, 'info'), { recursive: true });
  fs.mkdirSync(worktree, { recursive: true });
  fs.writeFileSync(path.join(worktree, '.git'), `gitdir: ${path.relative(worktree, metadata)}\n`);

  assert.equal(gitMetadataDir(normal), path.join(normal, '.git'));
  assert.equal(gitMetadataDir(worktree), metadata);
  assert.equal(gitInfoExcludePath(worktree), path.join(metadata, 'info', 'exclude'));
});

test('Git metadata resolver treats missing and malformed metadata as unavailable', () => {
  const missing = path.join(temporary, 'missing');
  const malformed = path.join(temporary, 'malformed');
  fs.mkdirSync(missing, { recursive: true });
  fs.mkdirSync(malformed, { recursive: true });
  fs.writeFileSync(path.join(malformed, '.git'), 'not a gitfile\n');
  assert.equal(gitMetadataDir(missing), null);
  assert.equal(gitInfoExcludePath(malformed), null);
});
