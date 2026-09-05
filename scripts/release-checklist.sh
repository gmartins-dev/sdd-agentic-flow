#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

version="$(node -e "console.log(require('./package.json').version)")"

echo "== release-checklist: $version =="

echo "-- 1/19: npm run check --"
npm run check

echo "-- 2/19: regenerate terminal UI catalog --"
npm run ui:catalog

echo "-- 3/19: presentation boundary --"
npm run presentation:boundary

echo "-- 4/19: npm run pack:dry --"
npm run pack:dry

echo "-- 5/19: cli:exhaustive --"
npm run cli:exhaustive

echo "-- 6/19: full 99-scenario matrix: dist --"
npm run cli:full-matrix:dist

echo "-- 7/19: full 99-scenario matrix: packed-npx --"
npm run cli:full-matrix:packed

echo "-- 8/19: cli:certify --"
npm run cli:certify

echo "-- 9/19: cli:certify:packed --"
npm run cli:certify:packed

echo "-- 10/19: brand motion black-box: dist --"
npm run cli:brand-motion:dist

echo "-- 11/19: brand motion black-box: packed --"
npm run cli:brand-motion:packed

echo "-- 12/19: doctor --smoke --"
node dist/sdd-agentic-flow.js doctor --smoke

echo "-- 13/19: human CLI input audit --"
npm run cli:human-audit

echo "-- 14/19: version consistency (package.json vs package-lock roots vs source contract) --"
npx tsx scripts/check-version-consistency.ts

echo "-- 15/19: no pinned sdd-agentic-flow@<version> examples remaining --"
if grep -rEn 'sdd-agentic-flow@[0-9]' README.md README.pt-BR.md docs/ 2>/dev/null; then
  echo "found a pinned sdd-agentic-flow@<version> reference above — examples must stay unpinned" >&2
  exit 1
fi
echo "no pinned sdd-agentic-flow@<version> references found"

echo "-- 16/19: documented CLI commands exist in the source command registry --"
npx tsx scripts/check-documented-commands.ts

echo "-- 17/19: bundled license coverage --"
npm run licenses:check

echo "-- 18/19: sanitize publishable files --"
npm run sanitize

echo "-- 19/19: summary --"
echo "PASS release-checklist: v${version} pronta para tag/publish"
