import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_USER_TARGETS,
  type InstallConfig,
  type InstallProjectProfile,
} from './install-domain';
import { PACKAGE_ROOT, userSkillsDirsForTargets } from './paths';
import { isLegacySkillName, OFFICIAL_SKILLS } from './skill-identity';
import {
  type ClassifiedPairs,
  classifyManagedPairs,
  collectManagedPairs,
  type ManagedPair,
  readInstallProvenance,
} from './upgrade';

const USER_TARGET_LABELS = {
  agents: 'Shared Agent Skills',
  cursor: 'Cursor',
  claude: 'Claude Code',
  copilot: 'GitHub Copilot',
} as const;

type InstallScope = 'user' | 'project';

type ActionTotals = {
  CREATE: number;
  UPDATE: number;
  PRESERVE: number;
  REMOVE: number;
  COLLISION: number;
  MANAGED_MODIFIED: number;
  PARTIAL: number;
  BLOCKED: number;
};

type TargetReport = {
  targetRoot: string;
  label: string;
  pairs: ManagedPair[];
  classified: ClassifiedPairs;
  managed: boolean;
  legacy: boolean;
  summary: ActionTotals;
  partialWarnings: string[];
  foreignSkills: string[];
  staleManagedSkills: string[];
  blocked: boolean;
};

type InstallPlan = {
  modeLabel: string;
  scope: InstallScope;
  targetIds: string[];
  targets: TargetReport[];
  totals: ActionTotals;
  blocked: boolean;
  applicability: 'applicable' | 'blocked';
  blockerReason?: string;
  requestedScope?: InstallScope | 'unresolved';
  repositoryChanges: string[];
};

type BuildInstallPlanInput = {
  packageRoot: string;
  skills: readonly string[];
  targets: string[];
  officialSkills: readonly string[];
  scope: InstallScope;
  modeLabel?: string;
  selectedTargets?: string[] | null;
  targetIds?: string[];
};

type InstallProfilePlanInput = {
  cwd: string;
  homeDir: string;
  scope: string;
  profile: InstallConfig['user'] | InstallProjectProfile;
};

type ApplyInstallSummary = {
  installed: number;
  updated: number;
  preserved: number;
  removed: number;
};

type ApplyInstallResult = {
  ok: boolean;
  blocked: boolean;
  report: TargetReport;
  summary: ApplyInstallSummary;
};

function targetLabelFor(dir: string, scope: InstallScope = 'user'): string {
  if (scope === 'project') return 'Project .agents/skills';
  const normalized = dir.replace(/\\/g, '/');
  if (normalized.includes('/.cursor/skills')) return USER_TARGET_LABELS.cursor;
  if (normalized.includes('/.claude/skills')) return USER_TARGET_LABELS.claude;
  if (normalized.includes('/.copilot/skills')) return USER_TARGET_LABELS.copilot;
  return USER_TARGET_LABELS.agents;
}

function skillDirPartial(skillDir: string): boolean {
  if (!fs.existsSync(skillDir)) return false;
  return !fs.existsSync(path.join(skillDir, 'SKILL.md'));
}

function classifyTargetRoot(
  packageRoot: string,
  skills: readonly string[],
  targetRoot: string,
  officialSkills: readonly string[],
  scope: InstallScope = 'user',
): TargetReport {
  const pairs = collectManagedPairs(packageRoot, skills, targetRoot);
  const classified = classifyManagedPairs(pairs);
  const provenance = readInstallProvenance(targetRoot);
  const managed = Boolean(
    provenance?.package === 'sdd-agentic-flow' && provenance.schema === 'saf-install-provenance/v3',
  );
  const legacy =
    Boolean(
      provenance?.package === 'sdd-agentic-flow' &&
        provenance.schema !== 'saf-install-provenance/v3',
    ) ||
    (fs.existsSync(targetRoot) &&
      fs
        .readdirSync(targetRoot)
        .some((name) => name !== 'sdd-agentic-flow-shared' && isLegacySkillName(name)));
  const entries: { skill: string; class: string; targetRoot: string }[] = [];
  let collisions = 0;
  const partialWarnings: string[] = [];
  const staleManagedSkills = managed
    ? (provenance?.managedSkills || []).filter(
        (skill) => !skills.includes(skill) && fs.existsSync(path.join(targetRoot, skill)),
      )
    : [];

  for (const skill of skills) {
    const destSkill = path.join(targetRoot, skill);
    if (!fs.existsSync(destSkill)) continue;
    if (skillDirPartial(destSkill)) {
      partialWarnings.push(skill);
      continue;
    }
    if (!managed && officialSkills.includes(skill)) {
      entries.push({ skill, class: 'FOREIGN', targetRoot });
      collisions += 1;
    }
  }

  const summary: ActionTotals = {
    CREATE: classified.missing.length,
    UPDATE: managed ? classified.differs.length : 0,
    PRESERVE: classified.identical.length,
    REMOVE: staleManagedSkills.length,
    COLLISION: collisions,
    MANAGED_MODIFIED: classified.differs.length,
    PARTIAL: partialWarnings.length,
    BLOCKED: legacy ? 1 : 0,
  };

  return {
    targetRoot,
    label: targetLabelFor(targetRoot, scope),
    pairs,
    classified,
    managed,
    legacy,
    summary,
    partialWarnings,
    foreignSkills: entries.map((entry) => entry.skill),
    staleManagedSkills,
    blocked: collisions > 0 || legacy,
  };
}

function buildInstallPlan({
  packageRoot,
  skills,
  targets,
  officialSkills,
  scope,
  modeLabel = 'Local / User',
  selectedTargets = null,
  targetIds = [],
}: BuildInstallPlanInput): InstallPlan {
  const targetReports: TargetReport[] = [];
  const totals: ActionTotals = {
    CREATE: 0,
    UPDATE: 0,
    PRESERVE: 0,
    REMOVE: 0,
    COLLISION: 0,
    MANAGED_MODIFIED: 0,
    PARTIAL: 0,
    BLOCKED: 0,
  };
  for (const targetRoot of targets) {
    const label = targetLabelFor(targetRoot, scope);
    if (selectedTargets && !selectedTargets.includes(label)) continue;
    const report = classifyTargetRoot(packageRoot, skills, targetRoot, officialSkills, scope);
    targetReports.push(report);
    for (const key of Object.keys(totals) as (keyof ActionTotals)[]) {
      totals[key] += report.summary[key] || 0;
    }
  }
  const blocked = totals.COLLISION > 0 || totals.BLOCKED > 0;
  return {
    modeLabel,
    scope,
    targetIds,
    targets: targetReports,
    totals,
    blocked,
    applicability: blocked ? 'blocked' : 'applicable',
    requestedScope: scope,
    repositoryChanges:
      scope === 'project'
        ? [
            ...officialSkills.map((skill) => `.agents/skills/${skill}/`),
            '.agents/skills/sdd-agentic-flow-shared/',
          ]
        : [],
  };
}

function buildInstallProfilePlan({ cwd, homeDir, scope, profile }: InstallProfilePlanInput) {
  const userProfile = 'targets' in profile;
  const targetIds =
    scope === 'project'
      ? ['project-agents']
      : userProfile && profile.targets.length
        ? profile.targets
        : [...DEFAULT_USER_TARGETS];
  return buildInstallPlan({
    packageRoot: PACKAGE_ROOT,
    skills: OFFICIAL_SKILLS,
    targets:
      scope === 'project'
        ? [path.join(cwd, '.agents', 'skills')]
        : userSkillsDirsForTargets(targetIds, homeDir),
    officialSkills: OFFICIAL_SKILLS,
    scope: scope === 'project' ? 'project' : 'user',
    modeLabel: scope === 'project' ? 'Project / Team' : 'Local / User',
    targetIds,
  });
}

function applyInstallPlan(
  packageRoot: string,
  skills: readonly string[],
  targetRoot: string,
  { officialSkills }: { officialSkills?: readonly string[] } = {},
): ApplyInstallResult {
  const report = classifyTargetRoot(packageRoot, skills, targetRoot, officialSkills || []);
  if (report.blocked) {
    return {
      ok: false,
      blocked: true,
      report,
      summary: { installed: 0, updated: 0, preserved: 0, removed: 0 },
    };
  }
  const summary: ApplyInstallSummary = { installed: 0, updated: 0, preserved: 0, removed: 0 };
  for (const pair of report.pairs) {
    const kind = report.classified.identical.includes(pair)
      ? 'identical'
      : report.classified.differs.includes(pair)
        ? 'differs'
        : 'missing';
    if (kind === 'identical') {
      summary.preserved += 1;
      continue;
    }
    if (kind === 'differs') summary.updated += 1;
    else summary.installed += 1;
    fs.mkdirSync(path.dirname(pair.dest), { recursive: true });
    fs.copyFileSync(pair.source, pair.dest);
  }
  for (const skill of report.staleManagedSkills) {
    fs.rmSync(path.join(targetRoot, skill), { recursive: true, force: true });
    summary.removed += 1;
  }
  return { ok: true, blocked: false, report, summary };
}

function isPlanEmpty(plan: InstallPlan): boolean {
  return (['CREATE', 'UPDATE', 'REMOVE', 'COLLISION', 'BLOCKED'] as const).every(
    (action) => (plan.totals[action] || 0) === 0,
  );
}

export type {
  ActionTotals,
  ApplyInstallResult,
  InstallPlan,
  InstallProfilePlanInput,
  TargetReport,
};
export {
  applyInstallPlan,
  buildInstallPlan,
  buildInstallProfilePlan,
  classifyTargetRoot,
  isPlanEmpty,
  skillDirPartial,
  targetLabelFor,
  USER_TARGET_LABELS,
};
