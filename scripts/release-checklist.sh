#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

version="$(node -e "console.log(require('./package.json').version)")"

echo "== release-checklist: $version =="

echo "-- 1/17: npm run check --"
npm run check

echo "-- 2/17: regenerate terminal UI catalog --"
npm run ui:catalog

echo "-- 3/17: presentation boundary --"
npm run presentation:boundary

echo "-- 4/17: npm run pack:dry --"
npm run pack:dry

echo "-- 5/17: cli:exhaustive --"
npm run cli:exhaustive

echo "-- 6/17: full 99-scenario matrix: dist --"
npm run cli:full-matrix:dist

echo "-- 7/17: full 99-scenario matrix: packed-npx --"
npm run cli:full-matrix:packed

echo "-- 8/17: cli:certify --"
npm run cli:certify

echo "-- 9/17: cli:certify:packed --"
npm run cli:certify:packed

echo "-- 10/17: doctor --smoke --"
node dist/sdd-agentic-flow.js doctor --smoke

echo "-- 11/17: human CLI input audit --"
npm run cli:human-audit

echo "-- 12/17: version consistency (package.json vs package-lock roots vs source contract) --"
npx tsx scripts/check-version-consistency.ts

echo "-- 13/17: no pinned sdd-agentic-flow@<version> examples remaining --"
if grep -rEn 'sdd-agentic-flow@[0-9]' README.md README.pt-BR.md docs/ 2>/dev/null; then
  echo "found a pinned sdd-agentic-flow@<version> reference above — examples must stay unpinned" >&2
  exit 1
fi
echo "no pinned sdd-agentic-flow@<version> references found"

echo "-- 14/17: documented CLI commands exist in the source command registry --"
npx tsx scripts/check-documented-commands.ts

echo "-- 15/17: bundled license coverage --"
npm run licenses:check

echo "-- 16/17: sanitize publishable files --"
npm run sanitize

echo "-- 17/17: summary --"
echo "PASS release-checklist: v${version} pronta para tag/publish"
