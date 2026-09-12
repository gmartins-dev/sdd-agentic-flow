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
import { removeManagedTargetContent, writeInstallProvenance } from '../src/upgrade';

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

test('invalid provenance cannot authorize removal outside the installation', () => {
  const target = path.join(temporary, 'unsafe-provenance');
  const outside = path.join(temporary, 'outside');
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'keep.txt'), 'user data');
  writeInstallProvenance(target, {
    packageVersion: '7.10.1',
    managedSkills: ['../outside'],
  });
  assert.throws(
    () => applyInstallPlan(packageRoot, [firstSkill], target, { officialSkills }),
    /unsafe.*provenance/i,
  );
  assert.equal(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8'), 'user data');
});

test('legacy current provenance removes the shared layer during cleanup', () => {
  const target = path.join(temporary, 'legacy-shared-cleanup');
  fs.mkdirSync(path.join(target, 'sdd-agentic-flow-shared', 'references'), { recursive: true });
  fs.writeFileSync(
    path.join(target, 'sdd-agentic-flow-shared', 'references', 'evidence-standard.md'),
    'owned\n',
  );
  writeInstallProvenance(target, {
    packageVersion: '7.10.1',
    managedSkills: [firstSkill],
  });
  removeManagedTargetContent(target, {
    package: 'sdd-agentic-flow',
    packageVersion: '7.10.1',
    schema: 'saf-install-provenance/v3',
    skillIdentity: 'saf',
    managedSkills: [firstSkill],
  });
  assert.equal(fs.existsSync(path.join(target, 'sdd-agentic-flow-shared')), false);
});

test('installation rejects destination symlinks before writing any managed file', (t) => {
  const target = path.join(temporary, 'linked-target');
  const outside = path.join(temporary, 'linked-victim');
  fs.writeFileSync(outside, 'user data');
  fs.mkdirSync(path.join(target, secondSkill), { recursive: true });
  try {
    fs.symlinkSync(outside, path.join(target, secondSkill, 'SKILL.md'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
    t.skip('symlink creation unavailable');
    return;
  }
  writeInstallProvenance(target, { packageVersion: '7.10.1', managedSkills: officialSkills });
  assert.throws(() => applyInstallPlan(packageRoot, officialSkills, target), /symbolic link/i);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'user data');
  assert.equal(fs.existsSync(path.join(target, firstSkill)), false);
});

test('install plans report an actionable external symlink blocker', (t) => {
  const target = path.join(temporary, 'planned-linked-target');
  const outside = path.join(temporary, 'planned-linked-victim');
  fs.writeFileSync(outside, 'user data');
  fs.mkdirSync(path.join(target, firstSkill), { recursive: true });
  try {
    fs.symlinkSync(outside, path.join(target, firstSkill, 'SKILL.md'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
    t.skip('symlink creation unavailable');
    return;
  }
  const plan = buildInstallPlan({
    packageRoot,
    skills: officialSkills,
    targets: [target],
    officialSkills,
    scope: 'user',
  });
  assert.equal(plan.blocked, true);
  assert.equal(plan.applicability, 'blocked');
  assert.match(plan.blockerReason || '', /symbolic link/i);
  assert.match(plan.blockerReason || '', /choose another target|project scope/i);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'user data');
});
