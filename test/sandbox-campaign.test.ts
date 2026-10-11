import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CLAUDE_SANDBOX_SETTINGS,
  hostCommand,
  packageVersion,
  parseHostOutput,
  prepareProfile,
  redact,
  runCampaign,
  skillsDirFor,
  terminationFor,
} from '../scripts/sandbox-campaign.js';
import { compareRecords } from '../scripts/skill-behavior/compare.js';
import { parseRecords, validateRecord } from '../scripts/skill-behavior/record.js';

const tempOutput = (name: string) =>
  path.join(fs.mkdtempSync(path.join(os.tmpdir(), `saf-campaign-${name}-`)), 'report.md');

test('report redacts credentials and personal paths', () => {
  const output = redact('token=secret /home/alice/private/file');
  assert.equal(output, 'token=[REDACTED] [PATH]');
});

test('host commands use isolated profiles and never bypass the sandbox', () => {
  const claude = hostCommand('claude', {
    prompt: 'check T01',
    project: '/w',
    home: '/h',
    maxBudgetUsd: 2,
  });
  assert.equal(claude.command, 'claude');
  assert.equal(claude.env.CLAUDE_CONFIG_DIR, path.join('/h', 'claude-config'));
  assert.equal(claude.env.HOME, '/h');
  assert.deepEqual(claude.args.slice(-2), ['--max-budget-usd', '2']);
  assert.ok(!claude.args.includes('bypassPermissions'));
  assert.ok(claude.args.includes('stream-json'));
  const settings = JSON.parse(claude.args[claude.args.indexOf('--settings') + 1] ?? '{}');
  assert.deepEqual(settings, CLAUDE_SANDBOX_SETTINGS);
  assert.equal(settings.sandbox.enabled, true);
  assert.equal(settings.sandbox.allowUnsandboxedCommands, false);
  assert.equal(settings.sandbox.failIfUnavailable, true);
  const codex = hostCommand('codex', { prompt: 'p', project: '/w', home: '/h', model: 'm' });
  assert.equal(codex.env.CODEX_HOME, '/h');
  assert.ok(codex.args.includes('workspace-write'));
  assert.ok(!codex.args.some((arg) => arg.includes('dangerously')));
  // codex-cli 0.162.1 rejects --sandbox together with --approve-for-me.
  assert.ok(!codex.args.includes('--approve-for-me'));
  assert.deepEqual(codex.args.slice(-3), ['--model', 'm', 'p']);
});

test('isolated profiles copy only credentials and report what is missing', () => {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-profile-source-'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-profile-root-'));
  fs.mkdirSync(path.join(source, '.codex'));
  fs.writeFileSync(path.join(source, '.codex/auth.json'), '{}');
  assert.deepEqual(prepareProfile(root, 'codex', source), []);
  assert.equal(fs.existsSync(path.join(root, 'codex-home/auth.json')), true);
  assert.deepEqual(prepareProfile(root, 'claude', source), ['[HOME]/.claude/.credentials.json']);
});

test('Claude stream-json yields commands, skill loading, model, cost, and the result subtype', () => {
  const stream = [
    JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-test-1' }),
    JSON.stringify({
      type: 'user',
      message: { content: [{ type: 'text', text: 'run npm test' }] },
    }),
    JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            name: 'Read',
            input: { file_path: '/w/.claude/skills/saf-check-task/SKILL.md' },
          },
          { type: 'tool_use', name: 'Bash', input: { command: 'npm test' } },
        ],
      },
    }),
    JSON.stringify({
      type: 'result',
      subtype: 'success',
      total_cost_usd: 0.42,
      usage: { input_tokens: 100, output_tokens: 20 },
    }),
  ].join('\n');
  assert.deepEqual(parseHostOutput(stream), {
    commands: ['npm test'],
    model: 'claude-test-1',
    usage: { cost_usd: 0.42, input_tokens: 100, output_tokens: 20 },
    resultSubtype: 'success',
    skillLoaded: true,
  });
  // A prompt that mentions a command is not an executed command.
  assert.deepEqual(parseHostOutput(stream.split('\n').slice(0, 2).join('\n')).commands, []);
});

test('Codex JSON events yield completed commands and summed usage', () => {
  const events = [
    JSON.stringify({ type: 'thread.started', thread_id: 't' }),
    JSON.stringify({
      type: 'item.started',
      item: { type: 'command_execution', command: 'npm test' },
    }),
    JSON.stringify({
      type: 'item.completed',
      item: {
        type: 'command_execution',
        command: "bash -lc 'cat .agents/skills/saf-implement/SKILL.md'",
      },
    }),
    JSON.stringify({
      type: 'item.completed',
      item: { type: 'command_execution', command: 'npm test' },
    }),
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 50, output_tokens: 5 } }),
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 1 } }),
    'not json',
  ].join('\n');
  const parsed = parseHostOutput(events);
  assert.deepEqual(parsed.commands, [
    "bash -lc 'cat .agents/skills/saf-implement/SKILL.md'",
    'npm test',
  ]);
  assert.equal(parsed.skillLoaded, true);
  assert.deepEqual(parsed.usage, { input_tokens: 60, output_tokens: 6 });
  assert.equal(parsed.model, null);
  assert.equal(parseHostOutput('').usage, null);
});

test('host results map to terminations without trusting the exit code', () => {
  const base = { signal: null, exitCode: 0, resultSubtype: null };
  assert.equal(terminationFor(base), 'normal');
  assert.equal(terminationFor({ ...base, resultSubtype: 'success' }), 'normal');
  assert.equal(terminationFor({ ...base, resultSubtype: 'error_max_budget_usd' }), 'budget');
  assert.equal(terminationFor({ ...base, resultSubtype: 'error_max_turns' }), 'budget');
  assert.equal(
    terminationFor({ ...base, resultSubtype: 'error_during_execution' }),
    'transport-error',
  );
  assert.equal(terminationFor({ ...base, exitCode: 1 }), 'transport-error');
  assert.equal(terminationFor({ ...base, errorCode: 'ETIMEDOUT' }), 'timeout');
  assert.equal(terminationFor({ ...base, errorCode: 'ENOENT' }), 'host-unavailable');
});

test('each host gets the bundle in its documented project skills directory', () => {
  assert.equal(skillsDirFor('claude'), path.join('.claude', 'skills'));
  assert.equal(skillsDirFor('codex'), path.join('.agents', 'skills'));
  assert.equal(skillsDirFor('cursor'), path.join('.agents', 'skills'));
});

test('dry-run packs and installs the bundle but never produces a PASS', () => {
  const output = tempOutput('dry');
  const result = runCampaign({
    mode: 'dry-run',
    output,
    caseIds: ['F1-D-evidence-before-completion', 'F4-R-external-injection'],
    keep: false,
  });
  assert.equal(result.setup[0]?.status, 'PASS');
  assert.equal(result.records.length, 4);
  assert.ok(result.records.every((item) => item.verdict === 'NOT-EXERCISED'));
  assert.ok(result.records.every((item) => validateRecord(item).length === 0));
  assert.ok(result.records.every((item) => item.bundle_sha256?.length === 64));
  const report = fs.readFileSync(output, 'utf8');
  assert.match(
    report,
    new RegExp(`# SAF v${packageVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} skill behavior`),
  );
  assert.match(report, /Result: \*\*BLOCKED\*\*/);
  assert.doesNotMatch(report, /Result: \*\*PASS\*\*/);
});

test('real mode refuses to start without a wall-time ceiling or with the stub host', () => {
  const result = runCampaign({
    mode: 'real',
    hosts: ['stub'],
    output: tempOutput('real'),
    install: false,
    keep: false,
  });
  assert.equal(result.records.length, 0);
  assert.match(result.blocked.join('\n'), /wall-time-minutes ceiling/);
  assert.match(result.blocked.join('\n'), /stub host is offline-only/);
});

test('a published baseline is only fetched in real mode', () => {
  const result = runCampaign({
    mode: 'stub',
    condition: 'baseline',
    output: tempOutput('baseline'),
    install: false,
    keep: false,
  });
  assert.match(result.blocked.join('\n'), /needs --baseline-version/);
  assert.match(result.blocked.join('\n'), /fetched only in real mode/);
  assert.equal(result.records.length, 0);
});

test('the stub pipeline derives verdicts from oracles and an A/A comparison is zero', () => {
  const cases = ['F2-R-weakened-sensor', 'F5-D-unknown-effect'];
  const compliant = runCampaign({
    mode: 'stub',
    caseIds: cases,
    trials: 2,
    install: false,
    output: tempOutput('stub-a'),
    keep: false,
  });
  assert.deepEqual(compliant.blocked, []);
  assert.equal(compliant.records.length, 4);
  assert.ok(compliant.records.every((item) => item.verdict === 'PASS'));
  const parsed = parseRecords(fs.readFileSync(compliant.recordsPath, 'utf8'));
  assert.deepEqual(parsed.errors, []);
  // An A/A pair: the same bundle recorded once as baseline and once as candidate.
  const baseline = parsed.records.map((item) => ({ ...item, condition: 'baseline' as const }));
  const comparison = compareRecords(baseline, parsed.records);
  assert.deepEqual(comparison.errors, []);
  assert.ok(comparison.cases.every((item) => item.delta === 0));

  const violating = runCampaign({
    mode: 'stub',
    caseIds: cases,
    stubBehavior: 'violating',
    install: false,
    output: tempOutput('stub-b'),
    keep: false,
  });
  assert.ok(violating.records.every((item) => item.verdict === 'FAIL'));
  assert.ok(violating.records.every((item) => item.exit_code === 0));
  assert.ok(violating.records.every((item) => item.attribution.layer === 'unassigned'));
  assert.match(fs.readFileSync(violating.reportPath, 'utf8'), /Result: \*\*FAIL\*\*/);
});

test('unknown hosts block the campaign and records never overwrite the report', () => {
  const unknown = runCampaign({
    mode: 'stub',
    hosts: ['claud' as never],
    install: false,
    output: tempOutput('unknown-host'),
    keep: false,
  });
  assert.match(unknown.blocked.join('\n'), /unknown host: claud/);
  assert.equal(unknown.records.length, 0);

  const output = tempOutput('txt').replace(/\.md$/, '.txt');
  const result = runCampaign({
    mode: 'stub',
    caseIds: ['F4-R-external-injection'],
    install: false,
    output,
    keep: false,
  });
  assert.notEqual(result.recordsPath, result.reportPath);
  assert.match(fs.readFileSync(result.reportPath, 'utf8'), /skill behavior campaign report/);
  assert.deepEqual(parseRecords(fs.readFileSync(result.recordsPath, 'utf8')).errors, []);
});
