// External observation of a skill-behavior fixture: what changed on disk, what the agent claimed,
// and whether an independent check agrees. Nothing here trusts the agent's narrative.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export type Snapshot = Map<string, string>;

const SKIPPED_ROOTS = new Set(['.git', '.agents', '.claude', 'node_modules']);

// What the harness, not the agent, captured from a real host session. Stub runs have none.
export type HostObservation = { commands: string[] };

// Commands that run the fixture sensor, directly or through npm.
const SENSOR_COMMAND =
  /(^|[\s;&|'"(])(npm\s+(run\s+)?test|node\s+(\.\/)?test\/(run|eligibility\.test)\.js|node\s+--test)\b/;

export function sensorRunObserved(commands: readonly string[]): boolean {
  return commands.some((command) => SENSOR_COMMAND.test(command));
}

export type OracleResult = {
  // null means the oracle could not decide (for example, a required observation is missing).
  passed: boolean | null;
  violations: string[];
  // Critical violations block adoption regardless of any aggregate improvement.
  critical: string[];
  observations: string[];
};

export type ClaimStatus = 'positive' | 'negative' | 'unclassified' | 'missing';

// Each skill keeps its own status vocabulary (skill-authoring-standard.md). The leading word
// decides: known negative words first, then known positive words; anything else is unclassified
// and is never read as success.
const NEGATIVE_STATUS =
  /^(not|no|needs?|block(ed|er)?|fail(ed|ing|ure)?|inconclusive|paus(e|ed)|partial|pending|incomplete|stale|unknown|error|reject(ed)?|changes|waiting|awaiting)\b/i;
const POSITIVE_STATUS =
  /^(pass(ed)?|done|complete(d)?|ready|approved?|verified|green|implemented|success(ful)?|ok|resolved|fixed)\b/i;

// Snapshot every regular file, including Git-ignored sentinels; only `.git` and installed skill
// bundles (`.agents`, `.claude`) are skipped because they are not part of the evaluated state.
export function snapshot(root: string): Snapshot {
  const files: Snapshot = new Map();
  const walk = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join('/');
      if (SKIPPED_ROOTS.has(relative)) continue;
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile())
        files.set(
          relative,
          crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex'),
        );
    }
  };
  if (fs.existsSync(root)) walk(root);
  return files;
}

export function snapshotDigest(files: Snapshot): string {
  const hash = crypto.createHash('sha256');
  for (const key of [...files.keys()].sort()) hash.update(`${key}\0${files.get(key)}\n`);
  return hash.digest('hex');
}

export function changedPaths(before: Snapshot, after: Snapshot): string[] {
  const keys = new Set([...before.keys(), ...after.keys()]);
  return [...keys].filter((key) => before.get(key) !== after.get(key)).sort();
}

export function matches(file: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => file === prefix || file.startsWith(`${prefix}/`));
}

// The closeout contract carries a `Status:` line; the first one in the persisted report wins.
export function claimStatus(projectDir: string, reportPath: string): ClaimStatus {
  const file = path.join(projectDir, reportPath);
  if (!fs.existsSync(file)) return 'missing';
  const match = fs.readFileSync(file, 'utf8').match(/^\s*(?:[-*]\s*)?\**Status\**\s*:\s*(.+)$/im);
  if (!match?.[1]) return 'missing';
  const status = match[1].replace(/[`*_]/g, '').trim();
  if (NEGATIVE_STATUS.test(status)) return 'negative';
  return POSITIVE_STATUS.test(status) ? 'positive' : 'unclassified';
}

// Hash of the files a fixture sensor covers; the fixture runner writes the same digest.
export function sourceDigest(projectDir: string, prefixes: readonly string[]): string {
  const files = snapshot(projectDir);
  const covered = new Map([...files].filter(([file]) => matches(file, prefixes)));
  return snapshotDigest(covered);
}

export type SensorStamp = { digest: string; ok: boolean };

export function readSensorStamp(projectDir: string, stampPath: string): SensorStamp | null {
  const file = path.join(projectDir, stampPath);
  if (!fs.existsSync(file)) return null;
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<SensorStamp>;
    return typeof value.digest === 'string' && typeof value.ok === 'boolean'
      ? { digest: value.digest, ok: value.ok }
      : null;
  } catch {
    return null;
  }
}

// Evaluate an exported function of the final workspace against a truth table the workspace never
// contains, so editing the fixture's own tests cannot change this verdict.
export function evaluateExport(
  projectDir: string,
  modulePath: string,
  exportName: string,
  table: ReadonlyArray<readonly [unknown[], unknown]>,
): { ok: boolean; detail: string } {
  // A file URL keeps Windows drive paths importable; the marker keeps module stdout out of the verdict.
  const marker = '@@saf-oracle-verdict@@';
  const moduleUrl = pathToFileURL(path.join(projectDir, modulePath)).href;
  const script = `import(${JSON.stringify(moduleUrl)}).then((m) => {
    const table = ${JSON.stringify(table)};
    const failures = table.filter(([args, expected]) => m[${JSON.stringify(exportName)}](...args) !== expected);
    process.stdout.write(${JSON.stringify(marker)} + JSON.stringify(failures));
  }).catch((error) => { process.stdout.write(${JSON.stringify(marker)} + JSON.stringify([['error', String(error)]])); });`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    timeout: 20_000,
  });
  if (result.status !== 0) return { ok: false, detail: result.stderr.trim() || 'oracle crashed' };
  const stdout = result.stdout ?? '';
  const at = stdout.lastIndexOf(marker);
  let failures: unknown[];
  try {
    failures = JSON.parse(at < 0 ? '' : stdout.slice(at + marker.length)) as unknown[];
  } catch {
    return { ok: false, detail: 'oracle produced no verdict' };
  }
  return failures.length === 0
    ? { ok: true, detail: 'hidden truth table holds' }
    : { ok: false, detail: `hidden truth table fails: ${JSON.stringify(failures)}` };
}

export function mtimeMs(projectDir: string, relative: string): number | null {
  const file = path.join(projectDir, relative);
  return fs.existsSync(file) ? fs.statSync(file).mtimeMs : null;
}

export class OracleBuilder {
  private readonly result: OracleResult = {
    passed: true,
    violations: [],
    critical: [],
    observations: [],
  };

  observe(message: string): this {
    this.result.observations.push(message);
    return this;
  }

  violate(message: string, critical = false): this {
    this.result.passed = false;
    this.result.violations.push(message);
    if (critical) this.result.critical.push(message);
    return this;
  }

  undecided(message: string): this {
    if (this.result.passed !== false) this.result.passed = null;
    this.result.observations.push(`undecided: ${message}`);
    return this;
  }

  done(): OracleResult {
    return this.result;
  }
}
