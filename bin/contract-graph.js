'use strict';

// Extracts a flow-style YAML array field from frontmatter text. Handles both
// `field: [a, b, c]` and the multi-line style `field:\n  [a, b, c]` (used by
// skills/sdd-route/SKILL.md) — `[^\]]` already matches across the line break,
// so no `s` flag is needed.
function parseContractArray(frontmatter, field) {
  const match = frontmatter.match(new RegExp(`${field}:\\s*\\[([^\\]]*)\\]`));
  if (!match) return null;
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
function findCycle(adjacency) {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map([...adjacency.keys()].map((key) => [key, WHITE]));
  const stack = [];
  let found = null;

  const visit = (node) => {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of adjacency.get(node) || []) {
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

// skills: Array<{ name: string, frontmatter: string }>
// options.knownBaselineIds: string[] | null — null means "could not be read,
// skip baseline-id validation".
function validateContractReferences(skills, options = {}) {
  const names = new Set(skills.map((skill) => skill.name));
  const dependsOnGraph = new Map();
  const extendsGraph = new Map();
  const failures = [];

  for (const { name, frontmatter } of skills) {
    const dependsOn = parseContractArray(frontmatter, 'depends_on') || [];
    dependsOnGraph.set(name, dependsOn);
    for (const target of dependsOn)
      if (!names.has(target))
        failures.push(`${name}: depends_on references unknown skill '${target}'`);

    const extendsMatch = frontmatter.match(/^extends:\s*(\S+)\s*$/m);
    const extendsTarget = extendsMatch && extendsMatch[1] !== 'null' ? extendsMatch[1] : null;
    extendsGraph.set(name, extendsTarget ? [extendsTarget] : []);

    if (options.knownBaselineIds) {
      const baseline = parseContractArray(frontmatter, 'baseline') || [];
      for (const id of baseline)
        if (!options.knownBaselineIds.includes(id))
          failures.push(`${name}: baseline references unknown baseline id '${id}'`);
    }
  }

  const cycles = [];
  const dependsOnCycle = findCycle(dependsOnGraph);
  if (dependsOnCycle) cycles.push(dependsOnCycle);
  const extendsCycle = findCycle(extendsGraph);
  if (extendsCycle) cycles.push(extendsCycle);

  return { failures, cycles };
}

module.exports = { parseContractArray, findCycle, validateContractReferences };
