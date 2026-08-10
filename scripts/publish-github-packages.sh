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

if [[ -z "${NODE_AUTH_TOKEN:-}" ]]; then
  echo "NODE_AUTH_TOKEN is not set — required to authenticate against npm.pkg.github.com" >&2
  exit 1
fi

# actions/setup-node's generated .npmrc (written to $RUNNER_TEMP/.npmrc, pointed at by
# NPM_CONFIG_USERCONFIG, not $HOME/.npmrc) only maps NODE_AUTH_TOKEN to the registry-url it was
# configured with (registry.npmjs.org, for the public npm publish step). This alternate registry
# needs its own auth line, or npm publish fails with ENEEDAUTH. `npm config set` resolves the
# same config file npm itself would use (honors NPM_CONFIG_USERCONFIG when set, falls back to
# $HOME/.npmrc for a manual run per docs/publishing.md), so it stays correct in both contexts.
npm config set "//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}"

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
