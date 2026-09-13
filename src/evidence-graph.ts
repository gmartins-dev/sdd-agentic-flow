import fs from 'node:fs';
import path from 'node:path';

import {
  type EvidenceFreshness,
  type EvidenceRecord,
  type EvidenceResult,
  parseEvidenceReport,
  validateEvidenceRecordFreshness,
} from './evidence-contract';

export type BrokenEdge =
  | 'no-task-anchor'
  | 'no-task-check'
  | 'no-current-evidence'
  | 'duplicate-req-id'
  | 'legacy-report'
  | 'invalid-report'
  | 'ambiguous-report'
  | 'inconclusive';

export type RequirementGraphNode = {
  reqId: string;
  status: 'current' | 'stale' | BrokenEdge;
  taskIds: string[];
  checkReports: string[];
};

export type EvidenceGraphReport = {
  path: string;
  scope: string | null;
  reportId: string | null;
  digest: string | null;
  kind: 'active' | 'superseded' | 'legacy' | 'invalid' | 'ambiguous';
  reason: string | null;
};

export type EvidenceGraphResult = {
  featureSlug: string;
  evidenceContract: 'saf-evidence/v1';
  contractCompatible: boolean;
  requirements: RequirementGraphNode[];
  reports: EvidenceGraphReport[];
  errors: string[];
};

type EvidenceIndexRow = {
  anchor: string;
  sensor: string;
  recordIds: string[];
  result: EvidenceResult;
  freshness: EvidenceFreshness;
};

type ParsedReport = {
  path: string;
  content: string;
  featureSlug: string | null;
  taskId: string | null;
  report: NonNullable<ReturnType<typeof parseEvidenceReport>> | null;
  index: EvidenceIndexRow[];
};

const REQ_HEADING = /^(?:## Requirement |### )(REQ-[A-Za-z0-9-]+)/gm;
const TASK_ID = /^(T\d+[A-Za-z0-9-]*)/;
const REQUIREMENT_ANCHORS = /^Requirement anchors:\s*(.+)$/m;
const TASK_DEPENDENCIES = /^Dependencies:\s*(.*)$/m;
const FEATURE_LINE = /^Feature:\s*(.+)$/m;
const TASK_HEADING = /^# Task check — (.+)$/m;
const INDEX_HEADER = '| Requirement anchor | Sensor | Record IDs | Result | Freshness |';

function readIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

export function parseRequirementIds(specContent: string): string[] {
  const ids: string[] = [];
  for (const match of specContent.matchAll(REQ_HEADING)) {
    const id = match[1];
    if (id) ids.push(id);
  }
  return ids;
}

export function findDuplicateReqIds(reqIds: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of reqIds) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

export function parseTaskRequirementAnchors(tasksContent: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const sections = tasksContent.split(/^## /m).slice(1);
  for (const section of sections) {
    const taskId = section.split('\n')[0]?.trim().match(TASK_ID)?.[1];
    if (!taskId) continue;
    const raw = section.match(REQUIREMENT_ANCHORS)?.[1] ?? '';
    map.set(
      taskId,
      raw
        .split(',')
        .map((value) => value.trim())
        .filter((value) => /^REQ-/.test(value)),
    );
  }
  return map;
}

export function parseTaskDependencies(tasksContent: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const sections = tasksContent.split(/^## /m).slice(1);
  for (const section of sections) {
    const taskId = section.split('\n')[0]?.trim().match(TASK_ID)?.[1];
    if (!taskId) continue;
    const raw = section.match(TASK_DEPENDENCIES)?.[1]?.trim() ?? '';
    map.set(
      taskId,
      raw && !/^none$/i.test(raw)
        ? raw
            .split(',')
            .map((value) => value.trim())
            .filter((value) => TASK_ID.test(value))
        : [],
    );
  }
  return map;
}

export function findTaskDependencyCycle(deps: Map<string, string[]>): string[] | null {
  const color = new Map([...deps.keys()].map((task) => [task, 0]));
  const stack: string[] = [];
  let found: string[] | null = null;
  const visit = (task: string) => {
    color.set(task, 1);
    stack.push(task);
    for (const dependency of deps.get(task) ?? []) {
      if (!deps.has(dependency)) continue;
      if (color.get(dependency) === 1) {
        found = [...stack.slice(stack.indexOf(dependency)), dependency];
        return;
      }
      if (color.get(dependency) === 0) visit(dependency);
      if (found) return;
    }
    stack.pop();
    color.set(task, 2);
  };
  for (const task of deps.keys()) {
    if (color.get(task) === 0) visit(task);
    if (found) break;
  }
  return found;
}

function listMarkdownFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const results: string[] = [];
  const walk = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.md')) results.push(full);
    }
  };
  walk(root);
  return results;
}

function parseIndex(content: string): EvidenceIndexRow[] {
  const evidence = content.split(/^## Evidence\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  const lines = evidence.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.indexOf(INDEX_HEADER);
  if (start < 0 || lines[start + 1] !== '| --- | --- | --- | --- | --- |') return [];
  const rows: EvidenceIndexRow[] = [];
  for (let index = start + 2; lines[index]?.startsWith('|'); index += 1) {
    const line = lines[index];
    if (!line) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 5) continue;
    const [anchor, sensor, ids, result, freshness] = cells;
    if (
      !anchor ||
      !sensor ||
      !ids ||
      !['pass', 'fail', 'inconclusive', 'not-run'].includes(result ?? '') ||
      !['current', 'historical', 'stale', 'not-run', 'inconclusive'].includes(freshness ?? '')
    )
      continue;
    rows.push({
      anchor,
      sensor,
      recordIds: ids
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      result: result as EvidenceResult,
      freshness: freshness as EvidenceFreshness,
    });
  }
  return rows;
}

export function parseCheckReport(content: string): {
  taskId: string | null;
  featureSlug: string | null;
  evidenceRows: Array<{
    anchor: string;
    sensor: string;
    result: string;
    freshness: EvidenceFreshness;
  }>;
  hasDetailedEvidence: boolean;
} {
  const taskId = content.match(TASK_HEADING)?.[1]?.trim() ?? null;
  const featureSlug = content.match(FEATURE_LINE)?.[1]?.trim() ?? null;
  const evidence = content.split(/^## Evidence\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  const header = '| Requirement anchor | Sensor | Result | Freshness |';
  const lines = evidence.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.indexOf(header);
  const evidenceRows: Array<{
    anchor: string;
    sensor: string;
    result: string;
    freshness: EvidenceFreshness;
  }> = [];
  if (start >= 0 && lines[start + 1] === '| --- | --- | --- | --- |') {
    for (let index = start + 2; lines[index]?.startsWith('|'); index += 1) {
      const line = lines[index];
      if (!line) continue;
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (
        cells.length === 4 &&
        cells.every(Boolean) &&
        ['current', 'historical', 'stale', 'not-run'].includes(cells[3] ?? '')
      )
        evidenceRows.push({
          anchor: cells[0] ?? '',
          sensor: cells[1] ?? '',
          result: cells[2] ?? '',
          freshness: cells[3] as EvidenceFreshness,
        });
    }
  }
  const hasDetailedEvidence = [
    'Command',
    'Exit status',
    'Observable result',
    'Requirement mapping',
  ].every((label) => new RegExp(`^${label}:[ \\t]*\\S[^\\r\\n]*$`, 'im').test(evidence));
  return { taskId, featureSlug, evidenceRows, hasDetailedEvidence };
}

function parseReport(filePath: string): ParsedReport {
  const content = fs.readFileSync(filePath, 'utf8');
  return {
    path: filePath,
    content,
    featureSlug: content.match(FEATURE_LINE)?.[1]?.trim() ?? null,
    taskId: content.match(TASK_HEADING)?.[1]?.trim() ?? null,
    report: parseEvidenceReport(content),
    index: parseIndex(content),
  };
}

function aggregateResult(records: EvidenceRecord[]): EvidenceResult {
  if (records.some((record) => record.result === 'fail')) return 'fail';
  if (records.some((record) => record.result === 'inconclusive')) return 'inconclusive';
  if (records.some((record) => record.result === 'not-run')) return 'not-run';
  return 'pass';
}

function aggregateFreshness(root: string, records: EvidenceRecord[]): EvidenceFreshness {
  const values = records.map((record) => validateEvidenceRecordFreshness(root, record));
  if (values.includes('inconclusive')) return 'inconclusive';
  if (values.includes('stale')) return 'stale';
  if (values.includes('historical')) return 'historical';
  if (values.includes('not-run')) return 'not-run';
  return 'current';
}

function resolveScope(
  reports: ParsedReport[],
  scope: string,
  errors: string[],
): { active: ParsedReport | null; ambiguous: boolean } {
  const matching = reports.filter(
    (candidate) => candidate.report?.scope === scope && candidate.report.errors.length === 0,
  );
  if (!matching.length) return { active: null, ambiguous: false };
  const byId = new Map(matching.map((candidate) => [candidate.report?.reportId, candidate]));
  const predecessors = new Set<string>();
  let invalid = false;
  for (const candidate of matching) {
    const previous = candidate.report?.supersedes;
    if (!previous) continue;
    if (!byId.has(previous)) {
      errors.push(`missing predecessor ${previous} in ${scope}`);
      invalid = true;
    }
    predecessors.add(previous);
  }
  const terminals = matching.filter(
    (candidate) => !predecessors.has(candidate.report?.reportId ?? ''),
  );
  if (invalid || terminals.length !== 1) {
    errors.push(`ambiguous active report chain for ${scope}`);
    return { active: null, ambiguous: true };
  }
  return { active: terminals[0] ?? null, ambiguous: false };
}

function taskCoverage(
  root: string,
  report: ParsedReport,
  requirement: string,
): RequirementGraphNode['status'] {
  const contract = report.report;
  if (!contract) return 'invalid-report';
  const rows = report.index.filter((row) => row.anchor === requirement);
  if (!rows.length) return 'no-current-evidence';
  const seen = new Set<string>();
  for (const row of rows) {
    if (new Set(row.recordIds).size !== row.recordIds.length) return 'invalid-report';
    const pair = `${row.anchor}\u0000${row.sensor}`;
    if (seen.has(pair)) return 'invalid-report';
    seen.add(pair);
    const records = row.recordIds.map((id) => contract.records.find((record) => record.id === id));
    if (records.some((record) => !record)) return 'invalid-report';
    const joined = records.filter((record): record is EvidenceRecord => Boolean(record));
    if (
      joined.some(
        (record) =>
          !record.requirementAnchors.includes(requirement) || record.sensor !== row.sensor,
      )
    )
      return 'invalid-report';
    if (
      aggregateResult(joined) !== row.result ||
      aggregateFreshness(root, joined) !== row.freshness
    )
      return 'invalid-report';
    if (joined.some((record) => record.result !== 'pass')) return 'no-current-evidence';
    if (aggregateFreshness(root, joined) !== 'current')
      return aggregateFreshness(root, joined) === 'stale' ? 'stale' : 'inconclusive';
  }
  const indexed = new Set(report.index.flatMap((row) => row.recordIds));
  if (contract.records.some((record) => !indexed.has(record.id))) return 'invalid-report';
  return 'current';
}

export function collectEvidenceGraph(
  cwd: string,
  featureSlug: string,
  options: { specsRoot?: string; reportsRoot?: string } = {},
): EvidenceGraphResult {
  const specsRoot = options.specsRoot ?? path.join(cwd, '.specs', 'features');
  const reportsRoot = options.reportsRoot ?? path.join(cwd, '.sdd-agentic-flow', 'reports');
  const featureDir = path.join(specsRoot, featureSlug);
  const errors: string[] = [];
  const empty = (message: string): EvidenceGraphResult => ({
    featureSlug,
    evidenceContract: 'saf-evidence/v1',
    contractCompatible: false,
    requirements: [],
    reports: [],
    errors: [message],
  });
  if (!fs.existsSync(featureDir)) return empty(`feature not found: ${featureDir}`);
  const spec = readIfExists(path.join(featureDir, 'spec.md'));
  const tasks = readIfExists(path.join(featureDir, 'tasks.md'));
  if (!spec || !tasks) return empty('feature package missing spec.md or tasks.md');
  const reqIds = parseRequirementIds(spec);
  const duplicates = findDuplicateReqIds(reqIds);
  if (!reqIds.length) return empty('feature package has no requirements');
  if (duplicates.length)
    return {
      featureSlug,
      evidenceContract: 'saf-evidence/v1',
      contractCompatible: false,
      requirements: duplicates.map((reqId) => ({
        reqId,
        status: 'duplicate-req-id',
        taskIds: [],
        checkReports: [],
      })),
      reports: [],
      errors: [`duplicate REQ-* IDs: ${duplicates.join(', ')}`],
    };
  const taskAnchors = parseTaskRequirementAnchors(tasks);
  const parsed = listMarkdownFiles(reportsRoot)
    .map(parseReport)
    .filter((report) => report.featureSlug === featureSlug);
  const scopes = new Set(
    parsed.map((report) => report.report?.scope).filter((scope): scope is string => Boolean(scope)),
  );
  const resolved = new Map<string, { active: ParsedReport | null; ambiguous: boolean }>();
  for (const scope of scopes) resolved.set(scope, resolveScope(parsed, scope, errors));
  const reportViews: EvidenceGraphReport[] = parsed.map((report) => {
    if (!report.report)
      return {
        path: report.path,
        scope: null,
        reportId: null,
        digest: null,
        kind: report.taskId ? 'legacy' : 'invalid',
        reason: report.taskId ? 'legacy report' : 'invalid v1 report',
      };
    const result = resolved.get(report.report.scope);
    if (result?.ambiguous)
      return {
        path: report.path,
        scope: report.report.scope,
        reportId: report.report.reportId,
        digest: report.report.digest,
        kind: 'ambiguous',
        reason: 'ambiguous report chain',
      };
    return {
      path: report.path,
      scope: report.report.scope,
      reportId: report.report.reportId,
      digest: report.report.digest,
      kind: result?.active === report ? 'active' : 'superseded',
      reason: null,
    };
  });
  const requirements = reqIds.map((reqId) => {
    const taskIds = [...taskAnchors.entries()]
      .filter(([, anchors]) => anchors.includes(reqId))
      .map(([taskId]) => taskId);
    if (!taskIds.length)
      return { reqId, status: 'no-task-anchor' as const, taskIds, checkReports: [] };
    const checkReports: string[] = [];
    let status: RequirementGraphNode['status'] = 'current';
    for (const taskId of taskIds) {
      const scope = `check:${featureSlug}:${taskId}`;
      const match = resolved.get(scope);
      if (match?.ambiguous) {
        status = 'ambiguous-report';
        continue;
      }
      if (!match?.active) {
        const legacy = parsed.some((report) => report.taskId === taskId && !report.report);
        status = legacy ? 'legacy-report' : 'no-task-check';
        continue;
      }
      checkReports.push(match.active.path);
      const coverage = taskCoverage(cwd, match.active, reqId);
      if (coverage !== 'current') status = coverage;
    }
    return { reqId, status, taskIds, checkReports };
  });
  const contractCompatible = reportViews.every(
    (report) => !['legacy', 'invalid', 'ambiguous'].includes(report.kind),
  );
  return {
    featureSlug,
    evidenceContract: 'saf-evidence/v1',
    contractCompatible,
    requirements,
    reports: reportViews,
    errors,
  };
}
