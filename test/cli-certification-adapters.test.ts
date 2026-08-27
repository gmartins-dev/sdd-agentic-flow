import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  type CliExecutionAdapter,
  createDistAdapter,
  createSandbox,
  removeSandbox,
} from '../scripts/cli-certification/adapters.js';

const repoRoot = path.join(__dirname, '..');
const version = (
  JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string }
).version;

function withAdapter(
  adapter: CliExecutionAdapter,
  callback: (sandbox: ReturnType<typeof createSandbox>) => void,
) {
  const sandbox = createSandbox(adapter.name);
  try {
    callback(sandbox);
  } finally {
    removeSandbox(sandbox);
  }
}

test('dist adapter executes the compiled CLI in an isolated sandbox', (t) => {
  if (!fs.existsSync(path.join(repoRoot, 'dist', 'sdd-agentic-flow.js'))) {
    t.skip('dist is not built');
    return;
  }
  const adapter = createDistAdapter(repoRoot);
  withAdapter(adapter, (sandbox) => {
    const result = adapter.run(['version'], sandbox);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`${version.replace(/\./g, '\\.')}|version`, 'i'));
    assert.deepEqual(fs.readdirSync(sandbox.cwd), ['.git']);
  });
});

test('sandbox roots are separate from the repository and are disposable', () => {
  const sandbox = createSandbox('layout');
  assert.notEqual(sandbox.cwd, repoRoot);
  assert.ok(sandbox.home.startsWith(os.tmpdir()));
  removeSandbox(sandbox);
  assert.equal(fs.existsSync(sandbox.root), false);
});
