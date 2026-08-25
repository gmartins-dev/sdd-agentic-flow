import fs from 'node:fs';
import path from 'node:path';
import { isLegacySkillName } from './skill-identity';
import {
  type ClassifiedPairs,
  classifyManagedPairs,
  collectManagedPairs,
  type ManagedPair,
  type PresetLike,
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
  desiredPacks: string[];
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
  preset: PresetLike;
  targets: string[];
  officialSkills: readonly string[];
  scope: InstallScope;
  modeLabel?: string;
  selectedTargets?: string[] | null;
  desiredPacks?: string[];
  targetIds?: string[];
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
  preset: PresetLike,
  targetRoot: string,
  officialSkills: readonly string[],
  scope: InstallScope = 'user',
): TargetReport {
  const pairs = collectManagedPairs(packageRoot, preset, targetRoot);
  const classified = classifyManagedPairs(pairs);
  const provenance = readInstallProvenance(targetRoot);
  const managed = Boolean(
    provenance?.package === 'sdd-agentic-flow' && provenance.schema === 'saf-install-provenance/v2',
  );
  const legacy =
    Boolean(
      provenance?.package === 'sdd-agentic-flow' &&
        provenance.schema !== 'saf-install-provenance/v2',
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
        (skill) => !preset.skills?.includes(skill) && fs.existsSync(path.join(targetRoot, skill)),
      )
    : [];

  for (const skill of preset.skills || []) {
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
    BLOCKED: 0,
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
    blocked: collisions > 0,
  };
}

function buildInstallPlan({
  packageRoot,
  preset,
  targets,
  officialSkills,
  scope,
  modeLabel = 'Local / User',
  selectedTargets = null,
  desiredPacks = [],
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
    const report = classifyTargetRoot(packageRoot, preset, targetRoot, officialSkills, scope);
    targetReports.push(report);
    for (const key of Object.keys(totals) as (keyof ActionTotals)[]) {
      totals[key] += report.summary[key] || 0;
    }
  }
  const blocked = totals.COLLISION > 0 || totals.BLOCKED > 0;
  return {
    modeLabel,
    scope,
    desiredPacks,
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

function applyInstallPlan(
  packageRoot: string,
  preset: PresetLike,
  targetRoot: string,
  { officialSkills }: { officialSkills?: readonly string[] } = {},
): ApplyInstallResult {
  const report = classifyTargetRoot(packageRoot, preset, targetRoot, officialSkills || []);
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

export type { ActionTotals, ApplyInstallResult, InstallPlan, TargetReport };
export {
  applyInstallPlan,
  buildInstallPlan,
  classifyTargetRoot,
  isPlanEmpty,
  skillDirPartial,
  targetLabelFor,
  USER_TARGET_LABELS,
};
