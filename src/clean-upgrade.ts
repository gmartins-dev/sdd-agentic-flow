import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { classifyInstallIntent, installConfigPath } from './install-domain';
import { HISTORICAL_SKILLS, OFFICIAL_SKILLS } from './skill-identity';

const CURRENT_PROVENANCE_SCHEMA = 'saf-install-provenance/v3';
const LEGACY_PROVENANCE_SCHEMAS = new Set([
  'saf-install-provenance/v1',
  'saf-install-provenance/v2',
]);
const HISTORICAL_SKILL_NAMES = new Set<string>([...OFFICIAL_SKILLS, ...HISTORICAL_SKILLS]);

type LegacyTarget = { root: string; managedSkills: string[]; shared: boolean };
type Backup = { original: string; staged: string };

export type CleanUpgradeState = 'none' | 'current' | 'legacy' | 'future' | 'unknown';

export type CleanUpgradeInspection = {
  state: CleanUpgradeState;
  cwd: string;
  blockedReason?: string;
  legacyTargets: LegacyTarget[];
  legacyIntent: boolean;
  legacyConfig: boolean;
  intentPath?: string;
  projectFiles: string[];
};

export type CleanUpgradeSession = CleanUpgradeInspection & {
  commit: () => void;
  rollback: () => void;
};

function schemaAt(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  const match = fs.readFileSync(file, 'utf8').match(/^schema:\s*(\S+)$/m);
  return match?.[1] || null;
}

function listField(text: string, name: string): string[] {
  const match = text.match(new RegExp(`^${name}:\\s*\\n((?:\\s+-\\s+[^\\n]+\\n?)*)`, 'm'));
  return match?.[1]
    ? [...match[1].matchAll(/^\s+-\s+(.+)$/gm)].flatMap((item) => (item[1] ? [item[1].trim()] : []))
    : [];
}

function legacyTarget(root: string): LegacyTarget | null {
  const provenance = path.join(root, 'sdd-agentic-flow-shared', 'install-provenance.yml');
  const text = fs.existsSync(provenance) ? fs.readFileSync(provenance, 'utf8') : '';
  const provenanceOwned =
    /^package:\s*sdd-agentic-flow$/m.test(text) &&
    LEGACY_PROVENANCE_SCHEMAS.has(schemaAt(provenance) || '');
  const fromProvenance = provenanceOwned
    ? listField(text, 'managed_skills').filter((skill) => /^[a-z0-9][a-z0-9-]*$/.test(skill))
    : [];
  const exactHistorical = fs.existsSync(root)
    ? fs.readdirSync(root).filter((name) => HISTORICAL_SKILL_NAMES.has(name))
    : [];
  const managedSkills = [...new Set([...fromProvenance, ...exactHistorical])];
  const shared = provenanceOwned || fs.existsSync(path.join(root, 'sdd-agentic-flow-shared'));
  if (!managedSkills.length && !shared) return null;
  return {
    root,
    managedSkills,
    shared,
  };
}

function targetState(root: string): 'none' | 'current' | 'legacy' | 'future' | 'unknown' {
  const file = path.join(root, 'sdd-agentic-flow-shared', 'install-provenance.yml');
  const schema = schemaAt(file);
  if (!schema) return 'none';
  if (schema === CURRENT_PROVENANCE_SCHEMA) return 'current';
  if (LEGACY_PROVENANCE_SCHEMAS.has(schema)) return 'legacy';
  if (/^saf-install-provenance\/v\d+$/.test(schema)) return 'future';
  return 'unknown';
}

export function inspectCleanUpgrade({
  cwd,
  homeDir = os.homedir(),
  targetRoots,
}: {
  cwd: string;
  homeDir?: string;
  targetRoots: string[];
}): CleanUpgradeInspection {
  const intent = classifyInstallIntent(homeDir);
  const configSchema = schemaAt(path.join(cwd, '.sdd-agentic-flow', 'config.yml'));
  const workspaceSchema = schemaAt(path.join(cwd, '.sdd-agentic-flow', 'workspace.yml'));
  const targetStates = targetRoots.map(targetState);
  const states = [
    intent.kind === 'future' || intent.kind === 'unknown'
      ? intent.kind
      : intent.kind === 'legacy'
        ? 'legacy'
        : intent.kind === 'current'
          ? 'current'
          : 'none',
    ...targetStates,
    configSchema === 'saf-config/v1' || configSchema === 'saf-config/v2'
      ? 'legacy'
      : configSchema === 'saf-config/v3' || !configSchema
        ? 'none'
        : /^saf-config\/v\d+$/.test(configSchema)
          ? 'future'
          : 'unknown',
    workspaceSchema === 'saf-workspace/v1' || !workspaceSchema
      ? 'none'
      : /^saf-workspace\/v\d+$/.test(workspaceSchema)
        ? 'future'
        : 'unknown',
  ] as CleanUpgradeState[];
  const blocked = states.find((state) => state === 'future' || state === 'unknown');
  const legacyTargets = targetRoots
    .map(legacyTarget)
    .filter((target): target is LegacyTarget => Boolean(target));
  const legacyIntent = intent.kind === 'legacy';
  const legacyConfig = configSchema === 'saf-config/v1' || configSchema === 'saf-config/v2';
  const projectRoot = path.join(cwd, '.sdd-agentic-flow');
  const projectFiles = [
    'config.yml',
    'usage.md',
    'saf-skills-usage-guide.md',
    'saf-skills-usage-guide.pt-BR.md',
    'workspace.yml',
    path.join('context', 'project-context.md'),
    path.join('autonomy', 'loop-state.md'),
    'reports',
    'snapshots',
    'explanations',
  ]
    .map((relative) => path.join(projectRoot, relative))
    .filter((file) => fs.existsSync(file));
  if (blocked) {
    return {
      state: blocked,
      cwd,
      blockedReason:
        'installation state is newer than or unknown to this CLI; no cleanup was attempted',
      legacyTargets,
      legacyIntent,
      legacyConfig,
      intentPath: installConfigPath(homeDir),
      projectFiles,
    };
  }
  const legacy = states.includes('legacy');
  return {
    state: legacy ? 'legacy' : states.includes('current') ? 'current' : 'none',
    cwd,
    legacyTargets,
    legacyIntent,
    legacyConfig,
    intentPath: installConfigPath(homeDir),
    projectFiles,
  };
}

export function prepareCleanUpgrade(inspection: CleanUpgradeInspection): CleanUpgradeSession {
  if (inspection.state !== 'legacy') return { ...inspection, commit: () => {}, rollback: () => {} };
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-clean-upgrade-'));
  const backups: Backup[] = [];
  const move = (original: string, label: string) => {
    if (!fs.existsSync(original)) return;
    const staged = path.join(backupRoot, label);
    fs.mkdirSync(path.dirname(staged), { recursive: true });
    fs.renameSync(original, staged);
    backups.push({ original, staged });
  };
  try {
    for (const target of inspection.legacyTargets) {
      for (const skill of target.managedSkills)
        move(
          path.join(target.root, skill),
          path.join('targets', encodeURIComponent(target.root), skill),
        );
      if (target.shared)
        move(
          path.join(target.root, 'sdd-agentic-flow-shared'),
          path.join('targets', encodeURIComponent(target.root), 'sdd-agentic-flow-shared'),
        );
    }
    if (inspection.legacyIntent && inspection.intentPath)
      move(inspection.intentPath, 'install-intent.yml');
    for (const file of inspection.projectFiles) {
      const relative = path.relative(inspection.cwd, file);
      move(file, path.join('project', encodeURIComponent(relative)));
    }
  } catch (error) {
    for (const backup of [...backups].reverse()) {
      if (fs.existsSync(backup.staged)) {
        fs.mkdirSync(path.dirname(backup.original), { recursive: true });
        fs.renameSync(backup.staged, backup.original);
      }
    }
    fs.rmSync(backupRoot, { recursive: true, force: true });
    throw error;
  }
  let finished = false;
  return {
    ...inspection,
    commit: () => {
      if (finished) return;
      finished = true;
      fs.rmSync(backupRoot, { recursive: true, force: true });
    },
    rollback: () => {
      if (finished) return;
      for (const backup of [...backups].reverse()) {
        if (fs.existsSync(backup.original))
          fs.rmSync(backup.original, { recursive: true, force: true });
        if (fs.existsSync(backup.staged)) {
          fs.mkdirSync(path.dirname(backup.original), { recursive: true });
          fs.renameSync(backup.staged, backup.original);
        }
      }
      fs.rmSync(backupRoot, { recursive: true, force: true });
      finished = true;
    },
  };
}
