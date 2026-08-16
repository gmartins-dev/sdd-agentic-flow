// Extracts a flow-style YAML array field from frontmatter text. Handles both
// `field: [a, b, c]` and the multi-line style `field:\n  [a, b, c]` (used by
// skills/saf-route/SKILL.md) — `[^\]]` already matches across the line break,
// so no `s` flag is needed.
function parseContractArray(frontmatter: string, field: string): string[] | null {
  const match = frontmatter.match(new RegExp(`${field}:\\s*\\[([^\\]]*)\\]`));
  if (!match?.[1]) return null;
  return match[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

// Plain DFS 3-color cycle detector, no library.
// adjacency: Map<string, string[]>. Edges to a key not present in the map are
// ignored here (dangling references are a referential-integrity failure,
// reported separately, not a cycle).
// Returns the closed cycle path (e.g. ['a', 'b', 'a']) or null.
function findCycle(adjacency: Map<string, string[]>): string[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map([...adjacency.keys()].map((key) => [key, WHITE]));
  const stack: string[] = [];
  let found: string[] | null = null;

  const visit = (node: string): void => {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      if (!adjacency.has(next)) continue;
      if (color.get(next) === GRAY) {
        found = [...stack.slice(stack.indexOf(next)), next];
        return;
      }
      if (color.get(next) === WHITE) {
        visit(next);
        if (found) return;
      }
    }
    stack.pop();
    color.set(node, BLACK);
  };

  for (const node of adjacency.keys()) {
    if (color.get(node) === WHITE) visit(node);
    if (found) break;
  }
  return found;
}

type SkillContract = { name: string; frontmatter: string };

type ValidateContractOptions = {
  knownBaselineIds?: string[] | null;
};

type ValidateContractResult = {
  failures: string[];
  cycles: string[][];
};

function validateContractReferences(
  skills: SkillContract[],
  options: ValidateContractOptions = {},
): ValidateContractResult {
  const names = new Set(skills.map((skill) => skill.name));
  const dependsOnGraph = new Map<string, string[]>();
  const extendsGraph = new Map<string, string[]>();
  const failures: string[] = [];

  for (const { name, frontmatter } of skills) {
    const dependsOn = parseContractArray(frontmatter, 'depends_on') ?? [];
    dependsOnGraph.set(name, dependsOn);
    for (const target of dependsOn)
      if (!names.has(target))
        failures.push(`${name}: depends_on references unknown skill '${target}'`);

    const extendsMatch = frontmatter.match(/^extends:\s*(\S+)\s*$/m);
    const extendsTarget = extendsMatch?.[1] && extendsMatch[1] !== 'null' ? extendsMatch[1] : null;
    extendsGraph.set(name, extendsTarget ? [extendsTarget] : []);

    if (options.knownBaselineIds) {
      const baseline = parseContractArray(frontmatter, 'baseline') ?? [];
      for (const id of baseline)
        if (!options.knownBaselineIds.includes(id))
          failures.push(`${name}: baseline references unknown baseline id '${id}'`);
    }
  }

  const cycles: string[][] = [];
  const dependsOnCycle = findCycle(dependsOnGraph);
  if (dependsOnCycle) cycles.push(dependsOnCycle);
  const extendsCycle = findCycle(extendsGraph);
  if (extendsCycle) cycles.push(extendsCycle);

  return { failures, cycles };
}

export type { SkillContract, ValidateContractOptions, ValidateContractResult };
export { findCycle, parseContractArray, validateContractReferences };
