import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { CANONICAL_COMMANDS } from '../src/command-registry';
import { CONTRACT_KINDS } from '../src/contract-kinds';
import { OFFICIAL_SKILLS } from '../src/skill-identity';

export type DocumentationFinding = { file: string; message: string };

export type ReleaseDocumentationState = {
  roadmap: string;
  changelog: string;
  packageVersion: string;
};

const DOCUMENTATION_EXEMPTIONS = new Set([
  'CHANGELOG.md',
  'ROADMAP.md',
  'docs/compatibility-matrix.md',
  'docs/compatibility-promise.md',
]);
const LEGACY_PATTERNS = [
  /\bsdd-agentic-flow[ \t]+install[ \t]+[a-z][a-z0-9-]*\b/gi,
  /\binstall[ \t]+(?:planning|execution|review|multi-task|full)\b/gi,
  /\binit[ \t]+--(?:preset|language|execution-mode|autonomy-level|interactive|en|br)\b/gi,
  /^##[ \t]+Packs\b/gim,
  /\bsaf-(?:config|install-intent|install-provenance)\/v2\b/gi,
  /\b(?:default|defaults to)[ \t`]*(?:guided|manual)\b/gi,
  /\bcompatible_with\b/g,
  /\bmetadata\.pack\b/g,
  /\bpresets\//g,
];
const REPRESENTATION_MODEL = 'docs/information-representation-model.md';
const ARTIFACT_CONTRACTS = 'shared/references/artifact-contracts.md';

function activeMarkdownFiles(root: string): string[] {
  return execFileSync('git', ['ls-files', '*.md'], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(root, file)))
    .filter((file) => !file.startsWith('.specs/') && !file.startsWith('.sdd-agentic-flow/'))
    .filter((file) => !DOCUMENTATION_EXEMPTIONS.has(file));
}

function addUnknownTokens(
  findings: DocumentationFinding[],
  file: string,
  content: string,
  pattern: RegExp,
  known: ReadonlySet<string>,
  label: string,
) {
  const seen = new Set<string>();
  for (const match of content.matchAll(pattern)) {
    const token = match[1];
    if (
      token &&
      ![
        'saf-skills-usage-guide',
        'saf-workspace',
        'saf-contract',
        'saf-skill-contract',
        'saf-config',
        'saf-install-intent',
        'saf-install-provenance',
        'saf-ascii-art',
      ].includes(token) &&
      !known.has(token) &&
      !seen.has(token)
    ) {
      findings.push({ file, message: `unknown ${label}: ${token}` });
      seen.add(token);
    }
  }
}

function technicalLiterals(content: string): string[] {
  return [...content.matchAll(/```[\s\S]*?```|`[^`\n]+`/g)].map((match) =>
    match[0].startsWith('```')
      ? match[0].replace(/^```[^\n]*\n?|\n?```$/g, '')
      : match[0].slice(1, -1),
  );
}

function addRepresentationFindings(
  findings: DocumentationFinding[],
  documents: ReadonlyMap<string, string>,
): void {
  if (!documents.has(REPRESENTATION_MODEL) && !documents.has(ARTIFACT_CONTRACTS)) return;
  const model = documents.get(REPRESENTATION_MODEL);
  if (!model) {
    findings.push({
      file: REPRESENTATION_MODEL,
      message: 'missing information representation model',
    });
  } else {
    if (!model.includes('## Contract-kind inventory'))
      findings.push({ file: REPRESENTATION_MODEL, message: 'missing contract-kind inventory' });
    for (const kind of CONTRACT_KINDS)
      if (!model.includes(`\`${kind}\``))
        findings.push({ file: REPRESENTATION_MODEL, message: `missing contract kind: ${kind}` });
  }
  const artifactContracts = documents.get(ARTIFACT_CONTRACTS);
  if (artifactContracts && /\bL2\b/.test(artifactContracts))
    findings.push({
      file: ARTIFACT_CONTRACTS,
      message: 'current artifact contract must not declare an L2 structured island',
    });
}

function parseVersion(value: string): [number, number, number] | null {
  const match = value
    .trim()
    .replace(/^v/, '')
    .match(/^(\d+)\.(\d+)\.(\d+)$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareVersions(left: [number, number, number], right: [number, number, number]): number {
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    if (leftValue !== rightValue) return leftValue - rightValue;
  }
  return 0;
}

function markerVersions(content: string, marker: 'Current release' | 'Planned release'): string[] {
  return [
    ...content.matchAll(new RegExp(`^${marker}:[ \\t]*v?(\\d+\\.\\d+\\.\\d+)[ \\t]*$`, 'gim')),
  ]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value));
}

function releaseBulletVersions(content: string): string[] {
  return content.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^- \*\*v?(\d+\.\d+\.\d+):\*\*/i);
    return match?.[1] && !/\bnext\b/i.test(line) ? [match[1]] : [];
  });
}

export function checkReleaseDocumentationState(
  state: ReleaseDocumentationState,
): DocumentationFinding[] {
  const findings: DocumentationFinding[] = [];
  const current = markerVersions(state.roadmap, 'Current release');
  const planned = markerVersions(state.roadmap, 'Planned release');
  const packageVersion = parseVersion(state.packageVersion);
  const changelogVersions = [
    ...state.changelog.matchAll(/^##[ \t]+v?(\d+\.\d+\.\d+)[ \t]*$/gim),
  ].map((match) => match[1]);
  const roadmapReleaseBullets = releaseBulletVersions(state.roadmap);

  if (current.length !== 1)
    findings.push({ file: 'ROADMAP.md', message: 'expected exactly one Current release marker' });
  if (planned.length > 1)
    findings.push({ file: 'ROADMAP.md', message: 'expected at most one Planned release marker' });
  if (!packageVersion) {
    findings.push({
      file: 'package.json',
      message: `invalid package version: ${state.packageVersion}`,
    });
  }
  if (current[0] && packageVersion && current[0] !== state.packageVersion.replace(/^v/, ''))
    findings.push({ file: 'ROADMAP.md', message: 'Current release does not match package.json' });
  if (current[0] && changelogVersions[0] && current[0] !== changelogVersions[0])
    findings.push({
      file: 'CHANGELOG.md',
      message: 'Current release does not match first CHANGELOG release',
    });
  if (planned[0] && current[0]) {
    const plannedVersion = parseVersion(planned[0]);
    const currentVersion = parseVersion(current[0]);
    if (plannedVersion && currentVersion && compareVersions(plannedVersion, currentVersion) <= 0)
      findings.push({
        file: 'ROADMAP.md',
        message: 'Planned release must be greater than Current release',
      });
  }

  if (current[0]) {
    const currentBulletCount = roadmapReleaseBullets.filter(
      (version) => version === current[0],
    ).length;
    if (currentBulletCount !== 1)
      findings.push({
        file: 'ROADMAP.md',
        message: `expected exactly one historical release bullet for Current release: ${current[0]}`,
      });
  }

  for (const line of state.roadmap.split(/\r?\n/)) {
    const match = line.match(/^- \*\*v?(\d+\.\d+\.\d+):\*\*/i);
    if (match && /\bnext\b/i.test(line))
      findings.push({
        file: 'ROADMAP.md',
        message: `release bullet still labeled as next: ${match[1]}`,
      });
  }

  for (const match of state.roadmap.matchAll(
    /Next release after[\s\S]*?—[ \t]*v?(\d+\.\d+\.\d+)/gim,
  )) {
    if (changelogVersions.includes(match[1]))
      findings.push({
        file: 'ROADMAP.md',
        message: `released version still labeled as next: ${match[1]}`,
      });
  }
  if (/v?\d+\.\d+\.\d+[ \t]*\(next patch\)/i.test(state.roadmap))
    findings.push({ file: 'ROADMAP.md', message: 'released version still labeled as next patch' });
  if (/v?\d+\.\d+\.\d+[ \t]*\(current baseline\)/i.test(state.roadmap))
    findings.push({
      file: 'ROADMAP.md',
      message: 'released version still labeled as current baseline',
    });

  return findings;
}

export function checkDocumentationContracts(
  documents: ReadonlyMap<string, string>,
): DocumentationFinding[] {
  const findings: DocumentationFinding[] = [];
  const skills = new Set(OFFICIAL_SKILLS);
  const commands = new Set(
    CANONICAL_COMMANDS.map((command) => command.split(' ')[0]).filter(
      (command): command is string => Boolean(command),
    ),
  );

  for (const [file, content] of documents) {
    for (const pattern of LEGACY_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        findings.push({ file, message: `retired documentation vocabulary: ${pattern.source}` });
      }
    }

    for (const literal of technicalLiterals(content)) {
      addUnknownTokens(
        findings,
        file,
        literal,
        /\b(saf-[a-z][a-z0-9-]*)\b/g,
        skills,
        'skill reference',
      );
      addUnknownTokens(
        findings,
        file,
        literal,
        /\bsdd-agentic-flow\s+([a-z][a-z0-9-]*)\b/g,
        commands,
        'CLI command',
      );
    }
  }

  addRepresentationFindings(findings, documents);

  return findings;
}

export function loadActiveDocumentation(root = process.cwd()): Map<string, string> {
  const documents = new Map<string, string>();
  for (const file of activeMarkdownFiles(root))
    documents.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  if (fs.existsSync(path.join(root, REPRESENTATION_MODEL)) && !documents.has(REPRESENTATION_MODEL))
    documents.set(
      REPRESENTATION_MODEL,
      fs.readFileSync(path.join(root, REPRESENTATION_MODEL), 'utf8'),
    );
  return documents;
}

export function loadReleaseDocumentationState(root = process.cwd()): ReleaseDocumentationState {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    version?: string;
  };
  return {
    roadmap: fs.readFileSync(path.join(root, 'ROADMAP.md'), 'utf8'),
    changelog: fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'),
    packageVersion: packageJson.version ?? '',
  };
}

if (process.argv[1]?.endsWith('check-documentation-contracts.ts')) {
  const findings = [
    ...checkDocumentationContracts(loadActiveDocumentation()),
    ...checkReleaseDocumentationState(loadReleaseDocumentationState()),
  ];
  for (const finding of findings) process.stderr.write(`${finding.file}: ${finding.message}\n`);
  if (findings.length) process.exitCode = 1;
  else console.log('PASS documentation contracts');
}
