// Cross-platform replacement for the previous `env VAR=val npm pack --dry-run` shell script,
// which relied on POSIX `env`/`${VAR:-default}` syntax and broke under Windows' default
// npm script shell (cmd.exe). See docs/environment-compatibility.md (Milestone 2).

const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cacheDir =
  process.env.NPM_CONFIG_CACHE || path.join(os.tmpdir(), 'sdd-agentic-flow-npm-cache');

const result = spawnSync('npm', ['pack', '--dry-run'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NPM_CONFIG_CACHE: cacheDir },
});

process.exit(result.status ?? 1);
