import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import {
  certifyConsumerClosure,
  inspectSourceProjection,
} from '../scripts/consumer-closure-certification';

const root = path.resolve(__dirname, '..');

test('source projection is complete and reports deterministic closure findings', () => {
  const result = inspectSourceProjection(root);
  assert.equal(result.inspectedPaths.length > 0, true);
  assert.deepEqual(
    result.inspectedPaths,
    [...result.inspectedPaths].sort((left, right) => left.localeCompare(right)),
  );
});

test('dist certification installs and inspects project and every user target', (t) => {
  if (!fs.existsSync(path.join(root, 'dist', 'sdd-agentic-flow.js'))) {
    t.skip('dist is not built');
    return;
  }
  const report = certifyConsumerClosure({ profile: 'dist', repoRoot: root });
  assert.equal(report.scopes.length, 5);
  assert.deepEqual(
    report.scopes.map((scope) => scope.id),
    ['project', 'user:agents', 'user:claude', 'user:copilot', 'user:cursor'],
  );
  assert.ok(report.scopes.every((scope) => scope.result.status === 'PASS'));
});
