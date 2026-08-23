import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type CandidateSourceIdentity = {
  baseCommit: string;
  dirty: boolean;
  candidateType: 'commit-clone' | 'working-tree-snapshot' | 'working-tree-git-clone';
};

const excludedRoots = new Set([
  '.git',
  '.local',
  '.sdd-agentic-flow',
  '.specs',
  'dist',
  'node_modules',
]);

function git(source: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: source,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function assertDestination(source: string, destination: string): void {
  const sourcePath = path.resolve(source);
  const destinationPath = path.resolve(destination);
  if (sourcePath === destinationPath)
    throw new Error('audit source destination must differ from source');
  if (fs.existsSync(destinationPath))
    throw new Error(`audit source destination already exists: ${destinationPath}`);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
}

function copyWorkingTree(source: string, destination: string): void {
  fs.cpSync(source, destination, {
    recursive: true,
    filter: (entry) => {
      const relative = path.relative(source, entry);
      const first = relative.split(path.sep)[0] ?? '';
      return relative === '' || !excludedRoots.has(first);
    },
  });
}

export function sourceIdentity(source: string): CandidateSourceIdentity {
  const status = git(source, ['status', '--porcelain']);
  return {
    baseCommit: git(source, ['rev-parse', 'HEAD']),
    dirty: Boolean(status),
    candidateType: 'commit-clone',
  };
}

export function materializeCleanClone(
  source: string,
  destination: string,
  commit?: string,
): CandidateSourceIdentity {
  assertDestination(source, destination);
  const baseCommit = commit ?? git(source, ['rev-parse', 'HEAD']);
  execFileSync(
    'git',
    [
      '-c',
      'core.autocrlf=false',
      'clone',
      '--local',
      '--no-hardlinks',
      '--no-checkout',
      source,
      destination,
    ],
    {
      stdio: 'pipe',
    },
  );
  execFileSync('git', ['config', 'core.autocrlf', 'false'], {
    cwd: destination,
    stdio: 'pipe',
  });
  execFileSync('git', ['checkout', '--detach', baseCommit], { cwd: destination, stdio: 'pipe' });
  return { baseCommit, dirty: false, candidateType: 'commit-clone' };
}

export function materializeDirtySnapshot(
  source: string,
  destination: string,
): CandidateSourceIdentity {
  assertDestination(source, destination);
  const identity = sourceIdentity(source);
  copyWorkingTree(source, destination);
  return { ...identity, candidateType: 'working-tree-snapshot' };
}

export function materializeDirtyGitClone(
  source: string,
  destination: string,
): CandidateSourceIdentity {
  const identity = materializeCleanClone(source, destination);
  copyWorkingTree(source, destination);
  return { ...identity, dirty: true, candidateType: 'working-tree-git-clone' };
}

export function createAuditSource(
  mode: 'clean' | 'dirty' | 'dirty-git',
  source: string,
  destination: string,
  commit?: string,
) {
  return mode === 'clean'
    ? materializeCleanClone(source, destination, commit)
    : mode === 'dirty-git'
      ? materializeDirtyGitClone(source, destination)
      : materializeDirtySnapshot(source, destination);
}

function main(): void {
  const [mode, source, destination, commit] = process.argv.slice(2);
  if ((mode !== 'clean' && mode !== 'dirty' && mode !== 'dirty-git') || !source || !destination) {
    throw new Error(
      'usage: cli-audit-source <clean|dirty|dirty-git> <source> <destination> [commit]',
    );
  }
  const identity = createAuditSource(mode, source, destination, commit);
  process.stdout.write(`${JSON.stringify(identity)}${os.EOL}`);
}

if (require.main === module) main();
