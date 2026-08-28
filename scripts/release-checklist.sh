#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

version="$(node -e "console.log(require('./package.json').version)")"

echo "== release-checklist: $version =="

echo "-- 1/11: npm run check --"
npm run check

echo "-- 2/11: npm run pack:dry --"
npm run pack:dry

echo "-- 3/11: cli:exhaustive --"
npm run cli:exhaustive

echo "-- 4/11: cli:certify --"
npm run cli:certify

echo "-- 5/11: cli:certify:packed --"
npm run cli:certify:packed

echo "-- 6/11: doctor --smoke --"
node dist/sdd-agentic-flow.js doctor --smoke

echo "-- 7/11: human CLI input audit --"
npm run cli:human-audit

echo "-- 8/11: version consistency (package.json vs package-lock roots vs dist/) --"
npx tsx scripts/check-version-consistency.ts

echo "-- 9/11: no pinned sdd-agentic-flow@<version> examples remaining --"
if grep -rEn 'sdd-agentic-flow@[0-9]' README.md README.pt-BR.md docs/ 2>/dev/null; then
  echo "found a pinned sdd-agentic-flow@<version> reference above — examples must stay unpinned" >&2
  exit 1
fi
echo "no pinned sdd-agentic-flow@<version> references found"

echo "-- 10/11: documented CLI commands exist in dist/sdd-agentic-flow.js --"
node <<'NODE'
const fs = require('node:fs');

const cliSource = fs.readFileSync('dist/sdd-agentic-flow.js', 'utf8');
const dispatched = new Set(
  [...cliSource.matchAll(/command\s*===\s*'([a-z-]+)'/g)].map((m) => m[1]),
);
// Always valid even though they short-circuit before the command dispatch above.
for (const alwaysValid of ['list', 'help', 'version']) dispatched.add(alwaysValid);

const { execFileSync } = require('node:child_process');
const docFiles = execFileSync('git', ['ls-files', '*.md', ':!.specs/**'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)
  .filter((file) => file === 'README.md' || file === 'README.pt-BR.md' || file.startsWith('docs/'));

const cited = new Set();
for (const file of docFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const match of content.matchAll(/npx sdd-agentic-flow ([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
    cited.add(match[1]);
  }
}

const missing = [...cited].filter((cmd) => !dispatched.has(cmd));
if (missing.length) {
  console.error(`documented command(s) not found in CLI dispatch: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`all ${cited.size} documented command(s) exist in the CLI dispatch`);
NODE

echo "-- 11/11: summary --"
echo "PASS release-checklist: v${version} pronta para tag/publish"
