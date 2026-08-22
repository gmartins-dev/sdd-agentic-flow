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
] as const);

const SKILL_NAMESPACE = 'saf-';
const LEGACY_SKILL_PREFIXES = Object.freeze(['sdd-', 'setup-sdd-'] as const);

function isOfficialSkill(name: string): boolean {
  return (OFFICIAL_SKILLS as readonly string[]).includes(name);
}

function isLegacySkillName(name: unknown): boolean {
  return (
    typeof name === 'string' && LEGACY_SKILL_PREFIXES.some((prefix) => name.startsWith(prefix))
  );
}

function listManagedSkillDirNames(entries: string[]): string[] {
  return entries.filter(
    (name) =>
      (OFFICIAL_SKILLS as readonly string[]).includes(name) ||
      isLegacySkillName(name) ||
      name === 'sdd-agentic-flow-shared',
  );
}

export {
  isLegacySkillName,
  isOfficialSkill,
  LEGACY_SKILL_PREFIXES,
  listManagedSkillDirNames,
  OFFICIAL_SKILLS,
  SKILL_NAMESPACE,
};
