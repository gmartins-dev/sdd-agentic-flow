'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { collectManagedPairs, classifyManagedPairs, readInstallProvenance } = require('./upgrade');
const { isLegacySkillName } = require('./skill-identity');

const USER_TARGET_LABELS = {
  agents: 'Shared Agent Skills',
  cursor: 'Cursor',
  claude: 'Claude Code',
  copilot: 'GitHub Copilot',
};

function targetLabelFor(dir, scope = 'user') {
  if (scope === 'project') return 'Project .agents/skills';
  const normalized = dir.replace(/\\/g, '/');
  if (normalized.includes('/.cursor/skills')) return USER_TARGET_LABELS.cursor;
  if (normalized.includes('/.claude/skills')) return USER_TARGET_LABELS.claude;
  if (normalized.includes('/.copilot/skills')) return USER_TARGET_LABELS.copilot;
  return USER_TARGET_LABELS.agents;
}

function skillDirPartial(skillDir) {
  if (!fs.existsSync(skillDir)) return false;
  return !fs.existsSync(path.join(skillDir, 'SKILL.md'));
}

function classifyTargetRoot(packageRoot, preset, targetRoot, officialSkills, scope = 'user') {
  const pairs = collectManagedPairs(packageRoot, preset, targetRoot);
  const classified = classifyManagedPairs(pairs);
  const provenance = readInstallProvenance(targetRoot);
  const managed = Boolean(provenance?.package === 'sdd-agentic-flow' && provenance.schema === 2);
  const legacy =
    Boolean(provenance?.package === 'sdd-agentic-flow' && provenance.schema !== 2) ||
    (fs.existsSync(targetRoot) &&
      fs
        .readdirSync(targetRoot)
        .some((name) => name !== 'sdd-agentic-flow-shared' && isLegacySkillName(name)));
  const entries = [];
  let collisions = 0;
  const partialWarnings = [];
  const staleManagedSkills = managed
    ? (provenance.managedSkills || []).filter(
        (skill) => !preset.skills.includes(skill) && fs.existsSync(path.join(targetRoot, skill)),
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

  const summary = {
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
  preset,
  targets,
  officialSkills,
  scope,
  modeLabel = 'Local / User',
  selectedTargets = null,
  desiredPacks = [],
  targetIds = [],
}) {
  const targetReports = [];
  const totals = {
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
    for (const key of Object.keys(totals)) totals[key] += report.summary[key] || 0;
  }
  return {
    modeLabel,
    scope,
    desiredPacks,
    targetIds,
    targets: targetReports,
    totals,
    blocked: totals.COLLISION > 0 || totals.BLOCKED > 0,
    repositoryChanges: scope === 'project' ? ['.agents/skills/'] : [],
  };
}

function applyInstallPlan(packageRoot, preset, targetRoot, { officialSkills } = {}) {
  const report = classifyTargetRoot(packageRoot, preset, targetRoot, officialSkills || []);
  if (report.blocked) {
    return {
      ok: false,
      blocked: true,
      report,
      summary: { installed: 0, updated: 0, preserved: 0, removed: 0 },
    };
  }
  const summary = { installed: 0, updated: 0, preserved: 0, removed: 0 };
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

function isPlanEmpty(plan) {
  return ['CREATE', 'UPDATE', 'REMOVE', 'COLLISION', 'BLOCKED'].every(
    (action) => (plan.totals[action] || 0) === 0,
  );
}

module.exports = {
  USER_TARGET_LABELS,
  targetLabelFor,
  classifyTargetRoot,
  buildInstallPlan,
  applyInstallPlan,
  isPlanEmpty,
  skillDirPartial,
};
