import fs from 'node:fs';
import { isBuiltin } from 'node:module';
import path from 'node:path';

const root = process.cwd();
const licensePath = path.join(root, 'LICENSES', 'CLI-UI-BUNDLED.txt');
const bundlePath = path.join(root, 'dist', 'sdd-agentic-flow.js');
const artifactNoticePath = path.join(root, 'dist', 'third-party-notices.txt');
const roots = ['@clack/prompts', 'picocolors'];

function packageJsonPath(name: string): string {
  return path.join(root, 'node_modules', ...name.split('/'), 'package.json');
}

const packages = new Set<string>();
const pending = [...roots];
while (pending.length) {
  const name = pending.pop();
  if (!name || packages.has(name)) continue;
  const manifestPath = packageJsonPath(name);
  if (!fs.existsSync(manifestPath)) throw new Error(`bundled package is not installed: ${name}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    dependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  };
  packages.add(name);
  pending.push(...Object.keys(manifest.dependencies || {}));
  pending.push(...Object.keys(manifest.optionalDependencies || {}));
}

if (!fs.existsSync(bundlePath)) throw new Error('bundled CLI artifact is missing');
const notice = fs.readFileSync(licensePath, 'utf8');
if (!fs.existsSync(artifactNoticePath))
  throw new Error('bundled license notice artifact is missing');
if (fs.readFileSync(artifactNoticePath, 'utf8') !== notice)
  throw new Error('generated bundled license notice is stale');
const orderedPackages = [...packages].sort();
const missing = orderedPackages.filter((name) => !notice.includes(`## ${name} —`));
if (missing.length) throw new Error(`missing bundled license entries: ${missing.join(', ')}`);

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
if (
  [manifest.dependencies, manifest.optionalDependencies, manifest.peerDependencies].some(
    (dependencies) => Object.keys(dependencies || {}).length,
  )
)
  throw new Error('published CLI must not declare external runtime dependencies');

const bundle = fs.readFileSync(bundlePath, 'utf8');
for (const match of bundle.matchAll(/\b(?:require|import)\(\s*(['"])([^'"]+)\1\s*\)/g)) {
  if (!isBuiltin(match[2] ?? ''))
    throw new Error(`published CLI bundle contains an external runtime import: ${match[2]}`);
}

console.log(`PASS bundled licenses: ${orderedPackages.join(', ')}`);
