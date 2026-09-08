import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  classifyHostResult,
  fixtureTruthTable,
  redact,
  runCampaign,
} from '../scripts/v7.12-sandbox-campaign.js';

test('fixture truth table contains the four finite outcomes', () => {
  assert.deepEqual(fixtureTruthTable(), [
    ['active', true, true],
    ['active', false, false],
    ['inactive', true, false],
    ['inactive', false, false],
  ]);
});

test('host classification fails closed on timeout and non-zero exit', () => {
  assert.equal(classifyHostResult(0, false), 'PASS');
  assert.equal(classifyHostResult(1, false), 'FAIL');
  assert.equal(classifyHostResult(null, true), 'BLOCKED');
});

test('report redacts credentials and personal paths', () => {
  const output = redact('token=secret /home/alice/private/file');
  assert.equal(output, 'token=[REDACTED] [PATH]');
});

test('dry-run creates fixture, package install evidence, and a report without model calls', () => {
  const output = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'saf-campaign-test-')),
    'report.md',
  );
  const result = runCampaign({ mode: 'dry-run', output });
  assert.equal(result.blocked.length, 1);
  assert.equal(fs.existsSync(output), true);
  assert.match(fs.readFileSync(output, 'utf8'), /Mode: `dry-run`[\s\S]*Result: \*\*BLOCKED\*\*/);
  assert.equal(result.results.filter((item) => item.id === 'H01').length, 2);
  assert.equal(result.results.filter((item) => item.id === 'H07').length, 2);
});

test('full-campaign caps cannot silently imply that the full matrix ran', () => {
  const output = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'saf-campaign-full-test-')),
    'report.md',
  );
  const result = runCampaign({
    mode: 'real',
    fullTimeMinutes: 480,
    fullCostUsd: 50,
    output,
  });
  assert.ok(result.blocked.some((item) => item.includes('full 56-session')));
  assert.match(fs.readFileSync(output, 'utf8'), /Result: \*\*BLOCKED\*\*/);
});

test('monetary cost telemetry is optional and explicitly deferred', () => {
  const output = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'saf-campaign-cost-test-')),
    'report.md',
  );
  const result = runCampaign({
    mode: 'real',
    fullTimeMinutes: 480,
    fullCostUsd: 0,
    output,
  });
  assert.equal(
    result.blocked.some((item) => item.includes('cost telemetry')),
    false,
  );
  assert.match(fs.readFileSync(output, 'utf8'), /Monetary cost measurement: \*\*deferred/);
});
