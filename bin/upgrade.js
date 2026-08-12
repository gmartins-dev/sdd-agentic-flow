'use strict';

// Interactive / read-only upgrade flow (v1.13.0). Flag contracts:
//   upgrade --check        upgrade-specific read-only registry check (never mutates)
//   upgrade --plan         registry + concrete plan (never mutates)
//   upgrade --skills-only  no registry; refresh skills from the executing package only
//   upgrade (default)      interactive confirms on human TTY; machine = check-only
// See docs/trust-model.md and docs/upgrading.md.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { checkForUpdate } = require('./update-check');

const PROVENANCE_REL = path.join('sdd-agentic-flow-shared', 'install-provenance.yml');

function detectExecutionMode(packageRoot, env = process.env) {
  if (env.SDD_AGENTIC_FLOW_TEST_EXEC_MODE) return env.SDD_AGENTIC_FLOW_TEST_EXEC_MODE;
  const normalized = path.resolve(packageRoot);
  const npxMarker = `${path.sep}_npx${path.sep}`;
  if (normalized.includes(npxMarker) || normalized.includes(`${path.sep}.npm${path.sep}_npx`))
    return 'npx';
  try {
    const globalRoot = execFileSync('npm', ['root', '-g'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (globalRoot && normalized.startsWith(path.resolve(globalRoot) + path.sep)) return 'global';
    if (globalRoot && normalized === path.resolve(globalRoot, 'sdd-agentic-flow')) return 'global';
  } catch {
    // npm unavailable — fall through
  }
  return 'local';
}

function provenancePath(skillsRoot) {
  return path.join(skillsRoot, PROVENANCE_REL);
}

function writeInstallProvenance(skillsRoot, packageVersion) {
  const dest = provenancePath(skillsRoot);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `package: sdd-agentic-flow\npackage_version: ${packageVersion}\n`, 'utf8');
}

function readInstallProvenance(skillsRoot) {
  const dest = provenancePath(skillsRoot);
  if (!fs.existsSync(dest)) return null;
  try {
    const text = fs.readFileSync(dest, 'utf8');
    const versionMatch = text.match(/package_version:\s*(\S+)/);
    const packageMatch = text.match(/^package:\s*(\S+)/m);
    return {
      package: packageMatch ? packageMatch[1] : null,
      packageVersion: versionMatch ? versionMatch[1] : null,
    };
  } catch {
    return null;
  }
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(target) : [target];
  });
}

function collectManagedPairs(packageRoot, preset, targetRoot) {
  const pairs = [];
  for (const skill of preset.skills || []) {
    const sourceRoot = path.join(packageRoot, 'skills', skill);
    const destRoot = path.join(targetRoot, skill);
    if (!fs.existsSync(sourceRoot)) continue;
    for (const source of walkFiles(sourceRoot)) {
      const rel = path.relative(sourceRoot, source);
      pairs.push({ source, dest: path.join(destRoot, rel), rel: path.join(skill, rel) });
    }
  }
  if (preset.shared) {
    const sourceRoot = path.join(packageRoot, 'shared');
    const destRoot = path.join(targetRoot, 'sdd-agentic-flow-shared');
    for (const source of walkFiles(sourceRoot)) {
      const rel = path.relative(sourceRoot, source);
      pairs.push({
        source,
        dest: path.join(destRoot, rel),
        rel: path.join('sdd-agentic-flow-shared', rel),
      });
    }
  }
  if (preset.adapter) {
    const source = path.join(packageRoot, 'docs', 'adapters.md');
    const dest = path.join(targetRoot, 'sdd-agentic-flow-shared', 'docs', 'adapters.md');
    if (fs.existsSync(source))
      pairs.push({
        source,
        dest,
        rel: path.join('sdd-agentic-flow-shared', 'docs', 'adapters.md'),
      });
  }
  return pairs;
}

function classifyPair(source, dest) {
  if (!fs.existsSync(dest)) return 'missing';
  try {
    const a = fs.readFileSync(source);
    const b = fs.readFileSync(dest);
    return Buffer.compare(a, b) === 0 ? 'identical' : 'differs';
  } catch {
    return 'differs';
  }
}

function classifyManagedPairs(pairs) {
  const missing = [];
  const identical = [];
  const differs = [];
  for (const pair of pairs) {
    const kind = classifyPair(pair.source, pair.dest);
    if (kind === 'missing') missing.push(pair);
    else if (kind === 'identical') identical.push(pair);
    else differs.push(pair);
  }
  return { missing, identical, differs };
}

function applyManagedPairs(pairs, { overwriteDiffers = false } = {}) {
  const summary = { installed: 0, refreshed: 0, skippedIdentical: 0, skippedDiffers: 0 };
  for (const pair of pairs) {
    const kind = classifyPair(pair.source, pair.dest);
    if (kind === 'identical') {
      summary.skippedIdentical += 1;
      continue;
    }
    if (kind === 'differs' && !overwriteDiffers) {
      summary.skippedDiffers += 1;
      continue;
    }
    fs.mkdirSync(path.dirname(pair.dest), { recursive: true });
    fs.copyFileSync(pair.source, pair.dest);
    if (kind === 'missing') summary.installed += 1;
    else summary.refreshed += 1;
  }
  return summary;
}

function detectInstalledPacks(skillsRoot, presetsDir) {
  if (!fs.existsSync(skillsRoot)) return [];
  const names = fs
    .readdirSync(presetsDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace(/\.json$/, ''))
    .sort();
  const found = [];
  for (const name of names) {
    let preset;
    try {
      preset = JSON.parse(fs.readFileSync(path.join(presetsDir, `${name}.json`), 'utf8'));
    } catch {
      continue;
    }
    const skills = preset.skills || [];
    if (!skills.length) continue;
    if (skills.every((skill) => fs.existsSync(path.join(skillsRoot, skill, 'SKILL.md'))))
      found.push(name);
  }
  // Prefer core when present; otherwise every fully matched pack.
  if (found.includes('core')) return ['core'];
  return found;
}

function runNpmGlobalInstall({
  execFileSyncImpl = execFileSync,
  env = process.env,
  packageName = 'sdd-agentic-flow@latest',
} = {}) {
  if (env.SDD_AGENTIC_FLOW_TEST_NPM_INSTALL === 'fail') {
    const error = new Error('simulated npm install failure');
    error.status = 1;
    throw error;
  }
  if (env.SDD_AGENTIC_FLOW_TEST_NPM_INSTALL === 'ok') return { simulated: true };
  execFileSyncImpl('npm', ['install', '-g', packageName], {
    stdio: 'inherit',
    env: process.env,
  });
  return { simulated: false };
}

function formatCheckReport(result) {
  const lines = [
    `Current version: ${result.currentVersion}`,
    `Latest version: ${result.latest ?? '(unknown)'}`,
    `Update available: ${result.updateAvailable ? 'yes' : result.reachable ? 'no' : '(unknown)'}`,
  ];
  if (!result.reachable) {
    lines.push(
      '',
      'WARN unable to check for updates',
      '',
      'Reason:',
      '  network unavailable or registry unreachable',
    );
  } else if (result.updateAvailable) {
    lines.push('', 'Suggested:', '  sdd-agentic-flow upgrade');
  }
  return `${lines.join('\n')}\n`;
}

module.exports = {
  PROVENANCE_REL,
  detectExecutionMode,
  provenancePath,
  writeInstallProvenance,
  readInstallProvenance,
  collectManagedPairs,
  classifyPair,
  classifyManagedPairs,
  applyManagedPairs,
  detectInstalledPacks,
  runNpmGlobalInstall,
  formatCheckReport,
  checkForUpdate,
};
