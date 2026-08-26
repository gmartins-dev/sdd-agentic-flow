import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { configureIntent } from '../src/configure';
import { resolveGitContext } from '../src/git-context';
import {
  applyWorkspaceInitialization,
  planWorkspaceInitialization,
  WORKSPACE_MARKER,
} from '../src/workspace';

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

test('workspace plan is Git-gated, non-mutating, and apply preserves config', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-workspace-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-home-'));
  assert.equal(planWorkspaceInitialization(root, home).ok, false);
  git(root, 'init');
  fs.mkdirSync(path.join(root, '.sdd-agentic-flow'), { recursive: true });
  const config = 'schema: saf-config/v3\n';
  fs.writeFileSync(path.join(root, '.sdd-agentic-flow', 'config.yml'), config);

  const plan = planWorkspaceInitialization(root, home);
  assert.equal(plan.ok, true);
  assert.equal(fs.existsSync(path.join(root, '.sdd-agentic-flow', 'workspace.yml')), false);
  assert.equal(applyWorkspaceInitialization(plan, home).ok, true);
  assert.equal(
    fs.readFileSync(path.join(root, '.sdd-agentic-flow', 'workspace.yml'), 'utf8'),
    WORKSPACE_MARKER,
  );
  assert.equal(fs.readFileSync(path.join(root, '.sdd-agentic-flow', 'config.yml'), 'utf8'), config);
});

test('linked worktrees share adoption identity and keep local markers', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-linked-'));
  const linked = `${root}-worktree`;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-linked-home-'));
  git(root, 'init');
  git(root, 'config', 'user.email', 'test@example.test');
  git(root, 'config', 'user.name', 'Test');
  fs.writeFileSync(path.join(root, 'tracked'), 'x');
  git(root, 'add', 'tracked');
  git(root, 'commit', '-m', 'base');
  git(root, 'worktree', 'add', linked, '-b', 'linked');

  const first = resolveGitContext(root);
  const second = resolveGitContext(linked);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.equal(first.context.adoptionKey, second.context.adoptionKey);
  assert.equal(
    applyWorkspaceInitialization(planWorkspaceInitialization(root, home), home).ok,
    true,
  );
  assert.equal(
    applyWorkspaceInitialization(planWorkspaceInitialization(linked, home), home).ok,
    true,
  );
  assert.equal(fs.existsSync(path.join(root, '.sdd-agentic-flow', 'workspace.yml')), true);
  assert.equal(fs.existsSync(path.join(linked, '.sdd-agentic-flow', 'workspace.yml')), true);
});

test('workspace plan keeps Team excludes relative to a nested project', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-workspace-monorepo-'));
  const project = path.join(root, 'apps', 'payments');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-workspace-monorepo-home-'));
  fs.mkdirSync(project, { recursive: true });
  git(root, 'init');
  configureIntent({ homeDir: home, cwd: project, scope: 'project', adoptionMode: 'team' });
  const plan = planWorkspaceInitialization(project, home);
  assert.equal(plan.ok, true);
  assert.ok(plan.excludes.includes('apps/payments/.sdd-agentic-flow/workspace.yml'));
});
