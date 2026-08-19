import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { checkProductPositioning } from '../scripts/check-product-positioning';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-positioning-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

function fixture(extra = '') {
  const root = fs.mkdtempSync(path.join(temporary, 'repo-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'README.md'), 'Spec-Driven Agentic Workflow Harness');
  fs.writeFileSync(path.join(root, 'README.pt-BR.md'), 'Spec-Driven Agentic Workflow Harness');
  fs.writeFileSync(
    path.join(root, 'package.json'),
    '{"description":"Spec-Driven Agentic Workflow Harness"}',
  );
  fs.writeFileSync(
    path.join(root, 'docs/engineering-model.md'),
    'Agentic Workflow Harness\nSpec-Driven Agentic Workflow Harness\nSpec-Driven Coding-Agent Workflow Harness\nrepository-native engineering control plane',
  );
  fs.writeFileSync(path.join(root, 'docs/sdd-agentic-flow-model.md'), extra);
  fs.writeFileSync(path.join(root, 'docs/why-this-exists.md'), '');
  return root;
}

test('product-positioning accepts current active surfaces and legitimate role wording', () => {
  assert.deepEqual(checkProductPositioning(fixture()), []);
});

test('product-positioning rejects missing category and retired active wording', () => {
  const missing = fixture();
  fs.writeFileSync(path.join(missing, 'README.md'), '');
  assert.match(checkProductPositioning(missing)[0]!.message, /missing required/);
  const retired = fixture('Skills are the execution layer');
  assert.ok(
    checkProductPositioning(retired).some((finding) => /retired phrase/.test(finding.message)),
  );
});

test('product-positioning ignores historical-only occurrences', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'CHANGELOG.md'), 'Mental model (4 layers + SDD)');
  assert.deepEqual(checkProductPositioning(root), []);
});
