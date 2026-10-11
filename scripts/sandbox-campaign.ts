// Maintainer skill-behavior campaign runner. Each run prepares one disposable fixture, installs the
// SAF bundle under evaluation, lets a host (or an offline stub) act, and derives the verdict from an
// external oracle. A host exit code is an observation, never a verdict. Model hosts run only in
// `real` mode with an explicit wall-time ceiling; `npm run check` never reaches them.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type BehaviorCase, CASES, type Split, settleBackground } from './skill-behavior/cases.js';
import { changedPaths, snapshot, snapshotDigest } from './skill-behavior/oracle.js';
import {
  type BehaviorRecord,
  type Condition,
  deriveVerdict,
  RECORD_SCHEMA,
  type Termination,
} from './skill-behavior/record.js';

export type CampaignMode = 'dry-run' | 'stub' | 'real';
export type HostId = 'claude' | 'codex' | 'cursor' | 'stub';
export type CampaignOptions = {
  mode?: CampaignMode;
  hosts?: HostId[];
  caseIds?: string[];
  split?: Split;
  condition?: Exclude<Condition, 'no-saf'>;
  baselineVersion?: string;
  trials?: number;
  stubBehavior?: 'compliant' | 'violating';
  model?: string;
  sessionTimeoutMinutes?: number;
  wallTimeMinutes?: number;
  maxBudgetUsd?: number;
  install?: boolean;
  output?: string;
  keep?: boolean;
};

type SetupResult = { id: string; status: 'PASS' | 'FAIL' | 'SKIPPED'; note: string };

const repoRoot = path.join(__dirname, '..');
export const packageVersion = (
  JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string }
).version;

export function redact(value: string): string {
  return value
    .replace(
      /(authorization|token|api[_-]?key|password|secret)\s*[:=]\s*[^\s,}]+/gi,
      '$1=[REDACTED]',
    )
    .replace(/\/home\/[^\s/]+(?:\/[^\s]*)?/g, '[PATH]')
    .replace(/\/Users\/[^\s/]+(?:\/[^\s]*)?/g, '[PATH]');
}

function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function npmInvocation(args: string[]): { command: string; args: string[] } {
  const npmCli = process.env.npm_execpath;
  if (npmCli) return { command: process.execPath, args: [npmCli, ...args] };
  return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args };
}

// Pack the working tree (candidate) or a published version (baseline) into a tarball.
function packBundle(
  root: string,
  condition: 'baseline' | 'candidate',
  version: string,
): { tarball: string; sha256: string } {
  const packDir = path.join(root, `pack-${condition}`);
  fs.mkdirSync(packDir, { recursive: true });
  const spec = condition === 'candidate' ? [] : [`sdd-agentic-flow@${version}`];
  const invocation = npmInvocation(['pack', ...spec, '--json', '--pack-destination', packDir]);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 180_000,
  });
  if (result.status !== 0)
    throw new Error(`npm pack failed: ${result.error?.message ?? result.stderr}`);
  const metadata = JSON.parse(result.stdout.slice(result.stdout.indexOf('['))) as Array<{
    filename: string;
  }>;
  const first = metadata[0];
  if (!first) throw new Error('npm pack returned no artifact');
  const tarball = path.join(packDir, first.filename);
  return { tarball, sha256: sha256(tarball) };
}

// Install the bundle once into a template project; each run copies the installed `.agents` tree.
function installTemplate(root: string, tarball: string): SetupResult & { template: string } {
  const template = path.join(root, 'template');
  fs.mkdirSync(template, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: template });
  const home = path.join(root, 'install-home');
  fs.mkdirSync(home, { recursive: true });
  const install = spawnSync(
    'npx',
    [
      '--yes',
      '--no-audit',
      `file:${tarball}`,
      'install',
      '--scope',
      'project',
      '--adoption-mode',
      'team',
      '--yes',
    ],
    {
      cwd: template,
      env: { ...process.env, HOME: home, USERPROFILE: home },
      encoding: 'utf8',
      // npx is a .cmd shim on Windows, which Node spawns only through a shell.
      shell: process.platform === 'win32',
      timeout: 180_000,
    },
  );
  const skills = path.join(template, '.agents', 'skills');
  const installed = fs.existsSync(skills)
    ? fs.readdirSync(skills).filter((name) => name.startsWith('saf-'))
    : [];
  const ok = install.status === 0 && installed.length > 0;
  return {
    id: 'SETUP-INSTALL',
    status: ok ? 'PASS' : 'FAIL',
    note: ok
      ? `installed ${installed.length} official skills`
      : redact(install.stderr || install.stdout || 'install produced no skills'),
    template,
  };
}

// Isolated host profiles get only the credential files each CLI needs; returns what is missing.
export function prepareProfile(root: string, host: HostId, sourceHome = os.homedir()): string[] {
  const home = path.join(root, `${host}-home`);
  const files: Record<HostId, Array<[string, string]>> = {
    claude: [['.claude/.credentials.json', 'claude-config/.credentials.json']],
    codex: [
      ['.codex/auth.json', 'auth.json'],
      ['.codex/config.toml', 'config.toml'],
    ],
    cursor: [['.cursor/auth.json', '.cursor/auth.json']],
    stub: [],
  };
  const missing: string[] = [];
  for (const [source, target] of files[host]) {
    const from = path.join(sourceHome, source);
    // config.toml is optional; only credentials are required.
    if (!fs.existsSync(from)) {
      if (!source.endsWith('config.toml')) missing.push(`[HOME]/${source}`);
      continue;
    }
    const to = path.join(home, target);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
  }
  return missing;
}

// Bash runs inside Claude Code's own sandbox (writes confined to the workspace), is auto-approved
// there, and may not escape it; a session fails instead of silently running unsandboxed.
export const CLAUDE_SANDBOX_SETTINGS = {
  sandbox: {
    enabled: true,
    autoAllowBashIfSandboxed: true,
    allowUnsandboxedCommands: false,
    failIfUnavailable: true,
  },
};

// Each host discovers project skills in its own documented directory.
export function skillsDirFor(host: HostId): string {
  return host === 'claude' ? path.join('.claude', 'skills') : path.join('.agents', 'skills');
}

export function hostCommand(
  host: Exclude<HostId, 'stub'>,
  input: { prompt: string; project: string; home: string; model?: string; maxBudgetUsd?: number },
): { command: string; args: string[]; env: NodeJS.ProcessEnv } {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: input.home, USERPROFILE: input.home };
  const model = input.model ? ['--model', input.model] : [];
  if (host === 'claude') {
    env.CLAUDE_CONFIG_DIR = path.join(input.home, 'claude-config');
    const budget = input.maxBudgetUsd ? ['--max-budget-usd', String(input.maxBudgetUsd)] : [];
    return {
      command: 'claude',
      args: [
        '-p',
        input.prompt,
        '--output-format',
        'stream-json',
        '--verbose',
        '--permission-mode',
        'acceptEdits',
        '--settings',
        JSON.stringify(CLAUDE_SANDBOX_SETTINGS),
        ...model,
        ...budget,
      ],
      env,
    };
  }
  if (host === 'codex') {
    env.CODEX_HOME = input.home;
    return {
      command: 'codex',
      args: [
        'exec',
        '-C',
        input.project,
        '--sandbox',
        'workspace-write',
        '--json',
        ...model,
        input.prompt,
      ],
      env,
    };
  }
  return {
    command: 'agent',
    args: [
      '--print',
      '--output-format',
      'json',
      '--workspace',
      input.project,
      '--trust',
      '--force',
      ...model,
      input.prompt,
    ],
    env,
  };
}

export type HostOutput = {
  commands: string[];
  model: string | null;
  usage: BehaviorRecord['usage'];
  resultSubtype: string | null;
  skillLoaded: boolean;
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

// Read the host's machine event stream (Claude stream-json, Codex --json). Commands, model, and
// usage come only from what the host reported; anything absent stays unknown.
export function parseHostOutput(stdout: string): HostOutput {
  const output: HostOutput = {
    commands: [],
    model: null,
    usage: null,
    resultSubtype: null,
    skillLoaded: false,
  };
  const usage: NonNullable<BehaviorRecord['usage']> = {};
  const addTokens = (key: 'input_tokens' | 'output_tokens', value: unknown) => {
    if (typeof value === 'number') usage[key] = (usage[key] ?? 0) + value;
  };
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue;
    let event: Record<string, unknown>;
    try {
      event = record(JSON.parse(line));
    } catch {
      continue;
    }
    if (typeof event.model === 'string') output.model = event.model;
    const message = record(event.message);
    if (typeof message.model === 'string') output.model = message.model;
    for (const part of Array.isArray(message.content) ? message.content : []) {
      const item = record(part);
      if (item.type !== 'tool_use') continue;
      const input = record(item.input);
      if (item.name === 'Bash' && typeof input.command === 'string')
        output.commands.push(input.command);
      if (item.name === 'Skill') output.skillLoaded = true;
      if (typeof input.file_path === 'string' && /SKILL\.md$/.test(input.file_path))
        output.skillLoaded = true;
    }
    const codexItem = record(event.item);
    if (codexItem.type === 'command_execution' && event.type === 'item.completed') {
      const command = Array.isArray(codexItem.command)
        ? codexItem.command.join(' ')
        : codexItem.command;
      if (typeof command === 'string') output.commands.push(command);
    }
    if (event.type === 'result') {
      output.resultSubtype = typeof event.subtype === 'string' ? event.subtype : null;
      if (typeof event.total_cost_usd === 'number') usage.cost_usd = event.total_cost_usd;
      const reported = record(event.usage);
      addTokens('input_tokens', reported.input_tokens);
      addTokens('output_tokens', reported.output_tokens);
    }
    if (event.type === 'turn.completed') {
      const reported = record(event.usage);
      addTokens('input_tokens', reported.input_tokens);
      addTokens('output_tokens', reported.output_tokens);
    }
  }
  if (output.commands.some((command) => /SKILL\.md/.test(command))) output.skillLoaded = true;
  output.usage = Object.keys(usage).length ? usage : null;
  return output;
}

// Map the host's own result to a termination; the verdict still comes from the oracle.
export function terminationFor(input: {
  errorCode?: string | undefined;
  signal: string | null;
  exitCode: number | null;
  resultSubtype: string | null;
}): Termination {
  if (input.errorCode === 'ENOENT') return 'host-unavailable';
  if (input.errorCode === 'ETIMEDOUT' || input.signal === 'SIGTERM') return 'timeout';
  if (input.errorCode) return 'transport-error';
  if (input.resultSubtype && /budget|max_turns/i.test(input.resultSubtype)) return 'budget';
  if (input.resultSubtype && input.resultSubtype !== 'success') return 'transport-error';
  if (input.exitCode !== 0 && input.resultSubtype === null) return 'transport-error';
  return 'normal';
}

type Session = {
  termination: Termination;
  host?: HostOutput;
  exitCode: number | null;
  durationMs: number | null;
  stdout: string;
  stderr: string;
  checksNotRun: BehaviorRecord['checks_not_run'];
};

function runHost(
  host: HostId,
  item: BehaviorCase,
  project: string,
  options: Required<Omit<CampaignOptions, 'model' | 'baselineVersion'>> & { model?: string },
  homes: Map<HostId, string>,
  timeoutMs: number,
): Session {
  if (options.mode === 'dry-run')
    return {
      termination: 'not-run',
      exitCode: null,
      durationMs: null,
      stdout: '',
      stderr: '',
      checksNotRun: [{ name: 'host session', reason: 'dry-run: model invocation not performed' }],
    };
  if (host === 'stub') {
    const started = Date.now();
    item.simulate[options.stubBehavior](project);
    return {
      termination: 'normal',
      exitCode: 0,
      durationMs: Date.now() - started,
      stdout: `stub:${options.stubBehavior}`,
      stderr: '',
      checksNotRun: [],
    };
  }
  const home = homes.get(host);
  if (!home)
    return {
      termination: 'host-unavailable',
      exitCode: null,
      durationMs: null,
      stdout: '',
      stderr: '',
      checksNotRun: [{ name: 'host session', reason: 'isolated host profile is unavailable' }],
    };
  const invocation = hostCommand(host, {
    prompt: item.prompt,
    project,
    home,
    ...(options.model ? { model: options.model } : {}),
    ...(options.maxBudgetUsd ? { maxBudgetUsd: options.maxBudgetUsd } : {}),
  });
  const started = Date.now();
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: project,
    env: invocation.env,
    encoding: 'utf8',
    timeout: timeoutMs,
    // Event streams of long sessions exceed the 1 MiB default.
    maxBuffer: 64 * 1024 * 1024,
  });
  const error = result.error as NodeJS.ErrnoException | undefined;
  const parsed = parseHostOutput(result.stdout ?? '');
  return {
    termination: terminationFor({
      errorCode: error?.code,
      signal: result.signal,
      exitCode: result.status,
      resultSubtype: parsed.resultSubtype,
    }),
    host: parsed,
    exitCode: result.status,
    durationMs: Date.now() - started,
    stdout: redact(result.stdout ?? ''),
    stderr: redact(result.stderr ?? ''),
    checksNotRun: [],
  };
}

function hostVersion(host: HostId): string | null {
  const command = host === 'claude' ? 'claude' : host === 'codex' ? 'codex' : 'agent';
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 30_000 });
  return result.status === 0 ? result.stdout.trim().split(/\r?\n/)[0] || null : null;
}

function excludeFromGit(project: string, entries: string[]): void {
  const exclude = path.join(project, '.git', 'info', 'exclude');
  fs.mkdirSync(path.dirname(exclude), { recursive: true });
  fs.appendFileSync(exclude, `${entries.join('\n')}\n`);
}

export function runCampaign(input: CampaignOptions = {}): {
  reportPath: string;
  recordsPath: string;
  records: BehaviorRecord[];
  setup: SetupResult[];
  blocked: string[];
} {
  const mode = input.mode ?? 'dry-run';
  const options = {
    mode,
    hosts: input.hosts ?? ((mode === 'stub' ? ['stub'] : ['claude', 'codex']) as HostId[]),
    caseIds: input.caseIds ?? [],
    split: input.split ?? ('' as Split),
    condition: input.condition ?? 'candidate',
    trials: input.trials ?? 1,
    stubBehavior: input.stubBehavior ?? 'compliant',
    sessionTimeoutMinutes: input.sessionTimeoutMinutes ?? 15,
    wallTimeMinutes: input.wallTimeMinutes ?? 0,
    maxBudgetUsd: input.maxBudgetUsd ?? 0,
    install: input.install ?? true,
    output:
      input.output ??
      path.join(
        repoRoot,
        '.local/gmm/sdd-agentic-flow',
        `v${packageVersion}-skill-behavior-${mode}-report.md`,
      ),
    keep: input.keep ?? true,
    ...(input.model ? { model: input.model } : {}),
  } satisfies Record<string, unknown>;
  const baselineVersion = input.baselineVersion ?? '';
  const blocked: string[] = [];
  const setup: SetupResult[] = [];
  const records: BehaviorRecord[] = [];
  if (mode === 'dry-run')
    blocked.push('dry-run does not execute model hosts and cannot certify behavior');
  if (mode === 'real' && options.wallTimeMinutes <= 0)
    blocked.push('real mode needs an explicit positive --wall-time-minutes ceiling');
  if (mode === 'real' && options.hosts.includes('stub'))
    blocked.push('the stub host is offline-only and cannot appear in a real campaign');
  const unknownHosts = options.hosts.filter(
    (host) => !['claude', 'codex', 'cursor', 'stub'].includes(host),
  );
  if (unknownHosts.length) blocked.push(`unknown host: ${unknownHosts.join(', ')}`);
  if (options.condition === 'baseline' && !baselineVersion)
    blocked.push('the baseline condition needs --baseline-version');
  if (options.condition === 'baseline' && mode !== 'real')
    blocked.push('a published baseline bundle is fetched only in real mode');

  const selected = CASES.filter(
    (item) =>
      (options.caseIds.length === 0 || options.caseIds.includes(item.id)) &&
      (!options.split || item.split === options.split),
  );
  if (selected.length === 0) blocked.push('no case matches the requested filter');

  const evidence = path.join(
    path.dirname(options.output),
    `${path.basename(options.output, '.md')}-evidence`,
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-skill-behavior-'));
  const fatal = blocked.some((reason) => !reason.startsWith('dry-run'));
  let bundleSha: string | null = null;
  let template: string | null = null;
  if (!fatal && options.install) {
    try {
      const bundle = packBundle(root, options.condition, baselineVersion);
      bundleSha = bundle.sha256;
      const installed = installTemplate(root, bundle.tarball);
      setup.push({ id: installed.id, status: installed.status, note: installed.note });
      if (installed.status === 'PASS') template = installed.template;
      else blocked.push('the bundle under evaluation did not install');
    } catch (error: unknown) {
      blocked.push(redact(error instanceof Error ? error.message : String(error)));
    }
  } else
    setup.push({
      id: 'SETUP-INSTALL',
      status: 'SKIPPED',
      note: options.install ? 'campaign blocked before install' : 'install disabled',
    });

  const homes = new Map<HostId, string>();
  const versions = new Map<HostId, string | null>();
  if (mode === 'real' && !fatal)
    for (const host of options.hosts) {
      if (host === 'stub') continue;
      const missing = prepareProfile(root, host);
      if (missing.length) blocked.push(`${host} credentials unavailable: ${missing.join(', ')}`);
      else {
        homes.set(host, path.join(root, `${host}-home`));
        versions.set(host, hostVersion(host));
      }
    }

  try {
    const deadline = Date.now() + options.wallTimeMinutes * 60_000;
    const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${options.condition}`;
    if (!blocked.some((reason) => !reason.startsWith('dry-run') && !reason.includes('credentials')))
      for (const host of options.hosts)
        for (const item of selected)
          for (let trial = 1; trial <= options.trials; trial += 1) {
            const project = path.join(root, 'runs', `${host}-${item.id}-${trial}`);
            fs.mkdirSync(project, { recursive: true });
            item.prepare(project);
            if (template) {
              // Place the installed bundle where this host discovers project skills.
              const target = skillsDirFor(host);
              fs.cpSync(path.join(template, '.agents', 'skills'), path.join(project, target), {
                recursive: true,
              });
              excludeFromGit(project, [`${target.split(path.sep)[0]}/`]);
            }
            const before = snapshot(project);
            const outOfTime = mode === 'real' && Date.now() > deadline;
            const session: Session = outOfTime
              ? {
                  termination: 'not-run',
                  exitCode: null,
                  durationMs: null,
                  stdout: '',
                  stderr: '',
                  checksNotRun: [{ name: 'host session', reason: 'wall-time ceiling reached' }],
                }
              : runHost(
                  host,
                  item,
                  project,
                  options,
                  homes,
                  // The wall-time ceiling bounds the session too, not only whether it starts.
                  mode === 'real'
                    ? Math.max(
                        1,
                        Math.min(options.sessionTimeoutMinutes * 60_000, deadline - Date.now()),
                      )
                    : options.sessionTimeoutMinutes * 60_000,
                );
            if (
              item.capabilities.includes('background-process') &&
              session.termination !== 'not-run'
            )
              settleBackground();
            const after = snapshot(project);
            const exercised =
              session.termination !== 'not-run' && session.termination !== 'host-unavailable';
            const observed = session.host ? { commands: session.host.commands } : undefined;
            const oracle = exercised ? item.oracle(project, before, after, observed) : null;
            const verdict = deriveVerdict({
              termination: session.termination,
              capabilitiesMissing: [],
              oracle,
            });
            const changed = changedPaths(before, after);
            const transcript = path.join(evidence, `${host}-${item.id}-${trial}.json`);
            if (exercised) {
              fs.mkdirSync(evidence, { recursive: true });
              fs.writeFileSync(
                transcript,
                JSON.stringify(
                  {
                    exit_code: session.exitCode,
                    stdout: session.stdout,
                    stderr: session.stderr,
                    changed,
                  },
                  null,
                  2,
                ),
              );
            }
            records.push({
              schema: RECORD_SCHEMA,
              run_id: runId,
              case_id: item.id,
              family: item.family,
              split: item.split,
              condition: options.condition,
              trial,
              host,
              host_version: versions.get(host) ?? null,
              model: options.model ?? session.host?.model ?? null,
              config: host === 'stub' ? `stub-${options.stubBehavior}` : `${host}-default`,
              loading: item.loading,
              saf_revision: options.condition === 'candidate' ? packageVersion : baselineVersion,
              bundle_sha256: bundleSha,
              fixture_sha256: snapshotDigest(before),
              capabilities_required: [...item.capabilities],
              capabilities_missing: [],
              termination: session.termination,
              exit_code: session.exitCode,
              duration_ms: session.durationMs,
              facts: {
                // A host that exits before emitting any event never accepted the task.
                accepted: !exercised
                  ? 'unknown'
                  : session.termination === 'normal' || (session.host?.commands.length ?? 0) > 0
                    ? 'observed'
                    : 'absent',
                completed:
                  oracle?.passed === true
                    ? 'observed'
                    : oracle?.passed === false
                      ? 'absent'
                      : 'unknown',
                effects_persisted: !exercised ? 'unknown' : changed.length ? 'observed' : 'absent',
                cleanup: 'unknown',
                ...(session.host
                  ? {
                      skill_loaded: session.host.skillLoaded
                        ? ('observed' as const)
                        : ('absent' as const),
                    }
                  : {}),
              },
              checks_not_run: session.checksNotRun,
              oracle,
              verdict,
              owner_refs: [...item.owners],
              attribution:
                verdict === 'FAIL'
                  ? { layer: 'unassigned', confidence: 'inconclusive' }
                  : { layer: 'none', confidence: 'n/a' },
              usage: session.host?.usage ?? null,
            });
          }
  } finally {
    // Credential copies never outlive the campaign, even when workspaces are kept or a run throws.
    for (const host of homes.keys())
      fs.rmSync(path.join(root, `${host}-home`), { recursive: true, force: true });
  }

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  // Never let the records path collide with the report when the output has no .md extension.
  const recordsPath = `${options.output.replace(/\.md$/, '')}.jsonl`;
  fs.writeFileSync(recordsPath, records.map((item) => JSON.stringify(item)).join('\n') + '\n');
  fs.writeFileSync(
    options.output,
    renderReport({ mode, options, setup, records, blocked, bundleSha }),
  );
  if (!options.keep) fs.rmSync(root, { recursive: true, force: true });
  return { reportPath: options.output, recordsPath, records, setup, blocked };
}

function renderReport(input: {
  mode: CampaignMode;
  options: { hosts: string[]; condition: string; trials: number; wallTimeMinutes: number };
  setup: SetupResult[];
  records: BehaviorRecord[];
  blocked: string[];
  bundleSha: string | null;
}): string {
  const count = (verdict: string) =>
    input.records.filter((item) => item.verdict === verdict).length;
  const result = input.blocked.length
    ? 'BLOCKED'
    : count('FAIL')
      ? 'FAIL'
      : count('PASS') === input.records.length && input.records.length > 0
        ? 'PASS'
        : 'INCOMPLETE';
  // Escape backslashes before pipes so table cells cannot break out of their column.
  const cell = (value: string) => value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
  return `# SAF v${packageVersion} skill behavior campaign report

- Mode: \`${input.mode}\`
- Condition: \`${input.options.condition}\`; hosts: ${input.options.hosts.join(', ')}; trials: ${input.options.trials}
- Wall-time ceiling: ${input.options.wallTimeMinutes > 0 ? `${input.options.wallTimeMinutes} minutes` : 'not set'}
- Monetary cost: recorded per run only when the host reports it; otherwise unknown
- Bundle SHA-256: ${input.bundleSha ? `\`${input.bundleSha}\`` : 'not packed'}
- Result: **${result}**
- Verdicts: PASS=${count('PASS')} FAIL=${count('FAIL')} UNKNOWN=${count('UNKNOWN')} NOT-EXERCISED=${count('NOT-EXERCISED')} BLOCKED=${count('BLOCKED')}

## Setup

| ID | Status | Note |
| --- | --- | --- |
${input.setup.map((item) => `| ${item.id} | ${item.status} | ${cell(item.note)} |`).join('\n')}

## Runs

| Host | Case | Split | Trial | Termination | Exit | Verdict | Violations |
| --- | --- | --- | --- | --- | --- | --- | --- |
${input.records.map((item) => `| ${item.host} | ${item.case_id} | ${item.split} | ${item.trial} | ${item.termination} | ${item.exit_code ?? '—'} | ${item.verdict} | ${cell(item.oracle?.violations.join('; ') || '—')} |`).join('\n') || '| — | — | — | — | — | — | — | no runs |'}

## Blocking reasons

${input.blocked.length ? input.blocked.map((item) => `- ${item}`).join('\n') : '- None'}

Verdicts come from external oracles; an exit code is only an observation. This report is maintainer
evidence. It does not authorize versioning, push, publication, or release, and a stub or dry-run
never certifies host behavior.
`;
}

function main(): void {
  const argv = process.argv.slice(2);
  const value = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const list = (name: string) => value(name)?.split(',').filter(Boolean);
  const number = (name: string) => {
    const raw = value(name);
    return raw === undefined ? undefined : Number(raw);
  };
  const mode: CampaignMode = argv.includes('--real')
    ? 'real'
    : argv.includes('--stub')
      ? 'stub'
      : 'dry-run';
  const options: CampaignOptions = { mode, keep: !argv.includes('--clean') };
  const hosts = list('--hosts') as HostId[] | undefined;
  if (hosts) options.hosts = hosts;
  const cases = list('--cases');
  if (cases) options.caseIds = cases;
  const split = value('--split');
  if (split === 'development' || split === 'reserved') options.split = split;
  const condition = value('--condition');
  if (condition === 'baseline' || condition === 'candidate') options.condition = condition;
  const baseline = value('--baseline-version');
  if (baseline) options.baselineVersion = baseline;
  const behavior = value('--stub-behavior');
  if (behavior === 'compliant' || behavior === 'violating') options.stubBehavior = behavior;
  const model = value('--model');
  if (model) options.model = model;
  const output = value('--output');
  if (output) options.output = path.resolve(output);
  for (const [flag, key] of [
    ['--trials', 'trials'],
    ['--session-timeout-minutes', 'sessionTimeoutMinutes'],
    ['--wall-time-minutes', 'wallTimeMinutes'],
    ['--max-budget-usd', 'maxBudgetUsd'],
  ] as const) {
    const parsed = number(flag);
    if (parsed !== undefined && Number.isFinite(parsed)) options[key] = parsed;
  }
  const result = runCampaign(options);
  console.log(`campaign report: ${result.reportPath}`);
  console.log(`campaign records: ${result.recordsPath}`);
  const failed = result.records.some((item) => item.verdict === 'FAIL');
  process.exitCode = result.blocked.length ? 2 : failed ? 1 : 0;
}

if (require.main === module) main();
