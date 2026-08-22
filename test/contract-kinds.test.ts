import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CONTRACT_KINDS, unknownContractKinds } from '../src/contract-kinds';

test('contract-kind registry covers the current capability-contract vocabulary', () => {
  const expected = [
    'config',
    'source-item',
    'task-identity',
    'task-evidence',
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
    'check-report',
    'change-review-package',
    'review-findings',
    'fix-evidence',
    'validation-report',
  ];
  assert.deepEqual([...CONTRACT_KINDS].sort(), expected.sort());
});

test('unknown contract kinds are reported by field without imposing unrelated vocabularies', () => {
  assert.deepEqual(
    unknownContractKinds({
      requires: ['config', 'unknown-requirement'],
      consumes: ['project-context'],
      produces: ['unknown-output'],
    }),
    [
      { field: 'requires', value: 'unknown-requirement' },
      { field: 'produces', value: 'unknown-output' },
    ],
  );
});
