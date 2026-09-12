import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { USER_TARGETS } from '../src/install-domain';
import {
  type ArtifactIdentity,
  type CliExecutionAdapter,
  createDistAdapter,
  createPackedAdapter,
  createSandbox,
  removeSandbox,
} from './cli-certification/adapters';
import {
  analyzeConsumerClosure,
  type ConsumerClosureResult,
  materializeConsumerTree,
  materializeSourceProjection,
  renderConsumerClosureReport,
} from './consumer-closure';

type Profile = 'dist' | 'packed';

type ScopeEvidence = {
  id: 'project' | `user:${keyof typeof USER_TARGETS}`;
  root: string;
  command: string;
  commandStatus: number | null;
  result: ConsumerClosureResult;
};

export type ConsumerClosureCertification = {
  identity: ArtifactIdentity;
  profile: Profile;
  source: ConsumerClosureResult;
  scopes: ScopeEvidence[];
  status: ConsumerClosureResult['status'];
};

const USER_TARGET_IDS = ['agents', 'claude', 'copilot', 'cursor'] as const;

function failFromCommand(message: string): ConsumerClosureResult {
  return {
    status: 'FAIL',
    findings: [
      {
        rule: 'SAF-CLOSURE-009',
        file: 'install',
        location: 0,
        reference: 'install command',
        normalizedReference: 'install command',
        category: 'inspection',
        evidence: message,
        impact: 'installed tree was not produced',
        remediation: 'repair the installation command before retrying',
      },
    ],
    inspectedPaths: [],
    notes: [],
  };
}

export function inspectSourceProjection(repoRoot: string): ConsumerClosureResult {
  return analyzeConsumerClosure({ entries: materializeSourceProjection(repoRoot) });
}

function inspectInstalledScope(
  adapter: CliExecutionAdapter,
  id: ScopeEvidence['id'],
  args: string[],
  rootFor: (sandbox: ReturnType<typeof createSandbox>) => string,
): ScopeEvidence {
  const sandbox = createSandbox(`consumer-closure-${adapter.name}-${id.replace(':', '-')}`);
  try {
    const command = adapter.run(args, sandbox);
    const root = rootFor(sandbox);
    return {
      id,
      root,
      command: args.join(' '),
      commandStatus: command.status,
      result:
        command.status === 0
          ? analyzeConsumerClosure({ entries: materializeConsumerTree(root) })
          : failFromCommand(`${command.stderr}\n${command.stdout}`.trim()),
    };
  } finally {
    removeSandbox(sandbox);
  }
}

function aggregateStatus(results: ConsumerClosureResult[]): ConsumerClosureResult['status'] {
  if (results.some((result) => result.status === 'INCONCLUSIVE')) return 'INCONCLUSIVE';
  if (results.some((result) => result.status === 'FAIL')) return 'FAIL';
  return 'PASS';
}

export function certifyConsumerClosure({
  profile,
  repoRoot,
}: {
  profile: Profile;
  repoRoot: string;
}): ConsumerClosureCertification {
  const adapter =
    profile === 'packed' ? createPackedAdapter(repoRoot) : createDistAdapter(repoRoot);
  try {
    const scopes: ScopeEvidence[] = [
      inspectInstalledScope(
        adapter,
        'project',
        ['install', '--scope', 'project', '--adoption-mode', 'team'],
        (sandbox) => path.join(sandbox.cwd, '.agents', 'skills'),
      ),
      ...USER_TARGET_IDS.map((target) =>
        inspectInstalledScope(
          adapter,
          `user:${target}`,
          ['install', '--scope', 'user', '--target', target],
          (sandbox) => path.join(sandbox.home, ...USER_TARGETS[target]),
        ),
      ),
    ].sort((left, right) => left.id.localeCompare(right.id));
    const source = inspectSourceProjection(repoRoot);
    return {
      identity: adapter.identity,
      profile,
      source,
      scopes,
      status: aggregateStatus([source, ...scopes.map((scope) => scope.result)]),
    };
  } finally {
    adapter.dispose?.();
  }
}

export function renderConsumerClosureCertification(report: ConsumerClosureCertification): string {
  const lines = [
    '# Consumer closure certification',
    '',
    `Status: ${report.status}`,
    `Profile: ${report.profile}`,
    `Version: ${report.identity.version}`,
    `Source commit: ${report.identity.sourceCommit}`,
    '',
    '## Source projection',
    '',
    renderConsumerClosureReport(report.source).trim(),
    '',
    '## Installed scopes',
    '',
  ];
  for (const scope of report.scopes) {
    lines.push(
      `- ${scope.id}: ${scope.result.status} (install exit ${scope.commandStatus ?? 'null'}; ${scope.command})`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function profileFromArgs(args: readonly string[]): Profile {
  const raw = args.find((arg) => arg.startsWith('--profile='))?.slice('--profile='.length);
  assert.ok(raw === 'dist' || raw === 'packed', 'expected --profile=dist or --profile=packed');
  return raw;
}

if (process.argv[1]?.endsWith('consumer-closure-certification.ts')) {
  const profile = profileFromArgs(process.argv.slice(2));
  const report = certifyConsumerClosure({ profile, repoRoot: path.resolve(__dirname, '..') });
  const output =
    process.env.SAF_CONSUMER_CLOSURE_REPORT ||
    path.join(
      path.resolve(__dirname, '..'),
      '.local',
      'gmm',
      'sdd-agentic-flow',
      `v${report.identity.version}-consumer-closure-${profile}.md`,
    );
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, renderConsumerClosureCertification(report), 'utf8');
  console.log(`${report.status} consumer closure report: ${output}`);
  process.exit(report.status === 'PASS' ? 0 : report.status === 'FAIL' ? 1 : 2);
}
