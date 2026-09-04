import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { decideCertification, type ScenarioEvidence } from './cli-audit-model.js';
import {
  assertMutationContract,
  diffSnapshots,
  type MutationContract,
} from './cli-audit-snapshot.js';
import {
  type CliExecutionAdapter,
  createDistAdapter,
  createPackedAdapter,
  createSandbox,
  removeSandbox,
} from './cli-certification/adapters.js';
import { observeSandbox } from './cli-certification/observer.js';
import { hasScriptPty, runScriptPty } from './cli-certification/pty.js';

type Scenario = {
  id: string;
  name: string;
  requirement: 'mandatory' | 'optional';
  run(adapter: CliExecutionAdapter, sandbox: ReturnType<typeof createSandbox>): Promise<void>;
};

type ScenarioResult = ScenarioEvidence & {
  id: string;
  name: string;
  command: string;
  input: string;
  expected: string;
  environment: string;
  stateDelta: string;
  durationMs: number;
};

const repoRoot = path.join(__dirname, '..');
const profileFlag = process.argv.indexOf('--profile');
const profile =
  process.argv.find((arg) => arg.startsWith('--profile='))?.split('=')[1] ??
  (profileFlag >= 0 ? process.argv[profileFlag + 1] : undefined) ??
  'dist';

function expectSuccess(result: ReturnType<CliExecutionAdapter['run']>, pattern?: RegExp): void {
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  if (pattern) assert.match(`${result.stdout}\n${result.stderr}`, pattern);
}

function stripAnsi(value: string): string {
  const ansiEscape = String.fromCharCode(27);
  return value.replace(new RegExp(`${ansiEscape}\\[[0-?]*[ -/]*[@-~]`, 'g'), '');
}

function expectUnchanged(
  before: ReturnType<typeof observeSandbox>,
  after: ReturnType<typeof observeSandbox>,
): void {
  assertMutationContract(diffSnapshots(before.entries, after.entries));
  assert.equal(after.gitExclude, before.gitExclude);
  assert.equal(after.gitignore, before.gitignore);
  assert.equal(after.gitStatus, before.gitStatus);
}

function mutationContract(
  contract: MutationContract,
  before: ReturnType<typeof observeSandbox>,
  after: ReturnType<typeof observeSandbox>,
) {
  const diff = diffSnapshots(before.entries, after.entries, contract);
  assertMutationContract(diff);
  assert.equal(after.gitignore, before.gitignore);
}

function summarizeStateDelta(
  before: ReturnType<typeof observeSandbox>,
  after: ReturnType<typeof observeSandbox>,
): string {
  const diff = diffSnapshots(before.entries, after.entries);
  const format = (entries: { path: string }[]) =>
    entries.map((entry) => entry.path).join(', ') || 'none';
  return `added=${format(diff.added)}; changed=${format(diff.changed)}; removed=${format(diff.removed)}`;
}

function lifecycleScenario(): Scenario {
  return {
    id: 'C001',
    name: 'fresh lifecycle reaches observable Ready',
    requirement: 'mandatory',
    async run(adapter, sandbox) {
      expectSuccess(adapter.run(['init'], sandbox), /initialized|created/i);
      expectSuccess(
        adapter.run(['install', '--scope', 'project', '--adoption-mode', 'team'], sandbox),
        /installed|preserved/i,
      );
      const doctor = adapter.run(['doctor', '--json'], sandbox);
      expectSuccess(doctor);
      const report = JSON.parse(doctor.stdout) as { data?: { status?: string } };
      assert.notEqual(report.data?.status, 'FAIL');
      const state = observeSandbox(sandbox);
      assert.ok(
        state.entries.some((entry) => entry.path === 'project/.sdd-agentic-flow/workspace.yml'),
      );
      assert.ok(
        state.entries.some(
          (entry) => entry.path === 'project/.sdd-agentic-flow/context/project-context.md',
        ),
      );
      assert.ok(state.entries.some((entry) => entry.path === 'project/.agents/skills'));
      const bare = adapter.run([], sandbox);
      expectSuccess(bare, /Ready|Current setup|Suggested next step/i);
      assert.doesNotMatch(`${bare.stdout}\n${bare.stderr}`, /[▓▒]{2,}|#{2,}\s+\+{2,}/);
    },
  };
}

function readOnlyScenario(): Scenario {
  return {
    id: 'C002',
    name: 'read-only commands preserve state',
    requirement: 'mandatory',
    async run(adapter, sandbox) {
      expectSuccess(adapter.run(['init'], sandbox));
      const before = observeSandbox(sandbox);
      expectSuccess(adapter.run(['doctor'], sandbox));
      expectSuccess(adapter.run(['config', 'show'], sandbox), /Workflow|Language/i);
      expectSuccess(adapter.run(['help', 'install'], sandbox));
      expectUnchanged(before, observeSandbox(sandbox));
    },
  };
}

function planScenario(): Scenario {
  return {
    id: 'C003',
    name: 'plan mode is mutation-free',
    requirement: 'mandatory',
    async run(adapter, sandbox) {
      expectSuccess(adapter.run(['init'], sandbox));
      const before = observeSandbox(sandbox);
      expectSuccess(adapter.run(['config', 'policy', '--plan', '--preset', 'autonomous'], sandbox));
      expectUnchanged(before, observeSandbox(sandbox));
    },
  };
}

function commandSurfaceScenario(): Scenario {
  return {
    id: 'C004',
    name: 'non-interactive command surface stays read-only',
    requirement: 'mandatory',
    async run(adapter, sandbox) {
      const before = observeSandbox(sandbox);
      expectSuccess(
        adapter.run(['version'], sandbox),
        new RegExp(`${adapter.identity.version.replace(/\./g, '\\.')}|version`, 'i'),
      );
      expectSuccess(adapter.run(['help'], sandbox), /QUICK START|completion/i);
      expectSuccess(adapter.run(['learn-sdd'], sandbox), /Spec-Driven Development|SDD/i);
      expectSuccess(adapter.run(['completion', 'bash'], sandbox), /complete -F/);
      expectSuccess(adapter.run(['completion', 'zsh'], sandbox), /#compdef/);
      expectSuccess(adapter.run(['completion', 'fish'], sandbox), /complete -c/);
      expectUnchanged(before, observeSandbox(sandbox));
    },
  };
}

function configurationScenario(): Scenario {
  return {
    id: 'C005',
    name: 'policy and installation configuration preserve plan semantics',
    requirement: 'mandatory',
    async run(adapter, sandbox) {
      expectSuccess(adapter.run(['init'], sandbox));
      const beforePlan = observeSandbox(sandbox);
      expectSuccess(
        adapter.run(['config', 'policy', '--plan', '--preset', 'autonomous'], sandbox),
        /plan|preview|would/i,
      );
      expectUnchanged(beforePlan, observeSandbox(sandbox));
      expectSuccess(
        adapter.run(
          [
            'config',
            'policy',
            '--yes',
            '--preset',
            'supervised',
            '--language',
            'pt-BR',
            '--feature-profile',
            'medium_feature',
          ],
          sandbox,
        ),
        /saved|pass|already/i,
      );
      expectSuccess(adapter.run(['config', 'show'], sandbox), /Supervised|Português \(Brasil\)/i);
      assert.match(
        fs.readFileSync(path.join(sandbox.cwd, '.sdd-agentic-flow', 'config.yml'), 'utf8'),
        /feature_profile: medium_feature/,
      );
      expectSuccess(
        adapter.run(
          ['config', 'installation', '--plan', '--scope', 'project', '--adoption-mode', 'team'],
          sandbox,
        ),
        /plan|preview|would/i,
      );
      expectSuccess(
        adapter.run(
          ['config', 'installation', '--yes', '--scope', 'project', '--adoption-mode', 'team'],
          sandbox,
        ),
        /saved|pass/i,
      );
    },
  };
}

function upgradeScenario(): Scenario {
  return {
    id: 'C006',
    name: 'installed state supports safe skill upgrade and re-entry',
    requirement: 'mandatory',
    async run(adapter, sandbox) {
      expectSuccess(adapter.run(['init'], sandbox));
      expectSuccess(
        adapter.run(['config', 'policy', '--yes', '--language', 'en-US'], sandbox),
        /updated|already|language/i,
      );
      expectSuccess(
        adapter.run(['install', '--scope', 'project', '--adoption-mode', 'team'], sandbox),
      );
      expectSuccess(
        adapter.run(['upgrade', '--skills-only'], sandbox),
        /differ|skipped|refreshed/i,
      );
      expectSuccess(adapter.run([], sandbox), /Ready|Current setup|Suggested next step/i);
    },
  };
}

function recoveryScenario(): Scenario {
  return {
    id: 'C007',
    name: 'future and malformed state fail closed without stack traces',
    requirement: 'mandatory',
    async run(adapter, sandbox) {
      const intentPath = path.join(sandbox.home, '.sdd-agentic-flow', 'install.yml');
      fs.mkdirSync(path.dirname(intentPath), { recursive: true });
      fs.writeFileSync(intentPath, 'schema: saf-install-intent/v99\n');
      const before = observeSandbox(sandbox);
      const future = adapter.run(['install', '--plan'], sandbox);
      assert.ok([0, 1].includes(future.status ?? -1), `${future.stderr}\n${future.stdout}`);
      assert.match(`${future.stdout}\n${future.stderr}`, /future|unknown|blocked|requires/i);
      assert.doesNotMatch(`${future.stdout}\n${future.stderr}`, /\b(Error|TypeError):/);
      expectUnchanged(before, observeSandbox(sandbox));

      fs.rmSync(intentPath);
      fs.writeFileSync(intentPath, 'schema: saf-install-intent/v2\n');
      const legacyBefore = observeSandbox(sandbox);
      const legacy = adapter.run(['install', '--plan'], sandbox);
      assert.ok([0, 1].includes(legacy.status ?? -1), `${legacy.stderr}\n${legacy.stdout}`);
      assert.match(`${legacy.stdout}\n${legacy.stderr}`, /legacy|pre-v7|clean v7/i);
      expectUnchanged(legacyBefore, observeSandbox(sandbox));

      fs.rmSync(intentPath);
      const configPath = path.join(sandbox.cwd, '.sdd-agentic-flow', 'config.yml');
      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, 'schema: saf-config/v99\nworkflow:\n  execution_mode: broken\n');
      const malformed = adapter.run(['doctor', '--json'], sandbox);
      assert.equal(malformed.status, 1, `${malformed.stderr}\n${malformed.stdout}`);
      assert.equal(JSON.parse(malformed.stdout).data?.status, 'FAIL');
      assert.doesNotMatch(`${malformed.stdout}\n${malformed.stderr}`, /\b(Error|TypeError):/);
    },
  };
}

function incompleteScenario(): Scenario {
  return {
    id: 'C008',
    name: 'incomplete installation is never reported as Ready',
    requirement: 'mandatory',
    async run(adapter, sandbox) {
      expectSuccess(adapter.run(['init'], sandbox));
      const before = observeSandbox(sandbox);
      const bare = adapter.run([], sandbox);
      expectSuccess(bare, /install|incomplete|Suggested next step/i);
      assert.doesNotMatch(`${bare.stdout}\n${bare.stderr}`, /^(?:PASS|[◇◆✓])\s+Ready\r?$/m);
      const doctor = adapter.run(['doctor', '--json'], sandbox);
      assert.ok([0, 1].includes(doctor.status ?? -1), `${doctor.stderr}\n${doctor.stdout}`);
      assert.notEqual(JSON.parse(doctor.stdout).data?.status, 'PASS');
      expectUnchanged(before, observeSandbox(sandbox));
    },
  };
}

function collisionScenario(): Scenario {
  return {
    id: 'C009',
    name: 'foreign installation collision fails closed and preserves ownership',
    requirement: 'mandatory',
    async run(adapter, sandbox) {
      expectSuccess(adapter.run(['init'], sandbox));
      const foreign = path.join(sandbox.cwd, '.agents', 'skills', 'sdd-third-party');
      fs.mkdirSync(foreign, { recursive: true });
      fs.writeFileSync(path.join(foreign, 'SKILL.md'), '# foreign\n');
      const before = observeSandbox(sandbox);
      const result = adapter.run(
        ['install', '--scope', 'project', '--adoption-mode', 'team'],
        sandbox,
      );
      assert.equal(result.status, 1, `${result.stderr}\n${result.stdout}`);
      assert.match(`${result.stdout}\n${result.stderr}`, /blocked|collision|foreign|legacy/i);
      assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /\b(Error|TypeError):/);
      const after = observeSandbox(sandbox);
      expectUnchanged(before, after);
      assert.ok(
        after.entries.some(
          (entry) => entry.path === 'project/.agents/skills/sdd-third-party/SKILL.md',
        ),
      );
    },
  };
}

function targetScopeScenario(): Scenario {
  return {
    id: 'C010',
    name: 'target and scope selection removes only selected managed assets',
    requirement: 'mandatory',
    async run(adapter, sandbox) {
      expectSuccess(
        adapter.run(['install', '--target', 'claude'], sandbox),
        /installed|preserved/i,
      );
      const foreign = path.join(sandbox.home, '.claude', 'skills', 'foreign.txt');
      fs.writeFileSync(foreign, 'keep\n');
      const beforePlan = observeSandbox(sandbox);
      expectSuccess(
        adapter.run(['uninstall', '--plan', '--scope', 'user', '--target', 'claude'], sandbox),
        /plan|Shared|Claude/i,
      );
      expectUnchanged(beforePlan, observeSandbox(sandbox));
      expectSuccess(
        adapter.run(['uninstall', '--yes', '--scope', 'user', '--target', 'claude'], sandbox),
        /removed|preserved/i,
      );
      const after = observeSandbox(sandbox);
      assert.ok(after.entries.some((entry) => entry.path === 'home/.claude/skills/foreign.txt'));
      assert.equal(
        after.entries.some((entry) => entry.path === 'home/.claude/skills/saf-create-spec'),
        false,
      );
      assert.equal(
        after.entries.some((entry) => entry.path === 'home/.agents/skills'),
        false,
      );
    },
  };
}

function cancellationScenario(): Scenario {
  const mandatory = process.platform === 'linux';
  return {
    id: 'C015',
    name: 'interactive cancellation preserves the initial state',
    requirement: mandatory ? 'mandatory' : 'optional',
    async run(adapter, sandbox) {
      if (!hasScriptPty()) throw new Error('script PTY wrapper unavailable');
      const before = observeSandbox(sandbox);
      const result = await runScriptPty(adapter.ptyCommand(sandbox), {
        cwd: sandbox.cwd,
        env: { ...adapter.ptyEnvironment(sandbox), SDD_BRAND_ANIMATE: '0' },
        steps: [{ waitFor: /1-9 select/, input: '\u0003' }],
      });
      assert.equal(result.status, 0, `${result.stderr}\n${result.transcript}`);
      expectUnchanged(before, observeSandbox(sandbox));
      assert.match(result.transcript, /Cancelled|Cancelado/i);
      assert.doesNotMatch(result.transcript, /FAIL Aborted with Ctrl\+C/);
    },
  };
}

function preservationScenario(): Scenario {
  return {
    id: 'C011',
    name: 'uninstall preserves foreign and specification state',
    requirement: 'mandatory',
    async run(adapter, sandbox) {
      expectSuccess(adapter.run(['init'], sandbox));
      expectSuccess(
        adapter.run(['install', '--scope', 'project', '--adoption-mode', 'team'], sandbox),
      );
      fs.mkdirSync(path.join(sandbox.cwd, '.specs', 'features'), { recursive: true });
      fs.writeFileSync(path.join(sandbox.cwd, '.specs', 'features', 'keep.md'), 'keep\n');
      fs.writeFileSync(path.join(sandbox.cwd, 'foreign.txt'), 'keep\n');
      const beforePlan = observeSandbox(sandbox);
      expectSuccess(adapter.run(['uninstall', '--plan'], sandbox), /plan|No changes/i);
      expectUnchanged(beforePlan, observeSandbox(sandbox));
      expectSuccess(adapter.run(['uninstall', '--yes'], sandbox), /removed|preserved/i);
      const after = observeSandbox(sandbox);
      assert.ok(after.entries.some((entry) => entry.path === 'project/foreign.txt'));
      assert.ok(after.entries.some((entry) => entry.path === 'project/.specs/features/keep.md'));
      mutationContract(
        {
          allowRemoved: [
            'project/.agents/**',
            'project/.sdd-agentic-flow/**',
            'home/.sdd-agentic-flow/install.yml',
          ],
        },
        beforePlan,
        after,
      );
      expectSuccess(
        adapter.run(['install', '--scope', 'project', '--adoption-mode', 'team'], sandbox),
      );
      expectSuccess(adapter.run(['uninstall', '--yes', '--purge'], sandbox), /removed|preserved/i);
      const purged = observeSandbox(sandbox);
      assert.ok(purged.entries.some((entry) => entry.path === 'project/.specs/features/keep.md'));
      assert.equal(
        purged.entries.some((entry) => entry.path === 'project/.sdd-agentic-flow/config.yml'),
        false,
      );
    },
  };
}

function machineJsonScenario(): Scenario {
  return {
    id: 'C012',
    name: 'machine JSON remains parseable on invalid input',
    requirement: 'mandatory',
    async run(adapter, sandbox) {
      const result = adapter.run(['doctor', '--json', '--unknown'], sandbox);
      assert.equal(result.status, 1, `${result.stderr}\n${result.stdout}`);
      const report = JSON.parse(result.stdout) as { ok?: boolean };
      assert.equal(report.ok, false);
      assert.equal(result.stdout.includes(String.fromCharCode(27)), false);
    },
  };
}

function ptyScenario(): Scenario {
  const mandatory = process.platform === 'linux';
  return {
    id: 'C014',
    name: 'interactive setup is output-driven',
    requirement: mandatory ? 'mandatory' : 'optional',
    async run(adapter, sandbox) {
      if (!hasScriptPty()) throw new Error('script PTY wrapper unavailable');
      fs.mkdirSync(path.join(sandbox.home, '.codex'), { recursive: true });
      const result = await runScriptPty(adapter.ptyCommand(sandbox), {
        cwd: sandbox.cwd,
        env: { ...adapter.ptyEnvironment(sandbox), SDD_BRAND_ANIMATE: '0' },
        steps: [
          { waitFor: /Choose your language \/ Escolha o idioma/, input: '1' },
          { waitFor: /Sharing/, input: '1' },
          // Choose an initially unselected host: Codex is preselected by the
          // sandbox marker, while local PATH detection may preselect others.
          { waitFor: /Coding agents/, input: '4' },
          { waitFor: /Coding agents/, input: '\r' },
          { waitFor: /Workflow/, input: '\r' },
          { waitFor: /Ready to set up SAF/, input: '\r' },
          { waitFor: /Ready/, input: '' },
        ],
      });
      assert.equal(result.status, 0, `${result.stderr}\n${result.transcript}`);
      const transcript = stripAnsi(result.transcript);
      assert.match(transcript, /(?:PASS|[◇◆✓])\s+Ready(?:\r?\n|$)/);
      const languagePrompt = transcript.indexOf('Choose your language / Escolha o idioma');
      assert.ok(languagePrompt >= 0);
      const languagePrelude = transcript.slice(0, languagePrompt);
      assert.match(
        languagePrelude,
        /█{3,}\s+█{5,}\s+█{7,}|#{3,}\s+\+{5,}\s+={7,}|›\s+››\s+›››|>\s+>>\s+>>>/,
      );
      assert.match(transcript, /SDD-AGENTIC-FLOW \(SAF\)/);
      assert.ok((transcript.match(/SDD-AGENTIC-FLOW \(SAF\)/g) || []).length >= 1);
      assert.match(
        transcript,
        /Spec-Driven Agentic Workflow Harness|Harness de fluxo de trabalho/i,
      );
      assert.match(transcript, /Specs first\. Evidence before done|Specs primeiro/i);
      assert.match(transcript, /Welcome to SAF|Boas-vindas ao SAF/i);
      assert.match(
        transcript,
        /█{3,}\s+█{5,}\s+█{7,}|#{3,}\s+\+{5,}\s+={7,}|›\s+››\s+›››|>\s+>>\s+>>>/,
      );
      assert.equal((transcript.match(/Welcome to SAF|Boas-vindas ao SAF/gi) || []).length, 1);
      const welcomeStart = transcript.search(/Welcome to SAF|Boas-vindas ao SAF/i);
      assert.ok(welcomeStart >= 0 && languagePrompt > welcomeStart);
      assert.equal(
        result.transcript
          .slice(
            result.transcript.search(/Welcome to SAF|Boas-vindas ao SAF/i),
            result.transcript.search(/Choose your language|Escolha o idioma/i),
          )
          .includes('\x1b[H\x1b[2J'),
        false,
      );
      assert.doesNotMatch(
        result.transcript,
        /Feature profile|\[personal\/specs-shared\/team\]|\[y\/N\]|Running:/i,
      );
      const state = observeSandbox(sandbox);
      assert.ok(
        state.entries.some((entry) => entry.path === 'project/.sdd-agentic-flow/workspace.yml'),
      );
    },
  };
}

function installationPreservationScenario(): Scenario {
  return {
    id: 'C016',
    name: 'scope changes preserve unrelated user targets',
    requirement: 'mandatory',
    async run(adapter, sandbox) {
      expectSuccess(
        adapter.run(['install', '--target', 'claude'], sandbox),
        /installed|preserved/i,
      );
      expectSuccess(
        adapter.run(
          ['config', 'installation', '--yes', '--scope', 'project', '--adoption-mode', 'team'],
          sandbox,
        ),
        /saved|pass/i,
      );
      expectSuccess(
        adapter.run(['config', 'installation', '--yes', '--scope', 'user'], sandbox),
        /saved|pass/i,
      );
      const content = fs.readFileSync(
        path.join(sandbox.home, '.sdd-agentic-flow', 'install.yml'),
        'utf8',
      );
      assert.match(content, /- claude/);
    },
  };
}

function readySettingsScenario(): Scenario {
  return {
    id: 'C017',
    name: 'ready settings use one human shell without profile prompts',
    requirement: 'mandatory',
    async run(adapter, sandbox) {
      expectSuccess(adapter.run(['init'], sandbox));
      expectSuccess(
        adapter.run(['install', '--scope', 'project', '--adoption-mode', 'team'], sandbox),
      );
      const result = await runScriptPty(adapter.ptyCommand(sandbox), {
        cwd: sandbox.cwd,
        env: { ...adapter.ptyEnvironment(sandbox), SDD_BRAND_ANIMATE: '0' },
        steps: [
          {
            waitFor: /What would you like to do[\s\S]*1\.\s*Change settings/i,
            input: '1\n',
          },
          { waitFor: /1\.\s*Workflow/i, input: '1\n' },
          { waitFor: /1\.\s*Supervised/i, input: '1\n' },
          {
            waitFor: /Success: operation completed[\s\S]*What would you like to do/i,
            input: '1\n',
          },
          { waitFor: /Change settings[\s\S]*4\.\s*Back/i, input: '4\n' },
          { waitFor: /What would you like to do[\s\S]*5\.\s*Exit/i, input: '5\n' },
        ],
      });
      assert.equal(result.status, 0, `${result.stderr}\n${result.transcript}`);
      const transcript = stripAnsi(result.transcript);
      assert.match(transcript, /SDD-AGENTIC-FLOW \(SAF\)/);
      assert.match(transcript, /Welcome back|Bem-vindo de volta/i);
      assert.match(transcript, /SAF is ready|O SAF está pronto/i);
      assert.match(
        transcript,
        /█{3,}\s+█{5,}\s+█{7,}|#{3,}\s+\+{5,}\s+={7,}|›\s+››\s+›››|>\s+>>\s+>>>/,
      );
      assert.equal((transcript.match(/Welcome back|Bem-vindo de volta/gi) || []).length, 1);
      const welcomeStart = transcript.search(/Welcome back|Bem-vindo de volta/i);
      const menuStart = transcript.search(
        /What would you like to do|O que você gostaria de fazer/i,
      );
      assert.ok(welcomeStart >= 0 && menuStart > welcomeStart);
      assert.equal(
        result.transcript
          .slice(
            result.transcript.search(/Welcome back|Bem-vindo de volta/i),
            result.transcript.search(/What would you like to do|O que você gostaria de fazer/i),
          )
          .includes('\x1b[H\x1b[2J'),
        false,
      );
      assert.doesNotMatch(
        result.transcript,
        /Feature profile|medium_feature|personal\/specs-shared\/team|Running:/i,
      );
    },
  };
}

function userInstallThenWorkspaceScenario(): Scenario {
  const mandatory = process.platform === 'linux';
  return {
    id: 'C018',
    name: 'user installation works without Git and initializes a later Git workspace',
    requirement: mandatory ? 'mandatory' : 'optional',
    async run(adapter, sandbox) {
      if (!hasScriptPty()) throw new Error('script PTY wrapper unavailable');
      fs.rmSync(path.join(sandbox.cwd, '.git'), { recursive: true, force: true });
      expectSuccess(
        adapter.run(['install', '--scope', 'user', '--target', 'agents'], sandbox),
        /installed|preserved/i,
      );
      const intentPath = path.join(sandbox.home, '.sdd-agentic-flow', 'install.yml');
      assert.match(fs.readFileSync(intentPath, 'utf8'), /projects:\n/);
      const repository = path.join(sandbox.root, 'later-repository');
      fs.mkdirSync(repository, { recursive: true });
      execFileSync('git', ['init', '--quiet'], { cwd: repository });
      sandbox.cwd = repository;
      const result = await runScriptPty(adapter.ptyCommand(sandbox), {
        cwd: sandbox.cwd,
        env: { ...adapter.ptyEnvironment(sandbox), SDD_BRAND_ANIMATE: '0' },
        steps: [
          { waitFor: /Choose your language \/ Escolha o idioma/, input: '1\n' },
          { waitFor: /Sharing/, input: '1\n' },
          { waitFor: /Workflow/, input: '\r' },
          { waitFor: /Ready to set up SAF/, input: '\r' },
          { waitFor: /Ready/, input: '' },
        ],
      });
      assert.equal(result.status, 0, `${result.stderr}\n${result.transcript}`);
      assert.match(result.transcript, /Choose your language \/ Escolha o idioma/);
      assert.match(stripAnsi(result.transcript), /(?:PASS|[◇◆✓])\s+Ready(?:\r?\n|$)/);
      assert.ok(fs.existsSync(path.join(repository, '.sdd-agentic-flow', 'workspace.yml')));
      assert.ok(
        fs.existsSync(path.join(repository, '.sdd-agentic-flow', 'context', 'project-context.md')),
      );
      assert.equal(fs.existsSync(path.join(repository, '.agents', 'skills')), false);
      assert.match(fs.readFileSync(intentPath, 'utf8'), /adoption_mode: personal/);
    },
  };
}

const scenarios = [
  lifecycleScenario(),
  readOnlyScenario(),
  planScenario(),
  commandSurfaceScenario(),
  configurationScenario(),
  upgradeScenario(),
  recoveryScenario(),
  incompleteScenario(),
  collisionScenario(),
  targetScopeScenario(),
  preservationScenario(),
  machineJsonScenario(),
  ptyScenario(),
  cancellationScenario(),
  installationPreservationScenario(),
  readySettingsScenario(),
  userInstallThenWorkspaceScenario(),
];

async function runScenario(
  adapter: CliExecutionAdapter,
  scenario: Scenario,
): Promise<ScenarioResult> {
  const sandbox = createSandbox(`${profile}-${scenario.id}`);
  const started = Date.now();
  const initial = observeSandbox(sandbox);
  const input = ['C014', 'C015'].includes(scenario.id)
    ? 'output-driven PTY step sequence'
    : 'none (non-TTY)';
  const expected = scenario.name;
  const environment = `${process.platform} ${process.version}; adapter=${adapter.name}`;
  try {
    await scenario.run(adapter, sandbox);
    const final = observeSandbox(sandbox);
    return {
      id: scenario.id,
      name: scenario.name,
      command: `${adapter.name}:${scenario.name}`,
      outcome: 'PASS',
      coverage: 'COMPLETE',
      requirement: scenario.requirement,
      input,
      expected,
      environment,
      stateDelta: summarizeStateDelta(initial, final),
      note: 'observed expected behavior and sandbox invariants',
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const note = error instanceof Error ? error.message : String(error);
    const unavailable = /unavailable/i.test(note);
    const final = observeSandbox(sandbox);
    return {
      id: scenario.id,
      name: scenario.name,
      command: `${adapter.name}:${scenario.name}`,
      outcome: unavailable ? 'SKIPPED' : 'FAIL',
      coverage: unavailable ? 'UNAVAILABLE' : 'PARTIAL',
      requirement: scenario.requirement,
      input,
      expected,
      environment,
      stateDelta: summarizeStateDelta(initial, final),
      note: note.replace(/\s+/g, ' ').slice(0, 700),
      ...(unavailable ? { limitation: note } : {}),
      durationMs: Date.now() - started,
    };
  } finally {
    removeSandbox(sandbox);
  }
}

function reportPath(version: string): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  return (
    process.env.SAF_CLI_CERTIFICATION_REPORT ??
    path.join(
      repoRoot,
      `.local/gmm/sdd-agentic-flow/v${version}-cli-release-certification-audit-${stamp}.md`,
    )
  );
}

function writeReport(
  adapter: CliExecutionAdapter,
  results: ScenarioResult[],
  verdict: ReturnType<typeof decideCertification>,
  report: string,
): void {
  fs.mkdirSync(path.dirname(report), { recursive: true });
  const lines = [
    `# v${adapter.identity.version} CLI release certification audit`,
    '',
    `> **Verdict:** ${verdict.verdict}`,
    `> **Executed:** ${new Date().toISOString()}`,
    `> **Profile:** ${adapter.name}`,
    `> **Source commit:** ${adapter.identity.sourceCommit}`,
    `> **Source dirty:** ${adapter.identity.sourceDirty}`,
    `> **Tarball SHA-256:** ${adapter.identity.tarballSha256 ?? 'not applicable'}`,
    '',
    '## Scenario evidence',
    '',
    '| ID | Scenario | Requirement | Outcome | Coverage | Evidence |',
    '| --- | --- | --- | --- | --- | --- |',
    ...results.map(
      (item) =>
        `| ${item.id} | ${item.name} | ${item.requirement} | ${item.outcome} | ${item.coverage} | ${item.note.replace(/\|/g, '\\|')} (${item.durationMs} ms) |`,
    ),
    '',
    '## Findings',
    '',
    results.some((item) => item.outcome === 'FAIL')
      ? results
          .filter((item) => item.outcome === 'FAIL')
          .map(
            (item) =>
              `### ${item.id} — ${item.name}\n\n- **Severity:** High\n- **Classification:** observed behavioral failure; owner requires triage\n- **Exact command:** \`${item.command}\`\n- **Input:** ${item.input}\n- **Initial state:** isolated disposable project and HOME before the scenario\n- **Environment:** ${item.environment}\n- **Expected result:** ${item.expected}\n- **Observed result / exit, stdout, stderr evidence:** ${item.note}\n- **State delta:** ${item.stateDelta}\n- **Impact:** certification is blocked until the behavior is corrected or explicitly dispositioned\n- **Violated contract:** ${item.requirement} certification scenario and its applicable behavioral invariants\n- **Likely owner:** CLI implementation or certification harness, determined during triage\n- **Correction suggestion:** reproduce the command with the recorded evidence, identify whether the product or harness caused the failure, and fix the smallest owning boundary\n- **Regression-test recommendation:** retain or extend ${item.id} as a deterministic regression against both dist and packed adapters`,
          )
          .join('\n')
      : '- No unexpected scenario failures observed.',
    '',
    '## Interpretation',
    '',
    'The observer derives correctness from sandbox evidence. A non-PASS verdict blocks the release gate.',
    '',
  ];
  fs.writeFileSync(report, `${lines.join('\n')}\n`);
}

async function main(): Promise<number> {
  if (!['dist', 'packed'].includes(profile))
    throw new Error(`unknown certification profile: ${profile}`);
  const adapter =
    profile === 'packed' ? createPackedAdapter(repoRoot) : createDistAdapter(repoRoot);
  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) results.push(await runScenario(adapter, scenario));
  const evidence: ScenarioEvidence[] = results.map(
    ({ id: _id, name: _name, command: _command, durationMs: _durationMs, ...item }) => item,
  );
  for (const result of results.filter((item) => item.outcome !== 'PASS')) {
    console.error(`CLI certification scenario ${result.id} ${result.outcome}: ${result.note}`);
  }
  const verdict = decideCertification(evidence);
  const report = reportPath(adapter.identity.version);
  writeReport(adapter, results, verdict, report);
  console.log(`CLI certification ${adapter.name}: ${verdict.verdict}`);
  console.log(`Report: ${report}`);
  return verdict.exitCode;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
