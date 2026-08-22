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

function writeFixture({
  version = '0.0.1',
  cliSource,
  skillBody = '',
}: {
  version?: string;
  cliSource?: string;
  skillBody?: string;
} = {}) {
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
  fs.mkdirSync(path.join(root, 'skills', 'demo'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packs'));
  fs.writeFileSync(
    path.join(root, 'dist', 'sdd-agentic-flow.js'),
    cliSource ||
      "const VERSION = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;\n",
  );
  fs.writeFileSync(
    path.join(root, 'skills', 'demo', 'SKILL.md'),
    `---\nname: demo\nmetadata:\n  version: 0.0.1\n---\n\n# Demo\n\nDo not stamp this body version: 9.9.9\n${skillBody}`,
  );
  fs.writeFileSync(
    path.join(root, 'packs', 'full.json'),
    `${JSON.stringify({ name: 'full', version: '0.0.1', skills: ['demo'] }, null, 2)}\n`,
  );
  return root;
}

test('this repository is version-consistent and the CLI derives VERSION from package.json', () => {
  const result = checkVersionConsistency(packageRoot);
  assert.equal(result.packageVersion, packageVersion);
  assert.equal(result.cli.derived, true);
  assert.equal(result.cli.drifted, false);
  assert.ok(result.skills.length > 0);
  assert.ok(result.packs.length > 0);
  assert.ok(result.skills.every((entry) => !entry.drifted));
  assert.ok(result.packs.every((entry) => !entry.drifted));
  assert.equal(result.lockfile.versionDrifted, false);
  assert.equal(result.lockfile.rootVersionDrifted, false);
});

test('a hardcoded CLI VERSION is always drift, even when the number matches package.json', () => {
  const root = writeFixture({
    version: '1.11.0',
    cliSource: "const VERSION = '1.11.0';\n",
  });
  fs.writeFileSync(
    path.join(root, 'skills', 'demo', 'SKILL.md'),
    '---\nname: demo\nmetadata:\n  version: 1.11.0\n---\n\n# Demo\n',
  );
  fs.writeFileSync(
    path.join(root, 'packs', 'full.json'),
    `${JSON.stringify({ name: 'full', version: '1.11.0' }, null, 2)}\n`,
  );
  const result = checkVersionConsistency(root);
  assert.equal(result.cli.derived, false);
  assert.equal(result.cli.drifted, true);
  assert.equal(result.cli.version, '1.11.0');
});

test('stampVersions writes package.json into skill frontmatter and packs, not the skill body', () => {
  const root = writeFixture({ version: '2.0.0' });
  const first = stampVersions(root);
  assert.equal(first.packageVersion, '2.0.0');
  assert.deepEqual(first.written.sort(), ['packs/full.json', 'skills/demo/SKILL.md']);

  const skill = fs.readFileSync(path.join(root, 'skills', 'demo', 'SKILL.md'), 'utf8');
  assert.match(skill, /^ {2}version: 2\.0\.0$/m);
  assert.match(skill, /body version: 9\.9\.9/);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(root, 'packs', 'full.json'), 'utf8')).version,
    '2.0.0',
  );

  const second = stampVersions(root);
  assert.deepEqual(second.written, []);
  assert.equal(checkVersionConsistency(root).cli.drifted, false);
  assert.ok(checkVersionConsistency(root).skills.every((entry) => !entry.drifted));
  assert.ok(checkVersionConsistency(root).packs.every((entry) => !entry.drifted));
});

test('lockfile root mismatches are reported and stamping preserves every other field', () => {
  const root = writeFixture({ version: '2.0.0' });
  const lockPath = path.join(root, 'package-lock.json');
  const before = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  before.version = '1.0.0';
  before.packages[''].version = '1.1.0';
  fs.writeFileSync(lockPath, `${JSON.stringify(before, null, 2)}\n`);
  const inconsistent = checkVersionConsistency(root);
  assert.equal(inconsistent.lockfile.versionDrifted, true);
  assert.equal(inconsistent.lockfile.rootVersionDrifted, true);
  stampVersions(root);
  const after = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  after.version = before.version;
  after.packages[''].version = before.packages[''].version;
  assert.deepEqual(after, before);
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
