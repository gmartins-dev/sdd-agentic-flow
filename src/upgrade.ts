// Interactive / read-only upgrade flow (v1.13.0). Flag contracts:
//   upgrade --check        upgrade-specific read-only registry check (never mutates)
//   upgrade --plan         registry + concrete plan (never mutates)
//   upgrade --skills-only  no registry; refresh skills from the executing package only
//   upgrade (default)      interactive confirms on human TTY; machine = check-only
// See docs/trust-model.md and README.md's upgrade command reference.

import { type ExecFileSyncOptionsWithStringEncoding, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { checkForUpdate, type UpdateCheckResult } from './update-check';
import { parseVersion } from './version-compat';

const PROVENANCE_REL = path.join('sdd-agentic-flow-shared', 'install-provenance.yml');
const CURRENT_PROVENANCE_SCHEMA = 'saf-install-provenance/v3';

type ExecutionMode = 'npx' | 'global' | 'local';

type InstallProvenance = {
  package: string | null;
  packageVersion: string | null;
  schema: string;
  skillIdentity: string | null;
  scope?: string;
  target?: string;
  managedSkills?: string[];
  managedPaths?: string[];
  managedHashes?: Record<string, string>;
  applyState?: 'applying' | 'complete';
};

type ProvenanceInput =
  | string
  | {
      packageVersion: string;
      scope?: string;
      target?: string;
      skillIdentity?: string;
      managedSkills?: string[];
      managedPaths?: string[];
      managedHashes?: Record<string, string>;
      applyState?: 'applying' | 'complete';
    };

type ManagedPair = {
  source: string;
  dest: string;
  rel: string;
};

type PairKind = 'missing' | 'identical' | 'differs';

type ClassifiedPairs = {
  missing: ManagedPair[];
  identical: ManagedPair[];
  differs: ManagedPair[];
};

type ClassifiedImpact = {
  packageChanged: ManagedPair[];
  localOnly: ManagedPair[];
  unknown: ManagedPair[];
};

type ApplySummary = {
  installed: number;
  refreshed: number;
  skippedIdentical: number;
  skippedDiffers: number;
};

type NpmInstallOptions = {
  execFileSyncImpl?: typeof execFileSync;
  env?: NodeJS.ProcessEnv;
  version: string;
};

type NpmInstallError = Error & { status?: number };

function detectExecutionMode(
  packageRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): ExecutionMode {
  if (env.SDD_AGENTIC_FLOW_TEST_EXEC_MODE)
    return env.SDD_AGENTIC_FLOW_TEST_EXEC_MODE as ExecutionMode;
  const normalized = path.resolve(packageRoot);
  const npxMarker = `${path.sep}_npx${path.sep}`;
  if (normalized.includes(npxMarker) || normalized.includes(`${path.sep}.npm${path.sep}_npx`))
    return 'npx';
  try {
    const globalRoot = execFileSync('npm', ['root', '-g'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    } as ExecFileSyncOptionsWithStringEncoding).trim();
    if (globalRoot && normalized.startsWith(`${path.resolve(globalRoot)}${path.sep}`))
      return 'global';
    if (globalRoot && normalized === path.resolve(globalRoot, 'sdd-agentic-flow')) return 'global';
  } catch {
    // npm unavailable — fall through
  }
  return 'local';
}

function provenancePath(skillsRoot: string): string {
  return path.join(skillsRoot, PROVENANCE_REL);
}

// The installation root is the authority boundary; metadata cannot redirect a write/delete.
function assertManagedDestination(root: string, relative: string): void {
  if (
    path.isAbsolute(relative) ||
    path.win32.isAbsolute(relative) ||
    relative.split(/[\\/]/).some((part) => !part || part === '.' || part === '..')
  )
    throw new Error('unsafe installation provenance path');
  // Include the host directory for the conventional <home>/<host>/skills layout.
  const boundary = path.basename(root) === 'skills' ? path.dirname(path.dirname(root)) : root;
  const destination = path.resolve(root, relative);
  let current = path.resolve(boundary);
  for (const part of ['', ...path.relative(current, destination).split(path.sep)]) {
    current = path.join(current, part);
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) {
      let target = '<unreadable target>';
      try {
        target = fs.readlinkSync(current);
      } catch {
        // Keep the safety failure actionable even when the link target cannot be read.
      }
      throw new Error(
        `managed destination crosses a symbolic link: ${current} -> ${target}. ` +
          'SAF will not write through symbolic links; remove or replace the link manually, ' +
          'choose another target, or use project scope.',
      );
    }
  }
}

function writeInstallProvenance(skillsRoot: string, provenance: ProvenanceInput): void {
  const dest = provenancePath(skillsRoot);
  assertManagedDestination(skillsRoot, PROVENANCE_REL);
  assertManagedDestination(skillsRoot, `${PROVENANCE_REL}.tmp`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const value = typeof provenance === 'string' ? { packageVersion: provenance } : provenance;
  const lines = [
    'package: sdd-agentic-flow',
    `package_version: ${value.packageVersion}`,
    `schema: ${CURRENT_PROVENANCE_SCHEMA}`,
    `apply_state: ${value.applyState || 'complete'}`,
    ...(value.scope ? [`scope: ${value.scope}`] : []),
    ...(value.target ? [`target: ${value.target}`] : []),
    `skill_identity: ${value.skillIdentity || 'saf'}`,
    'managed_skills:',
    ...(value.managedSkills || []).map((skill) => `  - ${skill}`),
    'managed_paths:',
    ...(value.managedPaths || value.managedSkills || []).map((managedPath) => `  - ${managedPath}`),
    'managed_hashes:',
    ...Object.entries(value.managedHashes || {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([managedPath, hash]) => `  ${managedPath}: ${hash}`),
    '',
  ];
  const temporary = `${dest}.tmp`;
  fs.writeFileSync(temporary, lines.join('\n'), 'utf8');
  fs.renameSync(temporary, dest);
}

function readInstallProvenance(skillsRoot: string): InstallProvenance | null {
  const dest = provenancePath(skillsRoot);
  if (!fs.existsSync(dest)) return null;
  try {
    const text = fs.readFileSync(dest, 'utf8');
    const versionMatch = text.match(/package_version:\s*(\S+)/);
    const packageMatch = text.match(/^package:\s*(\S+)/m);
    const schemaMatch = text.match(/^schema:\s*(\S+)/m);
    const applyStateMatch = text.match(/^apply_state:\s*(\S+)/m);
    const scopeMatch = text.match(/^scope:\s*(\S+)/m);
    const targetMatch = text.match(/^target:\s*(\S+)/m);
    const skillIdentityMatch = text.match(/^skill_identity:\s*(\S+)/m);
    const list = (name: string): string[] => {
      const match = text.match(new RegExp(`^${name}:\\s*\\n((?:\\s+-\\s+[^\\n]+\\n?)*)`, 'm'));
      return match?.[1]
        ? [...match[1].matchAll(/^\s+-\s+(.+)$/gm)].map((item) => item[1]?.trim() ?? '')
        : [];
    };
    const provenance: InstallProvenance = {
      package: packageMatch?.[1] ?? null,
      packageVersion: versionMatch?.[1] ?? null,
      schema: schemaMatch?.[1] ?? 'unsupported',
      skillIdentity: skillIdentityMatch?.[1] ?? null,
      ...(scopeMatch?.[1] ? { scope: scopeMatch[1] } : {}),
      ...(targetMatch?.[1] ? { target: targetMatch[1] } : {}),
      ...(applyStateMatch?.[1] === 'applying' || applyStateMatch?.[1] === 'complete'
        ? { applyState: applyStateMatch[1] }
        : {}),
    };
    const managedSkills = list('managed_skills');
    const managedPaths = list('managed_paths');
    const managedHashes: Record<string, string> = {};
    let readingHashes = false;
    for (const line of text.split(/\r?\n/)) {
      if (line.trim() === 'managed_hashes:') {
        readingHashes = true;
        continue;
      }
      if (!readingHashes) continue;
      const match = line.match(/^\s{2}([^:]+):\s*(\S+)$/);
      if (!match) {
        if (line.trim() && !/^\s/.test(line)) readingHashes = false;
        continue;
      }
      const relative = match[1]?.trim();
      const hash = match[2];
      if (relative && hash) managedHashes[relative] = hash;
    }
    if (
      managedSkills.some((skill) => !/^[a-z0-9][a-z0-9-]*$/.test(skill)) ||
      managedPaths.some((relative) => {
        const parts = relative.split(/[\\/]/);
        return (
          path.isAbsolute(relative) ||
          path.win32.isAbsolute(relative) ||
          parts.some((part) => !part || part === '.' || part === '..') ||
          (parts[0] !== 'sdd-agentic-flow-shared' && !managedSkills.includes(parts[0] ?? ''))
        );
      }) ||
      Object.entries(managedHashes).some(([relative, hash]) => {
        const parts = relative.split(/[\\/]/);
        return (
          !/^[a-f0-9]{64}$/.test(hash) ||
          path.isAbsolute(relative) ||
          path.win32.isAbsolute(relative) ||
          parts.some((part) => !part || part === '.' || part === '..') ||
          (parts[0] !== 'sdd-agentic-flow-shared' && !managedSkills.includes(parts[0] ?? ''))
        );
      })
    )
      throw new Error('unsafe installation provenance paths; preserve and repair the metadata');
    if (managedSkills.length) provenance.managedSkills = managedSkills;
    if (managedPaths.length) provenance.managedPaths = managedPaths;
    if (Object.keys(managedHashes).length) provenance.managedHashes = managedHashes;
    return provenance;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('unsafe installation provenance'))
      throw error;
    return null;
  }
}

function managedRemovalPaths(
  root: string,
  provenance: InstallProvenance | null,
  expectedScope?: string,
): string[] {
  if (
    provenance?.package !== 'sdd-agentic-flow' ||
    provenance.schema !== CURRENT_PROVENANCE_SCHEMA ||
    (expectedScope && provenance.scope && provenance.scope !== expectedScope)
  )
    return [];
  if (provenance.applyState === 'applying')
    throw new Error('installation cleanup blocked by interrupted apply');
  const managed = provenance.managedPaths?.length
    ? provenance.managedPaths
    : [...(provenance.managedSkills || []), 'sdd-agentic-flow-shared'];
  const relatives = [...managed, PROVENANCE_REL];
  for (const relative of relatives) assertManagedDestination(root, relative);
  return [...new Set(relatives.map((relative) => path.join(root, relative)))];
}

function removeManagedTargetContent(
  root: string,
  provenance: InstallProvenance | null,
  expectedScope?: string,
): void {
  const targets = managedRemovalPaths(root, provenance, expectedScope);
  for (const target of targets) fs.rmSync(target, { recursive: true, force: true });
  // Prune only parents of removed files, preserving unrelated empty directories.
  for (const target of targets) {
    let directory = path.dirname(target);
    while (directory !== root && directory.startsWith(`${root}${path.sep}`)) {
      if (!fs.existsSync(directory)) {
        directory = path.dirname(directory);
        continue;
      }
      if (fs.readdirSync(directory).length) break;
      fs.rmdirSync(directory);
      directory = path.dirname(directory);
    }
  }
}

function walkFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(target) : [target];
  });
}

function collectManagedPairs(
  packageRoot: string,
  skills: readonly string[],
  targetRoot: string,
): ManagedPair[] {
  const pairs: ManagedPair[] = [];
  for (const skill of skills) {
    const sourceRoot = path.join(packageRoot, 'skills', skill);
    const destRoot = path.join(targetRoot, skill);
    if (!fs.existsSync(sourceRoot)) continue;
    for (const source of walkFiles(sourceRoot)) {
      const rel = path.relative(sourceRoot, source);
      pairs.push({ source, dest: path.join(destRoot, rel), rel: path.join(skill, rel) });
    }
  }
  const sourceRoot = path.join(packageRoot, 'shared');
  const destRoot = path.join(targetRoot, 'sdd-agentic-flow-shared');
  for (const source of walkFiles(sourceRoot)) {
    const rel = path.relative(sourceRoot, source);
    pairs.push({
      source,
      dest: path.join(destRoot, rel),
      rel: path.join('sdd-agentic-flow-shared', rel),
    });
  }
  for (const pair of pairs) assertManagedDestination(targetRoot, pair.rel);
  return pairs;
}

function classifyPair(source: string, dest: string): PairKind {
  if (!fs.existsSync(dest)) return 'missing';
  try {
    const a = fs.readFileSync(source);
    const b = fs.readFileSync(dest);
    return Buffer.compare(a, b) === 0 ? 'identical' : 'differs';
  } catch {
    return 'differs';
  }
}

function classifyManagedPairs(pairs: ManagedPair[]): ClassifiedPairs {
  const missing: ManagedPair[] = [];
  const identical: ManagedPair[] = [];
  const differs: ManagedPair[] = [];
  for (const pair of pairs) {
    const kind = classifyPair(pair.source, pair.dest);
    if (kind === 'missing') missing.push(pair);
    else if (kind === 'identical') identical.push(pair);
    else differs.push(pair);
  }
  return { missing, identical, differs };
}

function sourceHash(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function managedHashesForPairs(pairs: readonly ManagedPair[]): Record<string, string> {
  return Object.fromEntries(pairs.map((pair) => [pair.rel, sourceHash(pair.source)]));
}

function classifyManagedImpact(
  pairs: readonly ManagedPair[],
  provenance: InstallProvenance | null,
): ClassifiedImpact {
  const packageChanged: ManagedPair[] = [];
  const localOnly: ManagedPair[] = [];
  const unknown: ManagedPair[] = [];
  for (const pair of pairs) {
    const previousHash = provenance?.managedHashes?.[pair.rel];
    if (!previousHash) {
      unknown.push(pair);
    } else if (previousHash === sourceHash(pair.source)) {
      localOnly.push(pair);
    } else {
      packageChanged.push(pair);
    }
  }
  return { packageChanged, localOnly, unknown };
}

function applyManagedPairs(
  pairs: ManagedPair[],
  { overwriteDiffers = false }: { overwriteDiffers?: boolean } = {},
): ApplySummary {
  for (const pair of pairs) {
    const root = path.resolve(pair.dest, ...pair.rel.split(/[\\/]/).map(() => '..'));
    assertManagedDestination(root, pair.rel);
  }
  const summary: ApplySummary = {
    installed: 0,
    refreshed: 0,
    skippedIdentical: 0,
    skippedDiffers: 0,
  };
  for (const pair of pairs) {
    const kind = classifyPair(pair.source, pair.dest);
    if (kind === 'identical') {
      summary.skippedIdentical += 1;
      continue;
    }
    if (kind === 'differs' && !overwriteDiffers) {
      summary.skippedDiffers += 1;
      continue;
    }
    fs.mkdirSync(path.dirname(pair.dest), { recursive: true });
    fs.copyFileSync(pair.source, pair.dest);
    if (kind === 'missing') summary.installed += 1;
    else summary.refreshed += 1;
  }
  return summary;
}

function packageSpec(version: string): string {
  if (!parseVersion(version)) throw new Error(`invalid package version: ${version}`);
  return `sdd-agentic-flow@${version}`;
}

function runNpmGlobalInstall({
  execFileSyncImpl = execFileSync,
  env = process.env,
  version,
}: NpmInstallOptions): { simulated: boolean } {
  if (env.SDD_AGENTIC_FLOW_TEST_NPM_INSTALL === 'fail') {
    const error: NpmInstallError = new Error('simulated npm install failure');
    error.status = 1;
    throw error;
  }
  if (env.SDD_AGENTIC_FLOW_TEST_NPM_INSTALL === 'ok') return { simulated: true };
  execFileSyncImpl('npm', ['install', '-g', packageSpec(version)], {
    stdio: 'inherit',
    env,
  });
  return { simulated: false };
}

function runNpmSkillsUpgrade({
  version,
  execFileSyncImpl = execFileSync,
  env = process.env,
}: NpmInstallOptions): { simulated: boolean } {
  if (env.SDD_AGENTIC_FLOW_TEST_NPM_INSTALL === 'fail') {
    const error: NpmInstallError = new Error('simulated npm skills upgrade failure');
    error.status = 1;
    throw error;
  }
  if (env.SDD_AGENTIC_FLOW_TEST_NPM_INSTALL === 'ok') return { simulated: true };
  execFileSyncImpl(
    'npm',
    ['exec', '--yes', packageSpec(version), '--', 'upgrade', '--skills-only'],
    { stdio: 'inherit', env },
  );
  return { simulated: false };
}

function formatCheckReport(result: UpdateCheckResult): string {
  const lines = [
    `Current version: ${result.currentVersion}`,
    `Latest version: ${result.latest ?? '(unknown)'}`,
    `Update available: ${result.updateAvailable ? 'yes' : result.reachable ? 'no' : '(unknown)'}`,
  ];
  if (!result.reachable) {
    lines.push(
      '',
      'WARN unable to check for updates',
      '',
      'Reason:',
      '  network unavailable or registry unreachable',
    );
  } else if (result.updateAvailable) {
    lines.push('', 'Suggested:', `  ${renderCliCommand('upgrade')}`);
  }
  return `${lines.join('\n')}\n`;
}

export type { ApplySummary, ClassifiedPairs, ExecutionMode, InstallProvenance, ManagedPair };
export {
  applyManagedPairs,
  assertManagedDestination,
  checkForUpdate,
  classifyManagedImpact,
  classifyManagedPairs,
  classifyPair,
  collectManagedPairs,
  detectExecutionMode,
  formatCheckReport,
  managedHashesForPairs,
  managedRemovalPaths,
  PROVENANCE_REL,
  provenancePath,
  readInstallProvenance,
  removeManagedTargetContent,
  runNpmGlobalInstall,
  runNpmSkillsUpgrade,
  writeInstallProvenance,
};

import { renderCliCommand } from './cli-command';
