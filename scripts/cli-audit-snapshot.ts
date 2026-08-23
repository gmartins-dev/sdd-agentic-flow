import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type SnapshotEntry = {
  path: string;
  type: 'directory' | 'file' | 'symlink';
  size: number;
  sha256?: string;
  target?: string;
};

export type SnapshotRoot = { name: string; path: string };

function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function snapshotPersistentState(roots: SnapshotRoot[]): SnapshotEntry[] {
  const snapshot: SnapshotEntry[] = [];
  for (const root of roots) {
    const visit = (current: string, relative: string) => {
      const stat = fs.lstatSync(current);
      const itemPath = `${root.name}/${relative || '.'}`;
      if (stat.isSymbolicLink()) {
        snapshot.push({
          path: itemPath,
          type: 'symlink',
          size: stat.size,
          target: fs.readlinkSync(current),
        });
        return;
      }
      if (stat.isDirectory()) {
        snapshot.push({ path: itemPath, type: 'directory', size: 0 });
        for (const entry of fs.readdirSync(current)) {
          visit(path.join(current, entry), relative ? path.join(relative, entry) : entry);
        }
        return;
      }
      snapshot.push({ path: itemPath, type: 'file', size: stat.size, sha256: sha256(current) });
    };
    if (fs.existsSync(root.path)) visit(root.path, '');
  }
  return snapshot.sort((left, right) => left.path.localeCompare(right.path));
}

export function assertSnapshotUnchanged(before: SnapshotEntry[], after: SnapshotEntry[]): void {
  assert.deepEqual(after, before);
}
