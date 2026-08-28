import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { defaultInstallConfig, writeInstallConfig } from '../src/install-domain';
import { PACKAGE_ROOT } from '../src/paths';
import {
  detectSetupHosts,
  resolveSetupPlan,
  setupPlanIsCurrent,
  setupPrecondition,
  targetsForHosts,
} from '../src/setup-plan';
import { OFFICIAL_SKILLS } from '../src/skill-identity';
import { writeInstallProvenance } from '../src/upgrade';

test('maps selected hosts to deduplicated persisted targets', () => {
  assert.deepEqual(targetsForHosts(['codex', 'cursor', 'claude-code']), [
    'agents',
    'cursor',
    'claude',
  ]);
});

test('invalidates a reviewed setup plan when durable inputs change', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-plan-'));
  try {
    const plan = { precondition: setupPrecondition(cwd) } as Parameters<
      typeof setupPlanIsCurrent
    >[1];
    fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.sdd-agentic-flow', 'workspace.yml'), 'changed\n');
    assert.equal(setupPlanIsCurrent(cwd, plan), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('detects hosts from injected local hints without executing providers', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-host-cwd-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-host-home-'));
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-host-bin-'));
  try {
    fs.mkdirSync(path.join(home, '.cursor'), { recursive: true });
    fs.writeFileSync(path.join(bin, process.platform === 'win32' ? 'claude.cmd' : 'claude'), '', {
      mode: 0o755,
    });
    const detected = detectSetupHosts({ cwd, homeDir: home, env: { PATH: bin } });
    assert.equal(detected.find((host) => host.host === 'cursor')?.detected, true);
    assert.equal(detected.find((host) => host.host === 'claude-code')?.detected, true);
    assert.equal(detected.find((host) => host.host === 'codex')?.detected, false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(bin, { recursive: true, force: true });
  }
});

test('resolves an inspectable plan with no executable callbacks', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-plan-shape-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-plan-home-'));
  try {
    const snapshot = {
      config: 'absent',
      workspace: 'absent',
      skills: 'absent',
      context: false,
      homeDir: home,
      evidence: { warnings: [], blockers: [], targetSet: [], targetEvidence: [] },
      state: 'Fresh',
    } as unknown as Parameters<typeof resolveSetupPlan>[1];
    const plan = resolveSetupPlan(
      cwd,
      snapshot,
      {
        sharing: 'personal',
        selectedHosts: ['codex', 'cursor'],
        workflow: 'supervised',
        language: 'en-US',
      },
      home,
    );
    assert.equal(plan.operation, 'user-install');
    assert.equal(plan.installationPlan.applicability, 'applicable');
    assert.equal(plan.workspacePlan.applicability, 'not_applicable');
    assert.equal(plan.blocked, false);
    assert.doesNotMatch(plan.blockers.join('\n'), /Git repository metadata is required/);
    assert.deepEqual(plan.targets, ['agents', 'cursor']);
    assert.equal(plan.preconditions.inputs.includes('unrelated home data'), false);
    assert.equal(
      Object.values(plan).some((value) => typeof value === 'function'),
      false,
    );
    assert.equal(setupPlanIsCurrent(cwd, plan, home), true);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('switches from user installation to workspace setup inside Git', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-transition-'));
  const home = path.join(root, 'home');
  fs.mkdirSync(home, { recursive: true });
  execFileSync('git', ['init'], { cwd: root, stdio: 'ignore' });
  writeInstallConfig({ ...defaultInstallConfig(), user: { targets: ['agents'] } }, home);
  const targetRoot = path.join(home, '.agents', 'skills');
  for (const skill of OFFICIAL_SKILLS) {
    fs.cpSync(path.join(PACKAGE_ROOT, 'skills', skill), path.join(targetRoot, skill), {
      recursive: true,
    });
  }
  fs.cpSync(path.join(PACKAGE_ROOT, 'shared'), path.join(targetRoot, 'sdd-agentic-flow-shared'), {
    recursive: true,
  });
  writeInstallProvenance(targetRoot, {
    packageVersion: '7.6.0',
    scope: 'user',
    target: 'agents',
    managedSkills: [...OFFICIAL_SKILLS],
    applyState: 'complete',
  });
  const state = {
    config: 'absent',
    workspace: 'absent',
    skills: 'complete',
    context: false,
    homeDir: home,
    evidence: { warnings: [], blockers: [], targetSet: [], targetEvidence: [] },
    state: 'Incomplete',
    installationIntent: 'current',
  } as unknown as Parameters<typeof resolveSetupPlan>[1];
  const plan = resolveSetupPlan(
    root,
    state,
    { sharing: 'personal', selectedHosts: ['codex'], workflow: 'supervised', language: 'en-US' },
    home,
  );
  assert.equal(plan.operation, 'workspace-setup');
  assert.equal(plan.installRequired, false);
  assert.equal(plan.workspacePlan.applicability, 'applicable');
  assert.equal(plan.blocked, false);
  fs.rmSync(root, { recursive: true, force: true });
});
