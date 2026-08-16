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
import { writeInstallProvenance } from '../src/upgrade';

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
  const foreignSkill = path.join(target, 'saf-create-spec');
  fs.mkdirSync(foreignSkill, { recursive: true });
  fs.writeFileSync(path.join(foreignSkill, 'SKILL.md'), '# foreign\n', 'utf8');
  const report = classifyTargetRoot(packageRoot, preset, target, officialSkills);
  assert.ok(report.summary.COLLISION >= 1);
  assert.equal(report.blocked, true);
});

test('managed v3 drift produces a real UPDATE while legacy trees block', () => {
  const target = path.join(temporary, 'managed-target');
  const source = path.join(packageRoot, 'skills', preset.skills[0], 'SKILL.md');
  fs.mkdirSync(path.join(target, preset.skills[0]), { recursive: true });
  fs.writeFileSync(path.join(target, preset.skills[0], 'SKILL.md'), 'changed\n');
  fs.mkdirSync(path.join(target, 'sdd-route'), { recursive: true });
  fs.writeFileSync(path.join(target, 'sdd-route', 'SKILL.md'), 'legacy\n');
  const report = classifyTargetRoot(packageRoot, preset, target, officialSkills);
  assert.equal(report.legacy, true);
  assert.equal(report.blocked, true);
  assert.ok(fs.existsSync(source));
});

test('managed stale skills are removed while desired drift is updated', () => {
  const target = path.join(temporary, 'stale-managed-target');
  const desired = preset.skills[0];
  const stale = preset.skills[1];
  fs.mkdirSync(path.join(target, desired), { recursive: true });
  fs.writeFileSync(path.join(target, desired, 'SKILL.md'), 'changed\n', 'utf8');
  fs.mkdirSync(path.join(target, stale), { recursive: true });
  fs.writeFileSync(path.join(target, stale, 'SKILL.md'), 'stale\n', 'utf8');
  writeInstallProvenance(target, {
    packageVersion: '3.0.0',
    managedSkills: [desired, stale],
  });
  const desiredPreset = { ...preset, skills: [desired] };
  const report = classifyTargetRoot(packageRoot, desiredPreset, target, officialSkills);
  assert.equal(report.summary.UPDATE > 0, true);
  assert.equal(report.summary.REMOVE, 1);
  const applied = applyInstallPlan(packageRoot, desiredPreset, target, { officialSkills });
  assert.equal(applied.summary.updated > 0, true);
  assert.equal(applied.summary.removed, 1);
  assert.equal(fs.existsSync(path.join(target, stale)), false);
});

test('an identical managed target produces an empty plan', () => {
  const target = path.join(temporary, 'current-managed-target');
  const applied = applyInstallPlan(packageRoot, preset, target, { officialSkills });
  writeInstallProvenance(target, { packageVersion: '3.0.0', managedSkills: preset.skills });
  assert.equal(applied.ok, true);
  const plan = buildInstallPlan({
    packageRoot,
    preset,
    targets: [target],
    officialSkills,
    scope: 'user',
  });
  assert.equal(isPlanEmpty(plan), true);
});
