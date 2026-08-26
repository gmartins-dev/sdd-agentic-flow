import fs from 'node:fs';
import path from 'node:path';
import { EFFECTIVE_DEFAULTS } from '../src/config-domain';
import { parseContractArray, validateContractReferences } from '../src/contract-graph';
import { unknownContractKinds } from '../src/contract-kinds';
import { parseSkillContract } from '../src/skill-contract';
import { OFFICIAL_SKILLS } from '../src/skill-identity';

const root = path.resolve(__dirname, '..');
const failures: string[] = [];
const descriptions = new Map<string, string>();
const baselineRegistry = fs.readFileSync(path.join(root, 'shared/baselines/registry.yml'), 'utf8');
const knownBaselineIds = [...baselineRegistry.matchAll(/^\s*-\s*id:\s*(\S+)\s*$/gm)]
  .map((match) => match[1])
  .filter((id): id is string => Boolean(id));
const skills = OFFICIAL_SKILLS.map((name) => {
  const content = fs.readFileSync(path.join(root, 'skills', name, 'SKILL.md'), 'utf8');
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1];
  if (!frontmatter) failures.push(`${name}: missing frontmatter`);
  const description = frontmatter?.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? '';
  if (!description || description.length > 1024) failures.push(`${name}: invalid description`);
  if (descriptions.has(description))
    failures.push(`${name}: duplicate description with ${descriptions.get(description)}`);
  descriptions.set(description, name);
  const allowed = new Set([
    'name',
    'description',
    'license',
    'compatibility',
    'metadata',
    'allowed-tools',
  ]);
  for (const match of (frontmatter ?? '').matchAll(/^([a-z][a-z-]*):/gm))
    if (match[1] && !allowed.has(match[1]))
      failures.push(`${name}: non-portable frontmatter field ${match[1]}`);
  if (/^\s+version:/m.test(frontmatter ?? ''))
    failures.push(`${name}: metadata.version is retired`);
  const sidecarFile = path.join(root, 'skills', name, 'saf-contract.yml');
  const sidecar = fs.existsSync(sidecarFile) ? fs.readFileSync(sidecarFile, 'utf8') : '';
  if (!sidecar) failures.push(`${name}: missing saf-contract.yml`);
  let parsed: ReturnType<typeof parseSkillContract> = {};
  try {
    parsed = parseSkillContract(sidecar);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
  for (const field of ['extends', 'requires', 'consumes', 'produces', 'baseline'])
    if (!(field in parsed)) failures.push(`${name}: missing ${field}`);
  const headings = [...content.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  const canonical = ['When to use', 'When not to use', 'Inputs', 'Workflow', 'Safety', 'Output'];
  if (JSON.stringify(headings) !== JSON.stringify(canonical))
    failures.push(`${name}: must contain exactly the six canonical H2 sections`);
  const output = content.match(/^## Output\n([\s\S]*?)(?=^### Autonomy)/m)?.[1] ?? '';
  for (const label of ['Status', 'Next recommended skill', 'Reason'])
    if (!output.includes(label)) failures.push(`${name}: output missing ${label}`);
  for (const { field, value } of unknownContractKinds({
    requires: parseContractArray(sidecar, 'requires') ?? [],
    consumes: parseContractArray(sidecar, 'consumes') ?? [],
    produces: parseContractArray(sidecar, 'produces') ?? [],
  }))
    failures.push(`${name}: unknown ${field} contract kind '${value}'`);
  return { name, frontmatter: sidecar };
});

const { failures: referenceFailures, cycles } = validateContractReferences(skills, {
  knownBaselineIds,
});
failures.push(
  ...referenceFailures,
  ...cycles.map((cycle) => `contract cycle: ${cycle.join(' -> ')}`),
);
for (const skill of skills) {
  const conflicts = parseContractArray(skill.frontmatter, 'conflicts') ?? [];
  for (const conflict of conflicts)
    if ((OFFICIAL_SKILLS as readonly string[]).includes(conflict))
      failures.push(`${skill.name}: conflicts with official skill ${conflict}`);
}

const defaultsFile = fs.readFileSync(
  path.join(root, 'shared/references/effective-defaults.md'),
  'utf8',
);
const defaultsBlock = defaultsFile.match(/```yaml effective-defaults\n([\s\S]*?)\n```/)?.[1];
if (!defaultsBlock) failures.push('effective defaults: missing structured block');
else {
  const projection = Object.fromEntries(
    defaultsBlock.split('\n').map((line) => {
      const [key, ...rest] = line.split(':');
      const value = rest.join(':').trim();
      return [key, value === 'true' ? true : value === 'false' ? false : value];
    }),
  );
  if (JSON.stringify(projection) !== JSON.stringify(EFFECTIVE_DEFAULTS))
    failures.push('effective defaults: shared projection differs from CLI constants');
}
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
