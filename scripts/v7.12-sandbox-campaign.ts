import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type CampaignMode = 'dry-run' | 'real';
export type CampaignOptions = {
  mode?: CampaignMode;
  pilotTimeMinutes?: number;
  pilotCostUsd?: number;
  fullTimeMinutes?: number;
  fullCostUsd?: number;
  output?: string;
  keep?: boolean;
};

type SessionResult = {
  id: string;
  host: 'codex' | 'cursor' | 'local';
  phase: 'setup' | 'pilot' | 'campaign' | 'transversal';
  status: 'PASS' | 'BLOCKED' | 'FAIL' | 'SKIPPED';
  exitCode?: number;
  durationMs?: number;
  evidence?: string;
  note: string;
};

type RunContext = {
  root: string;
  project: string;
  evidence: string;
  candidateTarball: string;
  candidateSha256: string;
};

const repoRoot = path.join(__dirname, '..');
const defaultOutput = path.join(
  repoRoot,
  '.local/gmm/sdd-agentic-flow/v7.12.0-sandbox-test-report.md',
);

const fixtureFiles: Record<string, string> = {
  'package.json':
    '{\n  "private": true,\n  "type": "module",\n  "scripts": { "test": "node test/eligibility.test.js" }\n}\n',
  'src/eligibility.js': `export function eligible(status, paid) {\n  return status === 'active' && paid === true;\n}\n`,
  'test/eligibility.test.js': `import assert from 'node:assert/strict';\nimport { eligible } from '../src/eligibility.js';\n\nassert.equal(eligible('active', true), true);\nassert.equal(eligible('active', false), false);\nassert.equal(eligible('inactive', true), false);\nassert.equal(eligible('inactive', false), false);\n`,
  '.specs/features/eligibility/spec.md': `# Eligibility\n\nWork intent: feature\n\n## Requirements\n\n- REQ-ELIG-1: Return true only when status is active and paid is true.\n- REQ-ELIG-2: Return false for the other three finite combinations.\n\n## Acceptance criteria\n\n- AC-1: The four combinations in the truth table produce the expected boolean.\n- AC-2: A verifier rejects an implementation that omits the paid condition.\n`,
  '.specs/features/eligibility/tasks.md': `# Tasks\n\n## T01 — Verify eligibility implementation\n\n- Requirements: REQ-ELIG-1, REQ-ELIG-2\n- Acceptance: AC-1, AC-2\n- Scope: read source, tests, and spec; write only the requested check report.\n`,
  '.sdd-agentic-flow/config.yml': `schema: saf-config/v3\n\nlanguage:\n  profile: en-US\n  human_outputs: en-US\n\nspecs:\n  root: .specs/features\n\nworkflow:\n  execution_mode: apply\n  autonomy_level: supervised\n\nquality:\n  tlc_baseline_required: true\n  require_tdd: true\n  require_independent_check: true\n  require_evidence_before_completion: true\n`,
};

export function fixtureTruthTable(): Array<[string, boolean, boolean]> {
  return [
    ['active', true, true],
    ['active', false, false],
    ['inactive', true, false],
    ['inactive', false, false],
  ];
}

export function redact(value: string): string {
  return value
    .replace(
      /(authorization|token|api[_-]?key|password|secret)\s*[:=]\s*[^\s,}]+/gi,
      '$1=[REDACTED]',
    )
    .replace(/\/home\/[^\s/]+(?:\/[^\s]*)?/g, '[PATH]')
    .replace(/\/Users\/[^\s/]+(?:\/[^\s]*)?/g, '[PATH]');
}

export function classifyHostResult(
  exitCode: number | null,
  timedOut: boolean,
): SessionResult['status'] {
  if (timedOut) return 'BLOCKED';
  return exitCode === 0 ? 'PASS' : 'FAIL';
}

function sha256(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
) {
  const started = Date.now();
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: timeoutMs });
  return {
    result,
    durationMs: Date.now() - started,
    stdout: redact(result.stdout ?? ''),
    stderr: redact(result.stderr ?? ''),
  };
}

function writeFixture(root: string): void {
  for (const [relative, content] of Object.entries(fixtureFiles)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
}

function git(root: string, args: string[]): void {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}

function npmExecutable(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function packCandidate(root: string): { tarball: string; sha256: string } {
  const packDir = path.join(root, 'pack');
  fs.mkdirSync(packDir, { recursive: true });
  const result = spawnSync(npmExecutable(), ['pack', '--json', '--pack-destination', packDir], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 120_000,
  });
  assert.equal(result.status, 0, result.stderr);
  const metadata = JSON.parse(result.stdout.slice(result.stdout.indexOf('['))) as Array<{
    filename: string;
  }>;
  const first = metadata[0];
  assert.ok(first, 'npm pack returned no artifact');
  const tarball = path.join(packDir, first.filename);
  return { tarball, sha256: sha256(tarball) };
}

function installCandidate(ctx: RunContext): SessionResult {
  const started = Date.now();
  const env = {
    ...process.env,
    HOME: path.join(ctx.root, 'home'),
    USERPROFILE: path.join(ctx.root, 'home'),
  };
  const install = run(
    'npx',
    [
      '--yes',
      '--no-audit',
      `file:${ctx.candidateTarball}`,
      'install',
      '--scope',
      'project',
      '--adoption-mode',
      'team',
      '--yes',
    ],
    ctx.project,
    env,
    120_000,
  );
  if (install.result.status !== 0) {
    const failure: SessionResult = {
      id: 'SETUP-INSTALL',
      host: 'local',
      phase: 'setup',
      status: 'FAIL',
      durationMs: Date.now() - started,
      note: install.stderr || install.stdout,
    };
    if (install.result.status !== null) failure.exitCode = install.result.status;
    return failure;
  }
  const init = run(
    'npx',
    ['--yes', '--no-audit', `file:${ctx.candidateTarball}`, 'init', '--yes'],
    ctx.project,
    env,
    120_000,
  );
  const fixtureTest = run('node', ['test/eligibility.test.js'], ctx.project, env, 30_000);
  const skills = path.join(ctx.project, '.agents/skills');
  const listed = fs.existsSync(skills) ? fs.readdirSync(skills).sort() : [];
  fs.writeFileSync(path.join(ctx.evidence, 'skill-manifest.txt'), listed.join('\n'));
  const session: SessionResult = {
    id: 'SETUP-INIT',
    host: 'local',
    phase: 'setup',
    status: init.result.status === 0 && fixtureTest.result.status === 0 ? 'PASS' : 'FAIL',
    durationMs: Date.now() - started,
    evidence: path.join(ctx.evidence, 'skill-manifest.txt'),
    note:
      init.result.status === 0 && fixtureTest.result.status === 0
        ? `installed ${listed.length} skill directories`
        : init.stderr || init.stdout || fixtureTest.stderr || fixtureTest.stdout,
  };
  if (init.result.status !== null) session.exitCode = init.result.status;
  return session;
}

function prepareProfiles(ctx: RunContext): string[] {
  const missing: string[] = [];
  const codexHome = path.join(ctx.root, 'codex-home');
  const cursorHome = path.join(ctx.root, 'cursor-home');
  fs.mkdirSync(path.join(codexHome, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(cursorHome, '.agents/skills'), { recursive: true });
  fs.mkdirSync(path.join(cursorHome, '.cursor/skills'), { recursive: true });
  const sourceHome = os.homedir();
  const files: Array<[string, string]> = [
    [path.join(sourceHome, '.codex/auth.json'), path.join(codexHome, 'auth.json')],
    [path.join(sourceHome, '.codex/config.toml'), path.join(codexHome, 'config.toml')],
    [path.join(sourceHome, '.cursor/auth.json'), path.join(cursorHome, '.cursor/auth.json')],
  ];
  for (const [source, target] of files) {
    if (!fs.existsSync(source)) {
      missing.push(source.replace(sourceHome, '[HOME]'));
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
  }
  fs.writeFileSync(
    path.join(ctx.evidence, 'profile-sources.txt'),
    `codex-home=${codexHome}\ncursor-home=${cursorHome}\nmissing=${missing.join(',')}`,
  );
  return missing;
}

function hostSession(
  ctx: RunContext,
  host: 'codex' | 'cursor',
  id: string,
  skill: 'saf-check-task' | 'saf-validate',
  report: string,
  mode: CampaignMode,
): SessionResult {
  const phase: SessionResult['phase'] = id.startsWith('H') ? 'pilot' : 'transversal';
  if (mode === 'dry-run')
    return { id, host, phase, status: 'SKIPPED', note: 'dry-run: model invocation not performed' };
  const home = path.join(ctx.root, `${host}-home`);
  if (!fs.existsSync(home))
    return { id, host, phase, status: 'BLOCKED', note: 'isolated host profile is unavailable' };
  const prompt =
    skill === 'saf-check-task'
      ? `Use saf-check-task to verify T01 in .specs/features/eligibility. Write the persisted response to ${report}. Do not modify src, test, or .specs.`
      : `Use saf-validate to validate .specs/features/eligibility. Write the persisted response to ${report}. Do not modify src, test, or .specs.`;
  const command = host === 'codex' ? 'codex' : 'agent';
  const args =
    host === 'codex'
      ? [
          'exec',
          '-C',
          ctx.project,
          '--sandbox',
          'workspace-write',
          '--approve-for-me',
          '--json',
          prompt,
        ]
      : [
          '--print',
          '--output-format',
          'json',
          '--workspace',
          ctx.project,
          '--trust',
          '--force',
          prompt,
        ];
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home };
  if (host === 'codex') env.CODEX_HOME = home;
  const result = run(command, args, ctx.project, env, 1_800_000);
  const transcript = path.join(ctx.evidence, `${id}-${host}.json`);
  fs.writeFileSync(
    transcript,
    JSON.stringify(
      { stdout: result.stdout, stderr: result.stderr, status: result.result.status },
      null,
      2,
    ),
  );
  const session: SessionResult = {
    id,
    host,
    phase,
    status:
      (result.result.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT'
        ? 'BLOCKED'
        : classifyHostResult(result.result.status, result.result.error?.name === 'TimeoutError'),
    durationMs: result.durationMs,
    evidence: transcript,
    note:
      result.result.status === 0
        ? 'host completed; inspect report and diff'
        : result.stderr || result.stdout || 'host returned no output',
  };
  if (result.result.status !== null) session.exitCode = result.result.status;
  return session;
}

function renderRawReport(
  options: Required<CampaignOptions>,
  ctx: RunContext | null,
  results: SessionResult[],
  blocked: string[],
): string {
  const total = results.length;
  const passed = results.filter((result) => result.status === 'PASS').length;
  return `# SAF v7.12.0 sandbox campaign report\n\n- Mode: \`${options.mode}\`\n- Pilot limit: 4 sessions / ${options.pilotTimeMinutes} minutes / US$${options.pilotCostUsd}\n- Full campaign limit: ${options.fullTimeMinutes ? `${options.fullTimeMinutes} minutes / US$${options.fullCostUsd}` : 'not authorized'}\n- Result: ${blocked.length > 0 ? '**BLOCKED**' : '**PASS**'}\n- Sessions recorded: ${total} (passed: ${passed})\n\n## Evidence\n\n${ctx ? `- Sandbox evidence: \`${redact(ctx.evidence)}\`\n- Candidate SHA-256: \`${ctx.candidateSha256}\`` : '- Sandbox was not created.'}\n\n| ID | Host | Phase | Status | Evidence | Note |\n| --- | --- | --- | --- | --- | --- |\n${results.map((result) => `| ${result.id} | ${result.host} | ${result.phase} | ${result.status} | ${result.evidence ? `\`${redact(result.evidence)}\`` : '—'} | ${result.note.replace(/\|/g, '\\|')} |`).join('\n') || '| — | — | — | — | — | no sessions |'}\n\n## Blocking reasons\n\n${blocked.length ? blocked.map((item) => `- ${item}`).join('\n') : '- None'}\n\nThis report is maintainer evidence only. It does not authorize versioning, push, publication, or release.\n`;
}

function renderReport(
  options: Required<CampaignOptions>,
  ctx: RunContext | null,
  results: SessionResult[],
  blocked: string[],
): string {
  return renderRawReport(options, ctx, results, blocked)
    .replace(
      /- Pilot limit: [^\n]*/,
      `- Pilot operational ceiling: 4 sessions / ${options.pilotTimeMinutes} minutes\n- Monetary cost measurement: **deferred; not measured by v7.12.0** (declared intent: US$${options.pilotCostUsd})`,
    )
    .replace(
      /- Full campaign limit: [^\n]*/,
      `- Full operational ceiling: ${options.fullTimeMinutes ? `${options.fullTimeMinutes} minutes` : 'not authorized'}\n- Full monetary cost measurement: **deferred; not measured by v7.12.0** (declared intent: ${options.fullTimeMinutes ? `US$${options.fullCostUsd}` : 'not declared'})`,
    );
}

export function runCampaign(input: CampaignOptions = {}): {
  reportPath: string;
  results: SessionResult[];
  blocked: string[];
} {
  const options: Required<CampaignOptions> = {
    mode: input.mode ?? 'dry-run',
    pilotTimeMinutes: input.pilotTimeMinutes ?? 120,
    pilotCostUsd: input.pilotCostUsd ?? 10,
    fullTimeMinutes: input.fullTimeMinutes ?? 0,
    fullCostUsd: input.fullCostUsd ?? 0,
    output: input.output ?? defaultOutput,
    keep: input.keep ?? true,
  };
  const results: SessionResult[] = [];
  const blocked: string[] = [];
  if (options.mode === 'dry-run')
    blocked.push('dry-run does not execute model hosts and cannot certify the campaign');
  if (options.mode === 'real' && options.pilotTimeMinutes <= 0)
    blocked.push('pilot wall-time ceiling must be positive and explicit');
  const fullAuthorized = options.fullTimeMinutes > 0;
  if (fullAuthorized)
    blocked.push(
      'full 56-session baseline/candidate orchestration is not enabled by this runner; no campaign result is certified',
    );

  let ctx: RunContext | null = null;
  if (blocked.length === 0 || options.mode === 'dry-run') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-v7.12-campaign-'));
    const project = path.join(root, 'project');
    const evidence = path.join(
      repoRoot,
      '.local/gmm/sdd-agentic-flow/v7.12.0-evidence',
      new Date().toISOString().replace(/[:.]/g, '-'),
    );
    fs.mkdirSync(project, { recursive: true });
    fs.mkdirSync(evidence, { recursive: true });
    writeFixture(project);
    git(project, ['init', '--quiet']);
    git(project, ['config', 'user.name', 'SAF Sandbox']);
    git(project, ['config', 'user.email', 'saf-sandbox@localhost']);
    git(project, ['add', '.']);
    git(project, ['commit', '-m', 'fixture: eligibility', '--quiet']);
    const packed = packCandidate(root);
    ctx = {
      root,
      project,
      evidence,
      candidateTarball: packed.tarball,
      candidateSha256: packed.sha256,
    };
    let profilesReady = true;
    if (options.mode === 'real') {
      const missing = prepareProfiles(ctx);
      if (missing.length > 0) {
        blocked.push(`host credentials unavailable for isolated profiles: ${missing.join(', ')}`);
        profilesReady = false;
      }
    }
    results.push(installCandidate(ctx));
    for (const [id, host, skill, report] of [
      ['H01', 'codex', 'saf-check-task', path.join(project, '.local/check-report.md')],
      ['H01', 'cursor', 'saf-check-task', path.join(project, '.local/check-report.md')],
      ['H07', 'codex', 'saf-validate', path.join(project, '.local/validation-report.md')],
      ['H07', 'cursor', 'saf-validate', path.join(project, '.local/validation-report.md')],
    ] as const) {
      results.push(
        profilesReady
          ? hostSession(ctx, host, id, skill, report, options.mode)
          : {
              id,
              host,
              phase: 'pilot',
              status: 'BLOCKED',
              note: 'isolated profile credentials unavailable',
            },
      );
    }
    if (options.mode === 'real' && !fullAuthorized)
      blocked.push('full campaign orchestration not requested; pilot only');
  }
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, renderReport(options, ctx, results, blocked));
  if (!options.keep && ctx) fs.rmSync(ctx.root, { recursive: true, force: true });
  return { reportPath: options.output, results, blocked };
}

function main(): void {
  const argv = process.argv.slice(2);
  const args = new Set(argv);
  const numberArg = (name: string, fallback: number): number => {
    const index = argv.indexOf(name);
    if (index < 0) return fallback;
    const value = Number(argv[index + 1]);
    return Number.isFinite(value) ? value : fallback;
  };
  const result = runCampaign({
    mode: args.has('--real') ? 'real' : 'dry-run',
    pilotTimeMinutes: numberArg('--pilot-time-minutes', 120),
    pilotCostUsd: numberArg('--pilot-cost-usd', 10),
    fullTimeMinutes: numberArg('--full-time-minutes', 0),
    fullCostUsd: numberArg('--full-cost-usd', 0),
    keep: !args.has('--clean'),
  });
  console.log(`sandbox report: ${result.reportPath}`);
  console.log(`status: ${result.blocked.length ? 'BLOCKED' : 'PASS'}`);
  process.exitCode = result.blocked.length ? 2 : 0;
}

if (require.main === module) main();
