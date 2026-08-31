#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

version="$(node -e "console.log(require('./package.json').version)")"

echo "== release-checklist: $version =="

echo "-- 1/14: npm run check --"
npm run check

echo "-- 2/14: npm run pack:dry --"
npm run pack:dry

echo "-- 3/14: cli:exhaustive --"
npm run cli:exhaustive

echo "-- 4/14: full 99-scenario matrix: dist --"
npm run cli:full-matrix:dist

echo "-- 5/14: full 99-scenario matrix: packed-npx --"
npm run cli:full-matrix:packed

echo "-- 6/14: cli:certify --"
npm run cli:certify

echo "-- 7/14: cli:certify:packed --"
npm run cli:certify:packed

echo "-- 8/14: doctor --smoke --"
node dist/sdd-agentic-flow.js doctor --smoke

echo "-- 9/14: human CLI input audit --"
npm run cli:human-audit

echo "-- 10/14: version consistency (package.json vs package-lock roots vs source contract) --"
npx tsx scripts/check-version-consistency.ts

echo "-- 11/14: no pinned sdd-agentic-flow@<version> examples remaining --"
if grep -rEn 'sdd-agentic-flow@[0-9]' README.md README.pt-BR.md docs/ 2>/dev/null; then
  echo "found a pinned sdd-agentic-flow@<version> reference above — examples must stay unpinned" >&2
  exit 1
fi
echo "no pinned sdd-agentic-flow@<version> references found"

echo "-- 12/14: documented CLI commands exist in the source command registry --"
npx tsx scripts/check-documented-commands.ts

echo "-- 13/14: bundled license coverage --"
npm run licenses:check

echo "-- 14/14: summary --"
echo "PASS release-checklist: v${version} pronta para tag/publish"
