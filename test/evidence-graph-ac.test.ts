import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { evidenceGraphExitCode } from '../src/doctor';
import { formatEvidenceGraph } from '../src/doctor-view';
import {
  collectEvidenceGraph,
  type EvidenceGraphResult,
  parseAcceptanceCriteria,
  parseTaskRequirementAnchors,
} from '../src/evidence-graph';
import { renderEvidenceGraphHtml } from '../src/evidence-graph-html';

const fixtureRoot = path.join(__dirname, 'fixtures', 'v8.4');
const feature = 'ac-feature';

function record(id: string, anchor: string): string {
  return `### ${id}

Requirement anchors: ${anchor}
Sensor: sensor-${anchor.toLowerCase()}
Sensor class: unitary
Oracle: ${anchor} acceptance criterion
Seam: counter
Surface: src/counter.ts
Revision: 0123456789abcdef0123456789abcdef01234567
Run state before: clean
Run state after: clean
Inputs:
| Path | SHA-256 | Status | Reason |
| --- | --- | --- | --- |
Command: npx tsx --test test/counter.test.ts
Exit status: 0
Observation: pass
Observation digest: sha256:d74ff0ee8da3b9806b18c877dbf29bbde50b5bd8e4dad7a3a725000feb82e8f1
Result: pass
Freshness: current
Confidence limit: Declared scope does not trace runtime-loaded dependencies.
`;
}

function v1Check(task: string, anchors: string[]): string {
  const rows = anchors.map(
    (anchor, index) =>
      `| ${anchor} | sensor-${anchor.toLowerCase()} | EV-00${index + 1} | pass | current |`,
  );
  const records = anchors.map((anchor, index) => record(`EV-00${index + 1}`, anchor));
  return `# Task check — ${task}

Feature: ${feature}
Evidence contract: saf-evidence/v1
Report ID: 123e4567-e89b-42d3-a456-426614174000
Report scope: check:${feature}:${task}
Supersedes: none

## Evidence

| Requirement anchor | Sensor | Record IDs | Result | Freshness |
| --- | --- | --- | --- | --- |
${rows.join('\n')}

## Evidence records

${records.join('\n')}`;
}

function graph(spec: string, tasks: string, evidenceAnchors?: string[]): EvidenceGraphResult {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-graph-ac-'));
  try {
    const specDir = path.join(temp, '.specs', 'features', feature);
    fs.mkdirSync(specDir, { recursive: true });
    fs.copyFileSync(path.join(fixtureRoot, spec), path.join(specDir, 'spec.md'));
    fs.copyFileSync(path.join(fixtureRoot, tasks), path.join(specDir, 'tasks.md'));
    if (evidenceAnchors) {
      const reports = path.join(temp, '.sdd-agentic-flow', 'reports');
      fs.mkdirSync(reports, { recursive: true });
      fs.writeFileSync(path.join(reports, 'T1-check.md'), v1Check('T1', evidenceAnchors));
    }
    return collectEvidenceGraph(temp, feature);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

const status = (result: EvidenceGraphResult, acId: string) =>
  result.acceptanceCriteria?.find((node) => node.acId === acId)?.status;

test('parseAcceptanceCriteria reads the documented form and reports lookalikes', () => {
  const parsed = parseAcceptanceCriteria(
    '- AC-1 (REQ-1): ok\n- AC-2: no parent\n  - AC-3 (REQ-1): indented\n- plain bullet\n',
  );
  assert.deepEqual(parsed.criteria, [{ acId: 'AC-1', reqId: 'REQ-1' }]);
  assert.equal(parsed.malformed.length, 2);
});

test('task anchors accept AC-* alongside REQ-*', () => {
  const map = parseTaskRequirementAnchors(
    '# Tasks\n\n## T1\nRequirement anchors: REQ-1, AC-1, X-9\n',
  );
  assert.deepEqual(map.get('T1'), ['REQ-1', 'AC-1']);
});

test('AC coverage is current when every AC has current evidence', () => {
  const result = graph('spec-ac.md', 'tasks-ac.md', ['AC-1', 'AC-2']);
  assert.equal(status(result, 'AC-1'), 'current');
  assert.equal(status(result, 'AC-2'), 'current');
  assert.equal(result.requirements[0]?.status, 'current');
  assert.equal(result.contractCompatible, true);
});

test('a REQ is covered only when all of its ACs are', () => {
  const result = graph('spec-ac.md', 'tasks-ac.md', ['AC-1']);
  assert.equal(status(result, 'AC-1'), 'current');
  assert.equal(status(result, 'AC-2'), 'no-ac-evidence');
  assert.equal(result.requirements[0]?.status, 'no-ac-evidence');
});

test('an AC without a task anchor is not covered by its REQ', () => {
  const result = graph('spec-ac.md', 'tasks-ac-partial.md', ['AC-1']);
  assert.equal(status(result, 'AC-2'), 'no-task-anchor');
  assert.equal(result.requirements[0]?.status, 'no-task-anchor');
});

test('unknown AC anchors in tasks become their own broken edge', () => {
  const result = graph('spec-ac.md', 'tasks-ac-unknown-anchor.md', ['AC-1', 'AC-2']);
  assert.equal(status(result, 'AC-9'), 'unknown-ac-anchor');
  assert.equal(result.requirements[0]?.status, 'current');
});

test('duplicate AC IDs stop the graph', () => {
  const result = graph('spec-duplicate-ac.md', 'tasks-ac.md');
  assert.equal(status(result, 'AC-1'), 'duplicate-ac-id');
  assert.equal(result.contractCompatible, false);
  assert.match(result.errors.join(' '), /duplicate AC/);
});

test('an AC naming an undeclared REQ is a broken edge', () => {
  const result = graph('spec-ac-unknown-req.md', 'tasks-ac.md', ['AC-1', 'AC-2']);
  assert.equal(status(result, 'AC-2'), 'ac-unknown-requirement');
});

test('malformed AC lines are diagnosed and never counted as coverage', () => {
  const result = graph('spec-malformed-ac.md', 'tasks-ac.md', ['AC-1']);
  assert.match(result.errors.join(' '), /malformed AC line: - AC-2: forgot/);
  assert.equal(result.acceptanceCriteria?.length, 2);
});

test('views list ACs under their REQ and omit the section without ACs', () => {
  const result = graph('spec-ac.md', 'tasks-ac.md', ['AC-1']);
  const text = formatEvidenceGraph(result);
  assert.match(text, /REQ-1: no-ac-evidence[\s\S]* {2}AC-1: current\n {2}AC-2: no-ac-evidence/);
  const html = renderEvidenceGraphHtml(result);
  assert.match(html, /AC-2<\/th><td>no-ac-evidence/);
  const plain = graph('spec-ac.md', 'tasks-ac.md');
  assert.ok(plain.acceptanceCriteria);
  const noAc = collectEvidenceGraph(os.tmpdir(), 'missing-feature');
  assert.equal('acceptanceCriteria' in noAc, false);
});

test('every AC broken edge makes doctor --evidence-graph exit 1', () => {
  const broken: Array<[string, string, string[] | undefined]> = [
    ['spec-duplicate-ac.md', 'tasks-ac.md', undefined],
    ['spec-ac-unknown-req.md', 'tasks-ac.md', ['AC-1', 'AC-2']],
    ['spec-ac.md', 'tasks-ac-unknown-anchor.md', ['AC-1', 'AC-2']],
    ['spec-ac.md', 'tasks-ac.md', ['AC-1']],
    ['spec-malformed-ac.md', 'tasks-ac.md', ['AC-1']],
  ];
  for (const [spec, tasks, anchors] of broken)
    assert.equal(evidenceGraphExitCode(graph(spec, tasks, anchors)), 1, spec);
  assert.equal(evidenceGraphExitCode(graph('spec-ac.md', 'tasks-ac.md', ['AC-1', 'AC-2'])), 0);
});

test('AC rows in the HTML view are escaped', () => {
  const result = graph('spec-ac.md', 'tasks-ac.md', ['AC-1', 'AC-2']);
  const [first] = result.acceptanceCriteria ?? [];
  assert.ok(first);
  first.acId = '<img src=x>';
  assert.doesNotMatch(renderEvidenceGraphHtml(result), /<img\b/);
});
