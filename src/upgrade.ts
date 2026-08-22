// Interactive / read-only upgrade flow (v1.13.0). Flag contracts:
//   upgrade --check        upgrade-specific read-only registry check (never mutates)
//   upgrade --plan         registry + concrete plan (never mutates)
//   upgrade --skills-only  no registry; refresh skills from the executing package only
//   upgrade (default)      interactive confirms on human TTY; machine = check-only
// See docs/trust-model.md and docs/upgrading.md.

import { type ExecFileSyncOptionsWithStringEncoding, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { checkForUpdate, type UpdateCheckResult } from './update-check';

const PROVENANCE_REL = path.join('sdd-agentic-flow-shared', 'install-provenance.yml');
const CURRENT_PROVENANCE_SCHEMA = 'saf-install-provenance/v2';

type ExecutionMode = 'npx' | 'global' | 'local';

type InstallProvenance = {
  package: string | null;
  packageVersion: string | null;
  schema: string;
  skillIdentity: string | null;
  scope?: string;
  target?: string;
  packs?: string[];
  managedSkills?: string[];
  managedPaths?: string[];
  applyState?: 'applying' | 'complete';
};

type ProvenanceInput =
  | string
  | {
      packageVersion: string;
      scope?: string;
      target?: string;
      skillIdentity?: string;
      packs?: string[];
      managedSkills?: string[];
      managedPaths?: string[];
      applyState?: 'applying' | 'complete';
    };

type ManagedPair = {
  source: string;
  dest: string;
  rel: string;
};

type PresetLike = {
  skills?: string[];
  shared?: boolean;
  adapter?: boolean;
};

type PairKind = 'missing' | 'identical' | 'differs';

type ClassifiedPairs = {
  missing: ManagedPair[];
  identical: ManagedPair[];
  differs: ManagedPair[];
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
  packageName?: string;
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

function writeInstallProvenance(skillsRoot: string, provenance: ProvenanceInput): void {
  const dest = provenancePath(skillsRoot);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const value = typeof provenance === 'string' ? { packageVersion: provenance } : provenance;
  const lines = [
    'package: sdd-agentic-flow',
    `package_version: ${value.packageVersion}`,
    `schema: ${CURRENT_PROVENANCE_SCHEMA}`,
    `apply_state: ${value.applyState || 'complete'}`,
    `scope: ${value.scope || 'user'}`,
    `target: ${value.target || 'unknown'}`,
    `skill_identity: ${value.skillIdentity || 'saf'}`,
    'packs:',
    ...(value.packs || []).map((pack) => `  - ${pack}`),
    'managed_skills:',
    ...(value.managedSkills || []).map((skill) => `  - ${skill}`),
    'managed_paths:',
    ...(value.managedPaths || value.managedSkills || []).map((managedPath) => `  - ${managedPath}`),
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
      ...(applyStateMatch?.[1] === 'applying' || applyStateMatch?.[1] === 'complete'
        ? { applyState: applyStateMatch[1] }
        : {}),
    };
    const packs = list('packs');
    const managedSkills = list('managed_skills');
    const managedPaths = list('managed_paths');
    if (packs.length) provenance.packs = packs;
    if (managedSkills.length) provenance.managedSkills = managedSkills;
    if (managedPaths.length) provenance.managedPaths = managedPaths;
    return provenance;
  } catch {
    return null;
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
  preset: PresetLike,
  targetRoot: string,
): ManagedPair[] {
  const pairs: ManagedPair[] = [];
  for (const skill of preset.skills || []) {
    const sourceRoot = path.join(packageRoot, 'skills', skill);
    const destRoot = path.join(targetRoot, skill);
    if (!fs.existsSync(sourceRoot)) continue;
    for (const source of walkFiles(sourceRoot)) {
      const rel = path.relative(sourceRoot, source);
      pairs.push({ source, dest: path.join(destRoot, rel), rel: path.join(skill, rel) });
    }
  }
  if (preset.shared) {
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
  }
  if (preset.adapter) {
    const source = path.join(packageRoot, 'docs', 'adapters.md');
    const dest = path.join(targetRoot, 'sdd-agentic-flow-shared', 'docs', 'adapters.md');
    if (fs.existsSync(source))
      pairs.push({
        source,
        dest,
        rel: path.join('sdd-agentic-flow-shared', 'docs', 'adapters.md'),
      });
  }
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

function applyManagedPairs(
  pairs: ManagedPair[],
  { overwriteDiffers = false }: { overwriteDiffers?: boolean } = {},
): ApplySummary {
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

function detectInstalledPacks(skillsRoot: string, packsDir: string): string[] {
  if (!fs.existsSync(skillsRoot)) return [];
  const names = fs
    .readdirSync(packsDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace(/\.json$/, ''))
    .sort();
  const found: string[] = [];
  for (const name of names) {
    let preset: PresetLike;
    try {
      preset = JSON.parse(
        fs.readFileSync(path.join(packsDir, `${name}.json`), 'utf8'),
      ) as PresetLike;
    } catch {
      continue;
    }
    const skills = preset.skills || [];
    if (!skills.length) continue;
    if (skills.every((skill) => fs.existsSync(path.join(skillsRoot, skill, 'SKILL.md'))))
      found.push(name);
  }
  const provenance = readInstallProvenance(skillsRoot);
  if (
    provenance?.package === 'sdd-agentic-flow' &&
    provenance.schema === CURRENT_PROVENANCE_SCHEMA
  ) {
    const recorded = (provenance.packs || []).filter((pack) => names.includes(pack));
    if (recorded.length) return recorded;
  }
  // A larger matching pack subsumes its smaller subsets (for example full includes planning).
  return found.filter((name) => {
    const skills =
      (JSON.parse(fs.readFileSync(path.join(packsDir, `${name}.json`), 'utf8')) as PresetLike)
        .skills || [];
    return !found.some((other) => {
      if (other === name) return false;
      const otherSkills =
        (JSON.parse(fs.readFileSync(path.join(packsDir, `${other}.json`), 'utf8')) as PresetLike)
          .skills || [];
      return (
        skills.length < otherSkills.length && skills.every((skill) => otherSkills.includes(skill))
      );
    });
  });
}

function runNpmGlobalInstall({
  execFileSyncImpl = execFileSync,
  env = process.env,
  packageName = 'sdd-agentic-flow@latest',
}: NpmInstallOptions = {}): { simulated: boolean } {
  if (env.SDD_AGENTIC_FLOW_TEST_NPM_INSTALL === 'fail') {
    const error: NpmInstallError = new Error('simulated npm install failure');
    error.status = 1;
    throw error;
  }
  if (env.SDD_AGENTIC_FLOW_TEST_NPM_INSTALL === 'ok') return { simulated: true };
  execFileSyncImpl('npm', ['install', '-g', packageName], {
    stdio: 'inherit',
    env: process.env,
  });
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
    lines.push('', 'Suggested:', '  sdd-agentic-flow upgrade');
  }
  return `${lines.join('\n')}\n`;
}

export type {
  ApplySummary,
  ClassifiedPairs,
  ExecutionMode,
  InstallProvenance,
  ManagedPair,
  PresetLike,
};
export {
  applyManagedPairs,
  checkForUpdate,
  classifyManagedPairs,
  classifyPair,
  collectManagedPairs,
  detectExecutionMode,
  detectInstalledPacks,
  formatCheckReport,
  PROVENANCE_REL,
  provenancePath,
  readInstallProvenance,
  runNpmGlobalInstall,
  writeInstallProvenance,
};
