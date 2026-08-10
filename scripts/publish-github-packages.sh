#!/usr/bin/env bash
# Publish the current package.json version to GitHub Packages as
# @gmartins-dev/sdd-agentic-flow. The public npm name (sdd-agentic-flow) stays unchanged
# in the committed package.json; this script only rewrites it temporarily.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [[ ! -f package.json ]]; then
  echo "package.json not found" >&2
  exit 1
fi

restore_package_json() {
  if [[ -f package.json.bak ]]; then
    mv package.json.bak package.json
  fi
}
trap restore_package_json EXIT

cp package.json package.json.bak
node <<'NODE'
const fs = require('node:fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.name = '@gmartins-dev/sdd-agentic-flow';
pkg.publishConfig = { registry: 'https://npm.pkg.github.com' };
fs.writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);
NODE

npm publish --registry=https://npm.pkg.github.com
