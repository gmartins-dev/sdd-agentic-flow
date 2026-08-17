import fs from 'node:fs';
import path from 'node:path';
import { gitInfo } from './project-context';

type PackageJsonPartial = { name?: string };

export type InitDefaults = {
  name: string;
  branch: string;
  agent: string;
};

function readPackageName(cwd: string): string | null {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'),
    ) as PackageJsonPartial;
    return typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : null;
  } catch {
    return null;
  }
}

function inferProjectName(cwd: string): string {
  return readPackageName(cwd) || path.basename(cwd) || 'example-project';
}

function inferDefaultBranch(cwd: string): string {
  const { branch } = gitInfo(cwd);
  if (branch && branch !== 'HEAD') return branch;
  for (const candidate of ['main', 'master']) {
    if (fs.existsSync(path.join(cwd, '.git', 'refs', 'heads', candidate))) return candidate;
  }
  return 'main';
}

function inferAgentTarget(cwd: string): string {
  if (fs.existsSync(path.join(cwd, 'CLAUDE.md'))) return 'claude-code';
  if (fs.existsSync(path.join(cwd, '.cursor'))) return 'cursor';
  if (fs.existsSync(path.join(cwd, 'CODEX.md'))) return 'codex';
  if (
    fs.existsSync(path.join(cwd, '.github', 'copilot-instructions.md')) ||
    fs.existsSync(path.join(cwd, '.vscode', 'settings.json'))
  ) {
    try {
      const settings = fs.readFileSync(path.join(cwd, '.vscode', 'settings.json'), 'utf8');
      if (settings.includes('chat.agentSkillsLocations')) return 'vscode-copilot';
    } catch {
      // ignore unreadable settings
    }
    if (fs.existsSync(path.join(cwd, '.github', 'copilot-instructions.md')))
      return 'vscode-copilot';
  }
  return 'generic';
}

export function inferInitDefaults(cwd: string): InitDefaults {
  return {
    name: inferProjectName(cwd),
    branch: inferDefaultBranch(cwd),
    agent: inferAgentTarget(cwd),
  };
}

export function mergeInitDefaults<T extends InitDefaults>(
  cwd: string,
  options: Partial<T> = {},
): T & InitDefaults {
  const defaults = inferInitDefaults(cwd);
  return {
    ...defaults,
    ...options,
    name: options.name || defaults.name,
    branch: options.branch || defaults.branch,
    agent: options.agent || defaults.agent,
  } as T & InitDefaults;
}
