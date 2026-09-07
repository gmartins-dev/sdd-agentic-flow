import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

test('distribution gate detects runtime dependency and bundle mutations', () => {
  const repo = path.join(__dirname, '..');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-runtime-gate-'));
  try {
    fs.mkdirSync(path.join(root, 'dist'));
    fs.cpSync(path.join(repo, 'LICENSES'), path.join(root, 'LICENSES'), { recursive: true });
    fs.copyFileSync(
      path.join(repo, 'LICENSES/CLI-UI-BUNDLED.txt'),
      path.join(root, 'dist/third-party-notices.txt'),
    );
    for (const name of ['@clack/prompts', '@clack/core', 'picocolors', 'sisteransi']) {
      const target = path.join(root, 'node_modules', name, 'package.json');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(repo, 'node_modules', name, 'package.json'), target);
    }
    const run = (manifest: object, bundle: string) => {
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(manifest));
      fs.writeFileSync(path.join(root, 'dist/sdd-agentic-flow.js'), bundle);
      return spawnSync(
        process.execPath,
        [
          '--import',
          pathToFileURL(require.resolve('tsx')).href,
          path.join(repo, 'scripts/check-bundled-licenses.ts'),
        ],
        { cwd: root, encoding: 'utf8' },
      );
    };
    assert.equal(run({}, 'require("node:fs");').status, 0);
    for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
      const result = run({ [field]: { unexpected: '1.0.0' } }, 'require("node:fs");');
      assert.equal(result.status, 1, field);
      assert.match(result.stderr, /must not declare external runtime dependencies/);
    }
    for (const bundle of ['require("unexpected");', 'import("unexpected");']) {
      const result = run({}, bundle);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /external runtime import/);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
