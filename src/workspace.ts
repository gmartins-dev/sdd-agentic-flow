import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type AdoptionMode, expectedExcludes, inspectAdoption } from './adoption';
import { configureIntent } from './configure';
import { type GitContext, resolveGitContext } from './git-context';
import { classifyInstallIntent, readInstallConfig } from './install-domain';
import { SDD_PATHS } from './paths';
import { discoverProject } from './project-context';

const WORKSPACE_MARKER = 'schema: saf-workspace/v1\n';

export type WorkspaceInitializationPlan = {
  ok: boolean;
  applicability: 'applicable' | 'not_applicable' | 'blocked';
  error?: string;
  git?: GitContext;
  adoptionMode?: AdoptionMode;
  create: string[];
  preserve: string[];
  excludes: string[];
  createsConfig: false;
};

export function planWorkspaceInitialization(
  cwd: string,
  homeDir: string = os.homedir(),
): WorkspaceInitializationPlan {
  const resolved = resolveGitContext(cwd);
  if (!resolved.ok)
    return {
      ok: false,
      applicability: 'not_applicable',
      error: resolved.error,
      create: [],
      preserve: [],
      excludes: [],
      createsConfig: false,
    };

  const marker = path.join(cwd, SDD_PATHS.workspace);
  if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') !== WORKSPACE_MARKER) {
    return {
      ok: false,
      applicability: 'blocked',
      error: `${SDD_PATHS.workspace} is invalid or unsupported; preserved without changes`,
      git: resolved.context,
      create: [],
      preserve: [SDD_PATHS.workspace],
      excludes: [],
      createsConfig: false,
    };
  }
  const intentState = classifyInstallIntent(homeDir);
  if (intentState.kind !== 'none' && intentState.kind !== 'current') {
    return {
      ok: false,
      applicability: 'blocked',
      error: `installation intent ${intentState.schema} is incompatible; repair the SAF installation before initializing this workspace`,
      git: resolved.context,
      create: [],
      preserve: [],
      excludes: [],
      createsConfig: false,
    };
  }
  const intent = readInstallConfig(homeDir);
  const profile = intent?.projects[resolved.context.adoptionKey];
  const adoptionMode = profile?.adoption_mode || 'personal';
  const adoption = inspectAdoption(cwd, homeDir);
  const contextExists = fs.existsSync(path.join(cwd, SDD_PATHS.projectContext));
  return {
    ok: true,
    applicability: 'applicable',
    git: resolved.context,
    adoptionMode,
    create: [
      ...(!fs.existsSync(marker) ? [SDD_PATHS.workspace] : []),
      ...(!contextExists ? [SDD_PATHS.projectContext] : []),
      ...(!profile ? ['~/.sdd-agentic-flow/install.yml'] : []),
    ],
    preserve: [
      ...(fs.existsSync(marker) ? [SDD_PATHS.workspace] : []),
      ...(contextExists ? [SDD_PATHS.projectContext] : []),
      ...(fs.existsSync(path.join(cwd, SDD_PATHS.config)) ? [SDD_PATHS.config] : []),
    ],
    excludes: expectedExcludes(
      adoptionMode,
      adoption.specsRoot,
      resolved.context.projectRelativePath,
      adoption.specsVisibility,
    ),
    createsConfig: false,
  };
}

export function applyWorkspaceInitialization(
  plan: WorkspaceInitializationPlan,
  homeDir: string = os.homedir(),
): { ok: boolean; error?: string } {
  if (!plan.ok || !plan.git || !plan.adoptionMode)
    return { ok: false, error: plan.error || 'workspace initialization plan is not applicable' };
  const marker = path.join(plan.git.projectRoot, SDD_PATHS.workspace);
  if (!fs.existsSync(marker)) {
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, WORKSPACE_MARKER, 'utf8');
  }
  configureIntent({
    homeDir,
    cwd: plan.git.projectRoot,
    scope: plan.adoptionMode === 'team' ? 'project' : 'user',
    adoptionMode: plan.adoptionMode,
  });
  if (!fs.existsSync(path.join(plan.git.projectRoot, SDD_PATHS.projectContext)))
    discoverProject(plan.git.projectRoot, { force: false, quiet: true });
  return { ok: true };
}

export { WORKSPACE_MARKER };
