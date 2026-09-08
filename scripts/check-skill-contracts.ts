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
  if (name === 'saf-create-spec') {
    for (const token of ['Feature profile', 'explicit-override', 'inferred'])
      if (!content.includes(token))
        failures.push(`${name}: missing feature-profile writer contract '${token}'`);
  }
  if (name === 'saf-implement' || name === 'saf-validate') {
    if (
      !content.includes('Do not re-infer profile depth') &&
      !content.includes('Do not independently infer')
    )
      failures.push(`${name}: downstream profile consumers must not re-infer`);
  }
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

type EvalRecord = Record<string, unknown>;

const AUTHORITY_ALLOWLIST = {
  'shared/references/workflow-routing.md#discovery-versus-specification': {
    file: 'shared/references/workflow-routing.md',
    heading: '## Discovery versus specification',
  },
  'shared/references/workflow-routing.md#routing-matrix': {
    file: 'shared/references/workflow-routing.md',
    heading: '## Routing matrix',
  },
  'shared/references/spec-lifecycle.md#package-resolution': {
    file: 'shared/references/spec-lifecycle.md',
    heading: '## Package resolution',
  },
  'skills/saf-route/SKILL.md#safety': {
    file: 'skills/saf-route/SKILL.md',
    heading: '## Safety',
  },
  'shared/references/workflow-routing.md#precedence-and-gates': {
    file: 'shared/references/workflow-routing.md',
    heading: '## Precedence and gates',
  },
} as const;

const REQUIRED_ROUTING_IDS = [
  'route-discovery-durable',
  'route-spec-ready',
  'route-single-task',
  'route-multi-task',
  'route-package-not-ready',
  'route-vague-intent',
  'route-consequential-choice',
  'route-spec-open-question',
  'route-package-ambiguous',
] as const;

const REQUIRED_FIXTURE_IDS = [
  'discovery-only-workspace',
  'no-package-defaults-applied',
  'named-package-ready-task',
  'named-package-not-ready',
  'named-package-dependent-tasks',
  'two-plausible-packages',
] as const;

function validateEvalCorpus(evalCorpus: EvalRecord, repositoryRoot = root): string[] {
  const corpusFailures: string[] = [];
  for (const key of ['routing_cases', 'prompt_cases', 'behavior_cases']) {
    if (!Array.isArray(evalCorpus[key]) || evalCorpus[key].length === 0)
      corpusFailures.push(`eval corpus: missing ${key}`);
  }
  const fixtures = Array.isArray(evalCorpus.routing_fixtures)
    ? evalCorpus.routing_fixtures.filter((item): item is EvalRecord =>
        Boolean(item && typeof item === 'object'),
      )
    : [];
  const fixtureIds = new Set<string>();
  for (const fixture of fixtures) {
    if (typeof fixture.id !== 'string' || !fixture.id.trim())
      corpusFailures.push('eval corpus: fixture id must be a non-empty string');
    else if (fixtureIds.has(fixture.id))
      corpusFailures.push(`eval corpus: duplicate fixture id ${fixture.id}`);
    else fixtureIds.add(fixture.id);
    if (typeof fixture.description !== 'string' || !fixture.description.trim())
      corpusFailures.push(`eval corpus: fixture ${String(fixture.id)} missing description`);
  }
  if (fixtures.length !== 6)
    corpusFailures.push(`eval corpus: expected 6 routing fixtures, found ${fixtures.length}`);
  for (const id of REQUIRED_FIXTURE_IDS)
    if (!fixtureIds.has(id)) corpusFailures.push(`eval corpus: missing required fixture ${id}`);
  const routingCases = Array.isArray(evalCorpus.routing_cases)
    ? evalCorpus.routing_cases.filter((item): item is EvalRecord =>
        Boolean(item && typeof item === 'object'),
      )
    : [];
  const caseIds = new Set<string>();
  const official = new Set<string>(OFFICIAL_SKILLS);
  for (const item of routingCases) {
    const id = typeof item.id === 'string' ? item.id : '';
    if (!id) corpusFailures.push('eval corpus: routing case id must be a non-empty string');
    else if (caseIds.has(id)) corpusFailures.push(`eval corpus: duplicate routing case id ${id}`);
    else caseIds.add(id);
    for (const field of ['prompt', 'fixture', 'authority_ref'])
      if (typeof item[field] !== 'string' || !String(item[field]).trim())
        corpusFailures.push(`eval corpus: ${id || 'routing case'} missing ${field}`);
    if (typeof item.fixture === 'string' && !fixtureIds.has(item.fixture))
      corpusFailures.push(`eval corpus: ${id} references unknown fixture ${item.fixture}`);
    if (item.expected_route !== 'skill' && item.expected_route !== 'human-gate')
      corpusFailures.push(`eval corpus: ${id} has invalid expected_route`);
    if (item.expected_route === 'skill') {
      if (typeof item.expected_skill !== 'string' || !official.has(item.expected_skill))
        corpusFailures.push(`eval corpus: ${id} requires an official expected_skill`);
    } else if ('expected_skill' in item)
      corpusFailures.push(`eval corpus: ${id} must not declare expected_skill for human-gate`);
    if (typeof item.authority_ref === 'string') {
      const authority = AUTHORITY_ALLOWLIST[item.authority_ref as keyof typeof AUTHORITY_ALLOWLIST];
      if (!authority)
        corpusFailures.push(
          `eval corpus: ${id} has unapproved authority_ref ${item.authority_ref}`,
        );
      else {
        const file = path.join(repositoryRoot, authority.file);
        if (!fs.existsSync(file))
          corpusFailures.push(`eval corpus: authority file missing ${authority.file}`);
        else if (!fs.readFileSync(file, 'utf8').includes(authority.heading))
          corpusFailures.push(`eval corpus: authority heading missing ${authority.heading}`);
      }
    }
    if (id === 'route-discovery-durable' && item.expected_mode !== 'durable discovery')
      corpusFailures.push(
        'eval corpus: route-discovery-durable expected_mode must remain durable discovery',
      );
  }
  for (const id of REQUIRED_ROUTING_IDS)
    if (!caseIds.has(id)) corpusFailures.push(`eval corpus: missing required routing case ${id}`);
  return corpusFailures;
}

const evalCorpus = JSON.parse(
  fs.readFileSync(path.join(root, 'shared', 'evals', 'evals.json'), 'utf8'),
) as EvalRecord;
failures.push(...validateEvalCorpus(evalCorpus));

if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log('PASS skill contracts');

export { AUTHORITY_ALLOWLIST, REQUIRED_FIXTURE_IDS, REQUIRED_ROUTING_IDS, validateEvalCorpus };
