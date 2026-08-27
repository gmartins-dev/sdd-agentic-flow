import fs from 'node:fs';
import path from 'node:path';

import { type AdoptionMode, adoptionModeForScope } from './adoption';
import { AGENT_TO_TARGETS } from './install-domain';
import type { SetupStateSnapshot } from './setup-state';

type SetupHost = keyof typeof AGENT_TO_TARGETS;
type SetupIntent = {
  sharing: AdoptionMode;
  selectedHosts: SetupHost[];
  workflow: 'manual' | 'supervised' | 'autonomous';
  language: 'en-US' | 'pt-BR';
  featureProfile: 'small_fix' | 'medium_feature' | 'large_feature' | 'epic';
};
type SetupPlan = {
  blocked: boolean;
  scope: 'user' | 'project';
  targets: string[];
  expectedState: 'Ready';
  precondition: string;
};

function targetsForHosts(hosts: readonly SetupHost[]): string[] {
  return [...new Set(hosts.flatMap((host) => AGENT_TO_TARGETS[host]))];
}

function setupPrecondition(cwd: string): string {
  const files = [
    '.sdd-agentic-flow/config.yml',
    '.sdd-agentic-flow/workspace.yml',
    '.agents/skills',
  ];
  return files
    .map((file) => {
      const target = path.join(cwd, file);
      const stat = fs.existsSync(target) ? fs.statSync(target) : null;
      return `${file}:${stat ? `${stat.mtimeMs}:${stat.size}` : 'absent'}`;
    })
    .join('|');
}

function resolveSetupPlan(cwd: string, state: SetupStateSnapshot, intent: SetupIntent): SetupPlan {
  const targets = targetsForHosts(intent.selectedHosts);
  return {
    blocked: state.state === 'Blocked' || !targets.length,
    scope: adoptionModeForScope(intent.sharing),
    targets,
    expectedState: 'Ready',
    precondition: setupPrecondition(cwd),
  };
}

function setupPlanIsCurrent(cwd: string, plan: SetupPlan): boolean {
  return plan.precondition === setupPrecondition(cwd);
}

export type { SetupHost, SetupIntent, SetupPlan };
export { resolveSetupPlan, setupPlanIsCurrent, setupPrecondition, targetsForHosts };
