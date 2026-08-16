// Simulates a genuinely new user running `npx sdd-agentic-flow` against the *current* source —
// without publishing anything. Packs a real tarball (the same artifact `npm publish` would
// ship), then installs and runs it via `npx "file:<tarball>"` in a brand-new project directory
// with an isolated HOME, so it exercises real npm package resolution and the `bin` shim exactly
// like a first-time consumer would get it. This is the same pack->extract->run recipe already
// proven in test/cli.test.js's tarball e2e tests, made runnable interactively outside the test
// runner. Pass `--clean` to remove the resulting sandbox afterward; by default it's left in
// place so you can inspect what got written (e.g. `.agents/skills`, `.sdd-agentic-flow/`).

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const repoRoot = path.join(__dirname, '..');

const rawArgs = process.argv.slice(2);
const clean = rawArgs.includes('--clean');
const forwardedArgs = rawArgs.filter((arg) => arg !== '--clean');

const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-sandbox-pack-'));
const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-sandbox-cache-'));
const consumerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-sandbox-consumer-'));
const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-sandbox-home-'));

function cleanup() {
  for (const dir of [packDir, cacheDir, consumerDir, homeDir]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log('cli:sandbox — packing current source into a real npm tarball...');
const pack = spawnSync(
  'npm',
  ['pack', '--json', '--pack-destination', packDir, '--cache', cacheDir],
  // Windows can't spawn the npm.cmd shim directly without a shell (EINVAL/null status) since
  // Node's CVE-2024-27980 hardening; POSIX doesn't need it. Matches test/cli.test.js.
  { cwd: repoRoot, encoding: 'utf8', shell: process.platform === 'win32' },
);
if (pack.status !== 0) {
  console.error(pack.stderr || pack.stdout);
  cleanup();
  process.exit(pack.status ?? 1);
}
const jsonStart = pack.stdout.indexOf('[');
const [meta] = JSON.parse(pack.stdout.slice(jsonStart));
const tarballPath = path.join(packDir, meta.filename);

console.log(`  tarball:     ${tarballPath} (v${meta.version})`);
console.log(`  project dir: ${consumerDir}`);
console.log(`  home dir:    ${homeDir}`);
console.log('  installing via npx exactly as a first-time user would...\n');

const result = spawnSync(
  'npx',
  ['--yes', '--cache', cacheDir, `file:${tarballPath}`, ...forwardedArgs],
  {
    cwd: consumerDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir },
  },
);

if (clean) {
  cleanup();
  console.log('\ncli:sandbox — sandbox removed (--clean).');
} else {
  console.log(`\ncli:sandbox — sandbox left in place for inspection:`);
  console.log(`  project dir: ${consumerDir}`);
  console.log(`  home dir:    ${homeDir}`);
  console.log(`  re-run with --clean to remove sandboxes automatically.`);
}

process.exit(result.status ?? 1);
