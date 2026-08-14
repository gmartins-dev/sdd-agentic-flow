'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { collectManagedPairs, classifyManagedPairs, readInstallProvenance } = require('./upgrade');

const USER_TARGET_LABELS = {
  agents: 'Shared Agent Skills',
  claude: 'Claude Code',
  copilot: 'GitHub Copilot',
};

function targetLabelFor(dir, scope = 'user') {
  if (scope === 'project') return 'Project .agents/skills';
  const normalized = dir.replace(/\\/g, '/');
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
  const managed = Boolean(provenance?.package === 'sdd-agentic-flow');
  const entries = [];
  let collisions = 0;
  const partialWarnings = [];

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
    PRESERVE: classified.identical.length + classified.differs.length,
    COLLISION: collisions,
    MANAGED_MODIFIED: classified.differs.length,
    PARTIAL: partialWarnings.length,
  };

  return {
    targetRoot,
    label: targetLabelFor(targetRoot, scope),
    pairs,
    classified,
    managed,
    summary,
    partialWarnings,
    foreignSkills: entries.map((entry) => entry.skill),
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
}) {
  const targetReports = [];
  const totals = { CREATE: 0, PRESERVE: 0, COLLISION: 0, MANAGED_MODIFIED: 0, PARTIAL: 0 };
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
    targets: targetReports,
    totals,
    blocked: totals.COLLISION > 0,
    repositoryChanges: scope === 'project' ? ['.agents/skills/'] : [],
  };
}

function applyInstallPlan(packageRoot, preset, targetRoot, { officialSkills } = {}) {
  const report = classifyTargetRoot(packageRoot, preset, targetRoot, officialSkills || []);
  if (report.blocked) {
    return { ok: false, blocked: true, report, summary: { installed: 0, preserved: 0 } };
  }
  const summary = { installed: 0, preserved: 0 };
  for (const pair of report.pairs) {
    if (fs.existsSync(pair.dest)) {
      summary.preserved += 1;
      continue;
    }
    summary.installed += 1;
    fs.mkdirSync(path.dirname(pair.dest), { recursive: true });
    fs.copyFileSync(pair.source, pair.dest);
  }
  return { ok: true, blocked: false, report, summary };
}

module.exports = {
  USER_TARGET_LABELS,
  targetLabelFor,
  classifyTargetRoot,
  buildInstallPlan,
  applyInstallPlan,
  skillDirPartial,
};
