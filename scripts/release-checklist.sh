#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

version="$(node -e "console.log(require('./package.json').version)")"

echo "== release-checklist: $version =="

echo "-- 1/7: npm run check --"
npm run check

echo "-- 2/7: npm run pack:dry --"
npm run pack:dry

echo "-- 3/7: doctor --smoke --"
node bin/sdd-agentic-flow.js doctor --smoke

echo "-- 4/7: version consistency (package.json vs skills/*/SKILL.md vs presets/*.json) --"
node <<'NODE'
const { checkVersionConsistency } = require('./scripts/check-version-consistency.js');

const { packageVersion, skills, presets } = checkVersionConsistency();
const drifted = [
  ...skills.filter((entry) => entry.drifted).map((entry) => `${entry.file} (version: ${entry.version})`),
  ...presets.filter((entry) => entry.drifted).map((entry) => `${entry.file} (version: ${entry.version})`),
];

if (drifted.length) {
  console.error(`version mismatch against package.json (${packageVersion}):`);
  for (const entry of drifted) console.error(`  - ${entry}`);
  process.exit(1);
}
console.log(`all skill and preset versions match package.json (${packageVersion})`);
NODE

echo "-- 5/7: no pinned sdd-agentic-flow@<version> examples remaining --"
if grep -rEn 'sdd-agentic-flow@[0-9]' README.md README.pt-BR.md docs/ 2>/dev/null; then
  echo "found a pinned sdd-agentic-flow@<version> reference above — examples must stay unpinned" >&2
  exit 1
fi
echo "no pinned sdd-agentic-flow@<version> references found"

echo "-- 6/7: documented CLI commands exist in bin/sdd-agentic-flow.js --"
node <<'NODE'
const fs = require('node:fs');

const cliSource = fs.readFileSync('bin/sdd-agentic-flow.js', 'utf8');
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

echo "-- 7/7: summary --"
echo "PASS release-checklist: v${version} pronta para tag/publish"
