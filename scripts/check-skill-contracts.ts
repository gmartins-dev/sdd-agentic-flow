import fs from 'node:fs';
import path from 'node:path';
import { EFFECTIVE_DEFAULTS } from '../src/config-domain';
import { parseContractArray, validateContractReferences } from '../src/contract-graph';
import { unknownContractKinds } from '../src/contract-kinds';
import { parseSkillContract } from '../src/skill-contract';
import { OFFICIAL_SKILLS } from '../src/skill-identity';
import {
  analyzeConsumerClosure,
  consumerClosureExitCode,
  materializeSourceProjection,
} from './consumer-closure';

const root = path.resolve(__dirname, '..');
const failures: string[] = [];
const closure = analyzeConsumerClosure({ entries: materializeSourceProjection(root) });
const closureFailures = closure.findings.map(
  (finding) =>
    `consumer closure ${finding.rule}: ${finding.file}:${finding.location} ${finding.reference}`,
);
failures.push(...closureFailures);
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
  'shared/references/prompt-authoring-standard.md': {
    file: 'shared/references/prompt-authoring-standard.md',
    heading: '# Prompt authoring standard',
  },
  'shared/references/evidence-standard.md#requirement-coverage': {
    file: 'shared/references/evidence-standard.md',
    heading: '## Requirement coverage',
  },
  'shared/references/evidence-standard.md#adequacy': {
    file: 'shared/references/evidence-standard.md',
    heading: '## Adequacy',
  },
  'shared/references/evidence-standard.md#authority-order': {
    file: 'shared/references/evidence-standard.md',
    heading: '## Authority order',
  },
  'shared/references/evidence-standard.md#freshness': {
    file: 'shared/references/evidence-standard.md',
    heading: '## Freshness',
  },
  'shared/references/evidence-standard.md#anti-tautology--epistemic-independence': {
    file: 'shared/references/evidence-standard.md',
    heading: '## Anti-tautology / epistemic independence',
  },
  'shared/references/reviewability.md#review-identity-and-evidence': {
    file: 'shared/references/reviewability.md',
    heading: '## Review identity and evidence',
  },
  'shared/references/reviewability.md#re-review-and-resolution': {
    file: 'shared/references/reviewability.md',
    heading: '## Re-review and resolution',
  },
  'shared/references/handoff-standard.md#what-belongs-in-each-handofftemplatemd-section': {
    file: 'shared/references/handoff-standard.md',
    heading: '## What belongs in each `handoff.template.md` section',
  },
  'skills/saf-create-spec/SKILL.md#workflow': {
    file: 'skills/saf-create-spec/SKILL.md',
    heading: '## Workflow',
  },
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
  'route-technical-design-open',
  'route-product-direction-unresolved',
  'route-feasibility-investigation',
] as const;

const REQUIRED_FIXTURE_IDS = [
  'discovery-only-workspace',
  'no-package-defaults-applied',
  'named-package-ready-task',
  'named-package-not-ready',
  'named-package-dependent-tasks',
  'two-plausible-packages',
  'technical-design-open',
  'product-direction-unresolved',
  'feasibility-investigation',
] as const;

// Declared neighboring operations in workflow-routing.md; both directions need an example.
const ROUTING_BOUNDARIES = [
  ['saf-brainstorm', 'saf-create-spec'],
  ['saf-create-spec', 'saf-create-prompts'],
  ['saf-implement', 'saf-implement-multi'],
  ['saf-check-task', 'saf-validate'],
  ['saf-create-pr', 'saf-review-pr'],
  ['saf-review-pr', 'saf-fix-pr'],
  ['saf-route', 'saf-implement'],
  ['saf-explain', 'saf-implement'],
] as const;

function validateAuthority(item: EvalRecord, repositoryRoot: string, errors: string[]): void {
  const authority =
    typeof item.authority_ref === 'string' && Object.hasOwn(AUTHORITY_ALLOWLIST, item.authority_ref)
      ? AUTHORITY_ALLOWLIST[item.authority_ref as keyof typeof AUTHORITY_ALLOWLIST]
      : undefined;
  if (!authority) {
    errors.push(
      `eval corpus: ${String(item.id)} has unapproved authority_ref ${String(item.authority_ref)}`,
    );
    return;
  }
  const file = path.join(repositoryRoot, authority.file);
  if (!fs.existsSync(file)) errors.push(`eval corpus: authority file missing ${authority.file}`);
  else if (!fs.readFileSync(file, 'utf8').includes(authority.heading))
    errors.push(`eval corpus: authority heading missing ${authority.heading}`);
}

// These checks validate maintained examples, not arbitrary consumer reports or semantic truth.
function records(value: unknown, label: string, errors: string[]): EvalRecord[] {
  if (!Array.isArray(value)) {
    errors.push(`eval corpus: ${label} must be an array`);
    return [];
  }
  return value.filter((item): item is EvalRecord => {
    const valid = Boolean(item && typeof item === 'object' && !Array.isArray(item));
    if (!valid) errors.push(`eval corpus: ${label} contains a non-record`);
    return valid;
  });
}

function requiredText(item: EvalRecord, fields: string[], label: string, errors: string[]): void {
  for (const field of fields)
    if (typeof item[field] !== 'string' || !item[field].trim())
      errors.push(`eval corpus: ${label} missing ${field}`);
}

function validateReviewExamples(value: unknown, repositoryRoot: string): string[] {
  const errors: string[] = [];
  const states = new Set([
    'confirmed',
    'not-reproduced',
    'evidence-gap',
    'spec-conflict',
    'human-judgment',
    'resolved',
    'deferred',
  ]);
  const examples = records(value, 'review_examples', errors);
  if (!examples.length) errors.push('eval corpus: missing review_examples');
  const exampleIds = new Set<unknown>();
  for (const example of examples) {
    requiredText(example, ['id', 'purpose', 'authority_ref'], 'review example', errors);
    if (exampleIds.has(example.id))
      errors.push(`eval corpus: duplicate review example ${String(example.id)}`);
    exampleIds.add(example.id);
    validateAuthority(example, repositoryRoot, errors);
    const rounds = records(example.rounds, 'review rounds', errors);
    if (rounds.length < 2)
      errors.push(`eval corpus: ${String(example.id)} needs two review rounds`);
    let prior = new Map<unknown, unknown>();
    const allocated = new Set<string>();
    for (const [index, round] of rounds.entries()) {
      const label = `${String(example.id)}/${index + 1}`;
      requiredText(round, ['task', 'context', 'previous'], label, errors);
      if (round.round !== index + 1 || round.task !== rounds[0]?.task)
        errors.push(`eval corpus: ${label} invalid round/task identity`);
      if (round.previous !== (index === 0 ? 'none' : `${String(example.id)}/${index}`))
        errors.push(`eval corpus: ${label} invalid previous review reference`);
      const current = new Map<unknown, unknown>();
      for (const finding of records(round.findings, `${label} findings`, errors)) {
        requiredText(
          finding,
          ['finding_id', 'state', 'impact', 'location', 'remediation', 'focus'],
          label,
          errors,
        );
        if (typeof finding.finding_id !== 'string' || !/^F\d{3,}$/.test(finding.finding_id))
          errors.push(`eval corpus: ${label} invalid finding_id`);
        if (current.has(finding.finding_id))
          errors.push(`eval corpus: ${label} duplicate finding_id`);
        current.set(finding.finding_id, finding.state);
        if (!states.has(String(finding.state)))
          errors.push(`eval corpus: ${label} invalid finding state`);
        const entries = records(finding.evidence, `${label} evidence`, errors);
        if (!entries.length) errors.push(`eval corpus: ${label} missing finding evidence`);
        for (const entry of entries) {
          requiredText(entry, ['source', 'result'], label, errors);
          if (!['internal', 'repro', 'external'].includes(String(entry.type)))
            errors.push(`eval corpus: ${label} invalid evidence type`);
        }
      }
      const newIds = [...current.keys()]
        .filter((id): id is string => typeof id === 'string' && !allocated.has(id))
        .sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)));
      for (const id of newIds) {
        if (id !== `F${String(allocated.size + 1).padStart(3, '0')}`)
          errors.push(`eval corpus: ${label} nonsequential finding_id ${id}`);
        allocated.add(id);
      }
      if (index > 0) {
        const resolution = records(round.resolution, `${label} resolution table`, errors);
        const seen = new Set<unknown>();
        for (const row of resolution) {
          requiredText(
            row,
            ['finding_id', 'previous_state', 'current_state', 'evidence', 'next_action'],
            label,
            errors,
          );
          if (seen.has(row.finding_id))
            errors.push(`eval corpus: ${label} duplicate resolution ID`);
          seen.add(row.finding_id);
          if (
            !prior.has(row.finding_id) ||
            row.previous_state !== prior.get(row.finding_id) ||
            row.current_state !== current.get(row.finding_id)
          )
            errors.push(`eval corpus: ${label} resolution state mismatch`);
        }
        for (const id of prior.keys())
          if (!seen.has(id) || !current.has(id))
            errors.push(`eval corpus: ${label} omitted carry-over ${String(id)}`);
      }
      prior = current;
    }
  }
  return errors;
}

function validateEvalCorpus(evalCorpus: EvalRecord, repositoryRoot = root): string[] {
  const corpusFailures: string[] = [];
  for (const key of ['routing_cases', 'prompt_cases', 'behavior_cases']) {
    if (!Array.isArray(evalCorpus[key]) || evalCorpus[key].length === 0)
      corpusFailures.push(`eval corpus: missing ${key}`);
  }
  const fixtures = records(evalCorpus.routing_fixtures, 'routing_fixtures', corpusFailures);
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
  for (const id of REQUIRED_FIXTURE_IDS)
    if (!fixtureIds.has(id)) corpusFailures.push(`eval corpus: missing required fixture ${id}`);
  const routingCases = records(evalCorpus.routing_cases, 'routing_cases', corpusFailures);
  const caseIds = new Set<string>();
  const official = new Set<string>(OFFICIAL_SKILLS);
  const selected = new Set<string>();
  const rejected = new Set<string>();
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
      else selected.add(item.expected_skill);
    } else if ('expected_skill' in item)
      corpusFailures.push(`eval corpus: ${id} must not declare expected_skill for human-gate`);
    if (item.expected_route === 'human-gate')
      requiredText(item, ['gate_reason'], id, corpusFailures);
    validateAuthority(item, repositoryRoot, corpusFailures);
    if ('rejected_skills' in item) {
      if (!Array.isArray(item.rejected_skills) || !item.rejected_skills.length)
        corpusFailures.push(`eval corpus: ${id} rejected_skills must be a non-empty array`);
      else
        for (const name of item.rejected_skills) {
          if (typeof name !== 'string' || !official.has(name) || name === item.expected_skill)
            corpusFailures.push(`eval corpus: ${id} invalid rejected skill`);
          else rejected.add(name);
        }
    }
    if (id === 'route-discovery-durable' && item.expected_mode !== 'durable discovery')
      corpusFailures.push(
        'eval corpus: route-discovery-durable expected_mode must remain durable discovery',
      );
  }
  for (const id of REQUIRED_ROUTING_IDS)
    if (!caseIds.has(id)) corpusFailures.push(`eval corpus: missing required routing case ${id}`);
  for (const name of official) {
    if (!selected.has(name)) corpusFailures.push(`eval corpus: missing positive route for ${name}`);
    if (!rejected.has(name)) corpusFailures.push(`eval corpus: missing negative route for ${name}`);
  }
  for (const boundary of ROUTING_BOUNDARIES)
    for (const [selectedSkill, rejectedSkill] of [boundary, [...boundary].reverse()])
      if (
        !routingCases.some(
          (item) =>
            item.expected_route === 'skill' &&
            item.expected_skill === selectedSkill &&
            Array.isArray(item.rejected_skills) &&
            item.rejected_skills.includes(rejectedSkill),
        )
      )
        corpusFailures.push(
          `eval corpus: missing boundary ${selectedSkill} instead of ${rejectedSkill}`,
        );
  for (const key of ['prompt_cases', 'behavior_cases']) {
    const ids = new Set<unknown>();
    for (const item of records(evalCorpus[key], key, corpusFailures)) {
      requiredText(
        item,
        ['id', 'input', 'rejected', 'expected', 'authority_ref'],
        key,
        corpusFailures,
      );
      if (ids.has(item.id))
        corpusFailures.push(`eval corpus: duplicate ${key} id ${String(item.id)}`);
      ids.add(item.id);
      validateAuthority(item, repositoryRoot, corpusFailures);
    }
  }
  corpusFailures.push(...validateReviewExamples(evalCorpus.review_examples, repositoryRoot));
  return corpusFailures;
}

const evalCorpus = JSON.parse(
  fs.readFileSync(path.join(root, 'shared', 'evals', 'evals.json'), 'utf8'),
) as EvalRecord;
failures.push(...validateEvalCorpus(evalCorpus));

if (failures.length) {
  for (const failure of failures) console.error(failure);
  const onlyClosureWasInconclusive =
    closure.status === 'INCONCLUSIVE' && failures.length === closureFailures.length;
  process.exit(onlyClosureWasInconclusive ? consumerClosureExitCode(closure.status) : 1);
}
console.log('PASS skill contracts');

export { AUTHORITY_ALLOWLIST, REQUIRED_FIXTURE_IDS, REQUIRED_ROUTING_IDS, validateEvalCorpus };
