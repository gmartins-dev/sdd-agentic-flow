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

test('PTY driver rejects stateful prompt matchers', async (t) => {
  if (!hasScriptPty()) {
    t.skip('Linux script PTY wrapper unavailable');
    return;
  }
  await assert.rejects(
    runScriptPty('printf READY', {
      cwd: process.cwd(),
      env: { ...process.env, TERM: 'dumb' },
      steps: [{ waitFor: /READY/g, input: '' }],
    }),
    /must not use global or sticky state/,
  );
});

test('PTY driver reaps descendants after a failed step', async (t) => {
  if (!hasScriptPty()) {
    t.skip('Linux script PTY wrapper unavailable');
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-cert-pty-reap-'));
  const marker = path.join(root, 'marker');
  try {
    await assert.rejects(
      runScriptPty(`(sleep 2; printf MARKER > '${marker}') & printf READY`, {
        cwd: root,
        env: { ...process.env, TERM: 'dumb' },
        steps: [{ waitFor: /MISSING/, input: '', timeoutMs: 100 }],
        timeoutMs: 1_000,
      }),
      /PTY prompt timeout|PTY process closed/,
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(fs.existsSync(marker), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('PTY driver accepts input immediately after the observed prompt', async (t) => {
  if (!hasScriptPty()) {
    t.skip('Linux script PTY wrapper unavailable');
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-cert-pty-immediate-'));
  try {
    const result = await runScriptPty('printf READY; read answer; printf DONE', {
      cwd: root,
      env: { ...process.env, TERM: 'dumb' },
      steps: [
        { waitFor: /READY/, input: 'ok\n' },
        { waitFor: /DONE/, input: '' },
      ],
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.transcript, /DONE/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('release-critical audits contain no blind sleep/printf input choreography', () => {
  for (const file of [
    'scripts/cli-exhaustive.ts',
    'scripts/cli-full-matrix.mjs',
    'scripts/cli-certification.ts',
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /sleep[\s\S]{0,160}printf|printf[\s\S]{0,160}sleep/);
  }
});
