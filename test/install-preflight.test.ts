import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import {
  applyInstallPlan,
  buildInstallPlan,
  classifyTargetRoot,
  isPlanEmpty,
  skillDirPartial,
} from '../src/install-preflight';
import { OFFICIAL_SKILLS } from '../src/skill-identity';
import { writeInstallProvenance } from '../src/upgrade';

const packageRoot = path.resolve(__dirname, '..');
const officialSkills = [...OFFICIAL_SKILLS];
const firstSkill = officialSkills[0];
const secondSkill = officialSkills[1];
if (!firstSkill || !secondSkill) throw new Error('official skill fixture is incomplete');

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
    skills: officialSkills,
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
  const foreignSkill = path.join(target, 'saf-implement');
  fs.mkdirSync(foreignSkill, { recursive: true });
  fs.writeFileSync(path.join(foreignSkill, 'SKILL.md'), '# foreign\n', 'utf8');
  const report = classifyTargetRoot(packageRoot, officialSkills, target, officialSkills);
  assert.ok(report.summary.COLLISION >= 1);
  assert.equal(report.blocked, true);
});

test('managed v3 drift produces a real UPDATE while legacy trees block', () => {
  const target = path.join(temporary, 'managed-target');
  const source = path.join(packageRoot, 'skills', firstSkill, 'SKILL.md');
  fs.mkdirSync(path.join(target, firstSkill), { recursive: true });
  fs.writeFileSync(path.join(target, firstSkill, 'SKILL.md'), 'changed\n');
  fs.mkdirSync(path.join(target, 'sdd-route'), { recursive: true });
  fs.writeFileSync(path.join(target, 'sdd-route', 'SKILL.md'), 'legacy\n');
  const report = classifyTargetRoot(packageRoot, officialSkills, target, officialSkills);
  assert.equal(report.legacy, true);
  assert.equal(report.blocked, true);
  assert.ok(fs.existsSync(source));
});

test('managed stale skills are removed while desired drift is updated', () => {
  const target = path.join(temporary, 'stale-managed-target');
  const desired = firstSkill;
  const stale = secondSkill;
  fs.mkdirSync(path.join(target, desired), { recursive: true });
  fs.writeFileSync(path.join(target, desired, 'SKILL.md'), 'changed\n', 'utf8');
  fs.mkdirSync(path.join(target, stale), { recursive: true });
  fs.writeFileSync(path.join(target, stale, 'SKILL.md'), 'stale\n', 'utf8');
  writeInstallProvenance(target, {
    packageVersion: '3.0.0',
    managedSkills: [desired, stale],
  });
  const report = classifyTargetRoot(packageRoot, [desired], target, officialSkills);
  assert.equal(report.summary.UPDATE > 0, true);
  assert.equal(report.summary.REMOVE, 1);
  const applied = applyInstallPlan(packageRoot, [desired], target, { officialSkills });
  assert.equal(applied.summary.updated > 0, true);
  assert.equal(applied.summary.removed, 1);
  assert.equal(fs.existsSync(path.join(target, stale)), false);
});

test('an identical managed target produces an empty plan', () => {
  const target = path.join(temporary, 'current-managed-target');
  const applied = applyInstallPlan(packageRoot, officialSkills, target, { officialSkills });
  writeInstallProvenance(target, { packageVersion: '3.0.0', managedSkills: officialSkills });
  assert.equal(applied.ok, true);
  const plan = buildInstallPlan({
    packageRoot,
    skills: officialSkills,
    targets: [target],
    officialSkills,
    scope: 'user',
  });
  assert.equal(isPlanEmpty(plan), true);
});
