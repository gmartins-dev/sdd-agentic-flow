import fs from 'node:fs';
import path from 'node:path';
import { parseContractArray, validateContractReferences } from '../src/contract-graph';
import { unknownContractKinds } from '../src/contract-kinds';
import { OFFICIAL_SKILLS } from '../src/skill-identity';

const root = path.resolve(__dirname, '..');
const failures: string[] = [];
const descriptions = new Map<string, string>();
const baselineRegistry = fs.readFileSync(path.join(root, 'shared/baselines/registry.yml'), 'utf8');
const knownBaselineIds = [...baselineRegistry.matchAll(/^\s*-\s*id:\s*(\S+)\s*$/gm)]
  .map((match) => match[1])
  .filter((id): id is string => Boolean(id));
const packFiles = fs.readdirSync(path.join(root, 'packs')).filter((file) => file.endsWith('.json'));
const packs = packFiles.map(
  (file) =>
    JSON.parse(fs.readFileSync(path.join(root, 'packs', file), 'utf8')) as {
      name: string;
      skills: string[];
    },
);
const expectedPacks = ['execution', 'full', 'multi-task', 'planning', 'review'];
if (JSON.stringify(packs.map((pack) => pack.name).sort()) !== JSON.stringify(expectedPacks))
  failures.push('packs: expected exactly execution, full, multi-task, planning, review');
const skills = OFFICIAL_SKILLS.map((name) => {
  const content = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (!frontmatter) failures.push(`${name}: missing frontmatter`);
  const description = frontmatter?.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? '';
  if (!description || description.length > 1024) failures.push(`${name}: invalid description`);
  if (descriptions.has(description))
    failures.push(`${name}: duplicate description with ${descriptions.get(description)}`);
  descriptions.set(description, name);
  for (const field of ['extends', 'requires', 'consumes', 'produces', 'baseline'])
    if (!new RegExp(`^${field}:`, 'm').test(frontmatter ?? ''))
      failures.push(`${name}: missing ${field}`);
  for (const removed of ['compatible_with:', '  pack:', 'packs:'])
    if ((frontmatter ?? '').includes(removed))
      failures.push(`${name}: retired contract token ${removed.trim()}`);
  const headings = [...content.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  const canonical = ['When to use', 'When not to use', 'Inputs', 'Workflow', 'Safety', 'Output'];
  if (JSON.stringify(headings) !== JSON.stringify(canonical))
    failures.push(`${name}: must contain exactly the six canonical H2 sections`);
  const output = content.match(/^## Output\n([\s\S]*?)(?=^### Autonomy)/m)?.[1] ?? '';
  for (const label of ['Status', 'Next recommended skill', 'Reason'])
    if (!output.includes(label)) failures.push(`${name}: output missing ${label}`);
  for (const { field, value } of unknownContractKinds({
    requires: parseContractArray(frontmatter ?? '', 'requires') ?? [],
    consumes: parseContractArray(frontmatter ?? '', 'consumes') ?? [],
    produces: parseContractArray(frontmatter ?? '', 'produces') ?? [],
  }))
    failures.push(`${name}: unknown ${field} contract kind '${value}'`);
  return { name, frontmatter: frontmatter ?? '' };
});

for (const pack of packs) {
  const unknown = pack.skills.filter(
    (skill) => !(OFFICIAL_SKILLS as readonly string[]).includes(skill),
  );
  if (unknown.length) failures.push(`${pack.name}: unknown skills ${unknown.join(', ')}`);
}
const full = packs.find((pack) => pack.name === 'full');
if (
  JSON.stringify([...(full?.skills || [])].sort()) !== JSON.stringify([...OFFICIAL_SKILLS].sort())
)
  failures.push('full: skills must equal OFFICIAL_SKILLS');

const { failures: referenceFailures, cycles } = validateContractReferences(skills, {
  knownBaselineIds,
});
failures.push(
  ...referenceFailures,
  ...cycles.map((cycle) => `contract cycle: ${cycle.join(' -> ')}`),
);
const vendor =
  /\b(github|gitlab|bitbucket|jira|linear|azure devops|claude|cursor|codex|gemini|copilot)\b/i;
for (const name of OFFICIAL_SKILLS) {
  const file = path.join(root, 'skills', name, 'SKILL.md');
  if (vendor.test(fs.readFileSync(file, 'utf8'))) failures.push(`${name}: provider leakage`);
}

const evalCorpus = JSON.parse(
  fs.readFileSync(path.join(root, 'shared', 'evals', 'evals.json'), 'utf8'),
) as Record<string, unknown>;
for (const key of ['routing_cases', 'prompt_cases', 'behavior_cases']) {
  if (!Array.isArray(evalCorpus[key]) || evalCorpus[key].length === 0)
    failures.push(`eval corpus: missing ${key}`);
}

if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log('PASS skill contracts');
