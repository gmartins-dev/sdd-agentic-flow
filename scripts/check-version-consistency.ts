// package.json is the canonical release version. Skills and bundle assets do not
// duplicate it; version:stamp updates only package-lock root fields.

import fs from 'node:fs';
import path from 'node:path';
import { compareVersions } from '../src/version-compat';

function getPackageVersion(root = process.cwd()): string {
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
  if (typeof lock.version !== 'string' || typeof lock.packages?.['']?.version !== 'string')
    throw new Error('package-lock.json must contain root version and packages[""].version');
  return {
    file: 'package-lock.json',
    version: lock.version,
    rootVersion: lock.packages[''].version,
    lock,
  };
}

function listCliVersion(root = process.cwd()) {
  const candidates = ['src/paths.ts', 'dist/paths.js', 'dist/sdd-agentic-flow.js'];
  const file = candidates.find((candidate) => fs.existsSync(path.join(root, candidate)));
  if (!file) return { file: candidates[0], version: null, derived: false };
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

function stampVersions(root = process.cwd()) {
  const packageVersion = getPackageVersion(root);
  const written: string[] = [];
  const lockfile = getLockfileVersions(root);
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
    cli: { ...cli, drifted: !cli.derived || isDrifted(cli.version) },
  };
}

export {
  checkVersionConsistency,
  getLockfileVersions,
  getPackageVersion,
  listCliVersion,
  stampVersions,
};

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('check-version-consistency.ts') ||
    process.argv[1].endsWith('check-version-consistency.js'));
if (isMain) {
  if (process.argv.includes('--stamp')) {
    const { packageVersion, written } = stampVersions();
    console.log(
      written.length
        ? `stamped ${packageVersion} into ${written.join(', ')}`
        : `already stamped at ${packageVersion}`,
    );
  }
  const { packageVersion, lockfile, cli } = checkVersionConsistency();
  const drifted = [
    ...(lockfile.versionDrifted
      ? [`package-lock.json.version (version: ${lockfile.version})`]
      : []),
    ...(lockfile.rootVersionDrifted
      ? [`package-lock.json.packages[""].version (version: ${lockfile.rootVersion})`]
      : []),
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
    process.exit(1);
  }
  console.log(`package-lock root and CLI versions match package.json (${packageVersion})`);
}
