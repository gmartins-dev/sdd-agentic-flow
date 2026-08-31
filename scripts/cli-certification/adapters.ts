import { type SpawnSyncReturns, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type CliResult = SpawnSyncReturns<string>;

export type CertificationSandbox = {
  root: string;
  cwd: string;
  home: string;
  npmCache: string;
};

export type ArtifactIdentity = {
  version: string;
  sourceCommit: string;
  sourceDirty: boolean;
  candidateType: 'dist' | 'packed';
  tarball?: string;
  tarballSha256?: string;
};

export type CliExecutionAdapter = {
  readonly name: string;
  readonly identity: ArtifactIdentity;
  run(args: string[], sandbox: CertificationSandbox, input?: string): CliResult;
  ptyCommand(sandbox: CertificationSandbox): string;
  ptyEnvironment(sandbox: CertificationSandbox): NodeJS.ProcessEnv;
};

function sourceIdentity(repoRoot: string, candidateType: ArtifactIdentity['candidateType']) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    version: string;
  };
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).stdout.trim();
  const dirty = Boolean(
    spawnSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim(),
  );
  return {
    version: packageJson.version,
    sourceCommit: commit || 'unavailable',
    sourceDirty: dirty,
    candidateType,
  } satisfies ArtifactIdentity;
}

export function createSandbox(label: string): CertificationSandbox {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `sdd-agentic-flow-cert-${label}-`));
  const sandbox = {
    root,
    cwd: path.join(root, 'project'),
    home: path.join(root, 'home'),
    npmCache: path.join(root, 'npm-cache'),
  };
  for (const directory of [sandbox.cwd, sandbox.home, sandbox.npmCache]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  const git = spawnSync('git', ['init', '--quiet'], { cwd: sandbox.cwd, encoding: 'utf8' });
  if (git.status !== 0) throw new Error(`cannot initialize sandbox Git repository: ${git.stderr}`);
  return sandbox;
}

export function removeSandbox(sandbox: CertificationSandbox): void {
  fs.rmSync(sandbox.root, { recursive: true, force: true });
}

export function environment(sandbox: CertificationSandbox): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: sandbox.home,
    USERPROFILE: sandbox.home,
    NPM_CONFIG_CACHE: sandbox.npmCache,
    CI: '1',
  };
}

export function createDistAdapter(repoRoot: string): CliExecutionAdapter {
  const identity = sourceIdentity(repoRoot, 'dist');
  const cli = path.join(repoRoot, 'dist', 'sdd-agentic-flow.js');
  return {
    name: 'dist',
    identity,
    run(args, sandbox, input = '') {
      return spawnSync(process.execPath, [cli, ...args], {
        cwd: sandbox.cwd,
        input,
        encoding: 'utf8',
        timeout: 30_000,
        env: environment(sandbox),
      });
    },
    ptyCommand: () =>
      `stty cols 80 rows 24 -isig -echo; exec ${shellQuote(process.execPath)} ${shellQuote(cli)}`,
    ptyEnvironment: (sandbox) => {
      const env = environment(sandbox);
      delete env.CI;
      env.TERM = 'xterm-256color';
      return env;
    },
  };
}

export function createPackedAdapter(repoRoot: string): CliExecutionAdapter {
  const packRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-cert-pack-'));
  const cache = path.join(packRoot, 'npm-cache');
  fs.mkdirSync(cache, { recursive: true });
  const pack = spawnSync(
    'npm',
    ['pack', '--json', '--pack-destination', packRoot, '--cache', cache],
    { cwd: repoRoot, encoding: 'utf8', timeout: 60_000 },
  );
  if (pack.status !== 0) throw new Error(`npm pack failed: ${pack.stderr}`);
  const metadata = JSON.parse(pack.stdout.slice(pack.stdout.indexOf('[')))[0] as {
    filename: string;
  };
  const tarball = path.join(packRoot, metadata.filename);
  const identity: ArtifactIdentity = {
    ...sourceIdentity(repoRoot, 'packed'),
    tarball: metadata.filename,
    tarballSha256: crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex'),
  };
  return {
    name: 'packed',
    identity,
    run(args, sandbox, input = '') {
      return spawnSync('npx', ['--yes', '--cache', cache, `file:${tarball}`, ...args], {
        cwd: sandbox.cwd,
        input,
        encoding: 'utf8',
        timeout: 60_000,
        env: { ...environment(sandbox), SDD_NO_UPDATE_PROMPT: '1' },
      });
    },
    ptyCommand: () =>
      `stty cols 80 rows 24 -isig -echo; exec npx --yes --cache ${shellQuote(cache)} ${shellQuote(`file:${tarball}`)}`,
    ptyEnvironment: (sandbox) => {
      const env = environment(sandbox);
      delete env.CI;
      env.SDD_NO_UPDATE_PROMPT = '1';
      env.TERM = 'xterm-256color';
      return env;
    },
  };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
