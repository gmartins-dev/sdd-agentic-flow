'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const { checkVersionConsistency, stampVersions } = require('../scripts/check-version-consistency');

const packageRoot = path.resolve(__dirname, '..');
const packageVersion = JSON.parse(
  fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
).version;
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-version-consistency-'));

after(() => fs.rmSync(temporary, { recursive: true, force: true }));

function writeFixture({ version = '0.0.1', cliSource, skillBody = '' } = {}) {
  const root = fs.mkdtempSync(path.join(temporary, 'repo-'));
  fs.writeFileSync(
    path.join(root, 'package.json'),
    `${JSON.stringify({ name: 'fixture', version }, null, 2)}\n`,
  );
  fs.mkdirSync(path.join(root, 'bin'));
  fs.mkdirSync(path.join(root, 'skills', 'demo'), { recursive: true });
  fs.mkdirSync(path.join(root, 'presets'));
  fs.writeFileSync(
    path.join(root, 'bin', 'sdd-agentic-flow.js'),
    cliSource ||
      "const VERSION = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')).version;\n",
  );
  fs.writeFileSync(
    path.join(root, 'skills', 'demo', 'SKILL.md'),
    `---\nname: demo\nmetadata:\n  version: 0.0.1\n---\n\n# Demo\n\nDo not stamp this body version: 9.9.9\n${skillBody}`,
  );
  fs.writeFileSync(
    path.join(root, 'presets', 'core.json'),
    `${JSON.stringify({ name: 'core', version: '0.0.1', skills: ['demo'] }, null, 2)}\n`,
  );
  return root;
}

test('this repository is version-consistent and the CLI derives VERSION from package.json', () => {
  const result = checkVersionConsistency(packageRoot);
  assert.equal(result.packageVersion, packageVersion);
  assert.equal(result.cli.derived, true);
  assert.equal(result.cli.drifted, false);
  assert.ok(result.skills.length > 0);
  assert.ok(result.presets.length > 0);
  assert.ok(result.skills.every((entry) => !entry.drifted));
  assert.ok(result.presets.every((entry) => !entry.drifted));
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
    path.join(root, 'presets', 'core.json'),
    `${JSON.stringify({ name: 'core', version: '1.11.0' }, null, 2)}\n`,
  );
  const result = checkVersionConsistency(root);
  assert.equal(result.cli.derived, false);
  assert.equal(result.cli.drifted, true);
  assert.equal(result.cli.version, '1.11.0');
});

test('stampVersions writes package.json into skill frontmatter and presets, not the skill body', () => {
  const root = writeFixture({ version: '2.0.0' });
  const first = stampVersions(root);
  assert.equal(first.packageVersion, '2.0.0');
  assert.deepEqual(first.written.sort(), ['presets/core.json', 'skills/demo/SKILL.md']);

  const skill = fs.readFileSync(path.join(root, 'skills', 'demo', 'SKILL.md'), 'utf8');
  assert.match(skill, /^ {2}version: 2\.0\.0$/m);
  assert.match(skill, /body version: 9\.9\.9/);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(root, 'presets', 'core.json'), 'utf8')).version,
    '2.0.0',
  );

  const second = stampVersions(root);
  assert.deepEqual(second.written, []);
  assert.equal(checkVersionConsistency(root).cli.drifted, false);
  assert.ok(checkVersionConsistency(root).skills.every((entry) => !entry.drifted));
  assert.ok(checkVersionConsistency(root).presets.every((entry) => !entry.drifted));
});
