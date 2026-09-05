import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { hasScriptPty, runScriptPty } from '../scripts/cli-certification/pty.js';

const cli = path.join(process.cwd(), 'dist', 'sdd-agentic-flow.js');

function setupEnv(home: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: home,
    PATH: `${path.dirname(process.execPath)}:/usr/bin`,
    CI: '',
    TERM: 'xterm',
  };
}

test('no-Git setup asks Language before coding agents and stays user-only', async (t) => {
  if (!hasScriptPty()) {
    t.skip('Linux script PTY wrapper unavailable');
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-pty-user-'));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  fs.mkdirSync(home);
  fs.mkdirSync(project);
  try {
    const result = await runScriptPty(`'${process.execPath}' '${cli}'`, {
      cwd: project,
      env: setupEnv(home),
      steps: [
        { waitFor: /Choose your language \/ Escolha o idioma/, input: '2' },
        { waitFor: /Agentes de código/, input: '1\r' },
        {
          waitFor: /Pronto para configurar o SAF[\s\S]*?▸ 1\. Instalar e configurar/,
          input: '1\r',
        },
        { waitFor: /Nenhum workspace Git está ativo aqui/, input: '' },
      ],
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(
      result.transcript.indexOf('Escolha o idioma') <
        result.transcript.indexOf('Agentes de código'),
    );
    assert.equal(fs.existsSync(path.join(project, '.sdd-agentic-flow', 'config.yml')), false);
    assert.equal(fs.existsSync(path.join(home, '.sdd-agentic-flow', 'install.yml')), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Git setup keeps PT-BR through review, Apply, validation, and persisted language fields', async (t) => {
  if (!hasScriptPty()) {
    t.skip('Linux script PTY wrapper unavailable');
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-pty-git-'));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  fs.mkdirSync(home);
  fs.mkdirSync(project);
  execFileSync('git', ['init', '--quiet'], { cwd: project });
  try {
    const result = await runScriptPty(`'${process.execPath}' '${cli}'`, {
      cwd: project,
      env: setupEnv(home),
      steps: [
        { waitFor: /Choose your language \/ Escolha o idioma/, input: '2' },
        { waitFor: /Compartilhamento/, input: '1' },
        { waitFor: /Agentes de código/, input: '1\r' },
        { waitFor: /Fluxo de trabalho/, input: '\r' },
        { waitFor: /Pronto para configurar o SAF/, input: '1\r' },
        { waitFor: /Fluxo: Supervisionado/, input: '' },
      ],
    });
    assert.equal(result.status, 0, result.stderr);
    const config = fs.readFileSync(path.join(project, '.sdd-agentic-flow', 'config.yml'), 'utf8');
    assert.match(config, /profile: pt-BR/);
    assert.match(config, /human_outputs: pt-BR/);
    assert.ok(result.transcript.includes('Saúde da configuração'));
    assert.ok(
      result.transcript.indexOf('Compartilhamento') <
        result.transcript.indexOf('Agentes de código'),
    );
    assert.ok(
      result.transcript.indexOf('Agentes de código') <
        result.transcript.indexOf('Fluxo de trabalho'),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
