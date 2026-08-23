import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { snapshotPersistentState } from '../scripts/cli-audit-snapshot.js';

test('snapshot records content changes and entry additions/removals', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-audit-snapshot-'));
  fs.writeFileSync(path.join(root, 'owned.txt'), 'before\n');
  const before = snapshotPersistentState([{ name: 'project', path: root }]);

  fs.writeFileSync(path.join(root, 'owned.txt'), 'after\n');
  fs.writeFileSync(path.join(root, 'added.txt'), 'added\n');
  const changed = snapshotPersistentState([{ name: 'project', path: root }]);

  assert.notDeepEqual(changed, before);
  assert.notEqual(
    changed.find((entry) => entry.path === 'project/owned.txt')?.sha256,
    before.find((entry) => entry.path === 'project/owned.txt')?.sha256,
  );
  assert.equal(
    changed.some((entry) => entry.path === 'project/added.txt'),
    true,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('snapshot records symlink target changes when the host permits symlinks', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-audit-snapshot-'));
  fs.writeFileSync(path.join(root, 'one.txt'), 'one\n');
  fs.writeFileSync(path.join(root, 'two.txt'), 'two\n');
  try {
    fs.symlinkSync('one.txt', path.join(root, 'current'));
  } catch {
    t.skip('host does not permit symlink creation');
    fs.rmSync(root, { recursive: true, force: true });
    return;
  }
  const before = snapshotPersistentState([{ name: 'project', path: root }]);
  fs.unlinkSync(path.join(root, 'current'));
  fs.symlinkSync('two.txt', path.join(root, 'current'));
  const after = snapshotPersistentState([{ name: 'project', path: root }]);
  assert.equal(before.find((entry) => entry.path === 'project/current')?.target, 'one.txt');
  assert.equal(after.find((entry) => entry.path === 'project/current')?.target, 'two.txt');
  assert.notDeepEqual(after, before);
  fs.rmSync(root, { recursive: true, force: true });
});
