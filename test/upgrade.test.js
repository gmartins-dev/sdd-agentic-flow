'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
  detectExecutionMode,
  writeInstallProvenance,
  readInstallProvenance,
  collectManagedPairs,
  classifyManagedPairs,
  applyManagedPairs,
  detectInstalledPacks,
  formatCheckReport,
  checkForUpdate,
} = require('../bin/upgrade');

const PACKAGE_ROOT = path.resolve(__dirname, '..');

test('detectExecutionMode honors test seam and npx path marker', () => {
  assert.equal(
    detectExecutionMode(PACKAGE_ROOT, { SDD_AGENTIC_FLOW_TEST_EXEC_MODE: 'global' }),
    'global',
  );
  assert.equal(
    detectExecutionMode(PACKAGE_ROOT, { SDD_AGENTIC_FLOW_TEST_EXEC_MODE: 'npx' }),
    'npx',
  );
  const fakeNpx = path.join(os.tmpdir(), '_npx', 'abc', 'node_modules', 'sdd-agentic-flow');
  assert.equal(detectExecutionMode(fakeNpx, {}), 'npx');
});

test('install provenance round-trips', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-prov-'));
  writeInstallProvenance(root, '1.13.0');
  assert.deepEqual(readInstallProvenance(root), {
    package: 'sdd-agentic-flow',
    packageVersion: '1.13.0',
    schema: 2,
    skillIdentity: 'saf',
  });
  fs.rmSync(root, { recursive: true, force: true });
});

test('pack detection preserves a full installation instead of collapsing it to core', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-packs-'));
  const full = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'presets/full.json'), 'utf8'));
  for (const skill of full.skills) {
    const dir = path.join(root, skill);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), '# test\n');
  }
  assert.deepEqual(detectInstalledPacks(root, path.join(PACKAGE_ROOT, 'presets')), ['full']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('managed refresh never silently overwrites differing files', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-refresh-'));
  const preset = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'presets/core.json'), 'utf8'));
  const pairs = collectManagedPairs(PACKAGE_ROOT, preset, target);
  assert.ok(pairs.length > 0);
  const first = pairs[0];
  fs.mkdirSync(path.dirname(first.dest), { recursive: true });
  fs.writeFileSync(first.dest, 'locally-modified\n');
  const classified = classifyManagedPairs([first]);
  assert.equal(classified.differs.length, 1);
  const skipped = applyManagedPairs(classified.differs, { overwriteDiffers: false });
  assert.equal(skipped.skippedDiffers, 1);
  assert.equal(fs.readFileSync(first.dest, 'utf8'), 'locally-modified\n');
  const overwritten = applyManagedPairs(classified.differs, { overwriteDiffers: true });
  assert.equal(overwritten.refreshed, 1);
  assert.notEqual(fs.readFileSync(first.dest, 'utf8'), 'locally-modified\n');
  fs.rmSync(target, { recursive: true, force: true });
});

test('formatCheckReport and checkForUpdate distinguish offline from up-to-date', async () => {
  const offline = await checkForUpdate({
    currentVersion: '1.0.0',
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });
  assert.equal(offline.reachable, false);
  assert.equal(offline.updateAvailable, false);
  assert.match(formatCheckReport(offline), /unable to check for updates/);
  assert.doesNotMatch(formatCheckReport(offline), /Update available: no\n$/);

  const current = await checkForUpdate({
    currentVersion: '9.9.9',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ version: '1.0.0' }),
    }),
  });
  assert.equal(current.reachable, true);
  assert.equal(current.updateAvailable, false);
  assert.match(formatCheckReport(current), /Update available: no/);
});
