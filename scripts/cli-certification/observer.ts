import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { type SnapshotEntry, snapshotPersistentState } from '../cli-audit-snapshot.js';
import type { CertificationSandbox } from './adapters.js';

export type ObservedCliState = {
  entries: SnapshotEntry[];
  gitStatus: string;
  gitExclude: string;
  gitignore: string;
};

function readOrEmpty(file: string): string {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

export function observeSandbox(sandbox: CertificationSandbox): ObservedCliState {
  const gitStatus = spawnSync('git', ['status', '--porcelain'], {
    cwd: sandbox.cwd,
    encoding: 'utf8',
  });
  return {
    entries: snapshotPersistentState([
      { name: 'project', path: sandbox.cwd },
      { name: 'home', path: sandbox.home },
    ]),
    gitStatus: gitStatus.stdout,
    gitExclude: readOrEmpty(path.join(sandbox.cwd, '.git', 'info', 'exclude')),
    gitignore: readOrEmpty(path.join(sandbox.cwd, '.gitignore')),
  };
}
