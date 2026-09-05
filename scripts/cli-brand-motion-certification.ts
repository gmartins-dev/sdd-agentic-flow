import assert from 'node:assert/strict';
import path from 'node:path';
import {
  createDistAdapter,
  createPackedAdapter,
  createSandbox,
  removeSandbox,
} from './cli-certification/adapters.js';
import { observeSandbox } from './cli-certification/observer.js';
import { hasScriptPty, runScriptPty } from './cli-certification/pty.js';

const root = path.join(__dirname, '..');
type Adapter = ReturnType<typeof createDistAdapter> | ReturnType<typeof createPackedAdapter>;

async function certify(adapter: Adapter): Promise<void> {
  const sandbox = createSandbox(`brand-${adapter.name}`);
  try {
    const before = observeSandbox(sandbox);
    const result = await runScriptPty(adapter.ptyCommand(sandbox).replace('rows 24', 'rows 48'), {
      cwd: sandbox.cwd,
      env: { ...adapter.ptyEnvironment(sandbox), NO_COLOR: '1', SDD_BRAND_ANIMATE: '1' },
      steps: [{ waitFor: /Choose your language \/ Escolha o idioma/, input: '\u0003' }],
      timeoutMs: 20_000,
    });
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.transcript.slice(-2000));
    assert.match(result.transcript, /█/);
    assert.match(result.transcript.replaceAll('\r', ''), /SDD-AGENTIC-FLOW \(SAF\)/);
    const after = observeSandbox(sandbox);
    assert.deepEqual(after.entries, before.entries);
    assert.equal(after.gitignore, before.gitignore);
    assert.equal(after.gitExclude, before.gitExclude);
    console.log(
      `PASS brand motion ${adapter.name}: canonical glyphs, welcome continuation, zero mutation`,
    );
  } finally {
    removeSandbox(sandbox);
  }
}

async function main(): Promise<void> {
  if (!hasScriptPty()) {
    if (process.platform === 'linux')
      throw new Error('Linux PTY support is mandatory for brand motion certification');
    console.log('SKIP brand motion certification: Linux script PTY unavailable on this host');
    return;
  }
  const profile = process.argv.find((arg) => arg.startsWith('--profile='))?.split('=')[1] ?? 'both';
  if (profile === 'dist' || profile === 'both') await certify(createDistAdapter(root));
  if (profile === 'packed' || profile === 'both') await certify(createPackedAdapter(root));
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
