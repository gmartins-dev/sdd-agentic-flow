import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type AdoptionMode, adoptionModeForScope, inspectAdoption } from './adoption';
import type { AutonomyLevel, ExecutionMode } from './config-domain';
import { resolveGitContext } from './git-context';
import { AGENT_TO_TARGETS } from './install-domain';
import { buildInstallPlan, type InstallPlan } from './install-preflight';
import { PACKAGE_ROOT, userSkillsDirsForTargets } from './paths';
import { planRecovery, type RecoveryAction } from './recovery';
import { inspectUserInstallation, type SetupStateSnapshot } from './setup-state';
import { OFFICIAL_SKILLS } from './skill-identity';
import { planWorkspaceInitialization, type WorkspaceInitializationPlan } from './workspace';

type SetupHost = keyof typeof AGENT_TO_TARGETS;
type SetupIntent = {
  sharing: AdoptionMode;
  selectedHosts: SetupHost[];
  workflow: 'manual' | 'supervised' | 'autonomous' | 'custom';
  executionMode?: ExecutionMode;
  autonomyLevel?: AutonomyLevel;
  specsVisibility?: 'local' | 'shared';
  language: 'en-US' | 'pt-BR';
};

type HostDetection = {
  host: SetupHost;
  detected: boolean;
  evidence: string[];
};

type SetupPlanAction = {
  kind: string;
  target: string;
  detail: string;
};

type SetupOperation = 'user-install' | 'workspace-setup' | 'combined';

type SetupPlan = {
  operation: SetupOperation;
  installRequired: boolean;
  blocked: boolean;
  scope: 'user' | 'project';
  targets: string[];
  expectedState: 'Ready' | 'UserInstallationReady';
  precondition: string;
  homeDir?: string;
  intent?: SetupIntent;
  installationPlan: InstallPlan;
  workspacePlan: WorkspaceInitializationPlan;
  cleanupActions: SetupPlanAction[];
  installationIntent: SetupPlanAction[];
  targetReconciliation: SetupPlanAction[];
  adoptionChanges: SetupPlanAction[];
  configMutation: SetupPlanAction[];
  workspaceInitialization: SetupPlanAction[];
  warnings: string[];
  blockers: string[];
  preconditions: { fingerprint: string; inputs: string[] };
  expectedPostconditions: string[];
  recoveryActions: RecoveryAction[];
};

type HostDetectionOptions = {
  cwd?: string;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
};

const HOST_COMMANDS: Record<SetupHost, string[]> = {
  codex: ['codex'],
  cursor: ['cursor'],
  'claude-code': ['claude'],
  'vscode-copilot': ['copilot'],
};

const HOST_DIRECTORIES: Record<SetupHost, string[][]> = {
  codex: [['.codex']],
  cursor: [['.cursor']],
  'claude-code': [['.claude']],
  'vscode-copilot': [['.copilot']],
};

function targetsForHosts(hosts: readonly SetupHost[]): string[] {
  return [...new Set(hosts.flatMap((host) => AGENT_TO_TARGETS[host]))];
}

function executableOnPath(command: string, env: NodeJS.ProcessEnv): string | null {
  const pathEntries = (env.PATH || '').split(path.delimiter).filter(Boolean);
  const extensions =
    process.platform === 'win32' ? (env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';') : [''];
  for (const directory of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${command}${extension}`);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        // A missing PATH entry is only a negative hint.
      }
    }
  }
  return null;
}

function detectSetupHosts({
  cwd = process.cwd(),
  homeDir = os.homedir(),
  env = process.env,
}: HostDetectionOptions = {}): HostDetection[] {
  return (Object.keys(AGENT_TO_TARGETS) as SetupHost[]).map((host) => {
    const evidence: string[] = [];
    for (const command of HOST_COMMANDS[host]) {
      const found = executableOnPath(command, env);
      if (found) evidence.push(`PATH:${command}`);
    }
    for (const segments of HOST_DIRECTORIES[host]) {
      if (fs.existsSync(path.join(homeDir, ...segments)))
        evidence.push(`home:${segments.join('/')}`);
    }
    if (host === 'codex' && fs.existsSync(path.join(cwd, '.codex')))
      evidence.push('project:.codex');
    return { host, detected: evidence.length > 0, evidence };
  });
}

function stableMetadata(file: string): string {
  try {
    const stat = fs.statSync(file);
    const hash = stat.isFile()
      ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16)
      : 'directory';
    return `${file}:${stat.mode}:${stat.size}:${stat.mtimeMs}:${hash}`;
  } catch {
    return `${file}:absent`;
  }
}

function setupPrecondition(cwd: string, homeDir = os.homedir(), intent?: SetupIntent): string {
  const files = [
    path.join(cwd, '.sdd-agentic-flow', 'config.yml'),
    path.join(cwd, '.sdd-agentic-flow', 'workspace.yml'),
    path.join(cwd, '.agents', 'skills'),
    path.join(homeDir, '.sdd-agentic-flow', 'install.yml'),
  ];
  const normalizedIntent = intent
    ? JSON.stringify({ ...intent, selectedHosts: [...intent.selectedHosts].sort() })
    : '';
  return crypto
    .createHash('sha256')
    .update([...files.map(stableMetadata), `intent:${normalizedIntent}`].join('|'))
    .digest('hex');
}

function action(kind: string, target: string, detail: string): SetupPlanAction {
  return { kind, target, detail };
}

function resolveSetupPlan(
  cwd: string,
  state: SetupStateSnapshot,
  intent: SetupIntent,
  homeDir = state.homeDir || os.homedir(),
): SetupPlan {
  const targets = targetsForHosts(intent.selectedHosts);
  const git = resolveGitContext(cwd);
  const userInstallation = inspectUserInstallation(homeDir);
  const operation: SetupOperation = !git.ok
    ? 'user-install'
    : userInstallation.state === 'healthy'
      ? 'workspace-setup'
      : 'combined';
  const scope = !git.ok ? 'user' : adoptionModeForScope(intent.sharing);
  const blockers = [...state.evidence.blockers];
  if (!targets.length && scope === 'user')
    blockers.push('at least one coding-agent host must be selected');
  if (state.state === 'Blocked' && !blockers.length && operation !== 'user-install')
    blockers.push('current setup state is blocked');
  const precondition = setupPrecondition(cwd, homeDir, intent);
  const installationPlan = buildInstallPlan({
    packageRoot: PACKAGE_ROOT,
    skills: OFFICIAL_SKILLS,
    officialSkills: OFFICIAL_SKILLS,
    scope,
    modeLabel: scope === 'project' ? 'Project / Team' : 'Local / User',
    targetIds: scope === 'project' ? ['project-agents'] : targets,
    targets:
      scope === 'project'
        ? [path.join(cwd, '.agents', 'skills')]
        : userSkillsDirsForTargets(targets, homeDir),
  });
  const plannedWorkspace = planWorkspaceInitialization(cwd, homeDir);
  const workspacePlan = { ...plannedWorkspace, adoptionMode: intent.sharing };
  if (installationPlan.blocked && installationPlan.blockerReason)
    blockers.push(installationPlan.blockerReason);
  if (workspacePlan.applicability === 'blocked' && workspacePlan.error)
    blockers.push(workspacePlan.error);
  const installRequired =
    operation !== 'workspace-setup' ||
    installationPlan.totals.CREATE > 0 ||
    installationPlan.totals.UPDATE > 0 ||
    installationPlan.totals.REMOVE > 0;
  const adoption = inspectAdoption(cwd, homeDir);
  const recovery = planRecovery({
    setupState: state.state,
    ...(state.installationIntent ? { installationKind: state.installationIntent } : {}),
    installationDrift: installationPlan.blocked,
    projectDrift: workspacePlan.applicability === 'blocked',
    sourceControlVisibilityDrift: adoption.sourceControlVisibilityDrift,
    collision: installationPlan.totals.COLLISION > 0,
    gitAvailable: Boolean(workspacePlan.git),
  });
  const targetReconciliation = targets.map((target) =>
    action('reconcile-target', target, `install or update the official skill bundle for ${target}`),
  );
  return {
    operation,
    installRequired,
    blocked: blockers.length > 0,
    scope,
    targets,
    expectedState: operation === 'user-install' ? 'UserInstallationReady' : 'Ready',
    precondition,
    homeDir,
    intent,
    installationPlan,
    workspacePlan,
    cleanupActions:
      state.installationIntent === 'legacy'
        ? [
            action(
              'cleanup-legacy',
              'SAF-owned legacy state',
              'remove only exact recognized legacy paths',
            ),
          ]
        : [],
    installationIntent: [
      action(
        'persist-intent',
        path.join(homeDir, '.sdd-agentic-flow', 'install.yml'),
        'persist selected targets and adoption',
      ),
    ],
    targetReconciliation,
    adoptionChanges:
      workspacePlan.applicability === 'applicable'
        ? [
            action(
              'adoption',
              scope,
              'synchronize managed Git visibility for the selected sharing mode',
            ),
          ]
        : [],
    configMutation: [
      action(
        'config',
        '.sdd-agentic-flow/config.yml',
        'persist only selected non-default managed values',
      ),
    ],
    workspaceInitialization:
      workspacePlan.applicability === 'applicable'
        ? [
            action(
              'workspace',
              '.sdd-agentic-flow/workspace.yml',
              'initialize workspace and generated context',
            ),
          ]
        : [],
    warnings: [...state.evidence.warnings],
    blockers,
    preconditions: {
      fingerprint: precondition,
      inputs: [
        'project config',
        'workspace marker',
        'target roots',
        'installation intent',
        'resolved intent',
      ],
    },
    expectedPostconditions: [
      'all selected target roots contain the official skill bundle',
      ...(operation === 'user-install'
        ? ['user-scoped installation is complete and projects remain unconfigured']
        : ['workspace marker and project context are valid']),
      ...(operation === 'user-install'
        ? []
        : ['setup inspection returns Ready or Attention without blockers']),
    ],
    recoveryActions: recovery.actions,
  };
}

function setupPlanIsCurrent(
  cwd: string,
  plan: SetupPlan,
  homeDir = plan.homeDir || os.homedir(),
): boolean {
  return plan.precondition === setupPrecondition(cwd, homeDir, plan.intent);
}

export type {
  HostDetection,
  HostDetectionOptions,
  SetupHost,
  SetupIntent,
  SetupOperation,
  SetupPlan,
  SetupPlanAction,
};
export {
  detectSetupHosts,
  resolveSetupPlan,
  setupPlanIsCurrent,
  setupPrecondition,
  targetsForHosts,
};
