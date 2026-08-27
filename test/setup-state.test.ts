import assert from 'node:assert/strict';
import { test } from 'node:test';

import { classifySetupState } from '../src/setup-state';

test('classifies setup from durable facts without requiring config', () => {
  assert.equal(
    classifySetupState({ config: 'absent', workspace: 'absent', skills: 'absent', context: false }),
    'Fresh',
  );
  assert.equal(
    classifySetupState({ config: 'absent', workspace: 'valid', skills: 'complete', context: true }),
    'Ready',
  );
  assert.equal(
    classifySetupState({ config: 'valid', workspace: 'valid', skills: 'partial', context: true }),
    'Incomplete',
  );
  assert.equal(
    classifySetupState({
      config: 'valid',
      workspace: 'valid',
      skills: 'complete',
      context: true,
      attention: true,
    }),
    'Attention',
  );
  assert.equal(
    classifySetupState({
      config: 'invalid',
      workspace: 'valid',
      skills: 'complete',
      context: true,
    }),
    'Blocked',
  );
});
