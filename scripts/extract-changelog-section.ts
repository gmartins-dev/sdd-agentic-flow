// Extracts the prose between a `## X.Y.Z` header and the next `## ` header (or end of file)
// from CHANGELOG.md. Used by .github/workflows/release.yml (Milestone 3, v1.6.0) both as the
// safeguard against tagging/releasing an accidental version bump with no matching changelog
// entry, and as the source of GitHub release notes.

const fs = require('node:fs');

function extractChangelogSection(version: string, changelogPath = 'CHANGELOG.md'): string | null {
  const content = fs.readFileSync(changelogPath, 'utf8');
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const header = new RegExp(`^## ${escaped}\\s*$`, 'm');
  const match = header.exec(content);
  if (!match) return null;
  const rest = content.slice(match.index + match[0].length);
  const nextHeaderOffset = rest.search(/^## /m);
  const section = nextHeaderOffset === -1 ? rest : rest.slice(0, nextHeaderOffset);
  return section.trim();
}

module.exports = { extractChangelogSection };

if (require.main === module) {
  const version = process.argv[2];
  if (!version) {
    console.error('usage: node scripts/extract-changelog-section.js <version>');
    process.exit(2);
  }
  const section = extractChangelogSection(version);
  if (section === null) {
    console.error(`no '## ${version}' section found in CHANGELOG.md`);
    process.exit(1);
  }
  process.stdout.write(`${section}\n`);
}
