import fs from 'node:fs';
import path from 'node:path';

import { configValue, readConfig } from './config-domain';
import { SDD_PATHS, sddJoin, userSkillsDirsFor } from './paths';
import { OFFICIAL_SKILLS } from './skill-identity';
import { WORKSPACE_MARKER } from './workspace';

type SetupState = 'Fresh' | 'Incomplete' | 'Ready' | 'Attention' | 'Blocked';

type SetupStateFacts = {
  config: 'absent' | 'valid' | 'invalid';
  workspace: 'absent' | 'valid' | 'invalid';
  skills: 'absent' | 'partial' | 'complete';
  context: boolean;
  attention?: boolean;
};

type SetupStateSnapshot = SetupStateFacts & { state: SetupState };

function classifySetupState(facts: SetupStateFacts): SetupState {
  if (facts.config === 'invalid' || facts.workspace === 'invalid') return 'Blocked';
  if (
    facts.config === 'absent' &&
    facts.workspace === 'absent' &&
    facts.skills === 'absent' &&
    !facts.context
  )
    return 'Fresh';
  if (facts.attention) return 'Attention';
  return facts.workspace === 'valid' && facts.skills === 'complete' && facts.context
    ? 'Ready'
    : 'Incomplete';
}

function hasSkill(root: string, skill: string): boolean {
  return fs.existsSync(path.join(root, skill, 'SKILL.md'));
}

function skillsState(cwd: string, configContent: string | null): SetupStateFacts['skills'] {
  const projectRoot = path.join(cwd, '.agents', 'skills');
  const configured = configContent ? configValue(configContent, 'target') : null;
  const roots = [projectRoot, ...(userSkillsDirsFor(configured) ?? [])];
  const count = Math.max(
    ...roots.map((root) => OFFICIAL_SKILLS.filter((skill) => hasSkill(root, skill)).length),
  );
  return count === OFFICIAL_SKILLS.length ? 'complete' : count ? 'partial' : 'absent';
}

function inspectSetupState(cwd: string): SetupStateSnapshot {
  const config = readConfig(sddJoin(cwd, 'config.yml'));
  const workspacePath = path.join(cwd, SDD_PATHS.workspace);
  const workspace = !fs.existsSync(workspacePath)
    ? 'absent'
    : fs.readFileSync(workspacePath, 'utf8') === WORKSPACE_MARKER
      ? 'valid'
      : 'invalid';
  const facts: SetupStateFacts = {
    config: config.ok ? (config.state === 'absent' ? 'absent' : 'valid') : 'invalid',
    workspace,
    skills: skillsState(cwd, config.content ?? null),
    context: fs.existsSync(sddJoin(cwd, 'context', 'project-context.md')),
  };
  return { ...facts, state: classifySetupState(facts) };
}

export type { SetupState, SetupStateFacts, SetupStateSnapshot };
export { classifySetupState, inspectSetupState };
