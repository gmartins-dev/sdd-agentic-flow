// Single source of the "does every skill/preset version match package.json" comparison,
// shared by scripts/check-skills.sh (CI gate) and scripts/release-checklist.sh (manual
// pre-release gate) — previously each reimplemented this walk independently (Milestone 2,
// v1.6.0). This module only gathers data; each caller keeps formatting its own error
// messages so observable script output is unchanged.
//
// package.json is the canonical version. `npm run version:stamp` writes that number into
// every skill frontmatter `metadata.version` and every `presets/*.json` `version` (copies
// that must exist on disk after `install`). The CLI reads package.json at runtime — it
// must not hardcode `const VERSION = 'x.y.z'`.

import fs from 'node:fs';
import path from 'node:path';
import { compareVersions } from '../src/version-compat';

const SKILL_VERSION_LINE = /^([ \t]*version:[ \t]*)(\S+)([ \t]*)$/m;

function getPackageVersion(root = process.cwd()) {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
}

function getLockfileVersions(root = process.cwd()) {
  const file = path.join(root, 'package-lock.json');
  let lock: { version?: unknown; packages?: Record<string, { version?: unknown }> };
  try {
    lock = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      `package-lock.json is missing or invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (typeof lock.version !== 'string' || typeof lock.packages?.['']?.version !== 'string') {
    throw new Error('package-lock.json must contain root version and packages[""].version');
  }
  return {
    file: 'package-lock.json',
    version: lock.version,
    rootVersion: lock.packages[''].version,
    lock,
  };
}

function listSkillVersions(root = process.cwd()) {
  return fs
    .readdirSync(path.join(root, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = `skills/${entry.name}/SKILL.md`;
      const content = fs.readFileSync(path.join(root, file), 'utf8');
      const front = skillFrontmatter(content, file);
      const match = front.match(SKILL_VERSION_LINE);
      return { name: entry.name, file, version: match ? match[2] : null };
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

// The CLI must derive VERSION from package.json. A hardcoded `const VERSION = 'x.y.z'`
// is always drift — that is the v1.9.1 failure mode (VERSION stuck at 1.8.0).
// Since v3.6.0 the canonical derivation lives in src/paths.ts (compiled into dist/).
function listCliVersion(root = process.cwd()) {
  const candidates = ['src/paths.ts', 'dist/paths.js', 'dist/sdd-agentic-flow.js'];
  const file = candidates.find((candidate) => fs.existsSync(path.join(root, candidate)));
  if (!file) {
    return { file: candidates[0], version: null, derived: false };
  }
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  const hardcoded =
    content.match(/^const VERSION = ['"](\d+\.\d+\.\d+)['"];/m) ||
    content.match(/^export const VERSION = ['"](\d+\.\d+\.\d+)['"];/m);
  const derived =
    !hardcoded && /^(export )?const VERSION = /m.test(content) && content.includes('package.json');
  return {
    file,
    version: hardcoded ? hardcoded[1] : derived ? getPackageVersion(root) : null,
    derived,
  };
}

function skillFrontmatter(content: string, file: string): string {
  if (!content.startsWith('---')) {
    throw new Error(`${file} is missing YAML frontmatter`);
  }
  const close = content.indexOf('\n---', 4);
  if (close === -1) {
    throw new Error(`${file} is missing YAML frontmatter closer`);
  }
  return content.slice(0, close);
}

function stampSkillFile(abs: string, file: string, packageVersion: string): boolean {
  const content = fs.readFileSync(abs, 'utf8');
  const close = content.indexOf('\n---', 4);
  if (!content.startsWith('---') || close === -1) {
    throw new Error(`${file} is missing YAML frontmatter`);
  }
  const front = content.slice(0, close);
  const rest = content.slice(close);
  const match = front.match(SKILL_VERSION_LINE);
  if (!match) {
    throw new Error(`${file} frontmatter has no version field to stamp`);
  }
  if (match[2] === packageVersion) return false;
  const nextFront = `${front.slice(0, match.index ?? 0)}${match[1]}${packageVersion}${match[3]}${front.slice((match.index ?? 0) + match[0].length)}`;
  if (nextFront === front) return false;
  fs.writeFileSync(abs, `${nextFront}${rest}`);
  return true;
}

function stampPresetFile(abs: string, packageVersion: string): boolean {
  const preset = JSON.parse(fs.readFileSync(abs, 'utf8'));
  if (preset.version === packageVersion) return false;
  preset.version = packageVersion;
  fs.writeFileSync(abs, `${JSON.stringify(preset, null, 2)}\n`);
  return true;
}

function stampVersions(root = process.cwd()) {
  const packageVersion = getPackageVersion(root);
  const written: string[] = [];
  const lockfile = getLockfileVersions(root);
  for (const skill of listSkillVersions(root)) {
    if (stampSkillFile(path.join(root, skill.file), skill.file, packageVersion)) {
      written.push(skill.file);
    }
  }
  for (const preset of listPresetVersions(root)) {
    if (stampPresetFile(path.join(root, preset.file), packageVersion)) {
      written.push(preset.file);
    }
  }
  if (lockfile.version !== packageVersion || lockfile.rootVersion !== packageVersion) {
    lockfile.lock.version = packageVersion;
    const rootPackage = lockfile.lock.packages?.[''];
    if (!rootPackage) throw new Error('package-lock.json must contain packages[""].version');
    rootPackage.version = packageVersion;
    fs.writeFileSync(path.join(root, lockfile.file), `${JSON.stringify(lockfile.lock, null, 2)}\n`);
    written.push(lockfile.file);
  }
  return { packageVersion, written };
}

// Returns package.json's version plus every skill/preset version alongside a `drifted`
// flag (true when missing or not exactly equal to packageVersion via compareVersions).
// `cli.derived` is true when bin/ reads package.json instead of hardcoding a semver.
function checkVersionConsistency(root = process.cwd()) {
  const packageVersion = getPackageVersion(root);
  const isDrifted = (version: string | null | undefined) =>
    !version || compareVersions(version, packageVersion) !== 0;
  const cli = listCliVersion(root);
  const lockfile = getLockfileVersions(root);
  return {
    packageVersion,
    lockfile: {
      ...lockfile,
      versionDrifted: isDrifted(lockfile.version),
      rootVersionDrifted: isDrifted(lockfile.rootVersion),
    },
    skills: listSkillVersions(root).map((entry) => ({
      ...entry,
      drifted: isDrifted(entry.version),
    })),
    presets: listPresetVersions(root).map((entry) => ({
      ...entry,
      drifted: isDrifted(entry.version),
    })),
    cli: { ...cli, drifted: !cli.derived || isDrifted(cli.version) },
  };
}

export {
  checkVersionConsistency,
  getLockfileVersions,
  getPackageVersion,
  listCliVersion,
  listPresetVersions,
  listSkillVersions,
  stampVersions,
};

// CLI mode: `tsx scripts/check-version-consistency.ts` prints a human-readable report and
// exits 1 on drift. `--stamp` writes package.json's version into skills and presets first.
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('check-version-consistency.ts') ||
    process.argv[1].endsWith('check-version-consistency.js'));
if (isMain) {
  if (process.argv.includes('--stamp')) {
    const { packageVersion, written } = stampVersions();
    if (written.length === 0) {
      console.log(`already stamped at ${packageVersion}`);
    } else {
      console.log(`stamped ${packageVersion} into ${written.length} file(s):`);
      for (const file of written) console.log(`  ${file}`);
    }
  }
  const { packageVersion, lockfile, skills, presets, cli } = checkVersionConsistency();
  const drifted = [
    ...(lockfile.versionDrifted
      ? [`package-lock.json.version (version: ${lockfile.version})`]
      : []),
    ...(lockfile.rootVersionDrifted
      ? [`package-lock.json.packages[""].version (version: ${lockfile.rootVersion})`]
      : []),
    ...skills
      .filter((entry) => entry.drifted)
      .map((entry) => `${entry.file} (version: ${entry.version})`),
    ...presets
      .filter((entry) => entry.drifted)
      .map((entry) => `${entry.file} (version: ${entry.version})`),
    ...(cli.drifted
      ? [
          cli.derived
            ? `${cli.file} (version: ${cli.version})`
            : `${cli.file} must read VERSION from package.json (found ${cli.version})`,
        ]
      : []),
  ];
  if (drifted.length) {
    console.error(`version mismatch against package.json (${packageVersion}):`);
    for (const entry of drifted) console.error(`  - ${entry}`);
    console.error('run `npm run version:stamp` and commit the result');
    process.exit(1);
  }
  console.log(
    `all package-lock root, skill, preset, and CLI versions match package.json (${packageVersion})`,
  );
}
