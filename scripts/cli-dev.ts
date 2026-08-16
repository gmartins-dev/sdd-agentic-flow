// Fastest local CLI loop: runs dist/sdd-agentic-flow.js directly from source (no `npm pack`,
// no npx) against a persistent scratch project + isolated HOME, so repeated invocations behave
// like an evolving real project instead of a fresh one every time. For "does this new onboarding
// wording read well" iteration — for "does this behave like a genuinely fresh npx install",
// use `npm run cli:sandbox` instead.

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const repoRoot = path.join(__dirname, '..');
const cli = path.join(repoRoot, 'dist', 'sdd-agentic-flow.js');

const rawArgs = process.argv.slice(2);
const fresh = rawArgs.includes('--fresh');
const forwardedArgs = rawArgs.filter((arg) => arg !== '--fresh');

const scratchDir = path.join(os.tmpdir(), 'sdd-agentic-flow-cli-dev');
const homeDir = path.join(os.tmpdir(), 'sdd-agentic-flow-cli-dev-home');

if (fresh) {
  fs.rmSync(scratchDir, { recursive: true, force: true });
  fs.rmSync(homeDir, { recursive: true, force: true });
}
fs.mkdirSync(scratchDir, { recursive: true });
fs.mkdirSync(homeDir, { recursive: true });

console.log(`cli:dev — running dist/sdd-agentic-flow.js from source`);
console.log(`  project dir: ${scratchDir}`);
console.log(`  home dir:    ${homeDir}`);
console.log(`  (state persists across runs; pass --fresh to reset both)\n`);

const result = spawnSync(process.execPath, [cli, ...forwardedArgs], {
  cwd: scratchDir,
  stdio: 'inherit',
  env: { ...process.env, HOME: homeDir, USERPROFILE: homeDir },
});

process.exit(result.status ?? 1);
