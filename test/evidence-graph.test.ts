import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  collectEvidenceGraph,
  findDuplicateReqIds,
  findTaskDependencyCycle,
  parseCheckReport,
  parseRequirementIds,
  parseTaskDependencies,
  parseTaskRequirementAnchors,
} from '../src/evidence-graph';
import { collectPurgeTargets } from '../src/uninstall';

const fixtureRoot = path.join(__dirname, 'fixtures', 'v4');

test('parseRequirementIds extracts REQ-* headings', () => {
  const content = fs.readFileSync(path.join(fixtureRoot, 'valid-spec.md'), 'utf8');
  assert.deepEqual(parseRequirementIds(content), ['REQ-1', 'REQ-2']);
});

test('findDuplicateReqIds detects duplicates', () => {
  assert.deepEqual(findDuplicateReqIds(['REQ-1', 'REQ-1']), ['REQ-1']);
});

test('parseTaskRequirementAnchors maps tasks to REQ anchors', () => {
  const content = fs.readFileSync(path.join(fixtureRoot, 'valid-tasks.md'), 'utf8');
  const map = parseTaskRequirementAnchors(content);
  assert.deepEqual(map.get('T1'), ['REQ-1']);
});

test('parseCheckReport reads feature identity and evidence table', () => {
  const content = fs.readFileSync(path.join(fixtureRoot, 'valid-check.md'), 'utf8');
  const parsed = parseCheckReport(content);
  assert.equal(parsed.featureSlug, 'sample-feature');
  assert.equal(parsed.taskId, 'T1');
  assert.equal(parsed.evidenceRows[0]?.freshness, 'current');
  assert.equal(parsed.hasDetailedEvidence, true);
});

test('legacy check without Feature is non-v4 for graph', () => {
  const content = fs.readFileSync(path.join(fixtureRoot, 'legacy-check.md'), 'utf8');
  const parsed = parseCheckReport(content);
  assert.equal(parsed.featureSlug, null);
});

test('collectEvidenceGraph reports current path for valid v4 package', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-graph-'));
  const feature = 'sample-feature';
  const specDir = path.join(temp, '.specs', 'features', feature);
  fs.mkdirSync(path.join(temp, '.sdd-agentic-flow', 'reports'), { recursive: true });
  fs.mkdirSync(specDir, { recursive: true });
  fs.copyFileSync(path.join(fixtureRoot, 'valid-spec.md'), path.join(specDir, 'spec.md'));
  fs.copyFileSync(path.join(fixtureRoot, 'valid-tasks.md'), path.join(specDir, 'tasks.md'));
  fs.copyFileSync(
    path.join(fixtureRoot, 'valid-check.md'),
    path.join(temp, '.sdd-agentic-flow', 'reports', 'T1-check.md'),
  );
  const result = collectEvidenceGraph(temp, feature);
  assert.equal(result.requirements.find((node) => node.reqId === 'REQ-1')?.status, 'current');
  fs.rmSync(temp, { recursive: true, force: true });
});

test('collectEvidenceGraph marks unanchored requirements as no-task-anchor', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-graph-anchor-'));
  const feature = 'sample-feature';
  const specDir = path.join(temp, '.specs', 'features', feature);
  fs.mkdirSync(specDir, { recursive: true });
  fs.copyFileSync(path.join(fixtureRoot, 'valid-spec.md'), path.join(specDir, 'spec.md'));
  fs.copyFileSync(path.join(fixtureRoot, 'valid-tasks.md'), path.join(specDir, 'tasks.md'));
  const result = collectEvidenceGraph(temp, feature);
  assert.equal(
    result.requirements.find((node) => node.reqId === 'REQ-2')?.status,
    'no-task-anchor',
  );
  fs.rmSync(temp, { recursive: true, force: true });
});

test('collectPurgeTargets preserves ambiguous legacy .sdd', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-purge-'));
  fs.mkdirSync(path.join(temp, '.sdd', 'unknown-tool'), { recursive: true });
  const targets = collectPurgeTargets(temp, temp);
  const legacy = targets.find((target) => target.kind === 'legacy-sdd-root');
  assert.ok(legacy?.preserve);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('collectEvidenceGraph rejects duplicate REQ-* IDs', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-graph-dup-'));
  const feature = 'dup-feature';
  const specDir = path.join(temp, '.specs', 'features', feature);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(
    path.join(specDir, 'spec.md'),
    '# Specification — dup\n\n## Requirement REQ-1: a\n\n## Requirement REQ-1: b\n\n## Acceptance criteria\n- x\n',
  );
  fs.writeFileSync(
    path.join(specDir, 'tasks.md'),
    '# Tasks — dup\n\n## T1\nRequirement anchors: REQ-1\nDependencies:\n',
  );
  const result = collectEvidenceGraph(temp, feature);
  assert.match(result.errors.join(' '), /duplicate REQ/);
  fs.rmSync(temp, { recursive: true, force: true });
});

test('collectEvidenceGraph isolates cross-feature task IDs', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-graph-xfeat-'));
  for (const feature of ['feature-a', 'feature-b']) {
    const specDir = path.join(temp, '.specs', 'features', feature);
    fs.mkdirSync(path.join(temp, '.sdd-agentic-flow', 'reports'), { recursive: true });
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(
      path.join(specDir, 'spec.md'),
      `# Specification — ${feature}\n\n## Requirement REQ-1: one\n\n## Acceptance criteria\n- one\n`,
    );
    fs.writeFileSync(
      path.join(specDir, 'tasks.md'),
      `# Tasks — ${feature}\n\n## T1\nRequirement anchors: REQ-1\nDependencies:\n`,
    );
  }
  fs.writeFileSync(
    path.join(temp, '.sdd-agentic-flow', 'reports', 'feature-b-check.md'),
    `# Task check — T1\n\nFeature: feature-b\n\n## Evidence\n\n| Requirement anchor | Sensor | Result | Freshness |\n| --- | --- | --- | --- |\n| REQ-1 | npm test | pass | current |\n\nCommand: npm test\nExit status: 0\nObservable result: pass\nRequirement mapping: REQ-1\n`,
  );
  const resultA = collectEvidenceGraph(temp, 'feature-a');
  assert.notEqual(resultA.requirements.find((node) => node.reqId === 'REQ-1')?.status, 'current');
  const resultB = collectEvidenceGraph(temp, 'feature-b');
  assert.equal(resultB.requirements.find((node) => node.reqId === 'REQ-1')?.status, 'current');
  fs.rmSync(temp, { recursive: true, force: true });
});

test('collectPurgeTargets lists owned SAF skill directories', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-purge-owned-'));
  const skillRoot = path.join(temp, '.agents', 'skills', 'saf-setup');
  fs.mkdirSync(skillRoot, { recursive: true });
  fs.writeFileSync(path.join(skillRoot, 'SKILL.md'), '# setup\n');
  const targets = collectPurgeTargets(temp, temp);
  assert.ok(targets.some((target) => target.path.endsWith('saf-setup')));
  fs.rmSync(temp, { recursive: true, force: true });
});

test('parseCheckReport detects stale freshness and summary-only gaps', () => {
  const stale = fs.readFileSync(path.join(fixtureRoot, 'stale-check.md'), 'utf8');
  assert.equal(parseCheckReport(stale).evidenceRows[0]?.freshness, 'stale');
  const summary = fs.readFileSync(path.join(fixtureRoot, 'summary-only-check.md'), 'utf8');
  const parsed = parseCheckReport(summary);
  assert.equal(parsed.hasDetailedEvidence, false);
});

test('collectEvidenceGraph marks stale and summary-only evidence correctly', () => {
  const staleTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-graph-stale-'));
  const feature = 'sample-feature';
  let specDir = path.join(staleTemp, '.specs', 'features', feature);
  fs.mkdirSync(path.join(staleTemp, '.sdd-agentic-flow', 'reports'), { recursive: true });
  fs.mkdirSync(specDir, { recursive: true });
  fs.copyFileSync(path.join(fixtureRoot, 'valid-spec.md'), path.join(specDir, 'spec.md'));
  fs.copyFileSync(path.join(fixtureRoot, 'valid-tasks.md'), path.join(specDir, 'tasks.md'));
  fs.copyFileSync(
    path.join(fixtureRoot, 'stale-check.md'),
    path.join(staleTemp, '.sdd-agentic-flow', 'reports', 'T1-stale.md'),
  );
  const staleResult = collectEvidenceGraph(staleTemp, feature);
  assert.equal(staleResult.requirements.find((node) => node.reqId === 'REQ-1')?.status, 'stale');
  fs.rmSync(staleTemp, { recursive: true, force: true });

  const summaryTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-graph-summary-'));
  specDir = path.join(summaryTemp, '.specs', 'features', feature);
  fs.mkdirSync(path.join(summaryTemp, '.sdd-agentic-flow', 'reports'), { recursive: true });
  fs.mkdirSync(specDir, { recursive: true });
  fs.copyFileSync(path.join(fixtureRoot, 'valid-spec.md'), path.join(specDir, 'spec.md'));
  fs.copyFileSync(path.join(fixtureRoot, 'valid-tasks.md'), path.join(specDir, 'tasks.md'));
  fs.copyFileSync(
    path.join(fixtureRoot, 'summary-only-check.md'),
    path.join(summaryTemp, '.sdd-agentic-flow', 'reports', 'T1-summary.md'),
  );
  const summaryResult = collectEvidenceGraph(summaryTemp, feature);
  assert.equal(
    summaryResult.requirements.find((node) => node.reqId === 'REQ-1')?.status,
    'no-current-evidence',
  );
  fs.rmSync(summaryTemp, { recursive: true, force: true });
});

test('findTaskDependencyCycle detects cyclic task dependencies', () => {
  const content = fs.readFileSync(path.join(fixtureRoot, 'cyclic-tasks.md'), 'utf8');
  const deps = parseTaskDependencies(content);
  const cycle = findTaskDependencyCycle(deps);
  assert.ok(cycle?.includes('T1') && cycle.includes('T2'));
});

test('parseTaskRequirementAnchors resolves titled task headings', () => {
  const content = fs.readFileSync(
    path.join(__dirname, '../examples/golden/task-management/tasks.md'),
    'utf8',
  );
  const map = parseTaskRequirementAnchors(content);
  assert.deepEqual(map.get('T1'), ['REQ-1']);
  assert.ok(map.get('T2')?.includes('REQ-2'));
});
