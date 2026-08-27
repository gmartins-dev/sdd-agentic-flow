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

export type MutationContract = {
  allowAdded?: readonly string[];
  allowChanged?: readonly string[];
  allowRemoved?: readonly string[];
  requireAdded?: readonly string[];
  requireChanged?: readonly string[];
  requireRemoved?: readonly string[];
};

export type StateDiff = {
  added: SnapshotEntry[];
  changed: SnapshotEntry[];
  removed: SnapshotEntry[];
  unexpectedAdded: SnapshotEntry[];
  unexpectedChanged: SnapshotEntry[];
  unexpectedRemoved: SnapshotEntry[];
  missingExpectedAdded: string[];
  missingExpectedChanged: string[];
  missingExpectedRemoved: string[];
};

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

function matchesPath(pathname: string, patterns: readonly string[] = []): boolean {
  return patterns.some((pattern) =>
    pattern.endsWith('/**')
      ? pathname === pattern.slice(0, -3) || pathname.startsWith(`${pattern.slice(0, -3)}/`)
      : pathname === pattern,
  );
}

function sameEntry(left: SnapshotEntry, right: SnapshotEntry): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function changedEntries(before: SnapshotEntry[], after: SnapshotEntry[]): SnapshotEntry[] {
  const previous = new Map(before.map((entry) => [entry.path, entry]));
  return after.filter((entry) => {
    const old = previous.get(entry.path);
    return old !== undefined && !sameEntry(old, entry);
  });
}

export function diffSnapshots(
  before: SnapshotEntry[],
  after: SnapshotEntry[],
  contract: MutationContract = {},
): StateDiff {
  const previous = new Map(before.map((entry) => [entry.path, entry]));
  const current = new Map(after.map((entry) => [entry.path, entry]));
  const added = after.filter((entry) => !previous.has(entry.path));
  const removed = before.filter((entry) => !current.has(entry.path));
  const changed = changedEntries(before, after);
  const unexpectedAdded = added.filter((entry) => !matchesPath(entry.path, contract.allowAdded));
  const unexpectedChanged = changed.filter(
    (entry) => !matchesPath(entry.path, contract.allowChanged),
  );
  const unexpectedRemoved = removed.filter(
    (entry) => !matchesPath(entry.path, contract.allowRemoved),
  );
  const missing = (required: readonly string[] | undefined, entries: SnapshotEntry[]) =>
    (required ?? []).filter(
      (requiredPath) => !entries.some((entry) => matchesPath(entry.path, [requiredPath])),
    );

  return {
    added,
    changed,
    removed,
    unexpectedAdded,
    unexpectedChanged,
    unexpectedRemoved,
    missingExpectedAdded: missing(contract.requireAdded, added),
    missingExpectedChanged: missing(contract.requireChanged, changed),
    missingExpectedRemoved: missing(contract.requireRemoved, removed),
  };
}

export function assertMutationContract(diff: StateDiff): void {
  const unexpected = {
    added: diff.unexpectedAdded.map((entry) => entry.path),
    changed: diff.unexpectedChanged.map((entry) => entry.path),
    removed: diff.unexpectedRemoved.map((entry) => entry.path),
  };
  const missing = {
    added: diff.missingExpectedAdded,
    changed: diff.missingExpectedChanged,
    removed: diff.missingExpectedRemoved,
  };
  assert.deepEqual(unexpected, { added: [], changed: [], removed: [] }, 'unexpected mutation');
  assert.deepEqual(missing, { added: [], changed: [], removed: [] }, 'missing mutation');
}
