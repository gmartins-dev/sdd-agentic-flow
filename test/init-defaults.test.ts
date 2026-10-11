import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { COMMAND_HELP, KNOWN_COMMANDS, writeCommandHelp } from '../src/cli-help';
import { CANONICAL_COMMANDS } from '../src/command-registry';
import { inferInitDefaults, mergeInitDefaults } from '../src/init-defaults';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-init-defaults-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));

function project(name: string, files: Record<string, string> = {}): string {
  const dir = path.join(root, name);
  for (const [relative, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, relative)), { recursive: true });
    fs.writeFileSync(path.join(dir, relative), content);
  }
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test('init defaults infer the package name, Git branch, and agent target', () => {
  const dir = project('named', { 'package.json': JSON.stringify({ name: ' demo-app ' }) });
  spawnSync('git', ['init', '-q', '-b', 'trunk'], { cwd: dir });
  assert.deepEqual(inferInitDefaults(dir), { name: 'demo-app', branch: 'trunk', agent: 'generic' });
});

test('init defaults fall back to the directory name, main, and generic agent', () => {
  const dir = project('plain-dir', { 'package.json': '{not json' });
  assert.deepEqual(inferInitDefaults(dir), { name: 'plain-dir', branch: 'main', agent: 'generic' });
});

test('agent markers map to their documented agent targets', () => {
  const cases: Array<[Record<string, string>, string]> = [
    [{ 'CLAUDE.md': '' }, 'claude-code'],
    [{ '.cursor/rules': '' }, 'cursor'],
    [{ 'CODEX.md': '' }, 'codex'],
    [{ '.github/copilot-instructions.md': '' }, 'vscode-copilot'],
    [{ '.vscode/settings.json': '{"chat.agentSkillsLocations": {}}' }, 'vscode-copilot'],
    [{ '.vscode/settings.json': '{}' }, 'generic'],
  ];
  cases.forEach(([files, agent], index) => {
    assert.equal(inferInitDefaults(project(`agent-${index}`, files)).agent, agent);
  });
});

test('explicit init options override inferred defaults without dropping extra fields', () => {
  const dir = project('merge');
  const merged = mergeInitDefaults<{ name: string; branch: string; agent: string; yes: boolean }>(
    dir,
    { name: 'explicit', yes: true },
  );
  assert.equal(merged.name, 'explicit');
  assert.equal(merged.branch, 'main');
  assert.equal(merged.agent, 'generic');
  assert.equal(merged.yes, true);
});

test('every canonical command has detailed help and is a known command', () => {
  for (const command of CANONICAL_COMMANDS) {
    const top = command.split(' ')[0] as string;
    assert.ok(KNOWN_COMMANDS.includes(top as (typeof KNOWN_COMMANDS)[number]), top);
  }
  const write = process.stdout.write.bind(process.stdout);
  let output = '';
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output += String(chunk);
    return true;
  }) as typeof process.stdout.write;
  try {
    writeCommandHelp('install');
    writeCommandHelp('missing-command');
  } finally {
    process.stdout.write = write;
  }
  assert.equal(output, COMMAND_HELP.install);
});
