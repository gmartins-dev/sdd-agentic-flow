#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

version="$(node -e "console.log(require('./package.json').version)")"

echo "== release-checklist: $version =="

echo "-- 1/6: npm run check --"
npm run check

echo "-- 2/6: npm run pack:dry --"
npm run pack:dry

echo "-- 3/6: doctor --smoke --"
node bin/sdd-agentic-flow.js doctor --smoke

echo "-- 4/6: version consistency (package.json vs skills/*/SKILL.md vs presets/*.json) --"
node <<'NODE'
const fs = require('node:fs');
const { compareVersions } = require('./bin/version-compat.js');

const packageVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const drifted = [];

for (const skill of fs.readdirSync('skills', { withFileTypes: true })) {
  if (!skill.isDirectory()) continue;
  const file = `skills/${skill.name}/SKILL.md`;
  const content = fs.readFileSync(file, 'utf8');
  const match = content.match(/^\s*version:\s*(\S+)\s*$/m);
  const found = match ? match[1] : null;
  if (!found || compareVersions(found, packageVersion) !== 0) drifted.push(`${file} (version: ${found})`);
}

for (const file of fs.readdirSync('presets').filter((name) => name.endsWith('.json'))) {
  const preset = JSON.parse(fs.readFileSync(`presets/${file}`, 'utf8'));
  if (!preset.version || compareVersions(preset.version, packageVersion) !== 0)
    drifted.push(`presets/${file} (version: ${preset.version})`);
}

if (drifted.length) {
  console.error(`version mismatch against package.json (${packageVersion}):`);
  for (const entry of drifted) console.error(`  - ${entry}`);
  process.exit(1);
}
console.log(`all skill and preset versions match package.json (${packageVersion})`);
NODE

echo "-- 5/6: no pinned sdd-agentic-flow@<version> examples remaining --"
if grep -rEn 'sdd-agentic-flow@[0-9]' README.md README.pt-BR.md docs/ 2>/dev/null; then
  echo "found a pinned sdd-agentic-flow@<version> reference above — examples must stay unpinned" >&2
  exit 1
fi
echo "no pinned sdd-agentic-flow@<version> references found"

echo "-- 6/6: summary --"
echo "PASS release-checklist: v${version} pronta para tag/publish"
