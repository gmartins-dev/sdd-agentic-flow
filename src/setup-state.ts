import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { inspectAdoption } from './adoption';
import { configValue, readConfig } from './config-domain';
import { resolveGitContext } from './git-context';
import {
  classifyInstallIntent,
  classifyProvenanceVersion,
  DEFAULT_USER_TARGETS,
  readInstallConfig,
  repositoryKey,
  USER_TARGETS,
} from './install-domain';
import { buildInstallProfilePlan, isPlanEmpty } from './install-preflight';
import { SDD_PATHS, sddJoin, userSkillsDirsForTargets, VERSION } from './paths';
import { OFFICIAL_SKILLS } from './skill-identity';
import { readInstallProvenance } from './upgrade';
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

type UserInstallationSnapshot = {
  state: 'absent' | 'healthy' | 'needs_repair';
  targets: string[];
  reason?: string;
};

function classifySetupState(facts: SetupStateFacts): SetupState {
  const projectArtifactsBlock =
    facts.git !== 'unavailable' && (facts.config === 'invalid' || facts.workspace === 'invalid');
  if (
    projectArtifactsBlock ||
    facts.installationIntent === 'future' ||
    facts.installationIntent === 'unknown' ||
    (facts.blockers?.length ?? 0) > 0
  )
    return 'Blocked';
  if (
    facts.config === 'absent' &&
    facts.workspace === 'absent' &&
    facts.skills === 'absent' &&
    !facts.context &&
    (facts.installationIntent ?? 'none') === 'none'
  )
    return 'Fresh';
  const ready = facts.workspace === 'valid' && facts.skills === 'complete' && facts.context;
  if (!ready) return 'Incomplete';
  return facts.attention || (facts.warnings?.length ?? 0) > 0 ? 'Attention' : 'Ready';
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

function inspectUserInstallation(homeDir = os.homedir()): UserInstallationSnapshot {
  const intent = classifyInstallIntent(homeDir);
  if (intent.kind === 'none') return { state: 'absent', targets: [] };
  if (intent.kind !== 'current') {
    return {
      state: 'needs_repair',
      targets: [],
      reason: `installation intent ${intent.schema} is not compatible with this CLI`,
    };
  }
  let config: ReturnType<typeof readInstallConfig>;
  try {
    config = readInstallConfig(homeDir);
  } catch {
    return {
      state: 'needs_repair',
      targets: [],
      reason: 'the user installation intent could not be read',
    };
  }
  const targets = [...(config?.user.targets || [])];
  if (!targets.length) return { state: 'absent', targets };
  const roots = userSkillsDirsForTargets(targets, homeDir);
  const healthy =
    roots.length === targets.length &&
    targets.every((target, index) => {
      const root = roots[index];
      const provenance = root ? readInstallProvenance(root) : null;
      return Boolean(
        root &&
          targetEvidence(target, root).complete &&
          provenance?.package === 'sdd-agentic-flow' &&
          provenance.schema === 'saf-install-provenance/v3' &&
          provenance.scope === 'user' &&
          provenance.applyState === 'complete',
      );
    });
  return healthy
    ? { state: 'healthy', targets }
    : {
        state: 'needs_repair',
        targets,
        reason: 'one or more selected user skill targets are incomplete',
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

function installationReconciliationPending(
  cwd: string,
  homeDir: string,
  installationIntent: SetupStateFacts['installationIntent'],
): boolean {
  if (installationIntent !== 'current') return false;
  let install: ReturnType<typeof readInstallConfig>;
  try {
    install = readInstallConfig(homeDir);
  } catch {
    return false;
  }
  const projectProfile = (() => {
    try {
      return install?.projects[repositoryKey(cwd)];
    } catch {
      return undefined;
    }
  })();
  const scope = projectProfile?.adoption_mode === 'team' ? 'project' : 'user';
  const profile = scope === 'project' ? projectProfile : install?.user;
  if (!profile) return false;
  const plan = buildInstallProfilePlan({ cwd, homeDir, scope, profile });
  return plan.blocked || !isPlanEmpty(plan);
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
  const adoption = resolveGitContext(cwd).ok ? inspectAdoption(cwd, homeDir) : null;
  if (adoption?.drift.length)
    warnings.push(`adoption visibility drift: ${adoption.drift.join('; ')}`);
  if (installationReconciliationPending(cwd, homeDir, installState.kind))
    warnings.push('installation intent has pending reconciliation');
  for (const target of targets) {
    const provenance = readInstallProvenance(target.root);
    if (
      provenance?.packageVersion &&
      classifyProvenanceVersion(provenance.packageVersion, VERSION) !== 'current'
    )
      warnings.push(`${target.id} target provenance is stale`);
  }
  const blockers: string[] = [];
  for (const target of targets) {
    if (readInstallProvenance(target.root)?.applyState === 'applying')
      blockers.push(`${target.id} target has an interrupted apply`);
  }
  const teamProject = targets.some((target) => target.id === 'project-agents');
  if (!teamProject) {
    const selected = new Set(targets.map((target) => target.id));
    for (const id of Object.keys(USER_TARGETS)) {
      if (selected.has(id)) continue;
      const root = userSkillsDirsForTargets([id], homeDir)[0];
      const provenance = root ? readInstallProvenance(root) : null;
      if (
        provenance?.package === 'sdd-agentic-flow' &&
        provenance.schema === 'saf-install-provenance/v3'
      )
        blockers.push(
          provenance.applyState === 'applying'
            ? `${id} target has an interrupted apply`
            : `${id} target is outside the authoritative selection`,
        );
    }
  }
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
  UserInstallationSnapshot,
};
export {
  classifySetupState,
  collectSetupFacts,
  evaluateSetupReadiness,
  inspectSetupState,
  inspectUserInstallation,
};
