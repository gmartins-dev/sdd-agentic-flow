'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const {
  buildInstallPlan,
  classifyTargetRoot,
  skillDirPartial,
} = require('../bin/install-preflight');

const packageRoot = path.resolve(__dirname, '..');
const preset = JSON.parse(fs.readFileSync(path.join(packageRoot, 'presets/core.json'), 'utf8'));
const officialSkills = preset.skills;

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-install-preflight-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

test('skillDirPartial detects missing SKILL.md', () => {
  const skillDir = path.join(temporary, 'partial-skill');
  fs.mkdirSync(skillDir, { recursive: true });
  assert.equal(skillDirPartial(skillDir), true);
});

test('buildInstallPlan reports CREATE for empty target', () => {
  const target = path.join(temporary, 'empty-target');
  fs.mkdirSync(target, { recursive: true });
  const plan = buildInstallPlan({
    packageRoot,
    preset,
    targets: [target],
    officialSkills,
    scope: 'user',
  });
  assert.ok(plan.totals.CREATE > 0);
  assert.equal(plan.totals.COLLISION, 0);
  assert.match(plan.modeLabel, /Local/);
});

test('classifyTargetRoot detects FOREIGN skill without provenance', () => {
  const target = path.join(temporary, 'foreign-target');
  const foreignSkill = path.join(target, 'sdd-create-specs');
  fs.mkdirSync(foreignSkill, { recursive: true });
  fs.writeFileSync(path.join(foreignSkill, 'SKILL.md'), '# foreign\n', 'utf8');
  const report = classifyTargetRoot(packageRoot, preset, target, officialSkills);
  assert.ok(report.summary.COLLISION >= 1);
  assert.equal(report.blocked, true);
});
