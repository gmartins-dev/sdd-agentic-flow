'use strict';

// Single source of the "does every skill/preset version match package.json" comparison,
// shared by scripts/check-skills.sh (CI gate) and scripts/release-checklist.sh (manual
// pre-release gate) — previously each reimplemented this walk independently (Milestone 2,
// v1.6.0). This module only gathers data; each caller keeps formatting its own error
// messages so observable script output is unchanged.

const fs = require('node:fs');
const path = require('node:path');
const { compareVersions } = require('../bin/version-compat.js');

function getPackageVersion(root = process.cwd()) {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
}

function listSkillVersions(root = process.cwd()) {
  return fs
    .readdirSync(path.join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = `skills/${entry.name}/SKILL.md`;
      const content = fs.readFileSync(path.join(root, file), 'utf8');
      const match = content.match(/^\s*version:\s*(\S+)\s*$/m);
      return { name: entry.name, file, version: match ? match[1] : null };
    });
}

function listPresetVersions(root = process.cwd()) {
  return fs
    .readdirSync(path.join(root, 'presets'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const file = `presets/${name}`;
      const preset = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
      return { file, version: preset.version };
    });
}

// v1.9.1: bin/sdd-agentic-flow.js's own `const VERSION` drifted from package.json during
// v1.9.0 and nothing here caught it — this file only ever walked skills/ and presets/. Same
// shape as a skill/preset entry so it flows through the existing drift logic unchanged.
function listCliVersion(root = process.cwd()) {
  const file = 'bin/sdd-agentic-flow.js';
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  const match = content.match(/^const VERSION = '([^']+)';/m);
  return { file, version: match ? match[1] : null };
}

// Returns package.json's version plus every skill/preset version alongside a `drifted`
// flag (true when missing or not exactly equal to packageVersion via compareVersions).
function checkVersionConsistency(root = process.cwd()) {
  const packageVersion = getPackageVersion(root);
  const isDrifted = (version) => !version || compareVersions(version, packageVersion) !== 0;
  return {
    packageVersion,
    skills: listSkillVersions(root).map((entry) => ({
      ...entry,
      drifted: isDrifted(entry.version),
    })),
    presets: listPresetVersions(root).map((entry) => ({
      ...entry,
      drifted: isDrifted(entry.version),
    })),
    cli: { ...listCliVersion(root), drifted: isDrifted(listCliVersion(root).version) },
  };
}

module.exports = {
  checkVersionConsistency,
  getPackageVersion,
  listSkillVersions,
  listPresetVersions,
  listCliVersion,
};

// CLI mode: `node scripts/check-version-consistency.js` prints a human-readable report and
// exits 1 on drift — used directly for manual/debugging invocation, independent of the two
// shell scripts that consume the module API above with their own message formats.
if (require.main === module) {
  const { packageVersion, skills, presets, cli } = checkVersionConsistency();
  const drifted = [
    ...skills
      .filter((entry) => entry.drifted)
      .map((entry) => `${entry.file} (version: ${entry.version})`),
    ...presets
      .filter((entry) => entry.drifted)
      .map((entry) => `${entry.file} (version: ${entry.version})`),
    ...(cli.drifted ? [`${cli.file} (version: ${cli.version})`] : []),
  ];
  if (drifted.length) {
    console.error(`version mismatch against package.json (${packageVersion}):`);
    for (const entry of drifted) console.error(`  - ${entry}`);
    process.exit(1);
  }
  console.log(`all skill, preset, and CLI versions match package.json (${packageVersion})`);
}
