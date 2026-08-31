import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hasScriptPty, runScriptPty } from '../scripts/cli-certification/pty.js';

test('PTY driver sends input only after matching output', async (t) => {
  if (!hasScriptPty()) {
    t.skip('Linux script PTY wrapper unavailable');
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-cert-pty-'));
  try {
    const result = await runScriptPty('printf READY; read answer; printf DONE', {
      cwd: root,
      env: { ...process.env, TERM: 'dumb' },
      steps: [
        { waitFor: /READY/, input: 'accepted\n' },
        { waitFor: /DONE/, input: '' },
      ],
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.transcript, /READY/);
    assert.match(result.transcript, /DONE/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('PTY driver preserves prompts that follow a matched prompt in one chunk', async (t) => {
  if (!hasScriptPty()) {
    t.skip('Linux script PTY wrapper unavailable');
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-cert-pty-chunk-'));
  try {
    const result = await runScriptPty('printf "FIRST\\nSECOND\\n"; read answer; printf DONE', {
      cwd: root,
      env: { ...process.env, TERM: 'dumb' },
      steps: [
        { waitFor: /FIRST/, input: '' },
        { waitFor: /SECOND/, input: 'accepted\n' },
        { waitFor: /DONE/, input: '' },
      ],
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.transcript, /FIRST/);
    assert.match(result.transcript, /SECOND/);
    assert.match(result.transcript, /DONE/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('PTY driver reports transcript on prompt timeout', async (t) => {
  if (!hasScriptPty()) {
    t.skip('Linux script PTY wrapper unavailable');
    return;
  }
  await assert.rejects(
    runScriptPty('printf READY', {
      cwd: process.cwd(),
      env: { ...process.env, TERM: 'dumb' },
      steps: [{ waitFor: /MISSING/, input: '', timeoutMs: 250 }],
    }),
    /PTY (prompt timeout|process closed).*READY/s,
  );
});
