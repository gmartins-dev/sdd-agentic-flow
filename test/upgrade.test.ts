import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { OFFICIAL_SKILLS } from '../src/skill-identity';
import {
  applyManagedPairs,
  checkForUpdate,
  classifyManagedImpact,
  classifyManagedPairs,
  collectManagedPairs,
  detectExecutionMode,
  formatCheckReport,
  managedHashesForPairs,
  readInstallProvenance,
  runNpmGlobalInstall,
  runNpmSkillsUpgrade,
  writeInstallProvenance,
} from '../src/upgrade';

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
    schema: 'saf-install-provenance/v3',
    skillIdentity: 'saf',
    applyState: 'complete',
  });
  fs.rmSync(root, { recursive: true, force: true });
});

test('install provenance uses canonical ordering and atomic-target shape', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-prov-shape-'));
  writeInstallProvenance(root, {
    packageVersion: '6.0.1',
    managedSkills: ['saf-route'],
    managedPaths: ['saf-route/SKILL.md'],
  });
  const file = path.join(root, 'sdd-agentic-flow-shared', 'install-provenance.yml');
  const content = fs.readFileSync(file, 'utf8');
  assert.match(
    content,
    /^package: sdd-agentic-flow\npackage_version: 6\.0\.1\nschema: saf-install-provenance\/v3\n/,
  );
  assert.match(content, /\nmanaged_paths:\n {2}- saf-route\/SKILL\.md\nmanaged_hashes:\n$/);
  assert.equal(fs.existsSync(`${file}.tmp`), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('managed refresh never silently overwrites differing files', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-refresh-'));
  const pairs = collectManagedPairs(PACKAGE_ROOT, OFFICIAL_SKILLS, target);
  assert.ok(pairs.length > 0);
  const first = pairs[0];
  assert.ok(first);
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

test('managed impact separates package changes from local-only edits', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-impact-'));
  const pairs = collectManagedPairs(PACKAGE_ROOT, OFFICIAL_SKILLS, target);
  const first = pairs[0];
  assert.ok(first);
  const provenanceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-impact-provenance-'));
  writeInstallProvenance(provenanceRoot, {
    packageVersion: '8.0.0',
    managedSkills: [first.rel.split(path.sep)[0] || 'saf-route'],
    managedPaths: [first.rel],
    managedHashes: managedHashesForPairs([first]),
  });
  const local = classifyManagedImpact([first], readInstallProvenance(provenanceRoot));
  assert.equal(local.localOnly.length, 1);
  assert.equal(local.packageChanged.length, 0);

  const changed = classifyManagedImpact([first], {
    ...readInstallProvenance(provenanceRoot)!,
    managedHashes: { [first.rel]: '0'.repeat(64) },
  });
  assert.equal(changed.packageChanged.length, 1);
  assert.equal(changed.localOnly.length, 0);

  const unknown = classifyManagedImpact([first], null);
  assert.equal(unknown.unknown.length, 1);
  fs.rmSync(target, { recursive: true, force: true });
  fs.rmSync(provenanceRoot, { recursive: true, force: true });
});

test('npm upgrade commands pin the checked version and preserve the supplied environment', () => {
  const calls: Array<{ args: readonly string[]; env: NodeJS.ProcessEnv }> = [];
  const execFileSyncImpl = ((
    _file: string,
    args: readonly string[],
    options: { env?: NodeJS.ProcessEnv },
  ) => {
    calls.push({ args, env: options.env ?? {} });
    return Buffer.from('');
  }) as typeof import('node:child_process').execFileSync;
  const env = { PATH: '/test/bin', SDD_AGENTIC_FLOW_TEST_NPM_INSTALL: 'run' };

  runNpmGlobalInstall({ version: '8.1.0', execFileSyncImpl, env });
  runNpmSkillsUpgrade({ version: '8.1.0', execFileSyncImpl, env });

  assert.deepEqual(
    calls.map((call) => call.args),
    [
      ['install', '-g', 'sdd-agentic-flow@8.1.0'],
      ['exec', '--yes', 'sdd-agentic-flow@8.1.0', '--', 'upgrade', '--skills-only'],
    ],
  );
  assert.equal(calls[0]?.env, env);
  assert.equal(calls[1]?.env, env);
  assert.throws(
    () => runNpmSkillsUpgrade({ version: 'latest', execFileSyncImpl, env }),
    /invalid package version/,
  );
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
      status: 200,
      json: async () => ({ version: '1.0.0' }),
    }),
  });
  assert.equal(current.reachable, true);
  assert.equal(current.updateAvailable, false);
  assert.match(formatCheckReport(current), /Update available: no/);
});
