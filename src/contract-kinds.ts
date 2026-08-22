const CONTRACT_KINDS = Object.freeze([
  'config',
  'source-item',
  'task-identity',
  'spec-package',
  'discovery-state',
  'spec-ready-brief',
  'domain-glossary',
  'project-context',
  'route-recommendation',
  'project-config',
  'task-prompts',
  'code-change+tdd-evidence',
  'explanation',
  'execution-plan',
  'multi-task-evidence',
  'task-evidence',
  'check-report',
  'change-review-package',
  'review-findings',
  'fix-evidence',
  'validation-report',
] as const);

type ContractKind = (typeof CONTRACT_KINDS)[number];
type ContractField = 'requires' | 'consumes' | 'produces';

function isContractKind(value: string): value is ContractKind {
  return (CONTRACT_KINDS as readonly string[]).includes(value);
}

function unknownContractKinds(fields: Partial<Record<ContractField, readonly string[]>>): Array<{
  field: ContractField;
  value: string;
}> {
  const unknown: Array<{ field: ContractField; value: string }> = [];
  for (const field of ['requires', 'consumes', 'produces'] as const)
    for (const value of fields[field] ?? [])
      if (!isContractKind(value)) unknown.push({ field, value });
  return unknown;
}

export type { ContractField, ContractKind };
export { CONTRACT_KINDS, isContractKind, unknownContractKinds };
