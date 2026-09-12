import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  analyzeConsumerClosure,
  type ConsumerClosureEntry,
  consumerClosureExitCode,
  expectedInstalledPaths,
} from '../scripts/consumer-closure';

test('maps consumer closure statuses to stable process exit codes', () => {
  assert.equal(consumerClosureExitCode('PASS'), 0);
  assert.equal(consumerClosureExitCode('FAIL'), 1);
  assert.equal(consumerClosureExitCode('INCONCLUSIVE'), 2);
});

function tree(entries: ConsumerClosureEntry[]) {
  return { entries, expectedPaths: expectedInstalledPaths() };
}

const required: ConsumerClosureEntry[] = expectedInstalledPaths().map((relativePath) => ({
  relativePath,
  kind: 'file' as const,
  content: relativePath.endsWith('.md') ? '# Ready\n' : 'ready\n',
}));

test('consumer closure accepts a complete self-contained tree', () => {
  const result = analyzeConsumerClosure(tree(required));
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.findings, []);
});

test('consumer closure rejects missing files, unexpected skill files, and escaped links', () => {
  const entries = required.filter((entry) => entry.relativePath !== 'saf-route/saf-contract.yml');
  entries.push({ relativePath: 'saf-route/notes.md', kind: 'file', content: '# Unexpected\n' });
  entries.find((entry) => entry.relativePath === 'saf-route/SKILL.md')!.content =
    '[escape](../../outside.md)\n';
  const result = analyzeConsumerClosure(tree(entries));
  assert.equal(result.status, 'FAIL');
  assert.ok(result.findings.some((finding) => finding.rule === 'SAF-CLOSURE-001'));
  assert.ok(result.findings.some((finding) => finding.rule === 'SAF-CLOSURE-002'));
  assert.ok(result.findings.some((finding) => finding.rule === 'SAF-CLOSURE-004'));
});

test('consumer closure resolves inline, reference-style, and fragment links', () => {
  const entries = required.map((entry) => ({ ...entry }));
  const skill = entries.find((entry) => entry.relativePath === 'saf-route/SKILL.md')!;
  skill.content =
    '[inline](../sdd-agentic-flow-shared/references/tlc-baseline.md#ready)\n' +
    '[reference][baseline]\n\n[baseline]: ../sdd-agentic-flow-shared/references/tlc-baseline.md#ready\n';
  entries.find(
    (entry) => entry.relativePath === 'sdd-agentic-flow-shared/references/tlc-baseline.md',
  )!.content = '# Ready\n';
  const result = analyzeConsumerClosure(tree(entries));
  assert.equal(result.status, 'PASS');
});

test('consumer closure reports malformed content as inconclusive and source-only literals as failures', () => {
  const entries = required.map((entry) => ({ ...entry }));
  entries.find((entry) => entry.relativePath === 'saf-route/SKILL.md')!.readError = 'invalid UTF-8';
  entries.find((entry) => entry.relativePath === 'saf-check-task/SKILL.md')!.content =
    '`scripts/check-skills.sh`\n';
  const result = analyzeConsumerClosure(tree(entries));
  assert.equal(result.status, 'INCONCLUSIVE');
  assert.ok(result.findings.some((finding) => finding.rule === 'SAF-CLOSURE-005'));
  assert.ok(result.findings.some((finding) => finding.rule === 'SAF-CLOSURE-007'));
});

test('consumer closure rejects unclassified shared files and root-escaping symlinks', () => {
  const entries = required.map((entry) => ({ ...entry }));
  entries.push({
    relativePath: 'sdd-agentic-flow-shared/foreign.md',
    kind: 'file',
    content: '# Foreign\n',
  });
  const skill = entries.find((entry) => entry.relativePath === 'saf-route/SKILL.md')!;
  skill.kind = 'symlink';
  skill.target = '../../outside.md';
  delete skill.content;
  const result = analyzeConsumerClosure(tree(entries));
  assert.equal(result.status, 'FAIL');
  assert.ok(result.findings.some((finding) => finding.rule === 'SAF-CLOSURE-003'));
  assert.ok(result.findings.some((finding) => finding.rule === 'SAF-CLOSURE-006'));
});

test('consumer closure orders occurrence identities deterministically', () => {
  const entries = required.map((entry) => ({ ...entry }));
  entries.find((entry) => entry.relativePath === 'saf-route/SKILL.md')!.content =
    '[missing-b](missing-b.md)\n[missing-a](missing-a.md)\n';
  const first = analyzeConsumerClosure(tree(entries));
  const second = analyzeConsumerClosure(tree([...entries].reverse()));
  assert.deepEqual(first, second);
});
