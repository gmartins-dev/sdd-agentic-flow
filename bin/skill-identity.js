'use strict';

const OFFICIAL_SKILLS = Object.freeze([
  'saf-setup',
  'saf-route',
  'saf-brainstorm',
  'saf-create-spec',
  'saf-create-prompts',
  'saf-explain',
  'saf-implement',
  'saf-implement-multi',
  'saf-check-task',
  'saf-create-pr',
  'saf-review-pr',
  'saf-fix-pr',
  'saf-validate',
]);

const CORE_SKILLS = Object.freeze([
  'saf-setup',
  'saf-create-spec',
  'saf-implement',
  'saf-check-task',
  'saf-validate',
]);

const SKILL_NAMESPACE = 'saf-';
const LEGACY_SKILL_PREFIXES = Object.freeze(['sdd-', 'setup-sdd-']);

function isOfficialSkill(name) {
  return OFFICIAL_SKILLS.includes(name);
}

function isLegacySkillName(name) {
  return (
    typeof name === 'string' && LEGACY_SKILL_PREFIXES.some((prefix) => name.startsWith(prefix))
  );
}

module.exports = {
  OFFICIAL_SKILLS,
  CORE_SKILLS,
  SKILL_NAMESPACE,
  LEGACY_SKILL_PREFIXES,
  isOfficialSkill,
  isLegacySkillName,
};
