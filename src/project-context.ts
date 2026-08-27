import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { renderCliCommand } from './cli-command';
import { EFFECTIVE_DEFAULTS, readConfig } from './config-domain';
import { resolveLocale, t, translateText } from './messages';
import { SDD_PATHS, sddJoin, VERSION } from './paths';
import { type DisplayMode, outputMode, styleStatus } from './ui';

type ProjectSignals = {
  readme: boolean;
  aiInstructionFiles: string[];
  docsDir: boolean;
  adrDirs: string[];
  packageName: string | null;
  packageDescription: string | null;
  workspaces: boolean;
  workspaceConfigs: string[];
  testConfigs: string[];
  architecturalFolders: string[];
  ciConfigs: string[];
  ormConfigs: string[];
  featureFlagConfigs: string[];
};

type PackageJsonPartial = {
  name?: string;
  description?: string;
  workspaces?: unknown;
};

type ProjectContextOptions = {
  quiet?: boolean | undefined;
  ascii?: boolean | undefined;
  force?: boolean | undefined;
  overrideGuard?: string | null | undefined;
  reason?: string | null | undefined;
};

type NextStepOptions = ProjectContextOptions & {
  mode?: DisplayMode | undefined;
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function localeFor(cwd: string): string {
  const config = readConfig(sddJoin(cwd, 'config.yml'));
  return resolveLocale({ configured: config.ok ? config.languageProfile : null });
}

function resolveMode(flags: ProjectContextOptions = {}): DisplayMode {
  return outputMode({ stdout: process.stdout, stdin: process.stdin }, process.env, {
    ascii:
      Boolean(flags.ascii) || process.argv.includes('--ascii') || process.env.SDD_ASCII === '1',
    quiet: Boolean(flags.quiet),
  });
}

function log(status: string, message: string, explicitLocale?: string) {
  const locale = explicitLocale || localeFor(process.cwd());
  process.stdout.write(
    `${styleStatus(status, process.stdout)} ${translateText(locale, message)}\n`,
  );
}

function fail(message: string, code = 1) {
  process.stderr.write(`${styleStatus('FAIL', process.stderr)} ${message}\n`);
  process.exitCode = code;
}

function nextStep(line: string | string[], options: NextStepOptions = {}) {
  if (options.quiet) return;
  const mode = options.mode ?? resolveMode(options);
  if (mode === 'machine') return;
  const list = (Array.isArray(line) ? line : [line]).filter(Boolean);
  if (!list.length) return;
  const locale = localeFor(process.cwd());
  process.stdout.write(
    `\n${t(locale, 'init.next')}\n${list.map((entry: string) => `  ${entry}`).join('\n')}\n`,
  );
}

function existingPaths(cwd: string, names: string[]) {
  return names.filter((name: string) => fs.existsSync(path.join(cwd, name)));
}

export function gitInfo(cwd: string) {
  const runGit = (args: string[]) => {
    try {
      return execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return null;
    }
  };
  return {
    revision: runGit(['rev-parse', 'HEAD']),
    branch: runGit(['rev-parse', '--abbrev-ref', 'HEAD']),
  };
}

function scanProjectSignals(cwd: string): ProjectSignals {
  let packageJson: PackageJsonPartial | null = null;
  try {
    packageJson = JSON.parse(
      fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'),
    ) as PackageJsonPartial;
  } catch {
    packageJson = null;
  }
  return {
    readme: fs.existsSync(path.join(cwd, 'README.md')),
    aiInstructionFiles: existingPaths(cwd, ['AGENTS.md', 'CLAUDE.md', 'CODEX.md', 'GEMINI.md']),
    docsDir: fs.existsSync(path.join(cwd, 'docs')),
    adrDirs: existingPaths(cwd, ['adr', 'docs/adr']),
    packageName: packageJson?.name || null,
    packageDescription: packageJson?.description || null,
    workspaces: Boolean(packageJson?.workspaces),
    workspaceConfigs: existingPaths(cwd, [
      'pnpm-workspace.yaml',
      'turbo.json',
      'nx.json',
      'lerna.json',
    ]),
    testConfigs: existingPaths(cwd, [
      'jest.config.js',
      'jest.config.ts',
      'jest.config.mjs',
      'vitest.config.js',
      'vitest.config.ts',
      'pytest.ini',
      'pyproject.toml',
    ]),
    architecturalFolders: existingPaths(cwd, [
      'domain',
      'src/domain',
      'hexagonal',
      'src/hexagonal',
      'ports',
      'src/ports',
      'adapters',
      'src/adapters',
    ]),
    ciConfigs: existingPaths(cwd, ['.github/workflows', '.gitlab-ci.yml', '.circleci']),
    ormConfigs: existingPaths(cwd, [
      'prisma/schema.prisma',
      'drizzle.config.ts',
      'drizzle.config.js',
    ]),
    featureFlagConfigs: existingPaths(cwd, ['.launchdarkly.yml', 'unleash.yml']),
  };
}

function projectContextFor(signals: ProjectSignals, provenance: Record<string, unknown>) {
  const bullets = (items: string[], empty: string) =>
    items.length ? items.map((item: string) => `- ${item}`).join('\n') : `- ${empty}`;
  return `# Project context (auto-discovered)

This file is generated by \`${renderCliCommand('context', 'refresh')}\` (also run automatically by
\`init\`). It records signals found in this repository so skills can load relevant
context without guessing. It is read-only generated output: re-run
\`${renderCliCommand('context', 'refresh')}\` after project changes. Run
\`${renderCliCommand('context', 'status')}\` to check what this file reflects without regenerating it.

> Generated by sdd-agentic-flow ${VERSION}
> Generated at: ${asString(provenance.generatedAt, 'unknown')}
> Repository revision: ${asString(provenance.revision) || 'not a git repository'}
> Branch: ${asString(provenance.branch) || 'unknown'}

## Project identity

- Package name: ${signals.packageName || 'not detected'}
- Package description: ${signals.packageDescription || 'not detected'}
- README present: ${signals.readme ? 'yes' : 'no'}

## Documentation found

${bullets(signals.aiInstructionFiles, 'no AI instruction files found (AGENTS.md, CLAUDE.md, CODEX.md, GEMINI.md)')}
- docs/ directory: ${signals.docsDir ? 'present' : 'not found'}
- ADR directory: ${signals.adrDirs.length ? signals.adrDirs.join(', ') : 'not found'}

## Workspace / monorepo signals

- Declares workspaces in package.json: ${signals.workspaces ? 'yes' : 'no'}
${bullets(signals.workspaceConfigs, 'no monorepo tooling config found (pnpm-workspace.yaml, turbo.json, nx.json, lerna.json)')}

## Testing signals

${bullets(signals.testConfigs, 'no known test config found')}

## Architecture signals

${bullets(signals.architecturalFolders, 'no domain/hexagonal/ports/adapters folder naming found')}

## CI/CD signals

${bullets(signals.ciConfigs, 'no CI configuration found (.github/workflows, .gitlab-ci.yml, .circleci)')}

## Platform signals

${bullets(signals.ormConfigs, 'no ORM config found (prisma/schema.prisma, drizzle.config.*)')}
${bullets(signals.featureFlagConfigs, 'no feature-flag config found (.launchdarkly.yml, unleash.yml)')}
`;
}

export function discoverProject(cwd: string, options: ProjectContextOptions = {}) {
  const contextPath = sddJoin(cwd, 'context', 'project-context.md');
  if (fs.existsSync(contextPath) && !options.force) {
    log('WARN', `preserved existing ${SDD_PATHS.projectContext}`);
    return false;
  }
  const provenance = { generatedAt: new Date().toISOString(), ...gitInfo(cwd) };
  fs.mkdirSync(path.dirname(contextPath), { recursive: true });
  fs.writeFileSync(contextPath, projectContextFor(scanProjectSignals(cwd), provenance), 'utf8');
  log('PASS', `created ${SDD_PATHS.projectContext}`);
  if (!options.quiet) nextStep(renderCliCommand('doctor'), { quiet: options.quiet });
  return true;
}

export function parseProvenance(content: string): Record<string, unknown> | null {
  const match = (label: string) => {
    const found = content.match(new RegExp(`^> ${label}: (.+)$`, 'm'));
    return found?.[1]?.trim() ?? null;
  };
  return {
    generatedAt: match('Generated at'),
    revision: match('Repository revision'),
    branch: match('Branch'),
  };
}

export function contextStatus(cwd: string) {
  const contextPath = sddJoin(cwd, 'context', 'project-context.md');
  if (!fs.existsSync(contextPath)) {
    log(
      'WARN',
      `status: not found; run \`init\` or \`context refresh\` to create ${SDD_PATHS.projectContext}`,
    );
    return;
  }
  const provenance = parseProvenance(fs.readFileSync(contextPath, 'utf8'));
  log('PASS', 'status: available');
  log('INFO', `artifact: ${SDD_PATHS.projectContext}`);
  if (!provenance) {
    log('WARN', 'status: provenance could not be parsed');
    return;
  }
  log('INFO', `generated at: ${asString(provenance.generatedAt) || 'unknown'}`);
  log('INFO', `repository revision: ${asString(provenance.revision) || 'not a git repository'}`);
  log('INFO', `branch: ${asString(provenance.branch) || 'unknown'}`);
  const current = gitInfo(cwd);
  if (provenance.revision && current.revision && provenance.revision !== current.revision) {
    log('INFO', 'Repository has changed since context generation.');
    log('INFO', `Recommendation: run \`${renderCliCommand('context', 'refresh')}\`.`);
  }
}

export function contextRefresh(cwd: string, options: ProjectContextOptions = {}) {
  discoverProject(cwd, { force: true, quiet: options.quiet, ascii: Boolean(options.ascii) });
}

// v1.8.0: .sdd-agentic-flow/autonomy/loop-state.md is the execution-state file an agent maintains while
// running a workflow under autonomy_level supervised/autonomous (shared/references/
// autonomy-guardrails.md). This CLI never runs skills itself — it only reads/writes this file
// so `doctor --autonomy`, `context autonomy-state`, and `autonomous-resume` can report and act
// on state an agent already recorded.
//
// A literal forward-slash string, deliberately not built with path.join — every other
// generated-artifact path already displayed in this file (e.g. '.sdd-agentic-flow/context/project-context.md')
// is a literal string for exactly this reason: path.join would produce backslashes in
// user-facing text on Windows, unlike the actual filesystem access below (loopStatePath), which
// does use path.join.
const LOOP_STATE_RELATIVE = SDD_PATHS.loopState;

function loopStatePath(cwd: string) {
  return sddJoin(cwd, 'autonomy', 'loop-state.md');
}

function latestCurrentStateSection(content: string) {
  const blocks = content.split(/^## Current State$/m);
  if (blocks.length < 2) return content;
  return blocks[blocks.length - 1]?.split(/^## /m)[0] ?? content;
}

function clearLastHumanOverride(content: string) {
  const regex = /^- Human override:.*$/gm;
  let lastMatch = null;
  let match = regex.exec(content);
  while (match) {
    lastMatch = match;
    match = regex.exec(content);
  }
  if (!lastMatch) return content;
  const start = lastMatch.index;
  const end = start + lastMatch[0].length;
  return `${content.slice(0, start)}- Human override: pause=false, stop=false${content.slice(end)}`;
}

function parseLoopState(content: string) {
  const latest = latestCurrentStateSection(content);
  const field = (label: string) => {
    const match = latest.match(new RegExp(`^- ${label}:\\s*(.+)$`, 'm'));
    return match?.[1]?.trim() ?? null;
  };
  const overrideRaw = field('Human override') || '';
  return {
    executionMode: content.match(/^Execution mode:\s*(.+)$/m)?.[1] ?? null,
    autonomyLevel: content.match(/^Autonomy level:\s*(.+)$/m)?.[1] ?? null,
    skill: field('Skill'),
    status: field('Status'),
    next: field('Next'),
    guardrails: field('Guardrails'),
    pause: /pause\s*=\s*true/.test(overrideRaw),
    stop: /stop\s*=\s*true/.test(overrideRaw),
  };
}

export function readLoopState(cwd: string) {
  const file = loopStatePath(cwd);
  if (!fs.existsSync(file)) return null;
  return {
    file,
    content: fs.readFileSync(file, 'utf8'),
    ...parseLoopState(fs.readFileSync(file, 'utf8')),
  };
}

export function autonomyStateReport(cwd: string) {
  const policy = readConfig(sddJoin(cwd, 'config.yml')).policy;
  const executionMode = policy?.executionMode || EFFECTIVE_DEFAULTS.execution_mode;
  const autonomyLevel = policy?.autonomyLevel || EFFECTIVE_DEFAULTS.autonomy_level;
  log('INFO', `execution_mode: ${executionMode}`);
  log('INFO', `autonomy_level: ${autonomyLevel}`);
  const state = readLoopState(cwd);
  if (!state) {
    log(
      'WARN',
      `status: no ${LOOP_STATE_RELATIVE} found; it is created by an agent the first time it runs a supervised/autonomous workflow`,
    );
    return;
  }
  log('PASS', 'status: available');
  log('INFO', `artifact: ${LOOP_STATE_RELATIVE}`);
  log('INFO', `current skill: ${state.skill || 'unknown'}`);
  log('INFO', `status: ${state.status || 'unknown'}`);
  log('INFO', `next: ${state.next || 'none'}`);
  log('INFO', `guardrails: ${state.guardrails || 'unknown'}`);
  if (state.stop)
    log('WARN', 'human override: stop=true — resolve the blocker, then run `autonomous-resume`');
  else if (state.pause)
    log('WARN', 'human override: pause=true — run `autonomous-resume` to continue');
  else log('PASS', 'human override: none');
}

export function autonomousResume(cwd: string, options: ProjectContextOptions = {}) {
  const state = readLoopState(cwd);
  if (!state) {
    fail(
      `no ${LOOP_STATE_RELATIVE} found; nothing to resume. It is created by an agent the first time it runs a supervised/autonomous workflow.`,
    );
    return;
  }
  if (!state.pause && !state.stop && !options.force && !options.overrideGuard) {
    log('PASS', `no active pause/stop recorded at skill '${state.skill}'; nothing to resume`);
    return;
  }
  const timestamp = new Date().toISOString();
  const entry = options.overrideGuard
    ? `- ${timestamp}: guardrail ${options.overrideGuard} overridden by human. Reason: ${options.reason}`
    : `- ${timestamp}: resumed via \`autonomous-resume${options.force ? ' --force' : ''}\`.`;
  let content = clearLastHumanOverride(state.content);
  content = /^## Override Log$/m.test(content)
    ? `${content.trimEnd()}\n${entry}\n`
    : `${content.trimEnd()}\n\n## Override Log\n\n${entry}\n`;
  fs.writeFileSync(state.file, content, 'utf8');
  log('PASS', `resumed: cleared human override recorded at skill '${state.skill}'`);
  log('INFO', `next skill: ${state.next || `unknown — inspect ${SDD_PATHS.loopState}`}`);
  log('INFO', 'the invoking agent re-checks all 7 guardrails before advancing to it.');
  if (state.next) nextStep(`invoke the ${state.next} skill`, { quiet: options.quiet });
  else nextStep('invoke the saf-route skill', { quiet: options.quiet });
}
