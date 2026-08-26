import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseSkillContract } from '../src/skill-contract';

const VALID = `schema: saf-skill-contract/v1
extends: null
requires: [spec-package]
consumes: []
produces: [task-prompts]
baseline: [tlc-spec-driven, tdd]
depends_on: []
conflicts: []
requires_cli: null
autonomy_profile:
  supported_levels: [manual, supervised]
  auto_continue_condition: 'human decision'
  blocking_conditions: [missing_spec]
  evidence_required: [prompts.md]
`;

test('parseSkillContract accepts the canonical restricted subset', () => {
  const contract = parseSkillContract(VALID);
  assert.equal(contract.schema, 'saf-skill-contract/v1');
  assert.deepEqual(contract.requires, ['spec-package']);
});

test('parseSkillContract rejects ambiguous or executable YAML features', () => {
  for (const replacement of [
    'requires: &items [spec-package]',
    'requires: *items',
    'requires: !custom value',
    '<<: { requires: [] }',
    '---',
    '? complex',
    'requires: []\nrequires: []',
  ]) {
    assert.throws(() => parseSkillContract(VALID.replace('requires: [spec-package]', replacement)));
  }
});
