import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type GitContext = {
  projectRoot: string;
  gitRoot: string;
  gitCommonDir: string;
  projectRelativePath: string;
  adoptionKey: string;
  excludePath: string;
};

export type GitContextResult = { ok: true; context: GitContext } | { ok: false; error: string };

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function identityPath(value: string): string {
  const normalized = path.normalize(value).replaceAll('\\', '/');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function canonicalCommonDir(value: string): string {
  const normalized = value.replaceAll('\\', '/');
  const marker = '/worktrees/';
  const index = normalized.toLowerCase().indexOf(marker);
  return index >= 0 ? normalized.slice(0, index) : normalized;
}

export function resolveGitContext(cwd: string): GitContextResult {
  const projectRoot = fs.realpathSync(cwd);
  try {
    const gitRoot = fs.realpathSync(git(projectRoot, 'rev-parse', '--show-toplevel'));
    const commonRaw = git(projectRoot, 'rev-parse', '--path-format=absolute', '--git-common-dir');
    const gitDirRaw = git(projectRoot, 'rev-parse', '--git-dir');
    const gitCommonDir = fs.realpathSync(
      path.isAbsolute(commonRaw) ? commonRaw : path.resolve(projectRoot, commonRaw),
    );
    const prefix = git(projectRoot, 'rev-parse', '--show-prefix');
    const projectRelativePath = prefix ? prefix.replaceAll('\\', '/').replace(/\/$/, '') : '.';
    const identityRelativePath = /[\\/]worktrees[\\/]/i.test(gitDirRaw) ? '.' : projectRelativePath;
    if (projectRelativePath === '..' || projectRelativePath.startsWith('../')) {
      return { ok: false, error: 'workspace root must be inside the Git worktree' };
    }
    const adoptionKey = crypto
      .createHash('sha256')
      .update(`${identityPath(canonicalCommonDir(gitCommonDir))}\0${identityRelativePath}`)
      .digest('hex')
      .slice(0, 16);
    return {
      ok: true,
      context: {
        projectRoot,
        gitRoot,
        gitCommonDir,
        projectRelativePath,
        adoptionKey,
        excludePath: path.join(gitCommonDir, 'info', 'exclude'),
      },
    };
  } catch {
    return {
      ok: false,
      error: 'Git repository metadata is required; run init from a Git workspace',
    };
  }
}
