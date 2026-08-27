import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { configValue, readConfig } from './config-domain';
import { resolveGitContext } from './git-context';
import {
  classifyInstallIntent,
  DEFAULT_USER_TARGETS,
  readInstallConfig,
  repositoryKey,
  USER_TARGETS,
} from './install-domain';
import { SDD_PATHS, sddJoin, userSkillsDirsForTargets } from './paths';
import { OFFICIAL_SKILLS } from './skill-identity';
import { WORKSPACE_MARKER } from './workspace';

type SetupState = 'Fresh' | 'Incomplete' | 'Ready' | 'Attention' | 'Blocked';

type SetupTargetEvidence = {
  id: string;
  root: string;
  present: string[];
  missing: string[];
  complete: boolean;
};

type SetupStateFacts = {
  config: 'absent' | 'valid' | 'invalid';
  workspace: 'absent' | 'valid' | 'invalid';
  skills: 'absent' | 'partial' | 'complete';
  context: boolean;
  attention?: boolean;
  homeDir?: string;
  git?: 'available' | 'unavailable';
  installationIntent?: 'none' | 'current' | 'legacy' | 'future' | 'unknown';
  targets?: SetupTargetEvidence[];
  warnings?: string[];
  blockers?: string[];
};

type ReadinessEvidence = {
  warnings: string[];
  blockers: string[];
  targetSet: string[];
  targetEvidence: SetupTargetEvidence[];
};

type SetupStateSnapshot = SetupStateFacts & {
  state: SetupState;
  evidence: ReadinessEvidence;
};

function classifySetupState(facts: SetupStateFacts): SetupState {
  if (
    facts.config === 'invalid' ||
    facts.workspace === 'invalid' ||
    facts.installationIntent === 'future' ||
    facts.installationIntent === 'unknown' ||
    (facts.blockers?.length ?? 0) > 0
  )
    return 'Blocked';
  if (
    facts.config === 'absent' &&
    facts.workspace === 'absent' &&
    facts.skills === 'absent' &&
    !facts.context
  )
    return 'Fresh';
  if (facts.attention || (facts.warnings?.length ?? 0) > 0) return 'Attention';
  return facts.workspace === 'valid' && facts.skills === 'complete' && facts.context
    ? 'Ready'
    : 'Incomplete';
}

function hasSkill(root: string, skill: string): boolean {
  return fs.existsSync(path.join(root, skill, 'SKILL.md'));
}

function targetEvidence(id: string, root: string): SetupTargetEvidence {
  const present = OFFICIAL_SKILLS.filter((skill) => hasSkill(root, skill));
  return {
    id,
    root,
    present,
    missing: OFFICIAL_SKILLS.filter((skill) => !present.includes(skill)),
    complete: present.length === OFFICIAL_SKILLS.length,
  };
}

function targetRoots(cwd: string, homeDir: string, configContent: string | null) {
  const projectRoot = path.join(cwd, '.agents', 'skills');
  const install = (() => {
    try {
      return readInstallConfig(homeDir);
    } catch {
      return null;
    }
  })();
  const projectKey = (() => {
    try {
      return repositoryKey(cwd);
    } catch {
      return null;
    }
  })();
  const projectProfile = projectKey ? install?.projects[projectKey] : undefined;
  if (projectProfile?.adoption_mode === 'team')
    return [{ id: 'project-agents', root: projectRoot }];
  const configuredTarget = configContent ? configValue(configContent, 'target') : null;
  const targetIds = install?.user.targets.length
    ? install.user.targets
    : configuredTarget && Object.hasOwn(USER_TARGETS, configuredTarget)
      ? [configuredTarget]
      : [...DEFAULT_USER_TARGETS];
  const roots = userSkillsDirsForTargets(targetIds, homeDir);
  return targetIds
    .map((id, index) => ({ id, root: roots[index] }))
    .filter((target): target is { id: string; root: string } => Boolean(target.root));
}

function collectSetupFacts(cwd: string, homeDir = os.homedir()): SetupStateFacts {
  const config = readConfig(sddJoin(cwd, 'config.yml'));
  const workspacePath = path.join(cwd, SDD_PATHS.workspace);
  const workspace = !fs.existsSync(workspacePath)
    ? 'absent'
    : fs.readFileSync(workspacePath, 'utf8') === WORKSPACE_MARKER
      ? 'valid'
      : 'invalid';
  const targets = targetRoots(cwd, homeDir, config.content ?? null).map(({ id, root }) =>
    targetEvidence(id, root),
  );
  const hasAnySkills = targets.some((target) => target.present.length > 0);
  const allTargetsComplete = targets.length > 0 && targets.every((target) => target.complete);
  const installState = classifyInstallIntent(homeDir);
  const warnings = targets
    .filter((target) => target.present.length > 0 && !target.complete)
    .map((target) => `${target.id} target is incomplete`);
  const blockers: string[] = [];
  if (installState.kind === 'future' || installState.kind === 'unknown')
    blockers.push(`installation state ${installState.schema} is not recognized`);
  if (installState.kind === 'legacy')
    warnings.push(`legacy installation intent ${installState.schema}`);
  return {
    config: config.ok ? (config.state === 'absent' ? 'absent' : 'valid') : 'invalid',
    workspace,
    skills: allTargetsComplete ? 'complete' : hasAnySkills ? 'partial' : 'absent',
    context: fs.existsSync(sddJoin(cwd, 'context', 'project-context.md')),
    homeDir,
    git: resolveGitContext(cwd).ok ? 'available' : 'unavailable',
    installationIntent: installState.kind,
    targets,
    warnings,
    blockers,
  };
}

function evaluateSetupReadiness(facts: SetupStateFacts): ReadinessEvidence {
  const targetEvidence = facts.targets ?? [];
  return {
    warnings: [...(facts.warnings ?? [])],
    blockers: [...(facts.blockers ?? [])],
    targetSet: targetEvidence.map((target) => target.id),
    targetEvidence,
  };
}

function inspectSetupState(cwd: string, homeDir = os.homedir()): SetupStateSnapshot {
  const facts = collectSetupFacts(cwd, homeDir);
  const evidence = evaluateSetupReadiness(facts);
  const state = classifySetupState(facts);
  return { ...facts, state, evidence };
}

export type {
  ReadinessEvidence,
  SetupState,
  SetupStateFacts,
  SetupStateSnapshot,
  SetupTargetEvidence,
};
export { classifySetupState, collectSetupFacts, evaluateSetupReadiness, inspectSetupState };
