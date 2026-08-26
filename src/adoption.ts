import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { configValue } from './config-domain';
import { resolveGitContext } from './git-context';
import { readInstallConfig, repositoryKey } from './install-domain';
import { gitInfoExcludePath, gitMetadataDir } from './paths';
import { HISTORICAL_SKILLS, OFFICIAL_SKILLS } from './skill-identity';

const ADOPTION_MODES = ['personal', 'specs-shared', 'team'] as const;
type AdoptionMode = (typeof ADOPTION_MODES)[number];
type AdoptionState = AdoptionMode | 'unclassified';

const BLOCKS = {
  specs: {
    start: '# sdd-agentic-flow managed excludes: specs',
    end: '# end sdd-agentic-flow managed excludes: specs',
  },
  state: {
    start: '# sdd-agentic-flow managed excludes: state',
    end: '# end sdd-agentic-flow managed excludes: state',
  },
  derived: {
    start: '# sdd-agentic-flow managed excludes: derived',
    end: '# end sdd-agentic-flow managed excludes: derived',
  },
} as const;

const LOCAL_TEAM_ARTIFACTS = [
  '.sdd-agentic-flow/workspace.yml',
  '.sdd-agentic-flow/context/project-context.md',
  '.sdd-agentic-flow/reports/',
  '.sdd-agentic-flow/snapshots/',
  '.sdd-agentic-flow/autonomy/',
  '.sdd-agentic-flow/explanations/',
  '.sdd-agentic-flow/usage.md',
  '.sdd-agentic-flow/saf-skills-usage-guide.md',
  '.sdd-agentic-flow/saf-skills-usage-guide.pt-BR.md',
] as const;

type AdoptionInspection = {
  mode: AdoptionState;
  specsRoot: string;
  repoRoot: string;
  expected: string[];
  managed: string[];
  drift: string[];
  warning?: string;
};

type AdoptionResult = AdoptionInspection & { changed: boolean };

function isAdoptionMode(value: unknown): value is AdoptionMode {
  return typeof value === 'string' && (ADOPTION_MODES as readonly string[]).includes(value);
}

function repositoryRoot(cwd: string): string {
  const resolved = resolveGitContext(cwd);
  return resolved.ok ? resolved.context.projectRoot : path.resolve(cwd);
}

function normalizeSpecsRoot(
  cwd: string,
  value = '.specs/features',
): { ok: true; relative: string; absolute: string } | { ok: false; error: string } {
  const raw = value.trim().replace(/\\/g, '/');
  if (!raw || path.posix.isAbsolute(raw)) {
    return { ok: false, error: 'specs.root must be a non-empty project-relative path' };
  }
  const segments = raw.split('/');
  if (segments.some((segment) => segment === '..')) {
    return { ok: false, error: 'specs.root cannot traverse outside the project' };
  }
  const relative = path.posix.normalize(raw).replace(/^\.\//, '');
  if (!relative || relative === '.') {
    return { ok: false, error: 'specs.root must identify a repository path' };
  }
  const root = repositoryRoot(cwd);
  const absolute = path.resolve(root, relative);
  const relativeToRoot = path.relative(root, absolute);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return { ok: false, error: 'specs.root must remain inside the project' };
  }
  return { ok: true, relative: relative.replace(/\/$/, ''), absolute };
}

function specsRootFor(cwd: string): ReturnType<typeof normalizeSpecsRoot> {
  const configPath = path.join(cwd, '.sdd-agentic-flow', 'config.yml');
  if (!fs.existsSync(configPath)) return normalizeSpecsRoot(cwd);
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    return normalizeSpecsRoot(cwd, configValue(content, 'root') || '.specs/features');
  } catch {
    return { ok: false, error: 'specs.root could not be read from the SAF config' };
  }
}

function projectAdoptionMode(cwd: string, homeDir: string): AdoptionState {
  try {
    const config = readInstallConfig(homeDir);
    const profile = config?.projects[repositoryKey(cwd)];
    return isAdoptionMode(profile?.adoption_mode) ? profile.adoption_mode : 'unclassified';
  } catch {
    return 'unclassified';
  }
}

function gitExcludeEntry(projectRelativePath: string, entry: string): string {
  return projectRelativePath === '.' ? entry : `${projectRelativePath}/${entry}`;
}

function expectedExcludes(
  mode: AdoptionMode,
  specsRoot: string,
  projectRelativePath = '.',
): string[] {
  const entries =
    mode === 'personal'
      ? ['.sdd-agentic-flow/', `${specsRoot}/`]
      : mode === 'specs-shared'
        ? ['.sdd-agentic-flow/']
        : [...LOCAL_TEAM_ARTIFACTS];
  return entries.map((entry) => gitExcludeEntry(projectRelativePath, entry));
}

function blockText(block: (typeof BLOCKS)[keyof typeof BLOCKS], entries: string[]): string {
  return [block.start, ...entries, block.end].join('\n');
}

function removeManagedBlocks(content: string): string {
  let next = content;
  for (const block of Object.values(BLOCKS)) {
    const pattern = new RegExp(
      `\\n?${escapeRegExp(block.start)}\\n[\\s\\S]*?${escapeRegExp(block.end)}\\n?`,
      'g',
    );
    next = next.replace(pattern, '\n');
  }
  // SAF 6.4 project-local block and init's explicit legacy block are both SAF-owned.
  next = next.replace(/\n?# sdd-agentic-flow project-local skills\n\.agents\/skills\/\n?/g, '\n');
  next = next.replace(
    /\n?# sdd-agentic-flow init --local-git-exclude\n\.sdd-agentic-flow\/\n?/g,
    '\n',
  );
  return next.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function managedEntries(content: string): string[] {
  const entries = new Set<string>();
  for (const block of Object.values(BLOCKS)) {
    const pattern = new RegExp(
      `${escapeRegExp(block.start)}\\n([\\s\\S]*?)${escapeRegExp(block.end)}`,
    );
    const match = content.match(pattern);
    for (const line of match?.[1]?.split(/\r?\n/) || []) if (line.trim()) entries.add(line.trim());
  }
  return [...entries];
}

function inspectAdoption(cwd: string, homeDir: string): AdoptionInspection {
  const mode = projectAdoptionMode(cwd, homeDir);
  const normalized = specsRootFor(cwd);
  const repoRoot = repositoryRoot(cwd);
  const git = resolveGitContext(cwd);
  const projectRelativePath = git.ok ? git.context.projectRelativePath : '.';
  if (!normalized.ok) {
    return {
      mode,
      specsRoot: '(invalid)',
      repoRoot,
      expected: [],
      managed: [],
      drift: [normalized.error],
      warning: normalized.error,
    };
  }
  const excludePath = git.ok ? git.context.excludePath : gitInfoExcludePath(cwd);
  const content =
    excludePath && fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
  const managed = managedEntries(content);
  const expected =
    mode === 'unclassified' ? [] : expectedExcludes(mode, normalized.relative, projectRelativePath);
  const drift =
    mode === 'unclassified'
      ? []
      : [
          ...new Set([
            ...expected.filter((entry) => !managed.includes(entry)),
            ...managed.filter((entry) => !expected.includes(entry)),
          ]),
        ];
  if (!excludePath && mode !== 'unclassified') drift.push('Git metadata is unavailable');
  return {
    mode,
    specsRoot: normalized.relative,
    repoRoot,
    expected,
    managed,
    drift,
    ...(drift.length ? { warning: drift.join('; ') } : {}),
  };
}

function applyAdoption(cwd: string, mode: AdoptionMode, homeDir: string): AdoptionResult {
  const inspection = inspectAdoption(cwd, homeDir);
  if (inspection.warning && inspection.specsRoot === '(invalid)') {
    return { ...inspection, changed: false };
  }
  const git = resolveGitContext(cwd);
  const excludePath = git.ok ? git.context.excludePath : gitInfoExcludePath(cwd);
  if (!excludePath)
    return {
      ...inspection,
      expected: expectedExcludes(
        mode,
        inspection.specsRoot,
        git.ok ? git.context.projectRelativePath : '.',
      ),
      changed: false,
      warning: 'Git metadata is unavailable',
    };
  const current = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
  const preserved = removeManagedBlocks(current).trimEnd();
  const projectRelativePath = git.ok ? git.context.projectRelativePath : '.';
  const specs =
    mode === 'personal' ? [gitExcludeEntry(projectRelativePath, `${inspection.specsRoot}/`)] : [];
  const state =
    mode === 'personal' || mode === 'specs-shared'
      ? [gitExcludeEntry(projectRelativePath, '.sdd-agentic-flow/')]
      : [];
  const derived =
    mode === 'team' ? expectedExcludes(mode, inspection.specsRoot, projectRelativePath) : [];
  const blocks = [
    specs.length ? blockText(BLOCKS.specs, specs) : '',
    state.length ? blockText(BLOCKS.state, state) : '',
    derived.length ? blockText(BLOCKS.derived, derived) : '',
  ].filter(Boolean);
  const next = [...(preserved ? [preserved] : []), ...blocks].join('\n\n');
  if (next !== current.trimEnd()) {
    fs.mkdirSync(path.dirname(excludePath), { recursive: true });
    if (next) fs.writeFileSync(excludePath, `${next}\n`, 'utf8');
    else fs.rmSync(excludePath, { force: true });
  }
  const refreshed = inspectAdoption(cwd, homeDir);
  const expected = expectedExcludes(mode, inspection.specsRoot, projectRelativePath);
  const drift = [
    ...new Set([
      ...expected.filter((entry) => !refreshed.managed.includes(entry)),
      ...refreshed.managed.filter((entry) => !expected.includes(entry)),
    ]),
  ];
  return {
    mode,
    specsRoot: refreshed.specsRoot,
    repoRoot: refreshed.repoRoot,
    managed: refreshed.managed,
    expected,
    drift,
    ...(drift.length ? { warning: drift.join('; ') } : {}),
    changed: next !== current.trimEnd(),
  };
}

function adoptionProfileFor(mode: AdoptionMode, scope: 'user' | 'project') {
  return { adoption_mode: mode, scope };
}

function adoptionModeForScope(mode: AdoptionMode): 'user' | 'project' {
  return mode === 'team' ? 'project' : 'user';
}

function hasManagedExcludeBlocks(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  return (
    Object.values(BLOCKS).some((block) => content.includes(block.start)) ||
    content.includes('# sdd-agentic-flow project-local skills') ||
    content.includes('# sdd-agentic-flow init --local-git-exclude')
  );
}

function removeManagedExcludeBlocksFromFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const next = removeManagedBlocks(fs.readFileSync(filePath, 'utf8')).trimEnd();
  if (next) fs.writeFileSync(filePath, `${next}\n`, 'utf8');
  else fs.rmSync(filePath, { force: true });
}

function removeUntrackedProjectAssets(cwd: string): string[] {
  if (!gitMetadataDir(cwd)) return [];
  const root = path.join(cwd, '.agents', 'skills');
  if (!fs.existsSync(root)) return [];
  const names = ['sdd-agentic-flow-shared', ...OFFICIAL_SKILLS, ...HISTORICAL_SKILLS];
  const removed: string[] = [];
  for (const name of names) {
    const target = path.join(root, name);
    if (!fs.existsSync(target)) continue;
    try {
      execFileSync('git', ['ls-files', '--error-unmatch', '--', path.relative(cwd, target)], {
        cwd,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
    } catch {
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(target);
    }
  }
  return removed;
}

export type { AdoptionInspection, AdoptionMode, AdoptionResult, AdoptionState };
export {
  ADOPTION_MODES,
  adoptionModeForScope,
  adoptionProfileFor,
  applyAdoption,
  expectedExcludes,
  hasManagedExcludeBlocks,
  inspectAdoption,
  isAdoptionMode,
  normalizeSpecsRoot,
  projectAdoptionMode,
  removeManagedExcludeBlocksFromFile,
  removeUntrackedProjectAssets,
  repositoryRoot,
};
