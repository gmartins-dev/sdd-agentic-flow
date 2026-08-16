import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compareVersions, parseVersion, satisfiesRange } from '../src/version-compat';

test('parseVersion accepts valid x.y.z and rejects malformed input', () => {
  assert.deepEqual(parseVersion('0.9.0'), { major: 0, minor: 9, patch: 0 });
  assert.deepEqual(parseVersion('12.34.56'), { major: 12, minor: 34, patch: 56 });
  for (const invalid of ['0.9', '0.9.0.1', 'v0.9.0', '0.9.x', '', null, undefined, 42]) {
    assert.equal(parseVersion(invalid), null, JSON.stringify(invalid));
  }
});

test('compareVersions orders by major, then minor, then patch, and returns null for invalid input', () => {
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.0.0', '1.0.1'), -1);
  assert.equal(compareVersions('1.0.1', '1.0.0'), 1);
  assert.equal(compareVersions('1.1.0', '1.0.9'), 1);
  assert.equal(compareVersions('2.0.0', '1.9.9'), 1);
  assert.equal(compareVersions('0.9.0', '0.9'), null);
  assert.equal(compareVersions('bogus', '0.9.0'), null);
});

test('satisfiesRange supports exact, >=, and ^ ranges deterministically', () => {
  assert.equal(satisfiesRange('0.9.0', '0.9.0'), true);
  assert.equal(satisfiesRange('0.9.1', '0.9.0'), false);

  assert.equal(satisfiesRange('0.9.0', '>=0.9.0'), true);
  assert.equal(satisfiesRange('0.10.0', '>=0.9.0'), true);
  assert.equal(satisfiesRange('0.8.9', '>=0.9.0'), false);

  assert.equal(satisfiesRange('0.9.5', '^0.9.0'), true);
  assert.equal(satisfiesRange('0.9.0', '^0.9.0'), true);
  assert.equal(satisfiesRange('0.8.9', '^0.9.0'), false);
  assert.equal(satisfiesRange('1.0.0', '^0.9.0'), false);

  for (const bogus of ['not-a-range', '>=', '^', '~0.9.0', ''] as string[]) {
    assert.equal(satisfiesRange('0.9.0', bogus), false, JSON.stringify(bogus));
  }
  assert.equal(satisfiesRange('0.9.0', null as unknown as string), false);
  assert.equal(satisfiesRange('0.9.0', undefined as unknown as string), false);
  assert.equal(satisfiesRange('bogus', '>=0.9.0'), false);
});
