import fs from 'node:fs';
import path from 'node:path';

export type EvidenceFreshness = 'current' | 'historical' | 'stale' | 'not-run';

export type BrokenEdge =
  | 'no-task-anchor'
  | 'no-task-check'
  | 'no-current-evidence'
  | 'duplicate-req-id'
  | 'legacy-report';

export type RequirementGraphNode = {
  reqId: string;
  status: 'current' | 'stale' | BrokenEdge;
  taskIds: string[];
  checkReports: string[];
};

export type EvidenceGraphResult = {
  featureSlug: string;
  v4Compatible: boolean;
  requirements: RequirementGraphNode[];
  errors: string[];
};

const REQ_HEADING = /^## Requirement (REQ-[A-Za-z0-9-]+)/gm;
const TASK_ID = /^(T\d+[A-Za-z0-9-]*)/;
const REQUIREMENT_ANCHORS = /^Requirement anchors:\s*(.+)$/m;
const TASK_DEPENDENCIES = /^Dependencies:\s*(.*)$/m;
const FEATURE_LINE = /^Feature:\s*(.+)$/m;
const EVIDENCE_TABLE_HEADER =
  /^\|\s*Requirement anchor\s*\|\s*Sensor\s*\|\s*Result\s*\|\s*Freshness\s*\|/m;

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
    const firstLine = section.split('\n')[0]?.trim() ?? '';
    const idMatch = firstLine.match(TASK_ID);
    if (!idMatch?.[1]) continue;
    const taskId = idMatch[1];
    const anchorMatch = section.match(REQUIREMENT_ANCHORS);
    if (!anchorMatch?.[1]) {
      map.set(taskId, []);
      continue;
    }
    const anchors = anchorMatch[1]
      .split(',')
      .map((value) => value.trim())
      .filter((value) => /^REQ-/.test(value));
    map.set(taskId, anchors);
  }
  return map;
}

export function parseTaskDependencies(tasksContent: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const sections = tasksContent.split(/^## /m).slice(1);
  for (const section of sections) {
    const firstLine = section.split('\n')[0]?.trim() ?? '';
    const idMatch = firstLine.match(TASK_ID);
    if (!idMatch?.[1]) continue;
    const taskId = idMatch[1];
    const depMatch = section.match(TASK_DEPENDENCIES);
    const raw = depMatch?.[1]?.trim() ?? '';
    if (!raw || /^none$/i.test(raw)) {
      map.set(taskId, []);
      continue;
    }
    const deps = raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => TASK_ID.test(value));
    map.set(taskId, deps);
  }
  return map;
}

export function findTaskDependencyCycle(deps: Map<string, string[]>): string[] | null {
  const adjacency = new Map<string, string[]>();
  for (const [taskId, taskDeps] of deps) adjacency.set(taskId, taskDeps);
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map([...adjacency.keys()].map((key) => [key, WHITE]));
  const stack: string[] = [];
  let found: string[] | null = null;

  const visit = (node: string): void => {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      if (!adjacency.has(next)) continue;
      if (color.get(next) === GRAY) {
        found = [...stack.slice(stack.indexOf(next)), next];
        return;
      }
      if (color.get(next) === WHITE) {
        visit(next);
        if (found) return;
      }
    }
    stack.pop();
    color.set(node, BLACK);
  };

  for (const node of adjacency.keys()) {
    if (color.get(node) === WHITE) visit(node);
    if (found) break;
  }
  return found;
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
  const taskMatch = content.match(/^# Task check — (.+)$/m);
  const featureMatch = content.match(FEATURE_LINE);
  const taskId = taskMatch?.[1]?.trim() ?? null;
  const featureSlug = featureMatch?.[1]?.trim() ?? null;
  const rows: Array<{
    anchor: string;
    sensor: string;
    result: string;
    freshness: EvidenceFreshness;
  }> = [];
  const lines = content.split('\n');
  let inTable = false;
  for (const line of lines) {
    if (EVIDENCE_TABLE_HEADER.test(line)) {
      inTable = true;
      continue;
    }
    if (inTable) {
      if (!line.startsWith('|') || line.match(/^\|\s*---/)) continue;
      if (!line.includes('|')) {
        inTable = false;
        continue;
      }
      const cells = line
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean);
      if (cells.length >= 4) {
        const freshness = cells[3] as EvidenceFreshness;
        rows.push({
          anchor: cells[0] ?? '',
          sensor: cells[1] ?? '',
          result: cells[2] ?? '',
          freshness,
        });
      }
    }
  }
  const hasDetailedEvidence =
    /## Evidence/.test(content) &&
    /(^Command:|^Exit status:|Observable result:|Requirement mapping:)/im.test(content);
  return { taskId, featureSlug, evidenceRows: rows, hasDetailedEvidence };
}

function listMarkdownFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) results.push(full);
    }
  };
  walk(root);
  return results;
}

export function collectEvidenceGraph(
  cwd: string,
  featureSlug: string,
  options: { specsRoot?: string; reportsRoot?: string } = {},
): EvidenceGraphResult {
  const specsRoot = options.specsRoot ?? path.join(cwd, '.specs', 'features');
  const reportsRoot = options.reportsRoot ?? path.join(cwd, '.sdd-agentic-flow', 'reports');
  const featureDir = path.join(specsRoot, featureSlug);
  const specPath = path.join(featureDir, 'spec.md');
  const tasksPath = path.join(featureDir, 'tasks.md');
  const errors: string[] = [];

  if (!fs.existsSync(featureDir)) {
    return {
      featureSlug,
      v4Compatible: false,
      requirements: [],
      errors: [`feature not found: ${featureDir}`],
    };
  }

  const specContent = readIfExists(specPath);
  const tasksContent = readIfExists(tasksPath);
  if (!specContent || !tasksContent) {
    return {
      featureSlug,
      v4Compatible: false,
      requirements: [],
      errors: ['feature package missing spec.md or tasks.md'],
    };
  }

  const reqIds = parseRequirementIds(specContent);
  const duplicates = findDuplicateReqIds(reqIds);
  if (duplicates.length) {
    return {
      featureSlug,
      v4Compatible: false,
      requirements: duplicates.map((reqId) => ({
        reqId,
        status: 'duplicate-req-id' as const,
        taskIds: [],
        checkReports: [],
      })),
      errors: [`duplicate REQ-* IDs: ${duplicates.join(', ')}`],
    };
  }

  const taskAnchors = parseTaskRequirementAnchors(tasksContent);
  const checkFiles = listMarkdownFiles(reportsRoot);
  const checksByTask = new Map<
    string,
    Array<{
      path: string;
      featureSlug: string | null;
      rows: ReturnType<typeof parseCheckReport>['evidenceRows'];
      hasDetailedEvidence: boolean;
    }>
  >();

  for (const file of checkFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (!/^# Task check — /m.test(content)) continue;
    const parsed = parseCheckReport(content);
    if (!parsed.taskId) continue;
    const list = checksByTask.get(parsed.taskId) ?? [];
    list.push({
      path: file,
      featureSlug: parsed.featureSlug,
      rows: parsed.evidenceRows,
      hasDetailedEvidence: parsed.hasDetailedEvidence,
    });
    checksByTask.set(parsed.taskId, list);
  }

  const requirements: RequirementGraphNode[] = reqIds.map((reqId) => {
    const taskIds = [...taskAnchors.entries()]
      .filter(([, anchors]) => anchors.includes(reqId))
      .map(([taskId]) => taskId);

    if (!taskIds.length) {
      return { reqId, status: 'no-task-anchor', taskIds: [], checkReports: [] };
    }

    let bestStatus: RequirementGraphNode['status'] = 'no-task-check';
    const matchedReports: string[] = [];

    for (const taskId of taskIds) {
      const reports = checksByTask.get(taskId) ?? [];
      const featureReports = reports.filter((report) => report.featureSlug === featureSlug);
      if (!reports.length) continue;
      if (!featureReports.length) {
        bestStatus = 'legacy-report';
        continue;
      }
      for (const report of featureReports) {
        matchedReports.push(report.path);
        const row = report.rows.find((entry) => entry.anchor === reqId);
        if (!row) {
          bestStatus = 'no-current-evidence';
          continue;
        }
        if (!report.hasDetailedEvidence) {
          bestStatus = 'no-current-evidence';
          continue;
        }
        if (row.freshness === 'current') {
          return {
            reqId,
            status: 'current',
            taskIds,
            checkReports: matchedReports,
          };
        }
        if (row.freshness === 'stale') bestStatus = 'stale';
        else bestStatus = 'no-current-evidence';
      }
    }

    return { reqId, status: bestStatus, taskIds, checkReports: matchedReports };
  });

  const v4Compatible = requirements.some((node) => node.status === 'current') || reqIds.length > 0;

  return { featureSlug, v4Compatible, requirements, errors };
}
