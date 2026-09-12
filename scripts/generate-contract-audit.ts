import fs from 'node:fs';
import path from 'node:path';

import { CONTRACT_KINDS } from '../src/contract-kinds';
import { OFFICIAL_SKILLS } from '../src/skill-identity';

export type ContractAuditRecord = {
  id: string;
  skill: string;
  authority: string[];
  consumers: string[];
  produces: string[];
  prerequisites: string[];
  evidence: string[];
  evidenceRequired: string[];
  tests: string[];
  handoff: string;
  writes: string;
  failureModes: string;
  verificationStatus: 'structural-pass';
  semanticReview: 'required';
};

export type ContractAudit = { records: ContractAuditRecord[] };

export function validateContractAudit(audit: ContractAudit, root: string): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  if (audit.records.length !== OFFICIAL_SKILLS.length)
    errors.push(
      `contract audit: expected ${OFFICIAL_SKILLS.length} records, found ${audit.records.length}`,
    );
  for (const record of audit.records) {
    if (!record.id.trim()) errors.push(`contract audit: ${record.skill} missing id`);
    else if (ids.has(record.id)) errors.push(`contract audit: duplicate id ${record.id}`);
    else ids.add(record.id);
    for (const field of [
      'authority',
      'consumers',
      'produces',
      'prerequisites',
      'evidence',
      'evidenceRequired',
      'tests',
    ] as const)
      if (!Array.isArray(record[field]))
        errors.push(`contract audit: ${record.skill} missing ${field}`);
    for (const reference of record.authority ?? [])
      if (!fs.existsSync(path.join(root, reference)))
        errors.push(`contract audit: ${record.skill} unresolved authority ${reference}`);
    for (const reference of record.tests ?? [])
      if (!fs.existsSync(path.join(root, reference)))
        errors.push(`contract audit: ${record.skill} unresolved test ${reference}`);
    for (const kind of [...(record.consumers ?? []), ...(record.produces ?? [])])
      if (!(CONTRACT_KINDS as readonly string[]).includes(kind))
        errors.push(`contract audit: ${record.skill} unknown contract kind ${kind}`);
    if (!record.handoff?.trim()) errors.push(`contract audit: ${record.skill} missing handoff`);
    if (!record.writes?.trim())
      errors.push(`contract audit: ${record.skill} missing write authority note`);
    if (!record.failureModes?.trim())
      errors.push(`contract audit: ${record.skill} missing failure modes`);
  }
  return errors.sort((left, right) => left.localeCompare(right));
}

function yamlArray(content: string, field: string): string[] {
  const match = content.match(new RegExp(`^\\s*${field}:\\s*\\[([^\\]]*)\\]`, 'm'));
  if (!match) throw new Error(`contract audit: missing structured field ${field}`);
  const values = match[1] ?? '';
  return values
    .split(',')
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

function stableId(skill: string): string {
  return `SAF-CONTRACT-${skill.slice('saf-'.length).toUpperCase().replaceAll('-', '_')}`;
}

export function buildContractAudit(root: string): ContractAudit {
  const records = OFFICIAL_SKILLS.map((skill) => {
    const sidecar = fs.readFileSync(path.join(root, 'skills', skill, 'saf-contract.yml'), 'utf8');
    return {
      id: stableId(skill),
      skill,
      authority: [`skills/${skill}/SKILL.md`, `skills/${skill}/saf-contract.yml`],
      consumers: yamlArray(sidecar, 'consumes'),
      produces: yamlArray(sidecar, 'produces'),
      prerequisites: yamlArray(sidecar, 'requires'),
      evidence: yamlArray(sidecar, 'baseline'),
      evidenceRequired: yamlArray(sidecar, 'evidence_required'),
      tests: ['scripts/check-skill-contracts.ts'],
      handoff: 'As declared by the Skill output and handoff standard when continuity is required.',
      writes: 'Human semantic review required; sidecars do not fully encode write authority.',
      failureModes:
        'Human semantic review required; structural parser validates declared contracts.',
      verificationStatus: 'structural-pass' as const,
      semanticReview: 'required' as const,
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  return { records };
}

export function renderContractAudit(audit: ContractAudit): string {
  const lines = [
    '# Contract audit',
    '',
    'Status: structural projection; semantic review required.',
    '',
    '| ID | Authority | Inputs | Outputs | Prerequisites | Evidence required | Tests | Semantic review |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const record of audit.records) {
    lines.push(
      `| ${record.id} | ${record.authority.join('<br>')} | ${record.consumers.join(', ') || 'none'} | ${record.produces.join(', ') || 'none'} | ${record.prerequisites.join(', ') || 'none'} | ${record.evidenceRequired.join(', ') || 'none'} | ${record.tests.join(', ')} | ${record.semanticReview} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1]?.endsWith('generate-contract-audit.ts')) {
  const root = path.resolve(__dirname, '..');
  const output =
    process.env.SAF_CONTRACT_AUDIT_REPORT ||
    path.join(root, '.local', 'gmm', 'sdd-agentic-flow', 'v7.15.0-contract-audit.md');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const audit = buildContractAudit(root);
  const errors = validateContractAudit(audit, root);
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
  fs.writeFileSync(output, renderContractAudit(audit), 'utf8');
  console.log(`PASS contract audit: ${output}`);
}
