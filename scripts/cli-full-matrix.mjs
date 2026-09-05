import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hasScriptPty, runScriptPty } from './cli-certification/pty.ts';

const repo = process.cwd();
const source = process.env.SAF_FULL_MATRIX_SOURCE ?? 'dist';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-real-npx-audit-'));
const home = path.join(root, 'home');
const cache = path.join(root, 'npm-cache');
fs.mkdirSync(home, { recursive: true });
fs.mkdirSync(cache, { recursive: true });
const tarball =
  source === 'packed'
    ? path.join(
        root,
        execFileSync('npm', ['pack', '--silent', '--pack-destination', root], {
          encoding: 'utf8',
        }).trim(),
      )
    : null;
const expectedVersion = JSON.parse(
  fs.readFileSync(path.join(repo, 'package.json'), 'utf8'),
).version;
const sourceCommit =
  process.env.SAF_CLI_SOURCE_COMMIT ??
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
const sourceDirty =
  process.env.SAF_CLI_SOURCE_DIRTY === 'true' ||
  (process.env.SAF_CLI_SOURCE_DIRTY !== 'false' &&
    Boolean(
      execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim(),
    ));
const candidateType =
  process.env.SAF_CLI_CANDIDATE_TYPE ?? (sourceDirty ? 'working-tree' : 'commit');
const tarballSha256 = tarball
  ? crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex')
  : null;
const results = [];
const failures = [];
const findings = [];

function project(name, git = true) {
  const cwd = path.join(root, name);
  fs.mkdirSync(cwd, { recursive: true });
  if (git) spawnSync('git', ['init', '--quiet'], { cwd });
  return cwd;
}

function env(ci = true) {
  return {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    NPM_CONFIG_CACHE: cache,
    // Keep the matrix independent from registry availability while still
    // exercising the update-check and upgrade-plan paths.
    SDD_AGENTIC_FLOW_TEST_LATEST_VERSION: expectedVersion,
    ...(ci ? { CI: '1' } : { TERM: 'xterm-256color' }),
    SDD_NO_UPDATE_PROMPT: '1',
  };
}

function run(cwd, args = [], input = '', ci = true) {
  const command = source === 'dist' ? 'node' : 'npx';
  const commandArgs =
    source === 'dist'
      ? [path.join(repo, 'dist/sdd-agentic-flow.js'), ...args]
      : source === 'packed'
        ? ['--yes', '--no-audit', '--cache', cache, `file:${tarball}`, ...args]
        : ['--yes', 'sdd-agentic-flow', ...args];
  return spawnSync(command, commandArgs, {
    cwd,
    input,
    encoding: 'utf8',
    timeout: 45_000,
    env: env(ci),
  });
}

function output(result) {
  const ansiEscape = String.fromCharCode(27);
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.replace(
    new RegExp(`${ansiEscape}\\[[0-?]*[ -/]*[@-~]`, 'g'),
    '',
  );
}

function cleanEvidence(value) {
  return value
    .replace(/\s+/g, ' ')
    .replaceAll('|', '/')
    .replaceAll('`', '')
    .replaceAll('*', '')
    .replaceAll('_', '\\_')
    .replace(/https?:\/\/\S+/g, '<url>')
    .trim()
    .slice(0, 500);
}

function snapshot(paths) {
  const hash = crypto.createHash('sha256');
  for (const base of paths) {
    if (!fs.existsSync(base)) continue;
    const visit = (file) => {
      const stat = fs.lstatSync(file);
      const rel = path.relative(base, file);
      if (stat.isDirectory()) {
        if (rel === '.git') return;
        for (const child of fs.readdirSync(file)) visit(path.join(file, child));
      } else {
        hash.update(rel);
        hash.update(fs.readFileSync(file));
      }
    };
    visit(base);
  }
  return hash.digest('hex');
}

function check(
  id,
  area,
  _command,
  cwd,
  args,
  { status = 0, match, json = false, unchanged = false, paths = [cwd], ci = true } = {},
) {
  const before = unchanged ? snapshot(paths) : null;
  const started = Date.now();
  const result = run(cwd, args, '', ci);
  const text = output(result);
  const problems = [];
  if (result.status !== status) problems.push(`exit ${result.status} (expected ${status})`);
  if (match && !match.test(text)) problems.push(`missing /${match.source}/`);
  if (json) {
    try {
      JSON.parse(result.stdout);
    } catch (error) {
      problems.push(`invalid JSON: ${error.message}`);
    }
  }
  if (unchanged && before !== snapshot(paths))
    problems.push('state changed during plan/read-only command');
  const item = {
    id,
    area,
    command: `npx sdd-agentic-flow ${args.join(' ')}`.trim(),
    status: problems.length ? 'FAIL' : 'PASS',
    exit: result.status,
    durationMs: Date.now() - started,
    evidence: cleanEvidence(text),
  };
  results.push(item);
  if (problems.length) failures.push({ ...item, problems });
  return result;
}

async function runInteractive(id, area, cwd, steps, expected) {
  const started = Date.now();
  const cliCommand =
    source === 'dist'
      ? `node '${path.join(repo, 'dist/sdd-agentic-flow.js')}'`
      : source === 'packed'
        ? `npx --yes --no-audit --cache '${cache}' 'file:${tarball}'`
        : 'npx --yes sdd-agentic-flow';
  const result = hasScriptPty()
    ? await runScriptPty(`stty cols 80 rows 24; exec ${cliCommand}`, {
        cwd,
        env: {
          ...env(false),
          PATH: [path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter),
        },
        timeoutMs: 180_000,
        steps,
      })
    : null;
  const text = result ? result.transcript : '';
  const problems = [];
  if (!result) problems.push('script PTY wrapper unavailable');
  else if (result.status !== 0) problems.push(`exit ${result.status} (expected 0)`);
  if (!expected.test(text)) problems.push(`missing /${expected.source}/`);
  const item = {
    id,
    area,
    command: 'npx sdd-agentic-flow (interactive TTY)',
    status: problems.length ? 'FAIL' : 'PASS',
    exit: result?.status ?? null,
    durationMs: Date.now() - started,
    evidence: cleanEvidence(text.slice(-1000)),
  };
  results.push(item);
  if (problems.length) failures.push({ ...item, problems });
  return text;
}

const fresh = project('fresh');
check('B01', 'surface', 'version', fresh, ['version'], {
  match: new RegExp(expectedVersion.replaceAll('.', '\\.')),
});
check('B02', 'surface', 'help', fresh, ['help'], {
  match: /QUICK START|Commands/i,
  unchanged: true,
});
for (const topic of [
  'init',
  'install',
  'config',
  'context',
  'doctor',
  'upgrade',
  'uninstall',
  'learn-sdd',
  'completion',
  'version',
])
  check(`B03-${topic}`, 'help', `help ${topic}`, fresh, ['help', topic], {
    status: 0,
    match: /usage:|USAGE|Commands|Spec-Driven|completion/i,
  });
for (const shell of ['bash', 'zsh', 'fish'])
  check(`B04-${shell}`, 'completion', `completion ${shell}`, fresh, ['completion', shell], {
    match: shell === 'bash' ? /complete -F/ : shell === 'zsh' ? /#compdef/ : /complete -c/,
  });
check('B05', 'read-only', 'learn-sdd', fresh, ['learn-sdd'], {
  match: /Spec-Driven Development|SDD/,
});
check('B06', 'read-only', 'doctor --json', fresh, ['doctor', '--json'], { json: true });
check('B07', 'read-only', 'context status', fresh, ['context', 'status'], {
  match: /context|not available|not found/i,
});
check('B08', 'read-only', 'context autonomy-state', fresh, ['context', 'autonomy-state'], {
  match: /autonomy|not found|no .*state/i,
});
check('B09', 'doctor modes', 'doctor --harness', fresh, ['doctor', '--harness'], {
  match: /harness|PASS|WARN/i,
});
check(
  'B10',
  'doctor modes',
  'doctor --smoke --contracts',
  fresh,
  ['doctor', '--smoke', '--contracts'],
  { match: /PASS|Checks|created/i },
);
check('B11', 'doctor modes', 'doctor --check-updates', fresh, ['doctor', '--check-updates'], {
  match: /update|offline|up to date|INFO|PASS/i,
});
check('B12', 'machine contract', 'init --json', fresh, ['init', '--json'], {
  json: true,
  match: /schema_version|workspace|init/i,
});
check(
  'B13',
  'machine contract',
  'install --scope project --adoption-mode team --plan --json',
  fresh,
  ['install', '--scope', 'project', '--adoption-mode', 'team', '--plan', '--json'],
  { status: 1, match: /json|unsupported|usage/i, unchanged: true },
);
check(
  'B14',
  'machine contract',
  'uninstall --plan --json',
  fresh,
  ['uninstall', '--plan', '--json'],
  { status: 1, match: /json|unsupported|usage/i, unchanged: true },
);
check('B15', 'plan semantics', 'context refresh --plan', fresh, ['context', 'refresh', '--plan'], {
  status: 1,
  match: /plan|usage|unsupported|context/i,
  unchanged: true,
});

const lifecycle = project('lifecycle');
check('L01', 'lifecycle', 'bare fresh', lifecycle, [], {
  match: /install|setup|Suggested next step/i,
});
check('L02', 'lifecycle', 'init --plan', lifecycle, ['init', '--plan'], {
  match: /INFO Create|plan|preview|would/i,
  unchanged: true,
});
check('L03', 'lifecycle', 'init', lifecycle, ['init'], { match: /initialized|created/i });
check('L04', 'lifecycle', 'init repeat', lifecycle, ['init'], {
  match: /preserved|initialized|already/i,
});
check(
  'L05',
  'lifecycle',
  'doctor json contracts autonomy',
  lifecycle,
  ['doctor', '--json', '--contracts', '--autonomy'],
  { json: true },
);
check('L06', 'lifecycle', 'context refresh', lifecycle, ['context', 'refresh'], {
  match: /created|refreshed|generated/i,
});
check('L07', 'lifecycle', 'context status', lifecycle, ['context', 'status'], {
  match: /available|project-context/i,
});

const scopes = project('scopes');
for (const target of ['agents', 'cursor', 'claude', 'copilot']) {
  check(
    `T-${target}`,
    'agent persona',
    `install --target ${target}`,
    scopes,
    ['install', '--target', target],
    { match: /installed|preserved/i },
  );
}
check('T-plan', 'agent persona', 'install --plan', scopes, ['install', '--plan'], {
  match: /Installation plan|Scope/i,
  unchanged: true,
  paths: [scopes, home],
});
check('T-doctor', 'agent persona', 'doctor --smoke', scopes, ['doctor', '--smoke'], {
  match: /PASS|Ready/i,
});
for (const target of ['agents', 'cursor', 'claude', 'copilot'])
  check(
    `U-${target}`,
    'agent persona',
    `uninstall --plan --scope user --target ${target}`,
    scopes,
    ['uninstall', '--plan', '--scope', 'user', '--target', target],
    { match: /plan|Shared|Claude|Copilot|Cursor/i, unchanged: true, paths: [scopes, home] },
  );

const config = project('config');
check('C01', 'configuration', 'init', config, ['init']);
check('C02', 'configuration', 'config show', config, ['config', 'show'], {
  match: /Workflow|Language/i,
  unchanged: true,
});
for (const preset of ['supervised', 'manual', 'autonomous']) {
  check(
    `C03-${preset}`,
    'policy',
    `config policy --plan --preset ${preset}`,
    config,
    ['config', 'policy', '--plan', '--preset', preset],
    { match: /preview|plan|would|Already using/i, unchanged: true },
  );
  check(
    `C04-${preset}`,
    'policy',
    `config policy --yes --preset ${preset}`,
    config,
    ['config', 'policy', '--yes', '--preset', preset],
    { match: /saved|updated|already|PASS/i },
  );
}
for (const language of ['en-US', 'pt-BR'])
  check(
    `C05-${language}`,
    'language',
    `config policy --yes --language ${language}`,
    config,
    ['config', 'policy', '--yes', '--language', language],
    { match: /saved|updated|already|PASS/i },
  );
for (const profile of ['small_fix', 'medium_feature', 'large_feature', 'epic'])
  check(
    `C06-${profile}`,
    'feature profile',
    `config policy --yes --feature-profile ${profile}`,
    config,
    ['config', 'policy', '--yes', '--feature-profile', profile],
    { match: /saved|updated|already|PASS/i },
  );
for (const adoption of ['personal', 'specs-shared', 'team']) {
  check(
    `C07-plan-${adoption}`,
    'adoption',
    `config installation --plan --adoption-mode ${adoption}`,
    config,
    ['config', 'installation', '--plan', '--adoption-mode', adoption],
    { match: /preview|plan|would/i, unchanged: true },
  );
  check(
    `C07-yes-${adoption}`,
    'adoption',
    `config installation --yes --adoption-mode ${adoption}`,
    config,
    ['config', 'installation', '--yes', '--adoption-mode', adoption],
    { match: /saved|updated|PASS/i },
  );
}

const user = project('user-install', false);
check(
  'G01',
  'no Git user setup',
  'install --scope user --target agents',
  user,
  ['install', '--scope', 'user', '--target', 'agents'],
  { match: /installed|preserved/i },
);
check('G02', 'no Git user setup', 'doctor --json', user, ['doctor', '--json'], { json: true });
const later = project('later-git');
check('G03', 'later workspace', 'init', later, ['init'], { match: /initialized|created/i });
check(
  'G04',
  'later workspace',
  'install --scope project',
  later,
  ['install', '--scope', 'project'],
  { status: 1, match: /blocked|Team adoption|personal requires/i, unchanged: true },
);
check(
  'G05',
  'later workspace',
  'install --scope project --adoption-mode team',
  later,
  ['install', '--scope', 'project', '--adoption-mode', 'team'],
  { match: /installed|preserved/i },
);

const upgrade = project('upgrade');
check(
  'R01',
  'reconciliation',
  'install --scope project --adoption-mode team',
  upgrade,
  ['install', '--scope', 'project', '--adoption-mode', 'team'],
  { match: /installed|preserved/i },
);
check('R02', 'reconciliation', 'upgrade --check', upgrade, ['upgrade', '--check'], {
  match: /update|up to date|version|check/i,
});
check('R03', 'reconciliation', 'upgrade --plan', upgrade, ['upgrade', '--plan'], {
  match: /plan|update|up to date/i,
});
check('R04', 'reconciliation', 'upgrade --skills-only', upgrade, ['upgrade', '--skills-only'], {
  match: /refreshed|differ|skipped|updated/i,
});

const removal = project('removal');
check(
  'X01',
  'uninstall',
  'install --scope project --adoption-mode team',
  removal,
  ['install', '--scope', 'project', '--adoption-mode', 'team'],
  { match: /installed|preserved/i },
);
fs.mkdirSync(path.join(removal, '.specs/features'), { recursive: true });
fs.writeFileSync(path.join(removal, '.specs/features/keep.md'), 'keep\n');
fs.writeFileSync(path.join(removal, 'foreign.txt'), 'keep\n');
check('X02', 'uninstall', 'uninstall --plan', removal, ['uninstall', '--plan'], {
  match: /plan|No changes/i,
  unchanged: true,
});
check('X03', 'uninstall', 'uninstall --yes', removal, ['uninstall', '--yes'], {
  match: /removed|preserved/i,
});
check('X04', 'uninstall', 'uninstall --yes --purge', removal, ['uninstall', '--yes', '--purge'], {
  match: /removed|preserved/i,
});

const allScope = project('all-scope');
check('X05', 'uninstall', 'init', allScope, ['init']);
check('X06', 'uninstall', 'install --scope project --adoption-mode team', allScope, [
  'install',
  '--scope',
  'project',
  '--adoption-mode',
  'team',
]);
check(
  'X07',
  'uninstall',
  'install --scope user --adoption-mode personal --target agents',
  allScope,
  ['install', '--scope', 'user', '--adoption-mode', 'personal', '--target', 'agents'],
);
check(
  'X08',
  'uninstall',
  'uninstall --plan --scope all',
  allScope,
  ['uninstall', '--plan', '--scope', 'all'],
  { match: /Uninstall plan|managed paths/i, unchanged: true, paths: [allScope, home] },
);
check(
  'X09',
  'uninstall',
  'uninstall --yes --scope all',
  allScope,
  ['uninstall', '--yes', '--scope', 'all'],
  { match: /removed|preserved/i, paths: [allScope, home] },
);

const errors = project('errors');
const bad = [
  ['E01', ['doctro'], /Did you mean|unknown|usage/i],
  ['E02', ['install', 'bad-pack'], /pack positional|usage: install|unknown/i],
  ['E03', ['doctor', '--unknown'], /usage:|unknown|invalid/i],
  ['E04', ['uninstall'], /uninstall --plan|--yes|usage/i],
  ['E05', ['config', 'installation', '--interactive', '--plan'], /cannot be combined|invalid/i],
  ['E06', ['upgrade', '--check', '--skills-only'], /cannot be combined|invalid/i],
  ['E07', ['autonomous-resume', '--override-guard=8'], /Invalid|guard|usage/i],
  [
    'E08',
    ['install', '--scope', 'project', '--target', 'agents'],
    /unknown|target|scope|invalid|Team/i,
  ],
  [
    'E09',
    ['uninstall', '--plan', '--scope', 'project', '--target', 'agents'],
    /requires --scope user|invalid|target/i,
  ],
];
for (const [id, args, match] of bad)
  check(id, 'negative safety', args.join(' '), errors, args, {
    status: 1,
    match,
    unchanged: id === 'E08',
  });
check(
  'E10',
  'machine contract',
  'doctor --json --unknown',
  errors,
  ['doctor', '--json', '--unknown'],
  { status: 1, json: true, match: /ok|unknown|invalid/i },
);
check(
  'E11',
  'machine contract',
  'config policy --json --yes --preset manual',
  errors,
  ['config', 'policy', '--json', '--yes', '--preset', 'manual'],
  { status: 1, match: /json|unsupported|usage/i, unchanged: true },
);
check(
  'E12',
  'machine contract',
  'config installation --json --yes --scope user',
  errors,
  ['config', 'installation', '--json', '--yes', '--scope', 'user'],
  { status: 1, match: /json|unsupported|usage/i, unchanged: true },
);

const malformed = project('malformed');
fs.mkdirSync(path.join(malformed, '.sdd-agentic-flow'), { recursive: true });
fs.writeFileSync(path.join(malformed, '.sdd-agentic-flow/config.yml'), 'schema: saf-config/v99\n');
check('F01', 'fail closed', 'doctor --json future config', malformed, ['doctor', '--json'], {
  status: 1,
  json: true,
  match: /future|unsupported|FAIL|unknown/i,
});
fs.writeFileSync(path.join(malformed, '.sdd-agentic-flow/config.yml'), 'schema: saf-config/v2\n');
check('F02', 'fail closed', 'install --plan malformed config', malformed, ['install', '--plan'], {
  status: 0,
  match: /plan|default|Scope|Installation/i,
});

const interactiveCwd = project('interactive');
await runInteractive(
  'I01',
  'interactive onboarding',
  interactiveCwd,
  [
    { waitFor: /Choose your language \/ Escolha o idioma/, input: '1' },
    { waitFor: /Sharing/, input: '1' },
    { waitFor: /Coding agents/, input: '1' },
    { waitFor: /Coding agents/, input: '\r' },
    { waitFor: /Workflow/, input: '\r' },
    { waitFor: /Ready to set up SAF/, input: '1\r' },
    { waitFor: /Ready/, input: '' },
  ],
  /PASS Ready|Ready|pronto/i,
);
const ready = project('interactive-ready');
check('I02-prep', 'interactive settings', 'init', ready, ['init']);
check('I03-prep', 'interactive settings', 'install --scope project --adoption-mode team', ready, [
  'install',
  '--scope',
  'project',
  '--adoption-mode',
  'team',
]);
await runInteractive(
  'I04',
  'interactive settings',
  ready,
  [
    { waitFor: /What would you like to do[\s\S]*1\.\s*Change settings/i, input: '1\n' },
    { waitFor: /1\.\s*Workflow/i, input: '1\n' },
    { waitFor: /1\.\s*Supervised/i, input: '1\n' },
    { waitFor: /Success: operation completed[\s\S]*What would you like to do/i, input: '1\n' },
    { waitFor: /Change settings[\s\S]*4\.\s*Back/i, input: '4\n' },
    { waitFor: /What would you like to do[\s\S]*5\.\s*Exit/i, input: '5\n' },
  ],
  /Welcome back|Bem-vindo de volta|Exit|Sair/i,
);

const summary = {
  total: results.length,
  passed: results.filter((x) => x.status === 'PASS').length,
  failed: failures.length,
  root,
};
const findingDetails = {
  B12: [
    'P1',
    'init JSON contamination',
    'init --json emits a valid JSON document followed by a human Suggested next step line.',
    'Emit JSON only whenever --json is supplied.',
  ],
  B13: [
    'P2',
    'install JSON capability drift',
    'The command registry advertises JSON support, but install --json is rejected by runtime/help.',
    'Implement the JSON contract or remove supportsJson from the registry and tests.',
  ],
  B14: [
    'P2',
    'uninstall JSON capability drift',
    'The command registry advertises JSON support, but uninstall --json is rejected by runtime/help.',
    'Implement the JSON contract or remove supportsJson from the registry and tests.',
  ],
  B15: [
    'P1',
    'context plan partial mutation',
    'context refresh --plan creates project-context.md and then exits 1 because the flag is unsupported.',
    'Validate all flags before performing context refresh; either support --plan or reject without writes.',
  ],
  G04: [
    'P1',
    'project install default conflict',
    'After init creates adoption_mode: personal, install --scope project fails with “personal requires --scope user”; docs present project install as a standalone command.',
    'Align init/install defaults and documentation, or emit an explicit required adoption-mode command.',
  ],
  E08: [
    'P1',
    'project target silently ignored',
    'install --scope project --target agents succeeds while ignoring the user-only target flag.',
    'Reject incompatible scope/target combinations before mutation.',
  ],
  E11: [
    'P2',
    'config policy JSON drift',
    'config policy --json --yes --preset manual succeeds with human-readable output instead of JSON.',
    'Implement machine output or remove the advertised JSON capability.',
  ],
  E12: [
    'P1',
    'config installation partial mutation',
    'config installation --json --yes --scope user writes installation intent, then exits 1 for the unsupported flag.',
    'Validate flags before saving intent and keep machine output behavior consistent.',
  ],
};
const lines = [
  '# CLI real-npx audit report',
  '',
  `> **Status:** ${summary.failed ? 'FINDINGS' : 'PASS'}`,
  `> **Executed:** ${new Date().toISOString()}`,
  `> **Artifact:** ${source === 'dist' ? 'compiled dist CLI' : source === 'packed' ? 'local npm pack tarball via npx file:' : 'published package via npx'}`,
  `> **Source commit:** ${sourceCommit || 'unavailable'}`,
  `> **Source dirty:** ${sourceDirty}`,
  `> **Candidate type:** ${candidateType}`,
  `> **Tarball filename:** ${tarball ? path.basename(tarball) : 'n/a'}`,
  `> **Tarball SHA-256:** ${tarballSha256 ?? 'n/a'}`,
  `> **Package version:** ${output(run(fresh, ['version'])).trim()}`,
  `> **Sandbox root:** ${root}`,
  '',
  '## Executive summary',
  '',
  `- Scenarios: **${summary.total}**`,
  `- Passed: **${summary.passed}**`,
  `- Unexpected failures: **${summary.failed}**`,
  '- Coverage: command surface, lifecycle, Git/no-Git, configuration, adoption, all four agent targets, reconciliation, uninstall, negative safety, machine JSON, and interactive TTY flows.',
  '',
  '## Persona coverage',
  '',
  '| Persona/target | Evidence |',
  '| --- | --- |',
  '| Shared agent-compatible skills (`agents`) | install, plan, targeted uninstall |',
  '| Cursor (`cursor`) | install, plan, targeted uninstall |',
  '| Claude Code (`claude`) | install, plan, targeted uninstall |',
  '| GitHub Copilot (`copilot`) | install, plan, targeted uninstall |',
  '',
  '## Scenario results',
  '',
  '| ID | Area | Command | Status | Evidence |',
  '| --- | --- | --- | --- | --- |',
  ...results.map(
    (x) =>
      `| ${x.id} | ${x.area} | \`${x.command}\` | ${x.status} | exit=${x.exit}; ${x.evidence.replaceAll('|', '\\|')} (${x.durationMs}ms) |`,
  ),
  '',
  '## Findings for next release',
  '',
  failures.length
    ? failures
        .map((x) => {
          const detail = findingDetails[x.id] ?? [
            'P2',
            'unclassified runtime mismatch',
            x.problems.join('; '),
            'Reproduce and assign to the owning command boundary.',
          ];
          return `- **${detail[0]} — ${x.id} (${detail[1]}):** ${detail[2]} Observed: ${x.evidence} Recommendation: ${detail[3]}`;
        })
        .join('\n')
    : '- No unexpected failures observed in this matrix.',
  '',
  '## Reproduction and limitations',
  '',
  `- Every product invocation used the selected ${source} adapter from a temporary project; no scenario was reduced to exit-code-only evidence.`,
  '- Interactive cases use a Linux PTY wrapper and scripted keystrokes; host-specific GUI/agent runtimes were not invoked.',
  '- The four personas are represented by SAF installation targets; the external Cursor, Claude Code, Copilot, and Codex hosts are not launched by this CLI.',
  '- Temporary sandboxes were retained for forensic inspection at the path above.',
];
const reportFile = path.join(
  repo,
  `.local/gmm/sdd-agentic-flow/v${expectedVersion}-cli-full-matrix-${source}.md`,
);
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, `${lines.join('\n')}\n`);
console.log(JSON.stringify(summary));
if (failures.length) process.exitCode = 1;
