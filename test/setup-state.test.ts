import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { defaultInstallConfig, writeInstallConfig } from '../src/install-domain';
import {
  chooseSessionLocale,
  needsSessionLanguageSelection,
  renderInvocationWelcome,
  renderOperationResult,
} from '../src/setup';
import {
  classifySetupState,
  collectSetupFacts,
  inspectSetupState,
  inspectUserInstallation,
} from '../src/setup-state';
import { OFFICIAL_SKILLS } from '../src/skill-identity';
import { writeInstallProvenance } from '../src/upgrade';

test('Fresh shell asks bilingually only without a reliable locale', () => {
  assert.equal(needsSessionLanguageSelection('Fresh', false), true);
  assert.equal(needsSessionLanguageSelection('Fresh', true), false);
  assert.equal(needsSessionLanguageSelection('Incomplete', false), true);
});

test('Fresh language selection is bilingual, defaults to English, and stays session-local', async () => {
  let question = '';
  let options: Array<{ value: unknown; label: string; selected?: boolean }> = [];
  const locale = await chooseSessionLocale(async (receivedQuestion, receivedOptions) => {
    question = receivedQuestion;
    options = receivedOptions as typeof options;
    return { value: 'pt-BR' };
  });
  assert.equal(question, 'Choose your language / Escolha o idioma');
  assert.deepEqual(options, [
    { value: 'en-US', label: 'English', selected: true },
    { value: 'pt-BR', label: 'Português' },
  ]);
  assert.equal(locale, 'pt-BR');
  assert.equal(await chooseSessionLocale(async () => ({ cancelled: true })), null);
});

test('operation result pages expose state, summary, and next action', () => {
  const page = renderOperationResult('Installation details', 'error', 'apply failed');
  assert.match(page, /Installation details/);
  assert.match(page, /Error: apply failed/);
  assert.match(page, /Next action:/);
});

test('invocation welcome owns localized identity and state greeting', () => {
  const snapshot = (state: string) => ({ state }) as never;
  const ready = renderInvocationWelcome(snapshot('Ready'), 'en-US', 'human-plain');
  assert.match(ready, /SDD-AGENTIC-FLOW \(SAF\)/);
  assert.match(ready, /Spec-Driven Agentic Workflow Harness/);
  assert.match(ready, /Specs first\. Evidence before done/);
  assert.match(ready, /Welcome back/);
  assert.match(ready, /OK SAF is ready/);
  assert.doesNotMatch(ready, /Current setup/);

  const attention = renderInvocationWelcome(snapshot('Attention'), 'pt-BR', 'human-plain');
  assert.match(attention, /Bem-vindo de volta/);
  assert.match(attention, /O SAF está pronto, mas há algo para revisar/);

  const incomplete = renderInvocationWelcome(snapshot('Incomplete'), 'en-US', 'human-plain');
  assert.match(incomplete, /SAF setup is incomplete/);
  assert.match(incomplete, /Some setup steps are complete/);

  const fresh = renderInvocationWelcome(snapshot('Fresh'), 'pt-BR', 'human-plain');
  assert.match(fresh, /Boas-vindas ao SAF \(sdd-agentic-flow\)/);
  assert.match(
    fresh,
    /Specs primeiro\. Evidências antes de concluir\. Você mantém o controle\.\n\n\nBoas-vindas ao SAF \(sdd-agentic-flow\)\nNenhuma configuração do SAF foi encontrada neste workspace\.\n\n$/,
  );

  const blocked = renderInvocationWelcome(snapshot('Blocked'), 'en-US', 'human-plain');
  assert.match(blocked, /SAF needs attention before setup can continue/);
});

test('classifies setup from durable facts without requiring config', () => {
  assert.equal(
    classifySetupState({ config: 'absent', workspace: 'absent', skills: 'absent', context: false }),
    'Fresh',
  );
  assert.equal(
    classifySetupState({ config: 'absent', workspace: 'valid', skills: 'complete', context: true }),
    'Ready',
  );
  assert.equal(
    classifySetupState({ config: 'valid', workspace: 'valid', skills: 'partial', context: true }),
    'Incomplete',
  );
  assert.equal(
    classifySetupState({
      config: 'valid',
      workspace: 'valid',
      skills: 'partial',
      context: true,
      warnings: ['target is incomplete'],
    }),
    'Incomplete',
  );
  assert.equal(
    classifySetupState({
      config: 'valid',
      workspace: 'valid',
      skills: 'complete',
      context: true,
      attention: true,
    }),
    'Attention',
  );
  assert.equal(
    classifySetupState({
      config: 'invalid',
      workspace: 'valid',
      skills: 'complete',
      context: true,
    }),
    'Blocked',
  );
  assert.equal(
    classifySetupState({
      config: 'absent',
      workspace: 'absent',
      skills: 'absent',
      context: false,
      installationIntent: 'current',
    }),
    'Incomplete',
  );
});

test('invalid project artifacts do not block user setup outside Git', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-no-git-state-'));
  try {
    fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.sdd-agentic-flow', 'config.yml'), 'schema: saf-config/v2\n');
    assert.equal(inspectSetupState(cwd, cwd).state, 'Incomplete');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('inspects every required target with an injected home directory', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-state-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-home-'));
  try {
    fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow', 'context'), { recursive: true });
    fs.writeFileSync(
      path.join(cwd, '.sdd-agentic-flow', 'workspace.yml'),
      'schema: saf-workspace/v1\n',
    );
    const facts = collectSetupFacts(cwd, home);
    assert.equal(facts.homeDir, home);
    assert.equal(facts.targets?.length, 3);
    assert.equal(
      facts.targets?.every((target) => !target.complete),
      true,
    );
    assert.equal(inspectSetupState(cwd, home).state, 'Incomplete');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('recognizes a healthy user installation without requiring a Git workspace', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-user-install-'));
  const homeDir = path.join(root, 'home');
  const cwd = path.join(root, 'cwd');
  fs.mkdirSync(cwd, { recursive: true });
  writeInstallConfig({ ...defaultInstallConfig(), user: { targets: ['agents'] } }, homeDir);
  const targetRoot = path.join(homeDir, '.agents', 'skills');
  for (const skill of OFFICIAL_SKILLS) {
    fs.mkdirSync(path.join(targetRoot, skill), { recursive: true });
    fs.writeFileSync(path.join(targetRoot, skill, 'SKILL.md'), '# skill\n');
  }
  writeInstallProvenance(targetRoot, {
    packageVersion: '7.6.0',
    scope: 'user',
    target: 'agents',
    managedSkills: [...OFFICIAL_SKILLS],
    applyState: 'complete',
  });
  assert.deepEqual(inspectUserInstallation(homeDir), {
    state: 'healthy',
    targets: ['agents'],
  });
  assert.equal(inspectSetupState(cwd, homeDir).state, 'Incomplete');
  fs.rmSync(root, { recursive: true, force: true });
});

test('pending installation reconciliation surfaces as onboarding attention', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-pending-install-'));
  const homeDir = path.join(root, 'home');
  const cwd = path.join(root, 'project');
  fs.mkdirSync(cwd, { recursive: true });
  execFileSync('git', ['init', '--quiet'], { cwd });
  writeInstallConfig({ ...defaultInstallConfig(), user: { targets: ['agents'] } }, homeDir);
  const skillsRoot = path.join(homeDir, '.agents', 'skills');
  fs.mkdirSync(skillsRoot, { recursive: true });
  for (const skill of OFFICIAL_SKILLS) {
    fs.mkdirSync(path.join(skillsRoot, skill), { recursive: true });
    fs.writeFileSync(path.join(skillsRoot, skill, 'SKILL.md'), '# stale skill\n');
  }
  writeInstallProvenance(skillsRoot, {
    packageVersion: '7.6.0',
    scope: 'user',
    target: 'agents',
    managedSkills: [...OFFICIAL_SKILLS],
    applyState: 'complete',
  });
  fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow', 'context'), { recursive: true });
  fs.writeFileSync(
    path.join(cwd, '.sdd-agentic-flow', 'workspace.yml'),
    'schema: saf-workspace/v1\n',
  );
  fs.writeFileSync(
    path.join(cwd, '.sdd-agentic-flow', 'context', 'project-context.md'),
    '# context\n',
  );
  try {
    assert.equal(inspectSetupState(cwd, homeDir).state, 'Attention');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('interrupted target apply cannot classify the setup as Ready', () => {
  assert.equal(
    classifySetupState({
      config: 'valid',
      workspace: 'valid',
      skills: 'complete',
      context: true,
      blockers: ['agents target has an interrupted apply'],
    }),
    'Blocked',
  );
});

test('recognized managed roots outside user intent cannot classify as Ready', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-extra-target-'));
  const homeDir = path.join(root, 'home');
  const cwd = path.join(root, 'project');
  fs.mkdirSync(cwd, { recursive: true });
  writeInstallConfig({ ...defaultInstallConfig(), user: { targets: ['agents'] } }, homeDir);
  const cursorRoot = path.join(homeDir, '.cursor', 'skills');
  writeInstallProvenance(cursorRoot, { packageVersion: '7.5.0', scope: 'user', target: 'cursor' });
  assert.equal(inspectSetupState(cwd, homeDir).state, 'Blocked');
  fs.rmSync(root, { recursive: true, force: true });
});
