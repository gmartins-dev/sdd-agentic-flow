import fs from 'node:fs';

const file = 'scripts/cli-certification.ts';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`certifier patch target not found: ${label}`);
  source = source.replace(from, to);
}

function replaceRegex(pattern, to, label) {
  if (!pattern.test(source)) throw new Error(`certifier patch target not found: ${label}`);
  source = source.replace(pattern, to);
}

replaceOnce(
`function mutationContract(
  contract: MutationContract,
  before: ReturnType<typeof observeSandbox>,
  after: ReturnType<typeof observeSandbox>,
) {`,
`function assertBareSetupPostconditions(
  adapter: CliExecutionAdapter,
  sandbox: ReturnType<typeof createSandbox>,
): void {
  const state = observeSandbox(sandbox);
  const requiredPaths = [
    'home/.agents/skills/saf-create-spec/SKILL.md',
    'home/.agents/skills/sdd-agentic-flow-shared/install-provenance.yml',
    'home/.sdd-agentic-flow/install.yml',
    'project/.sdd-agentic-flow/workspace.yml',
    'project/.sdd-agentic-flow/context/project-context.md',
  ];
  for (const required of requiredPaths)
    assert.ok(state.entries.some((entry) => entry.path === required), \`missing postcondition: \${required}\`);
  const intent = fs.readFileSync(path.join(sandbox.home, '.sdd-agentic-flow', 'install.yml'), 'utf8');
  assert.match(intent, /\\n    - agents\\n/);
  assert.match(intent, /adoption_mode: personal/);
  const doctor = adapter.run(['doctor', '--json'], sandbox);
  expectSuccess(doctor);
  const report = JSON.parse(doctor.stdout) as { data?: { status?: string } };
  assert.notEqual(report.data?.status, 'FAIL');
  const bare = adapter.run([], sandbox);
  expectSuccess(bare, /Ready|Current setup|Suggested next step/i);
}

function mutationContract(
  contract: MutationContract,
  before: ReturnType<typeof observeSandbox>,
  after: ReturnType<typeof observeSandbox>,
) {`,
  'postcondition helper',
);

replaceRegex(
/function ptyScenario\(\): Scenario \{[\s\S]*?\n}\n\nfunction installationPreservationScenario/,
`function ptyScenario(): Scenario {
  const mandatory = process.platform === 'linux';
  return {
    id: 'C014',
    name: 'bare Fresh setup applies reviewed choices and reaches observable Ready',
    requirement: mandatory ? 'mandatory' : 'optional',
    async run(adapter, sandbox) {
      if (!hasScriptPty()) throw new Error('script PTY wrapper unavailable');
      fs.mkdirSync(path.join(sandbox.home, '.codex'), { recursive: true });
      const result = await runScriptPty(adapter.ptyCommand(sandbox), {
        cwd: sandbox.cwd,
        env: { ...adapter.ptyEnvironment(sandbox), SDD_BRAND_ANIMATE: '0' },
        steps: [
          { waitFor: /Choose your language \\/ Escolha o idioma/, input: '1' },
          { waitFor: /What would you like to do/, input: '1' },
          { waitFor: /Sharing/, input: '1' },
          { waitFor: /Coding agents/, input: '\\r' },
          { waitFor: /Workflow/, input: '\\r' },
          { waitFor: /Apply this setup\\?/, input: '1' },
          { waitFor: /PASS Ready/, input: '' },
        ],
      });
      assert.equal(result.status, 0, \`\${result.stderr}\\n\${result.transcript}\`);
      assert.match(result.transcript, /PASS Ready/);
      assert.match(result.transcript, /Install and configure/);
      assert.doesNotMatch(result.transcript, /Ready to set up SAF[\\s\\S]*?> 1\\. Continue/);
      const languagePrompt = result.transcript.indexOf('Choose your language / Escolha o idioma');
      assert.ok(languagePrompt >= 0);
      const languagePrelude = result.transcript.slice(0, languagePrompt);
      assert.doesNotMatch(
        languagePrelude,
        /▓|#{2,}\\s+\\+{2,}|Spec-Driven Agentic Workflow Harness|Specs first/i,
      );
      assert.match(
        result.transcript,
        new RegExp(\`sdd-agentic-flow \${adapter.identity.version.replace(/\\./g, '\\\\.')}\`),
      );
      assert.match(result.transcript, /Spec-Driven Agentic Workflow Harness/);
      assert.match(result.transcript, /Specs first\\. Evidence before done/);
      assert.match(result.transcript, /Welcome to SAF/);
      assert.match(result.transcript, /▓|#{2,}/);
      assert.equal((result.transcript.match(/Welcome to SAF/gi) || []).length, 1);
      assertBareSetupPostconditions(adapter, sandbox);
    },
  };
}

function pendingIntentRecoveryScenario(): Scenario {
  const mandatory = process.platform === 'linux';
  return {
    id: 'C018',
    name: 'pending installation intent is recoverable through the bare shell',
    requirement: mandatory ? 'mandatory' : 'optional',
    async run(adapter, sandbox) {
      if (!hasScriptPty()) throw new Error('script PTY wrapper unavailable');
      fs.mkdirSync(path.join(sandbox.home, '.sdd-agentic-flow'), { recursive: true });
      fs.writeFileSync(
        path.join(sandbox.home, '.sdd-agentic-flow', 'install.yml'),
        'schema: saf-install-intent/v3\\nuser:\\n  targets:\\n    - agents\\nprojects:\\n',
        'utf8',
      );
      const result = await runScriptPty(adapter.ptyCommand(sandbox), {
        cwd: sandbox.cwd,
        env: { ...adapter.ptyEnvironment(sandbox), SDD_BRAND_ANIMATE: '0' },
        steps: [
          { waitFor: /Choose your language \\/ Escolha o idioma/, input: '1' },
          { waitFor: /What would you like to do/, input: '1' },
          { waitFor: /Sharing/, input: '1' },
          { waitFor: /Coding agents/, input: '\\r' },
          { waitFor: /Workflow/, input: '\\r' },
          { waitFor: /Apply this setup\\?/, input: '1' },
          { waitFor: /PASS Ready/, input: '' },
        ],
      });
      assert.equal(result.status, 0, \`\${result.stderr}\\n\${result.transcript}\`);
      assert.match(result.transcript, /SAF setup is incomplete/);
      assert.match(result.transcript, /Coding agents/);
      assert.doesNotMatch(result.transcript, /derived setup state: Fresh/i);
      assertBareSetupPostconditions(adapter, sandbox);
    },
  };
}

function blockedSetupReviewScenario(): Scenario {
  const mandatory = process.platform === 'linux';
  return {
    id: 'C019',
    name: 'blocked installation plan never offers Apply and preserves foreign content',
    requirement: mandatory ? 'mandatory' : 'optional',
    async run(adapter, sandbox) {
      if (!hasScriptPty()) throw new Error('script PTY wrapper unavailable');
      fs.mkdirSync(path.join(sandbox.home, '.codex'), { recursive: true });
      const foreign = path.join(sandbox.home, '.agents', 'skills', 'saf-create-spec', 'SKILL.md');
      fs.mkdirSync(path.dirname(foreign), { recursive: true });
      fs.writeFileSync(foreign, '# foreign\\n', 'utf8');
      const before = observeSandbox(sandbox);
      const result = await runScriptPty(adapter.ptyCommand(sandbox), {
        cwd: sandbox.cwd,
        env: { ...adapter.ptyEnvironment(sandbox), SDD_BRAND_ANIMATE: '0' },
        steps: [
          { waitFor: /Choose your language \\/ Escolha o idioma/, input: '1' },
          { waitFor: /What would you like to do/, input: '1' },
          { waitFor: /Sharing/, input: '1' },
          { waitFor: /Coding agents/, input: '\\r' },
          { waitFor: /Workflow/, input: '\\r' },
          { waitFor: /This setup cannot be applied yet\\./, input: '3' },
        ],
      });
      assert.equal(result.status, 0, \`\${result.stderr}\\n\${result.transcript}\`);
      assert.match(result.transcript, /Blocked:|unowned skill directories conflict with SAF/i);
      assert.doesNotMatch(result.transcript, /Install and configure/);
      expectUnchanged(before, observeSandbox(sandbox));
      assert.equal(fs.readFileSync(foreign, 'utf8'), '# foreign\\n');
    },
  };
}

function finalReviewCancellationScenario(): Scenario {
  const mandatory = process.platform === 'linux';
  return {
    id: 'C020',
    name: 'final reviewed setup cancellation preserves exact durable state',
    requirement: mandatory ? 'mandatory' : 'optional',
    async run(adapter, sandbox) {
      if (!hasScriptPty()) throw new Error('script PTY wrapper unavailable');
      fs.mkdirSync(path.join(sandbox.home, '.codex'), { recursive: true });
      const before = observeSandbox(sandbox);
      const result = await runScriptPty(adapter.ptyCommand(sandbox), {
        cwd: sandbox.cwd,
        env: { ...adapter.ptyEnvironment(sandbox), SDD_BRAND_ANIMATE: '0' },
        steps: [
          { waitFor: /Choose your language \\/ Escolha o idioma/, input: '1' },
          { waitFor: /What would you like to do/, input: '1' },
          { waitFor: /Sharing/, input: '1' },
          { waitFor: /Coding agents/, input: '\\r' },
          { waitFor: /Workflow/, input: '\\r' },
          { waitFor: /Apply this setup\\?/, input: '3' },
        ],
      });
      assert.equal(result.status, 0, \`\${result.stderr}\\n\${result.transcript}\`);
      assert.match(result.transcript, /Setup cancelled|Configuração cancelada/i);
      expectUnchanged(before, observeSandbox(sandbox));
    },
  };
}

function installationPreservationScenario`,
  'C014 and new regression scenarios',
);

replaceOnce(
`  installationPreservationScenario(),
  readySettingsScenario(),`,
`  installationPreservationScenario(),
  readySettingsScenario(),
  pendingIntentRecoveryScenario(),
  blockedSetupReviewScenario(),
  finalReviewCancellationScenario(),`,
  'scenario registration',
);
replaceOnce(
`  const input = ['C014', 'C015'].includes(scenario.id)`,
`  const input = ['C014', 'C015', 'C018', 'C019', 'C020'].includes(scenario.id)`,
  'PTY scenario metadata',
);

fs.writeFileSync(file, source, 'utf8');
console.log('PASS CLI certification audit regressions applied');
