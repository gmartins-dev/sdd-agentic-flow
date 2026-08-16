import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  CORE_SKILLS,
  isLegacySkillName,
  isOfficialSkill,
  OFFICIAL_SKILLS,
} from '../src/skill-identity';

test('the public SAF namespace contains the locked 13-skill roster', () => {
  assert.equal(OFFICIAL_SKILLS.length, 13);
  assert.ok(OFFICIAL_SKILLS.every((name) => name.startsWith('saf-')));
  assert.deepEqual(CORE_SKILLS, [
    'saf-setup',
    'saf-create-spec',
    'saf-implement',
    'saf-check-task',
    'saf-validate',
  ]);
});

test('legacy detection is diagnostic-only', () => {
  assert.equal(isOfficialSkill('saf-create-spec'), true);
  assert.equal(isOfficialSkill('sdd-create-specs'), false);
  assert.equal(isLegacySkillName('sdd-create-specs'), true);
  assert.equal(isLegacySkillName('setup-sdd-agentic-flow'), true);
  assert.equal(isLegacySkillName('saf-create-spec'), false);
});

test('multi implementation contract keeps waves, isolation, checking, and integration explicit', () => {
  const skill = fs.readFileSync(
    path.join(__dirname, '..', 'skills', 'saf-implement-multi', 'SKILL.md'),
    'utf8',
  );
  for (const required of [
    'DAG',
    'waves',
    'explicit user authorization',
    'saf-check-task',
    'implemented-isolated',
    'integrated',
    'Never commit, merge, cherry-pick, push',
  ]) {
    assert.match(skill, new RegExp(required));
  }
});
