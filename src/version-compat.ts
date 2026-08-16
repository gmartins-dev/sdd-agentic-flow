// Minimal, vendored version-comparison primitive (Milestone 3). Not the npm `semver` package —
// this repository has zero runtime dependencies as a mechanically-enforced invariant (see the
// `package_integrity` check in src/sdd-agentic-flow.ts), so a `semver` dependency would break
// that promise. This file only covers the syntax the project actually uses: exact `x.y.z`,
// `>=x.y.z`, and `^x.y.z` (same major, >= minor.patch) — not the full semver range grammar.

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

type ParsedVersion = { major: number; minor: number; patch: number };
type VersionPart = keyof ParsedVersion;

function parseVersion(value: unknown): ParsedVersion | null {
  if (typeof value !== 'string') return null;
  const match = VERSION_PATTERN.exec(value.trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function compareVersions(a: string, b: string): number | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  for (const key of ['major', 'minor', 'patch'] as const satisfies readonly VersionPart[]) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  return 0;
}

function satisfiesRange(version: string, range: string): boolean {
  const parsedVersion = parseVersion(version);
  if (!parsedVersion || typeof range !== 'string') return false;
  const trimmed = range.trim();

  if (trimmed.startsWith('^')) {
    const base = parseVersion(trimmed.slice(1));
    if (!base) return false;
    if (parsedVersion.major !== base.major) return false;
    const baseVersion = `${base.major}.${base.minor}.${base.patch}`;
    const cmp = compareVersions(version, baseVersion);
    return cmp === 0 || (cmp !== null && cmp > 0);
  }

  if (trimmed.startsWith('>=')) {
    const base = parseVersion(trimmed.slice(2));
    if (!base) return false;
    const cmp = compareVersions(version, `${base.major}.${base.minor}.${base.patch}`);
    return cmp !== null && cmp >= 0;
  }

  const exact = parseVersion(trimmed);
  if (!exact) return false;
  return compareVersions(version, `${exact.major}.${exact.minor}.${exact.patch}`) === 0;
}

export { compareVersions, parseVersion, satisfiesRange };
