#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const VERSION = '0.1.0';
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PRESETS_DIR = path.join(PACKAGE_ROOT, 'presets');
const PRIVATE_PATTERNS = [
  'QmVyZXNoaXQ=', 'QmFtYXE=', 'TU1CUQ==', 'Z3VpbGhlcm1lLm1pcmFuZGE=',
  'd29ya3NwYWNlL2Rldi9sb2NhbA==', 'LmxvY2FsL2JlcmVzaGl0',
  'Zm9ybWFsaXphdGlvbg==', 'Y3JlZGl0LXNpbXVsYXRpb24=',
  'Y3JlZGl0LWZvcm1hbGl6YXRpb24=', 'U2FsZXNmb3JjZQ==', 'Q0FG'
].map((value) => Buffer.from(value, 'base64').toString('utf8'));
const CONFIG = `version: 1

project:
  name: example-project
  default_branch: main

language:
  human_outputs: en-US
  technical_tokens: canonical

specs:
  root: .specs/features
  files:
    - context.md
    - spec.md
    - design.md
    - tasks.md

source:
  type: local-files
  snapshots_dir: .sdd/snapshots

workflow:
  default_flow: single
  allow_multi_worktree: false
  allow_stacked_prs: false
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
  const presets = fs.readdirSync(PRESETS_DIR).filter((file) => file.endsWith('.json')).sort();
  for (const file of presets) {
    const preset = JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, file), 'utf8'));
    log('PACK', `${preset.name} (${preset.status}) — ${preset.skills.join(', ') || 'shared guidance only'}`);
  }
}

function init(cwd) {
  const configPath = path.join(cwd, '.sdd', 'config.yml');
  for (const relative of ['.sdd/snapshots', '.sdd/reports', '.specs/features']) {
    fs.mkdirSync(path.join(cwd, relative), { recursive: true });
  }
  if (fs.existsSync(configPath)) {
    log('WARN', 'preserved existing .sdd/config.yml');
  } else {
    fs.writeFileSync(configPath, CONFIG, 'utf8');
    log('PASS', 'created .sdd/config.yml');
  }
  log('PASS', 'initialized local SDD directories');
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
  for (const skill of preset.skills) {
    copyTree(path.join(PACKAGE_ROOT, 'skills', skill), path.join(target, skill), summary);
  }
  if (preset.shared) {
    copyTree(path.join(PACKAGE_ROOT, 'shared'), path.join(target, 'sdd-agentic-flow-shared'), summary);
  }
  if (preset.adapter) {
    copyIfMissing(path.join(PACKAGE_ROOT, 'docs', 'adapters.md'), path.join(target, 'sdd-agentic-flow-shared', 'docs', 'adapters.md'), summary);
  }
  log('PASS', `installed ${pack}: ${summary.installed} files`);
  if (summary.preserved) log('WARN', `preserved ${summary.preserved} existing files`);
}

function hasCoreSkills(cwd) {
  return ['setup-sdd-agentic-flow', 'sdd-create-specs', 'sdd-implement-task', 'sdd-task-check', 'sdd-validation']
    .every((skill) => fs.existsSync(path.join(cwd, '.agents', 'skills', skill, 'SKILL.md')));
}

function filesIn(directory) {
  if (!fs.existsSync(directory)) return [];
  const entries = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) entries.push(...filesIn(target));
    else entries.push(target);
  }
  return entries;
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

function doctor(cwd) {
  let failed = false;
  const isPackage = fs.existsSync(path.join(cwd, 'package.json')) && (() => {
    try { return JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')).name === 'sdd-agentic-flow'; } catch { return false; }
  })();
  const check = (ok, label, warning = false) => {
    log(ok ? (warning ? 'WARN' : 'PASS') : 'FAIL', label);
    if (!ok && !warning) failed = true;
  };
  if (isPackage) {
    const manifest = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    check(fs.existsSync(path.join(cwd, 'shared/references/tlc-baseline.md')), 'internal TLC baseline present');
    check(fs.existsSync(path.join(cwd, 'NOTICE')), 'NOTICE present');
    check(fs.existsSync(path.join(cwd, 'LICENSING.md')), 'licensing map present');
    check(fs.existsSync(path.join(cwd, 'bin/sdd-agentic-flow.js')), 'CLI present');
    check(!fs.existsSync(path.join(cwd, 'node_modules')), 'no bundled dependencies');
    check(!Object.prototype.hasOwnProperty.call(manifest.scripts || {}, 'postinstall'), 'no postinstall script');
    check(!hasPrivateContext([path.join(cwd, 'bin'), path.join(cwd, 'skills'), path.join(cwd, 'shared'), path.join(cwd, 'presets'), path.join(cwd, 'examples'), path.join(cwd, 'docs')]), 'no blocked private context');
  } else {
    check(fs.existsSync(path.join(cwd, '.sdd/config.yml')), '.sdd/config.yml present', true);
    check(fs.existsSync(path.join(cwd, '.agents/skills')), '.agents/skills present', true);
    check(hasCoreSkills(cwd), 'core skills installed', true);
    check(fs.existsSync(path.join(cwd, '.agents/skills/sdd-agentic-flow-shared/references/tlc-baseline.md')), 'shared baseline installed', true);
    check(!hasPrivateContext([path.join(cwd, '.agents/skills')]), 'no blocked private context');
  }
  const configPath = path.join(cwd, '.sdd/config.yml');
  const safetyConfig = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : CONFIG;
  check(/no_commit_by_default:\s*true/.test(safetyConfig) && /no_push_by_default:\s*true/.test(safetyConfig) && /no_merge_or_deploy:\s*true/.test(safetyConfig), 'offline, no-commit safety is the default');
  if (failed) process.exitCode = 1;
}

function help() {
  process.stdout.write(`sdd-agentic-flow ${VERSION}\n\nCommands:\n  list\n  init\n  install <pack>\n  doctor\n  help\n  version\n`);
}

const [command = 'help', argument] = process.argv.slice(2);
try {
  if (command === 'list') list();
  else if (command === 'init') init(process.cwd());
  else if (command === 'install') argument ? install(argument, process.cwd()) : fail('install requires a pack name');
  else if (command === 'doctor') doctor(process.cwd());
  else if (command === 'help' || command === '--help' || command === '-h') help();
  else if (command === 'version' || command === '--version' || command === '-v') process.stdout.write(`${VERSION}\n`);
  else fail(`unknown command: ${command}`);
} catch (error) {
  fail(error.message, 2);
}
