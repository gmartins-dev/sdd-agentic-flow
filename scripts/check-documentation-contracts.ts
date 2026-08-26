import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { CANONICAL_COMMANDS } from '../src/command-registry';
import { CONTRACT_KINDS } from '../src/contract-kinds';
import { OFFICIAL_SKILLS } from '../src/skill-identity';

export type DocumentationFinding = { file: string; message: string };

const DOCUMENTATION_EXEMPTIONS = new Set([
  'CHANGELOG.md',
  'ROADMAP.md',
  'docs/compatibility-matrix.md',
  'docs/compatibility-promise.md',
]);
const LEGACY_PATTERNS = [
  /\bsdd-agentic-flow[ \t]+install[ \t]+[a-z][a-z0-9-]*\b/gi,
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

if (process.argv[1]?.endsWith('check-documentation-contracts.ts')) {
  const findings = checkDocumentationContracts(loadActiveDocumentation());
  for (const finding of findings) process.stderr.write(`${finding.file}: ${finding.message}\n`);
  if (findings.length) process.exitCode = 1;
  else console.log('PASS documentation contracts');
}
