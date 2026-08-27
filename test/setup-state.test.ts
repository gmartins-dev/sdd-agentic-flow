import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { defaultInstallConfig, writeInstallConfig } from '../src/install-domain';
import {
  chooseSessionLocale,
  needsSessionLanguageSelection,
  renderInvocationWelcome,
  renderLanguagePrelude,
  renderOperationResult,
} from '../src/setup';
import { classifySetupState, collectSetupFacts, inspectSetupState } from '../src/setup-state';
import { writeInstallProvenance } from '../src/upgrade';

test('Fresh shell asks bilingually only without a reliable locale', () => {
  assert.equal(needsSessionLanguageSelection('Fresh', false), true);
  assert.equal(needsSessionLanguageSelection('Fresh', true), false);
  assert.equal(needsSessionLanguageSelection('Incomplete', false), false);
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
    { value: 'pt-BR', label: 'Português (Brasil)' },
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
  assert.match(ready, /sdd-agentic-flow/);
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

  const blocked = renderInvocationWelcome(snapshot('Blocked'), 'en-US', 'human-plain');
  assert.match(blocked, /SAF needs attention before setup can continue/);
});

test('language prelude is neutral until session locale is selected', () => {
  const prelude = renderLanguagePrelude();
  assert.match(prelude, /sdd-agentic-flow/);
  assert.doesNotMatch(prelude, /Specs first|Boas-vindas|Welcome back/);
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
