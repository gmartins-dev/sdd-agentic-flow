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

function comparablePath(value: string): string {
  const normalized = path.normalize(path.resolve(value));
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function relativeProjectPath(gitRoot: string, projectRoot: string): string {
  const root = comparablePath(gitRoot);
  const project = comparablePath(projectRoot);
  if (project === root) return '.';
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (project.startsWith(prefix)) return project.slice(prefix.length).replaceAll(path.sep, '/');
  return path.relative(root, project).replaceAll(path.sep, '/') || '.';
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

export function resolveGitContext(cwd: string): GitContextResult {
  const projectRoot = fs.realpathSync(cwd);
  try {
    const gitRoot = fs.realpathSync(git(projectRoot, 'rev-parse', '--show-toplevel'));
    const commonRaw = git(projectRoot, 'rev-parse', '--git-common-dir');
    const gitCommonDir = fs.realpathSync(
      path.isAbsolute(commonRaw) ? commonRaw : path.resolve(projectRoot, commonRaw),
    );
    const projectRelativePath = relativeProjectPath(gitRoot, projectRoot);
    if (projectRelativePath === '..' || projectRelativePath.startsWith('../')) {
      return { ok: false, error: 'workspace root must be inside the Git worktree' };
    }
    const adoptionKey = crypto
      .createHash('sha256')
      .update(`${gitCommonDir}\0${projectRelativePath}`)
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
