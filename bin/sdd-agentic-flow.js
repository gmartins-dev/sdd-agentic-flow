#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline/promises');

const VERSION = '0.3.0';
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PRESETS_DIR = path.join(PACKAGE_ROOT, 'presets');
const LANGUAGE_PROFILES = ['en-US', 'pt-BR'];
const OFFICIAL_SKILLS = [
  'setup-sdd-agentic-flow',
  'sdd-create-specs',
  'sdd-create-prompts',
  'sdd-implement-task',
  'sdd-implement-multi',
  'sdd-task-check',
  'sdd-create-pr',
  'sdd-pr-review',
  'sdd-pr-fix',
  'sdd-validation',
];
const PRIVATE_PATTERNS = [
  'QmVyZXNoaXQ=',
  'QmFtYXE=',
  'TU1CUQ==',
  'Z3VpbGhlcm1lLm1pcmFuZGE=',
  'd29ya3NwYWNlL2Rldi9sb2NhbA==',
  'LmxvY2FsL2JlcmVzaGl0',
  'Zm9ybWFsaXphdGlvbg==',
  'Y3JlZGl0LXNpbXVsYXRpb24=',
  'Y3JlZGl0LWZvcm1hbGl6YXRpb24=',
  'U2FsZXNmb3JjZQ==',
  'Q0FG',
].map((value) => Buffer.from(value, 'base64').toString('utf8'));

function configFor(options = {}) {
  const profile = options.profile || options.language || 'en-US';
  return `version: 1

project:
  name: ${options.name || 'example-project'}
  default_branch: ${options.branch || 'main'}

agent:
  target: ${options.agent || 'generic'}

language:
  profile: ${profile}
  human_outputs: ${profile}
  technical_tokens: canonical
  bilingual_mode: technical-canonical

specs:
  root: .specs/features
  files:
    - context.md
    - spec.md
    - design.md
    - tasks.md

source:
  type: ${options.source || 'local-files'}
  snapshots_dir: .sdd/snapshots

workflow:
  default_flow: ${options.flow || 'single'}
  allow_multi_worktree: ${options.multiWorktree || false}
  allow_stacked_prs: ${options.stackedPrs || false}
  commit_policy: manual

quality:
  tlc_baseline_required: true
  require_tdd: true
  require_independent_check: true
  require_evidence_before_completion: true

safety:
  no_commit_by_default: true
  no_push_by_default: true
  no_merge_or_deploy: true
`;
}

function configValue(content, key) {
  const match = content.match(new RegExp(`^\\s+${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
}

function languageProfilePath(cwd, profile, isPackage) {
  return isPackage
    ? path.join(PACKAGE_ROOT, 'shared', 'language-profiles', `${profile}.md`)
    : path.join(
        cwd,
        '.agents',
        'skills',
        'sdd-agentic-flow-shared',
        'language-profiles',
        `${profile}.md`,
      );
}

function languageReport(cwd) {
  const configPath = path.join(cwd, '.sdd', 'config.yml');
  const isPackage = (() => {
    try {
      return (
        JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).name ===
        'sdd-agentic-flow'
      );
    } catch {
      return false;
    }
  })();
  const content = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf8')
    : isPackage
      ? configFor()
      : null;
  if (!content) {
    return {
      status: 'WARN',
      profile: null,
      human_outputs: null,
      technical_tokens: null,
      bilingual_mode: null,
      message: 'language profile is not configured',
    };
  }
  const profile = configValue(content, 'profile');
  const humanOutputs = configValue(content, 'human_outputs');
  const technicalTokens = configValue(content, 'technical_tokens');
  const bilingualMode = configValue(content, 'bilingual_mode');
  if (!profile) {
    return {
      status: 'WARN',
      profile: null,
      human_outputs: humanOutputs,
      technical_tokens: technicalTokens,
      bilingual_mode: bilingualMode,
      message: 'language.profile is missing; using legacy language settings',
    };
  }
  const valid =
    LANGUAGE_PROFILES.includes(profile) &&
    humanOutputs === profile &&
    technicalTokens === 'canonical' &&
    bilingualMode === 'technical-canonical';
  const profileFile = languageProfilePath(cwd, profile, isPackage);
  const installed = fs.existsSync(profileFile);
  const status = valid && installed ? 'PASS' : valid ? 'WARN' : 'FAIL';
  return {
    status,
    profile,
    human_outputs: humanOutputs,
    technical_tokens: technicalTokens,
    bilingual_mode: bilingualMode,
    message: !valid
      ? 'language profile values are invalid'
      : installed
        ? 'language profile is valid'
        : 'language profile is configured but not installed',
  };
}

function log(status, message) {
  process.stdout.write(`${status} ${message}\n`);
}

function fail(message, code = 1) {
  process.stderr.write(`FAIL ${message}\n`);
  process.exitCode = code;
}

function readPreset(name) {
  const filename = path.join(PRESETS_DIR, `${name}.json`);
  if (!fs.existsSync(filename)) return null;
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function list() {
  const presets = fs
    .readdirSync(PRESETS_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort();
  for (const file of presets) {
    const preset = JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, file), 'utf8'));
    log(
      'PACK',
      `${preset.name} (${preset.status}) — ${preset.skills.join(', ') || 'shared guidance only'}`,
    );
  }
}

function init(cwd, options = {}) {
  const configPath = path.join(cwd, '.sdd', 'config.yml');
  if (fs.existsSync(configPath)) {
    log('WARN', 'preserved existing .sdd/config.yml');
    return false;
  }
  for (const relative of ['.sdd/snapshots', '.sdd/reports', '.specs/features']) {
    fs.mkdirSync(path.join(cwd, relative), { recursive: true });
  }
  fs.writeFileSync(configPath, configFor(options), 'utf8');
  log('PASS', 'created .sdd/config.yml');
  log('PASS', 'initialized local SDD directories');
  return true;
}

function validValue(value, allowed) {
  return allowed.includes(value) ? value : null;
}

async function initInteractive(cwd, languageDefault = 'en-US') {
  if (fs.existsSync(path.join(cwd, '.sdd', 'config.yml'))) {
    log('WARN', '.sdd/config.yml already exists; interactive init will not overwrite it');
    return;
  }
  const pipedAnswers = process.stdin.isTTY ? null : fs.readFileSync(0, 'utf8').split(/\r?\n/);
  let answerIndex = 0;
  const rl = pipedAnswers
    ? null
    : readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (label, fallback, allowed) => {
    const prompt = `${label} [${fallback}]: `;
    let raw;
    if (pipedAnswers) {
      process.stdout.write(prompt);
      raw = pipedAnswers[answerIndex++];
    } else {
      raw = await rl.question(prompt);
    }
    const answer = (raw || '').trim() || fallback;
    if (allowed && !validValue(answer, allowed))
      throw new Error(`${label} must be one of: ${allowed.join(', ')}`);
    if (!allowed) {
      const valid =
        label === 'Default branch'
          ? /^[A-Za-z0-9][A-Za-z0-9._/-]*$/
          : /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/;
      if (!valid.test(answer)) throw new Error(`${label} contains unsupported characters`);
    }
    return answer;
  };
  try {
    const options = {
      name: await ask('Project name', 'example-project'),
      branch: await ask('Default branch', 'main'),
      agent: await ask('Agent target', 'generic', ['generic', 'codex', 'cursor', 'claude-code']),
      language: await ask('Human output language', languageDefault, LANGUAGE_PROFILES),
      source: await ask('Source type', 'local-files', ['local-files', 'github-guidance']),
      flow: await ask('Default flow', 'single', ['single', 'multi']),
      multiWorktree: (await ask('Allow multi-worktree', 'false', ['true', 'false'])) === 'true',
      stackedPrs: (await ask('Allow stacked PRs', 'false', ['true', 'false'])) === 'true',
    };
    init(cwd, options);
  } finally {
    if (rl) rl.close();
  }
}

function copyIfMissing(source, destination, summary) {
  if (fs.existsSync(destination)) {
    summary.preserved += 1;
    return;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  summary.installed += 1;
}

function copyTree(source, destination, summary) {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyTree(from, to, summary);
    else copyIfMissing(from, to, summary);
  }
}

function install(pack, cwd) {
  const preset = readPreset(pack);
  if (!preset) return fail(`unknown pack: ${pack}. Run \`sdd-agentic-flow list\`.`);
  const target = path.join(cwd, '.agents', 'skills');
  const summary = { installed: 0, preserved: 0 };
  for (const skill of preset.skills)
    copyTree(path.join(PACKAGE_ROOT, 'skills', skill), path.join(target, skill), summary);
  if (preset.shared)
    copyTree(
      path.join(PACKAGE_ROOT, 'shared'),
      path.join(target, 'sdd-agentic-flow-shared'),
      summary,
    );
  if (preset.adapter)
    copyIfMissing(
      path.join(PACKAGE_ROOT, 'docs', 'adapters.md'),
      path.join(target, 'sdd-agentic-flow-shared', 'docs', 'adapters.md'),
      summary,
    );
  log('PASS', `installed ${pack}: ${summary.installed} files`);
  if (summary.preserved) log('WARN', `preserved ${summary.preserved} existing files`);
}

function hasCoreSkills(cwd) {
  return [
    'setup-sdd-agentic-flow',
    'sdd-create-specs',
    'sdd-implement-task',
    'sdd-task-check',
    'sdd-validation',
  ].every((skill) => fs.existsSync(path.join(cwd, '.agents', 'skills', skill, 'SKILL.md')));
}

function filesIn(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(target) : [target];
  });
}

function hasPrivateContext(paths) {
  return paths.flatMap(filesIn).some((file) => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      return PRIVATE_PATTERNS.some((pattern) => content.includes(pattern));
    } catch {
      return false;
    }
  });
}

function severity(checks) {
  if (checks.some((check) => check.status === 'FAIL')) return 'FAIL';
  if (checks.some((check) => check.status === 'WARN')) return 'WARN';
  return 'PASS';
}

function doctorChecks(cwd) {
  const checks = [];
  const add = (name, status, message, section) => checks.push({ name, status, message, section });
  const isPackage =
    fs.existsSync(path.join(cwd, 'package.json')) &&
    (() => {
      try {
        return (
          JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).name ===
          'sdd-agentic-flow'
        );
      } catch {
        return false;
      }
    })();
  const configPath = path.join(cwd, '.sdd', 'config.yml');
  const safetyConfig = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf8')
    : configFor();
  const language = languageReport(cwd);

  if (isPackage) {
    const manifest = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    const packageOk =
      fs.existsSync(path.join(cwd, 'bin/sdd-agentic-flow.js')) &&
      !fs.existsSync(path.join(cwd, 'node_modules'));
    add(
      'package_integrity',
      packageOk ? 'PASS' : 'FAIL',
      packageOk
        ? 'CLI present and no bundled dependencies'
        : 'CLI missing or bundled dependencies found',
      'Package integrity',
    );
    add(
      'private_context',
      !hasPrivateContext([
        path.join(cwd, 'bin'),
        path.join(cwd, 'skills'),
        path.join(cwd, 'shared'),
        path.join(cwd, 'presets'),
        path.join(cwd, 'examples'),
        path.join(cwd, 'docs'),
      ])
        ? 'PASS'
        : 'FAIL',
      'publishable content has no blocked private context',
      'Safety',
    );
    add(
      'licensing',
      fs.existsSync(path.join(cwd, 'NOTICE')) && fs.existsSync(path.join(cwd, 'LICENSING.md'))
        ? 'PASS'
        : 'FAIL',
      'NOTICE and licensing map present',
      'Licensing',
    );
    add(
      'presets',
      fs.existsSync(PRESETS_DIR) ? 'PASS' : 'FAIL',
      'installable presets present',
      'Presets',
    );
    add(
      'agent_compatibility',
      fs.existsSync(path.join(cwd, 'docs', 'agent-compatibility.md')) ? 'PASS' : 'FAIL',
      'agent compatibility documentation present',
      'Agent compatibility',
    );
    add(
      'postinstall',
      !Object.hasOwn(manifest.scripts || {}, 'postinstall') ? 'PASS' : 'FAIL',
      'no postinstall script',
      'Safety',
    );
  } else {
    add(
      'config',
      fs.existsSync(configPath) ? 'PASS' : 'WARN',
      fs.existsSync(configPath) ? '.sdd/config.yml found' : '.sdd/config.yml not found',
      'Config',
    );
    add(
      'skills',
      fs.existsSync(path.join(cwd, '.agents', 'skills')) && hasCoreSkills(cwd) ? 'PASS' : 'WARN',
      hasCoreSkills(cwd) ? 'core skills installed' : 'core skills not fully installed',
      'Skills',
    );
    add(
      'shared_layer',
      fs.existsSync(
        path.join(cwd, '.agents/skills/sdd-agentic-flow-shared/references/tlc-baseline.md'),
      )
        ? 'PASS'
        : 'WARN',
      fs.existsSync(path.join(cwd, '.agents/skills/sdd-agentic-flow-shared'))
        ? 'shared layer installed'
        : 'shared layer not installed',
      'Shared layer',
    );
    add(
      'project_readiness',
      fs.existsSync(configPath) && hasCoreSkills(cwd) ? 'PASS' : 'WARN',
      'project readiness is based on config and core skills',
      'Project readiness',
    );
  }
  add('language_profile', language.status, language.message, 'Language');
  const safe =
    /no_commit_by_default:\s*true/.test(safetyConfig) &&
    /no_push_by_default:\s*true/.test(safetyConfig) &&
    /no_merge_or_deploy:\s*true/.test(safetyConfig);
  add(
    'safety',
    safe ? 'PASS' : 'FAIL',
    safe ? 'offline, no-commit safety is the default' : 'required safety defaults are missing',
    'Safety',
  );
  return checks;
}

function renderDoctor(checks) {
  let section = null;
  for (const check of checks) {
    if (check.section !== section) {
      section = check.section;
      process.stdout.write(`\n${section}\n`);
    }
    log(check.status, check.message);
  }
}

function smokeCheck() {
  let temporary;
  try {
    for (const profile of LANGUAGE_PROFILES) {
      temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-smoke-'));
      init(temporary, { profile });
      install('core', temporary);
      init(temporary, { profile });
      install('core', temporary);
      const required = [
        '.sdd/config.yml',
        '.agents/skills',
        '.agents/skills/sdd-agentic-flow-shared',
        `.agents/skills/sdd-agentic-flow-shared/language-profiles/${profile}.md`,
        '.specs/features',
      ].every((relative) => fs.existsSync(path.join(temporary, relative)));
      const state = severity(doctorChecks(temporary));
      if (!required || state === 'FAIL' || languageReport(temporary).profile !== profile)
        throw new Error(`expected ${profile} files or project checks are missing`);
      fs.rmSync(temporary, { recursive: true, force: true });
      temporary = null;
    }
    return {
      name: 'smoke',
      status: 'PASS',
      message: 'isolated init, install, preservation, and doctor checks passed',
      section: 'Project readiness',
    };
  } catch (error) {
    return {
      name: 'smoke',
      status: 'FAIL',
      message: `smoke failed; preserved for debugging: ${temporary} (${error.message})`,
      section: 'Project readiness',
    };
  }
}

function doctor(cwd, options = {}) {
  const checks = doctorChecks(cwd);
  if (options.smoke) checks.push(smokeCheck());
  const result = {
    status: severity(checks),
    version: VERSION,
    checks: checks.map(({ section, ...check }) => check),
    language: languageReport(cwd),
  };
  if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else renderDoctor(checks);
  if (result.status === 'FAIL') process.exitCode = 1;
}

function uninstall(args, cwd) {
  const plan = args.includes('--plan');
  const apply = args.includes('--apply');
  const includeConfig = args.includes('--include-config');
  if (
    plan === apply ||
    args.some((arg) => !['--plan', '--apply', '--include-config'].includes(arg)) ||
    (includeConfig && !apply)
  ) {
    return fail('usage: uninstall --plan | uninstall --apply [--include-config]');
  }
  const targets = [
    ...OFFICIAL_SKILLS.map((skill) => path.join(cwd, '.agents', 'skills', skill)),
    path.join(cwd, '.agents', 'skills', 'sdd-agentic-flow-shared'),
  ];
  if (includeConfig) targets.push(path.join(cwd, '.sdd', 'config.yml'));
  const existing = targets.filter((target) => fs.existsSync(target));
  if (plan) {
    for (const target of existing) log('PLAN', `remove ${path.relative(cwd, target)}`);
    if (!existing.length) log('PLAN', 'nothing installed by sdd-agentic-flow was found');
    log(
      'PLAN',
      'preserves .specs/features, .sdd/reports, .sdd/snapshots, source code, and unknown paths',
    );
    return;
  }
  for (const target of existing) {
    fs.rmSync(target, { recursive: true, force: true });
    log('PASS', `removed ${path.relative(cwd, target)}`);
  }
  if (!existing.length) log('WARN', 'nothing installed by sdd-agentic-flow was found');
  log('PASS', 'preserved project specs, reports, snapshots, source code, and unknown paths');
}

function help() {
  process.stdout.write(
    `sdd-agentic-flow ${VERSION}\n\nCommands:\n  list\n  init [--interactive] [--language en-US|pt-BR]\n  install <pack>\n  doctor [--json] [--smoke]\n  uninstall --plan | --apply [--include-config]\n  help\n  version\n`,
  );
}

async function main() {
  const [command = 'help', ...args] = process.argv.slice(2);
  if (command === 'list') list();
  else if (command === 'init') {
    if (args.includes('--help'))
      process.stdout.write('usage: init [--interactive] [--language en-US|pt-BR]\n');
    else {
      let interactive = false;
      let language = 'en-US';
      for (let index = 0; index < args.length; index += 1) {
        if (args[index] === '--interactive') interactive = true;
        else if (args[index] === '--language' && LANGUAGE_PROFILES.includes(args[index + 1])) {
          language = args[index + 1];
          index += 1;
        } else return fail('usage: init [--interactive] [--language en-US|pt-BR]');
      }
      if (interactive) await initInteractive(process.cwd(), language);
      else init(process.cwd(), { profile: language });
    }
  } else if (command === 'install')
    args.length === 1 ? install(args[0], process.cwd()) : fail('install requires one pack name');
  else if (command === 'doctor') {
    const valid = args.every((arg) => arg === '--json' || arg === '--smoke');
    if (!valid) {
      if (args.includes('--json'))
        process.stdout.write(
          `${JSON.stringify({ status: 'FAIL', version: VERSION, checks: [{ name: 'arguments', status: 'FAIL', message: 'usage: doctor [--json] [--smoke]' }] })}\n`,
        );
      else fail('usage: doctor [--json] [--smoke]');
    } else
      doctor(process.cwd(), { json: args.includes('--json'), smoke: args.includes('--smoke') });
  } else if (command === 'uninstall') uninstall(args, process.cwd());
  else if (command === 'help' || command === '--help' || command === '-h') help();
  else if (command === 'version' || command === '--version' || command === '-v')
    process.stdout.write(`${VERSION}\n`);
  else fail(`unknown command: ${command}`);
}

main().catch((error) => fail(error.message, 2));
