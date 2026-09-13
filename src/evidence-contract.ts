import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type EvidenceResult = 'pass' | 'fail' | 'inconclusive' | 'not-run';
export type EvidenceFreshness = 'current' | 'historical' | 'stale' | 'not-run' | 'inconclusive';
export type EvidenceInputStatus = 'included' | 'excluded';

export type EvidenceInput = {
  path: string;
  sha256: string;
  status: EvidenceInputStatus;
  reason: string | null;
};

export type EvidenceRecord = {
  id: string;
  requirementAnchors: string[];
  sensor: string;
  sensorClass: 'structural' | 'unitary' | 'integration' | 'contract' | 'black-box' | 'review';
  oracle: string;
  seam: string;
  surface: string;
  revision: string;
  runStateBefore: 'clean' | 'dirty' | 'not-a-git-repository';
  runStateAfter: 'clean' | 'dirty' | 'not-a-git-repository';
  inputs: EvidenceInput[];
  command: string;
  exitStatus: number | 'not-run';
  observation: string;
  observationDigest: string;
  result: EvidenceResult;
  freshness: EvidenceFreshness;
  confidenceLimit: string;
};

export type EvidenceReport = {
  contract: 'saf-evidence/v1';
  reportId: string;
  scope: string;
  supersedes: string | null;
  digest: string;
  records: EvidenceRecord[];
  errors: string[];
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const REPORT_SCOPE = /^(?:check:[a-z0-9][a-z0-9.-]*:[A-Za-z0-9-]+|validation:[a-z0-9][a-z0-9.-]*)$/;
const SENSOR = /^[a-z][a-z0-9-]{0,63}$/;
const SHA = /^sha256:[0-9a-f]{64}$/;
const REVISION = /^(?:[0-9a-f]{40}|[0-9a-f]{64}|not-a-git-repository)$/;
const RECORD_ID = /^EV-0*[1-9][0-9]*$/;
const MAX_REPORT_BYTES = 1024 * 1024;
const MAX_RECORDS = 200;
const MAX_INPUTS = 200;
const MAX_TEXT_BYTES = 2048;
const TRUNCATION_MARKER = '\n…[truncated]';
const SECRET =
  /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:token|password|secret|api[_-]?key)\s*[:=]\s*[^\s]+)/i;
const ABSOLUTE_HOME = /(?:^|[\s("'])\/(?:home|Users)\/[A-Za-z0-9_.-]+(?:\/|$)/;

function sha256(value: Buffer | string): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').normalize('NFC');
}

function boundText(value: string): string {
  const normalized = normalizeText(value);
  const bytes = Buffer.from(normalized, 'utf8');
  if (bytes.byteLength <= MAX_TEXT_BYTES) return normalized;
  const limit = MAX_TEXT_BYTES - Buffer.byteLength(TRUNCATION_MARKER, 'utf8');
  let end = limit;
  while (end > 0 && ((bytes[end] ?? 0) & 0xc0) === 0x80) end -= 1;
  return Buffer.from(bytes.subarray(0, end)).toString('utf8') + TRUNCATION_MARKER;
}

export function sanitizeEvidenceText(value: string): { value: string; safe: boolean } {
  const normalized = normalizeText(value);
  if (SECRET.test(normalized) || ABSOLUTE_HOME.test(normalized)) return { value: '', safe: false };
  return { value: boundText(normalized), safe: true };
}

export function observationDigest(value: string): string {
  return sha256(Buffer.from(value, 'utf8'));
}

export function normalizeEvidencePath(value: string): string | null {
  const normalized = value.replace(/\\/g, '/').normalize('NFC');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) return null;
  const parts = normalized.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  return normalized;
}

export function canonicalInputManifest(inputs: EvidenceInput[]): {
  digest: string;
  entries: EvidenceInput[];
} {
  const seen = new Set<string>();
  const folded = new Set<string>();
  const entries = inputs.map((input) => {
    const inputPath = normalizeEvidencePath(input.path);
    if (!inputPath) throw new Error(`unsafe input path: ${input.path}`);
    if (seen.has(inputPath)) throw new Error(`duplicate input path: ${inputPath}`);
    const caseFolded = inputPath.toLocaleLowerCase('en-US');
    if (folded.has(caseFolded)) throw new Error(`case-folding input collision: ${inputPath}`);
    seen.add(inputPath);
    folded.add(caseFolded);
    if (input.status === 'included' && !SHA.test(input.sha256))
      throw new Error(`invalid included input digest: ${inputPath}`);
    if (input.status === 'excluded' && (input.sha256 !== 'not-recorded' || !input.reason))
      throw new Error(`invalid excluded input: ${inputPath}`);
    if (input.reason && !sanitizeEvidenceText(input.reason).safe)
      throw new Error(`unsafe input reason: ${inputPath}`);
    return {
      path: inputPath,
      sha256: input.sha256,
      status: input.status,
      reason: input.status === 'included' ? null : boundText(input.reason ?? ''),
    };
  });
  entries.sort((left, right) =>
    left.path.localeCompare(right.path, 'en', { sensitivity: 'variant' }),
  );
  return { digest: sha256(Buffer.from(JSON.stringify(entries), 'utf8')), entries };
}

export function readDeclaredInput(root: string, input: EvidenceInput): EvidenceFreshness {
  if (input.status === 'excluded') return 'inconclusive';
  const normalized = normalizeEvidencePath(input.path);
  if (!normalized) return 'inconclusive';
  const rootResolved = path.resolve(root);
  const candidate = path.resolve(rootResolved, normalized);
  if (!candidate.startsWith(`${rootResolved}${path.sep}`)) return 'inconclusive';
  try {
    const stat = fs.lstatSync(candidate);
    if (!stat.isFile() || stat.isSymbolicLink()) return 'inconclusive';
    return sha256(fs.readFileSync(candidate)) === input.sha256 ? 'current' : 'stale';
  } catch {
    return 'inconclusive';
  }
}

function fieldValue(
  lines: string[],
  index: number,
  label: string,
  errors: string[],
): string | null {
  const line = lines[index];
  if (!line?.startsWith(`${label}: `)) {
    errors.push(`expected ${label}`);
    return null;
  }
  const value = line.slice(label.length + 2);
  if (!value) errors.push(`empty ${label}`);
  return value || null;
}

function parseInputTable(
  lines: string[],
  index: number,
  errors: string[],
): { inputs: EvidenceInput[]; next: number } {
  if (
    lines[index] !== 'Inputs:' ||
    lines[index + 1] !== '| Path | SHA-256 | Status | Reason |' ||
    lines[index + 2] !== '| --- | --- | --- | --- |'
  ) {
    errors.push('invalid Inputs table');
    return { inputs: [], next: index + 1 };
  }
  const inputs: EvidenceInput[] = [];
  let next = index + 3;
  while (lines[next]?.startsWith('|')) {
    const line = lines[next];
    if (!line) break;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 4) {
      errors.push('invalid input row');
    } else {
      const [inputPath, digest, status, reason] = cells;
      inputs.push({
        path: inputPath ?? '',
        sha256: digest ?? '',
        status: status === 'included' ? 'included' : 'excluded',
        reason: status === 'included' ? null : reason === '—' ? null : (reason ?? null),
      });
      if (!['included', 'excluded'].includes(status ?? ''))
        errors.push(`invalid input status: ${status}`);
    }
    next += 1;
  }
  if (inputs.length > MAX_INPUTS) errors.push('too many inputs');
  return { inputs, next };
}

function parseRecord(block: string, errors: string[]): EvidenceRecord | null {
  const lines = normalizeText(block).split('\n');
  const id = lines.shift()?.replace(/^### /, '') ?? '';
  if (!RECORD_ID.test(id)) errors.push(`invalid record ID: ${id}`);
  if (lines[0] === '') lines.shift();
  let index = 0;
  const requirementValue = fieldValue(lines, index++, 'Requirement anchors', errors);
  const sensor = fieldValue(lines, index++, 'Sensor', errors);
  const sensorClass = fieldValue(lines, index++, 'Sensor class', errors);
  const oracle = fieldValue(lines, index++, 'Oracle', errors);
  const seam = fieldValue(lines, index++, 'Seam', errors);
  const surface = fieldValue(lines, index++, 'Surface', errors);
  const revision = fieldValue(lines, index++, 'Revision', errors);
  const runStateBefore = fieldValue(lines, index++, 'Run state before', errors);
  const runStateAfter = fieldValue(lines, index++, 'Run state after', errors);
  const table = parseInputTable(lines, index, errors);
  index = table.next;
  const command = fieldValue(lines, index++, 'Command', errors);
  const exitStatusText = fieldValue(lines, index++, 'Exit status', errors);
  const observation = fieldValue(lines, index++, 'Observation', errors);
  const digest = fieldValue(lines, index++, 'Observation digest', errors);
  const result = fieldValue(lines, index++, 'Result', errors);
  const freshness = fieldValue(lines, index++, 'Freshness', errors);
  const confidenceLimit = fieldValue(lines, index++, 'Confidence limit', errors);
  if (lines.slice(index).some((line) => line.trim())) errors.push(`unknown field in ${id}`);
  if (
    !requirementValue ||
    !sensor ||
    !sensorClass ||
    !oracle ||
    !seam ||
    !surface ||
    !revision ||
    !runStateBefore ||
    !runStateAfter ||
    !command ||
    !exitStatusText ||
    !observation ||
    !digest ||
    !result ||
    !freshness ||
    !confidenceLimit
  )
    return null;
  if (!SENSOR.test(sensor)) errors.push(`invalid sensor: ${sensor}`);
  if (
    !['structural', 'unitary', 'integration', 'contract', 'black-box', 'review'].includes(
      sensorClass,
    )
  )
    errors.push(`invalid sensor class: ${sensorClass}`);
  if (!REVISION.test(revision)) errors.push(`invalid revision: ${revision}`);
  if (
    !['clean', 'dirty', 'not-a-git-repository'].includes(runStateBefore) ||
    !['clean', 'dirty', 'not-a-git-repository'].includes(runStateAfter)
  )
    errors.push(`invalid run state in ${id}`);
  if (!['pass', 'fail', 'inconclusive', 'not-run'].includes(result))
    errors.push(`invalid result: ${result}`);
  if (!['current', 'historical', 'stale', 'not-run', 'inconclusive'].includes(freshness))
    errors.push(`invalid freshness: ${freshness}`);
  if (!SHA.test(digest) && digest !== 'not-recorded')
    errors.push(`invalid observation digest: ${digest}`);
  const textValues = [oracle, seam, surface, command, observation, confidenceLimit];
  if (textValues.some((value) => !sanitizeEvidenceText(value).safe))
    errors.push(`unsafe text in ${id}`);
  try {
    canonicalInputManifest(table.inputs);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'invalid input manifest');
  }
  const exitStatus = exitStatusText === 'not-run' ? 'not-run' : Number(exitStatusText);
  if (exitStatus !== 'not-run' && (!Number.isInteger(exitStatus) || exitStatus < 0))
    errors.push(`invalid exit status: ${exitStatusText}`);
  return {
    id,
    requirementAnchors: requirementValue
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    sensor,
    sensorClass: sensorClass as EvidenceRecord['sensorClass'],
    oracle: sanitizeEvidenceText(oracle).value,
    seam: sanitizeEvidenceText(seam).value,
    surface: sanitizeEvidenceText(surface).value,
    revision,
    runStateBefore: runStateBefore as EvidenceRecord['runStateBefore'],
    runStateAfter: runStateAfter as EvidenceRecord['runStateAfter'],
    inputs: table.inputs,
    command: sanitizeEvidenceText(command).value,
    exitStatus,
    observation: sanitizeEvidenceText(observation).value,
    observationDigest: digest,
    result: result as EvidenceResult,
    freshness: freshness as EvidenceFreshness,
    confidenceLimit: sanitizeEvidenceText(confidenceLimit).value,
  };
}

export function parseEvidenceReport(content: string): EvidenceReport | null {
  const errors: string[] = [];
  const bytes = Buffer.byteLength(content, 'utf8');
  if (bytes > MAX_REPORT_BYTES) errors.push('report exceeds 1 MiB');
  const normalized = normalizeText(content);
  const masked = maskFenced(normalized);
  const evidenceHeadings = [...masked.matchAll(/^## Evidence\s*$/gm)];
  const recordsHeadings = [...masked.matchAll(/^## Evidence records\s*$/gm)];
  if (evidenceHeadings.length !== 1 || recordsHeadings.length !== 1)
    errors.push('expected one Evidence and one Evidence records section');
  if (
    evidenceHeadings[0] &&
    recordsHeadings[0] &&
    evidenceHeadings[0].index > recordsHeadings[0].index
  )
    errors.push('Evidence sections out of order');
  const preamble = masked.split(/^## Evidence\s*$/m)[0] ?? '';
  const uniqueField = (label: string): string | undefined => {
    const matches = [...preamble.matchAll(new RegExp(`^${label}: (.+)$`, 'gm'))];
    if (matches.length !== 1) errors.push(`expected one ${label}`);
    return matches[0]?.[1];
  };
  const contract = uniqueField('Evidence contract');
  const reportId = uniqueField('Report ID');
  const scope = uniqueField('Report scope');
  const supersedes = uniqueField('Supersedes');
  if (contract !== 'saf-evidence/v1') errors.push('missing or invalid Evidence contract');
  if (!reportId || !UUID_V4.test(reportId)) errors.push('invalid Report ID');
  if (!scope || !REPORT_SCOPE.test(scope)) errors.push('invalid Report scope');
  if (!supersedes || (supersedes !== 'none' && !UUID_V4.test(supersedes)))
    errors.push('invalid Supersedes');
  const evidenceBody = masked.split(/^## Evidence records\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  const records = evidenceBody
    .split(/^### /m)
    .slice(1)
    .map((block) => parseRecord(`### ${block.trimEnd()}`, errors))
    .filter((record): record is EvidenceRecord => record !== null);
  if (records.length > MAX_RECORDS) errors.push('too many evidence records');
  const ids = records.map((record) => record.id);
  if (new Set(ids).size !== ids.length) errors.push('duplicate record IDs');
  if (!records.length) errors.push('no evidence records');
  if (errors.length || !reportId || !scope || !supersedes) return null;
  return {
    contract: 'saf-evidence/v1',
    reportId,
    scope,
    supersedes: supersedes === 'none' ? null : supersedes,
    digest: sha256(Buffer.from(content, 'utf8')),
    records,
    errors,
  };
}

function maskFenced(value: string): string {
  let fenced = false;
  return value
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        return '';
      }
      return fenced ? '' : line;
    })
    .join('\n');
}

export function validateEvidenceRecordFreshness(
  root: string,
  record: EvidenceRecord,
): EvidenceFreshness {
  if (record.result === 'not-run' || record.freshness === 'not-run') return 'not-run';
  if (record.result === 'inconclusive' || record.freshness === 'inconclusive')
    return 'inconclusive';
  if (record.inputs.some((input) => readDeclaredInput(root, input) === 'inconclusive'))
    return 'inconclusive';
  if (record.inputs.some((input) => readDeclaredInput(root, input) === 'stale')) return 'stale';
  if (record.runStateBefore !== record.runStateAfter) return 'inconclusive';
  if (
    record.result === 'pass' &&
    (record.exitStatus !== 0 || record.observationDigest !== observationDigest(record.observation))
  )
    return 'inconclusive';
  return record.freshness === 'historical' ? 'historical' : 'current';
}

export { sha256 };
