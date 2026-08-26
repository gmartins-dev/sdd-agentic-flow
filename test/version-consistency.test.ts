import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { checkVersionConsistency, stampVersions } from '../scripts/check-version-consistency';

const packageRoot = path.resolve(__dirname, '..');
const packageVersion = JSON.parse(
  fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
).version;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-version-consistency-'));

after(() => fs.rmSync(temporary, { recursive: true, force: true }));

function writeFixture(version = '0.0.1', cliSource?: string) {
  const root = fs.mkdtempSync(path.join(temporary, 'repo-'));
  fs.writeFileSync(
    path.join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture', version }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(root, 'package-lock.json'),
    `${JSON.stringify({ name: 'fixture', version, lockfileVersion: 3, packages: { '': { name: 'fixture', version }, 'node_modules/demo': { version: '1.0.0' } } }, null, 2)}\n`,
  );
  fs.mkdirSync(path.join(root, 'dist'));
  fs.writeFileSync(
    path.join(root, 'dist', 'sdd-agentic-flow.js'),
    cliSource ||
      "const VERSION = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;\n",
  );
  return root;
}

test('this repository is version-consistent and CLI derives VERSION from package.json', () => {
  const result = checkVersionConsistency(packageRoot);
  assert.equal(result.packageVersion, packageVersion);
  assert.equal(result.cli.derived, true);
  assert.equal(result.cli.drifted, false);
  assert.equal(result.lockfile.versionDrifted, false);
  assert.equal(result.lockfile.rootVersionDrifted, false);
});

test('a hardcoded CLI VERSION is always drift', () => {
  const result = checkVersionConsistency(writeFixture('1.11.0', "const VERSION = '1.11.0';\n"));
  assert.equal(result.cli.derived, false);
  assert.equal(result.cli.drifted, true);
});

test('stampVersions updates only package-lock root fields', () => {
  const root = writeFixture('2.0.0');
  const lockPath = path.join(root, 'package-lock.json');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lock.version = '1.0.0';
  lock.packages[''].version = '1.1.0';
  fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  assert.deepEqual(stampVersions(root).written, ['package-lock.json']);
  assert.deepEqual(stampVersions(root).written, []);
  assert.equal(checkVersionConsistency(root).lockfile.versionDrifted, false);
});

test('missing, invalid, and incomplete lockfiles fail closed', () => {
  for (const body of [undefined, '{', '{}']) {
    const root = writeFixture();
    const lockPath = path.join(root, 'package-lock.json');
    if (body === undefined) fs.rmSync(lockPath);
    else fs.writeFileSync(lockPath, body);
    assert.throws(() => checkVersionConsistency(root), /package-lock\.json/);
    assert.throws(() => stampVersions(root), /package-lock\.json/);
  }
});
