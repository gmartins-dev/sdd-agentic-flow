import fs from 'node:fs';
import path from 'node:path';

import { OFFICIAL_SKILLS } from '../src/skill-identity';

export type ConsumerClosureStatus = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

export function consumerClosureExitCode(status: ConsumerClosureStatus): 0 | 1 | 2 {
  if (status === 'PASS') return 0;
  return status === 'INCONCLUSIVE' ? 2 : 1;
}

export type ConsumerClosureEntry = {
  relativePath: string;
  kind: 'file' | 'symlink';
  content?: string;
  target?: string;
  readError?: string;
};

export type ConsumerClosureFinding = {
  rule: string;
  file: string;
  location: number;
  reference: string;
  normalizedReference: string;
  category: 'bundle-local' | 'source-maintenance' | 'inspection';
  evidence: string;
  impact: string;
  remediation: string;
};

export type ConsumerClosureResult = {
  status: ConsumerClosureStatus;
  findings: ConsumerClosureFinding[];
  inspectedPaths: string[];
  notes: string[];
};

export type ConsumerClosureInput = {
  entries: readonly ConsumerClosureEntry[];
  expectedPaths?: readonly string[];
};

const SHARED_FILES = [
  'baselines/registry.yml',
  'evals/evals.json',
  'language-profiles/en-US.md',
  'language-profiles/pt-BR.md',
  'references/action-vocabulary.md',
  'references/artifact-contracts.md',
  'references/autonomy-guardrails.md',
  'references/bounded-execution.md',
  'references/canonical-vocabulary.md',
  'references/change-impact-validation.md',
  'references/decision-gates.md',
  'references/effective-defaults.md',
  'references/engineering-principles.md',
  'references/evidence-standard.md',
  'references/execution-isolation.md',
  'references/feature-profiles.md',
  'references/handoff-standard.md',
  'references/language-policy.md',
  'references/prompt-authoring-standard.md',
  'references/reviewability.md',
  'references/sdd-global-guidance.md',
  'references/skill-authoring-standard.md',
  'references/spec-lifecycle.md',
  'references/system-invariants.md',
  'references/task-context-package.md',
  'references/task-slicing.md',
  'references/tdd-baseline.md',
  'references/tlc-baseline.md',
  'references/work-types.md',
  'references/workflow-routing.md',
  'references/workflow-safety.md',
  'references/workspace-initialization.md',
  'templates/check-report.template.md',
  'templates/context.template.md',
  'templates/design.template.md',
  'templates/discovery.template.md',
  'templates/domain-glossary.template.md',
  'templates/explanation.template.md',
  'templates/handoff.template.md',
  'templates/pr-description.template.md',
  'templates/pr-fix.template.md',
  'templates/pr-review.template.md',
  'templates/spec.template.md',
  'templates/task-prompt.template.md',
  'templates/tasks.template.md',
  'templates/usage.template.md',
  'templates/usage.template.pt-BR.md',
  'templates/validation-report.template.md',
  'templates/workflow-diagram.mmd',
] as const;

const ALLOWED_GENERATED_SHARED_FILES = new Set(['sdd-agentic-flow-shared/install-provenance.yml']);

export function expectedInstalledPaths(): string[] {
  return [
    ...OFFICIAL_SKILLS.flatMap((skill) => [`${skill}/SKILL.md`, `${skill}/saf-contract.yml`]),
    ...SHARED_FILES.map((file) => `sdd-agentic-flow-shared/${file}`),
  ].sort((left, right) => left.localeCompare(right));
}

function normalizeRelative(value: string): string | null {
  if (!value || path.posix.isAbsolute(value) || value.includes('\\')) return null;
  const normalized = path.posix.normalize(value);
  return normalized === '..' || normalized.startsWith('../') ? null : normalized;
}

function splitDestination(
  destination: string,
): { pathname: string; fragment: string | null } | null {
  const hash = destination.indexOf('#');
  const pathname = hash === -1 ? destination : destination.slice(0, hash);
  const rawFragment = hash === -1 ? null : destination.slice(hash + 1);
  if (!rawFragment) return { pathname, fragment: null };
  try {
    return { pathname, fragment: decodeURIComponent(rawFragment) };
  } catch {
    return null;
  }
}

function isExternal(destination: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(destination);
}

function headingSlug(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/gu, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '');
}

function headings(content: string): Set<string> {
  const result = new Set<string>();
  const duplicates = new Set<string>();
  for (const match of content.matchAll(/^#{1,6}\s+(.+?)(?:\s+#+)?\s*$/gmu)) {
    const slug = headingSlug(match[1] ?? '');
    if (!slug) continue;
    if (result.has(slug)) duplicates.add(slug);
    result.add(slug);
  }
  for (const duplicate of duplicates) result.delete(duplicate);
  return result;
}

function lineAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

type MarkdownReference = { destination: string; location: number };

function markdownReferences(content: string): MarkdownReference[] {
  const definitions = new Map<string, string>();
  for (const match of content.matchAll(/^\s*\[([^\]]+)\]\s*:\s*(?:<([^>]+)>|(\S+))/gmu)) {
    const label = match[1]?.trim().toLocaleLowerCase();
    const destination = match[2] ?? match[3];
    if (label && destination) definitions.set(label, destination);
  }
  const references: MarkdownReference[] = [];
  for (const match of content.matchAll(/(?<!!)\[[^\]\n]*\]\((?:<([^>]+)>|([^\s)]+))[^)]*\)/gmu)) {
    const destination = match[1] ?? match[2];
    if (destination) references.push({ destination, location: lineAt(content, match.index) });
  }
  for (const match of content.matchAll(/(?<!!)\[[^\]\n]+\]\[([^\]\n]+)\]/gmu)) {
    const destination = definitions.get((match[1] ?? '').trim().toLocaleLowerCase());
    if (destination) references.push({ destination, location: lineAt(content, match.index) });
  }
  return references;
}

function literalSourceReferences(content: string): MarkdownReference[] {
  const results: MarkdownReference[] = [];
  for (const match of content.matchAll(/`((?:docs|scripts)\/[A-Za-z0-9_./-]+)`/gu)) {
    const destination = match[1];
    if (destination) results.push({ destination, location: lineAt(content, match.index) });
  }
  return results;
}

function finding(
  rule: string,
  file: string,
  location: number,
  reference: string,
  normalizedReference: string,
  category: ConsumerClosureFinding['category'],
  evidence: string,
  impact: string,
  remediation: string,
): ConsumerClosureFinding {
  return {
    rule,
    file,
    location,
    reference,
    normalizedReference,
    category,
    evidence,
    impact,
    remediation,
  };
}

function resolveEntry(
  entries: ReadonlyMap<string, ConsumerClosureEntry>,
  source: string,
  destination: string,
): { path?: string; error?: 'escape' | 'missing' | 'symlink' | 'unreadable' } {
  const parsed = splitDestination(destination);
  if (!parsed) return { error: 'unreadable' };
  const relative = parsed.pathname || path.posix.basename(source);
  const target = normalizeRelative(path.posix.join(path.posix.dirname(source), relative));
  if (!target) return { error: 'escape' };
  const seen = new Set<string>();
  let current = target;
  while (true) {
    if (seen.has(current)) return { error: 'symlink' };
    seen.add(current);
    const entry = entries.get(current);
    if (!entry) return { error: 'missing' };
    if (entry.readError) return { error: 'unreadable' };
    if (entry.kind === 'file')
      return entry.content === undefined ? { error: 'unreadable' } : { path: current };
    const linked = normalizeRelative(
      path.posix.join(path.posix.dirname(current), entry.target ?? ''),
    );
    if (!linked) return { error: 'symlink' };
    current = linked;
  }
}

export function analyzeConsumerClosure(input: ConsumerClosureInput): ConsumerClosureResult {
  const expected = new Set(input.expectedPaths ?? expectedInstalledPaths());
  const entries = new Map<string, ConsumerClosureEntry>();
  const findings: ConsumerClosureFinding[] = [];
  const notes: string[] = [];
  let inconclusive = false;

  for (const entry of input.entries) {
    const normalized = normalizeRelative(entry.relativePath);
    if (!normalized) {
      inconclusive = true;
      findings.push(
        finding(
          'SAF-CLOSURE-005',
          entry.relativePath,
          0,
          entry.relativePath,
          entry.relativePath,
          'inspection',
          'installed tree contains an unsafe or unreadable path',
          'inspection is incomplete',
          'materialize a safe installed tree before retrying',
        ),
      );
      continue;
    }
    entries.set(normalized, { ...entry, relativePath: normalized });
  }

  for (const expectedPath of expected) {
    if (!entries.has(expectedPath))
      findings.push(
        finding(
          'SAF-CLOSURE-001',
          expectedPath,
          0,
          expectedPath,
          expectedPath,
          'inspection',
          'required installed path is absent',
          'consumer closure cannot be established',
          'include the required path in the installed bundle',
        ),
      );
  }

  for (const entry of entries.values()) {
    if (entry.readError) {
      inconclusive = true;
      findings.push(
        finding(
          'SAF-CLOSURE-005',
          entry.relativePath,
          0,
          entry.relativePath,
          entry.relativePath,
          'inspection',
          entry.readError,
          'content could not be inspected',
          'repair filesystem readability or encoding and retry',
        ),
      );
    }
    const [first] = entry.relativePath.split('/');
    if (
      first &&
      (OFFICIAL_SKILLS as readonly string[]).includes(first) &&
      !expected.has(entry.relativePath)
    )
      findings.push(
        finding(
          'SAF-CLOSURE-002',
          entry.relativePath,
          0,
          entry.relativePath,
          entry.relativePath,
          'inspection',
          'unexpected file inside an official Skill directory',
          'manifest and installed content disagree',
          'declare the file in the expected manifest or remove it',
        ),
      );
    if (entry.kind === 'symlink') {
      const resolved = resolveEntry(entries, 'root.md', entry.relativePath);
      if (resolved.error)
        findings.push(
          finding(
            'SAF-CLOSURE-006',
            entry.relativePath,
            0,
            entry.target ?? '',
            entry.target ?? '',
            'bundle-local',
            `symlink resolution failed: ${resolved.error}`,
            'installed tree contains a broken or unsafe symlink',
            'repair the symlink target within the installed root',
          ),
        );
    }
    if (
      entry.relativePath.startsWith('sdd-agentic-flow-shared/') &&
      !expected.has(entry.relativePath)
    ) {
      if (ALLOWED_GENERATED_SHARED_FILES.has(entry.relativePath))
        notes.push(`generated shared file: ${entry.relativePath}`);
      else
        findings.push(
          finding(
            'SAF-CLOSURE-003',
            entry.relativePath,
            0,
            entry.relativePath,
            entry.relativePath,
            'inspection',
            'shared file is outside the expected manifest and policy exception list',
            'installed shared layout is not fully classified',
            'declare the file as required or generated, or remove it',
          ),
        );
    }
  }

  for (const [file, entry] of entries) {
    if (
      !file.endsWith('.md') ||
      entry.kind !== 'file' ||
      entry.readError ||
      entry.content === undefined
    )
      continue;
    for (const reference of markdownReferences(entry.content)) {
      if (isExternal(reference.destination)) continue;
      const parsed = splitDestination(reference.destination);
      if (!parsed) {
        inconclusive = true;
        findings.push(
          finding(
            'SAF-CLOSURE-005',
            file,
            reference.location,
            reference.destination,
            reference.destination,
            'inspection',
            'link contains malformed percent escaping',
            'target cannot be determined',
            'repair the local link destination',
          ),
        );
        continue;
      }
      const resolved = resolveEntry(entries, file, reference.destination);
      if (resolved.error) {
        const rule =
          resolved.error === 'escape'
            ? 'SAF-CLOSURE-004'
            : resolved.error === 'unreadable'
              ? 'SAF-CLOSURE-005'
              : 'SAF-CLOSURE-006';
        if (resolved.error === 'unreadable') inconclusive = true;
        findings.push(
          finding(
            rule,
            file,
            reference.location,
            reference.destination,
            reference.destination,
            'bundle-local',
            `local link resolution failed: ${resolved.error}`,
            'consumer cannot rely on this installed reference',
            'repair or remove the bundle-local reference',
          ),
        );
        continue;
      }
      if (parsed.fragment && resolved.path) {
        const target = entries.get(resolved.path);
        const targetHeadings = headings(target?.content ?? '');
        const slug = headingSlug(parsed.fragment);
        if (!slug || !targetHeadings.has(slug))
          findings.push(
            finding(
              'SAF-CLOSURE-008',
              file,
              reference.location,
              reference.destination,
              `${resolved.path}#${slug}`,
              'bundle-local',
              'Markdown heading fragment is absent or ambiguous',
              'consumer link cannot reach its declared section',
              'repair the target heading or fragment',
            ),
          );
      }
    }
    for (const reference of literalSourceReferences(entry.content))
      findings.push(
        finding(
          'SAF-CLOSURE-007',
          file,
          reference.location,
          reference.destination,
          reference.destination,
          'source-maintenance',
          'installed content references a repository-only path',
          'consumer is directed to unavailable maintenance content',
          'replace the reference with consumer-valid guidance',
        ),
      );
  }

  const sortedFindings = findings.sort((left, right) => {
    const leftKey = `${left.rule}\u0000${left.file}\u0000${left.normalizedReference}`;
    const rightKey = `${right.rule}\u0000${right.file}\u0000${right.normalizedReference}`;
    return leftKey.localeCompare(rightKey) || left.location - right.location;
  });
  const status: ConsumerClosureStatus = inconclusive
    ? 'INCONCLUSIVE'
    : sortedFindings.length > 0
      ? 'FAIL'
      : 'PASS';
  return {
    status,
    findings: sortedFindings,
    inspectedPaths: [...entries.keys()].sort((left, right) => left.localeCompare(right)),
    notes: notes.sort((left, right) => left.localeCompare(right)),
  };
}

export function materializeConsumerTree(root: string): ConsumerClosureEntry[] {
  const entries: ConsumerClosureEntry[] = [];
  const visit = (directory: string, relative = '') => {
    let children: fs.Dirent[];
    try {
      children = fs.readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      entries.push({
        relativePath: relative || '.',
        kind: 'file',
        readError: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    for (const child of children.sort((left, right) => left.name.localeCompare(right.name))) {
      const childRelative = relative ? `${relative}/${child.name}` : child.name;
      const target = path.join(directory, child.name);
      try {
        if (child.isDirectory()) {
          visit(target, childRelative);
          continue;
        }
        if (child.isSymbolicLink()) {
          entries.push({
            relativePath: childRelative,
            kind: 'symlink',
            target: fs.readlinkSync(target),
          });
          continue;
        }
        const content = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(target));
        entries.push({ relativePath: childRelative, kind: 'file', content });
      } catch (error) {
        entries.push({
          relativePath: childRelative,
          kind: 'file',
          readError: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };
  visit(root);
  return entries;
}

export function materializeSourceProjection(packageRoot: string): ConsumerClosureEntry[] {
  const materializeAt = (root: string, prefix: string) =>
    materializeConsumerTree(root).map((entry) => ({
      ...entry,
      relativePath: `${prefix}/${entry.relativePath}`,
    }));
  return [
    ...OFFICIAL_SKILLS.flatMap((skill) =>
      materializeAt(path.join(packageRoot, 'skills', skill), skill),
    ),
    ...materializeAt(path.join(packageRoot, 'shared'), 'sdd-agentic-flow-shared'),
  ];
}

export function renderConsumerClosureReport(result: ConsumerClosureResult): string {
  const lines = [
    '# Consumer closure report',
    '',
    `Status: ${result.status}`,
    '',
    '## Findings',
    '',
  ];
  if (!result.findings.length) lines.push('- none');
  for (const item of result.findings) {
    lines.push(
      `- [${item.rule}] ${item.file}:${item.location} — ${item.reference} (${item.category}); ${item.remediation}`,
    );
  }
  lines.push('', '## Inspected paths', '');
  for (const inspected of result.inspectedPaths) lines.push(`- ${inspected}`);
  if (result.notes.length) {
    lines.push('', '## Notes', '');
    for (const note of result.notes) lines.push(`- ${note}`);
  }
  return `${lines.join('\n')}\n`;
}
