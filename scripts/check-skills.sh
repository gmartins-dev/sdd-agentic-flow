#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

node -e 'JSON.parse(require("fs").readFileSync("package.json"));'
test -x bin/sdd-agentic-flow.js

skills=(setup-sdd-agentic-flow sdd-create-specs sdd-create-prompts sdd-implement-task sdd-implement-multi sdd-task-check sdd-create-pr sdd-pr-review sdd-pr-fix sdd-validation)
for skill in "${skills[@]}"; do
  file="skills/$skill/SKILL.md"
  test -f "$file"
  for marker in '## When to use' '## When not to use' '## Inputs' '## Workflow' '## Safety' '## Output' '.sdd/config.yml' 'tlc-baseline.md' 'workflow-safety.md'; do
    grep -F -q -- "$marker" "$file"
  done
  grep -F -q 'version: 0.6.0' "$file"
  if [[ "$skill" != "setup-sdd-agentic-flow" ]]; then
    grep -F -q 'npx sdd-agentic-flow init' "$file"
  fi
done

route_file="skills/sdd-route/SKILL.md"
test -f "$route_file"
for marker in '## When to use' '## When not to use' '## Inputs' '## Workflow' '## Safety' '## Output' '.sdd/config.yml' 'workflow-routing.md' 'workflow-safety.md' 'source of truth' 'version: 0.6.0'; do
  grep -F -q -- "$marker" "$route_file"
done

all_skills=(setup-sdd-agentic-flow sdd-route sdd-create-specs sdd-create-prompts sdd-implement-task sdd-implement-multi sdd-task-check sdd-create-pr sdd-pr-review sdd-pr-fix sdd-validation)
for skill in "${all_skills[@]}"; do
  file="skills/$skill/SKILL.md"
  for marker in 'extends:' 'requires:' 'consumes:' 'produces:' 'baseline:' 'compatible_with:'; do
    grep -F -q -- "$marker" "$file"
  done
done

node <<'NODE'
const fs = require('node:fs');
const skills = [
  'setup-sdd-agentic-flow', 'sdd-route', 'sdd-create-specs', 'sdd-create-prompts',
  'sdd-implement-task', 'sdd-implement-multi', 'sdd-task-check', 'sdd-create-pr',
  'sdd-pr-review', 'sdd-pr-fix', 'sdd-validation',
];
const presets = fs
  .readdirSync('presets')
  .filter((file) => file.endsWith('.json'))
  .map((file) => JSON.parse(fs.readFileSync(`presets/${file}`, 'utf8')));
let drift = false;
for (const skill of skills) {
  const actual = presets
    .filter((preset) => preset.skills.includes(skill))
    .map((preset) => preset.name)
    .sort();
  const content = fs.readFileSync(`skills/${skill}/SKILL.md`, 'utf8');
  const match = content.match(/compatible_with:\s*\[([^\]]*)\]/s);
  if (!match) {
    console.error(`missing compatible_with in skills/${skill}/SKILL.md`);
    drift = true;
    continue;
  }
  const declared = match[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .sort();
  if (JSON.stringify(actual) !== JSON.stringify(declared)) {
    console.error(
      `compatible_with drift for ${skill}: presets=[${actual.join(', ')}] declared=[${declared.join(', ')}]`,
    );
    drift = true;
  }
}
if (drift) process.exit(1);
NODE

for ref in tlc-baseline.md tdd-baseline.md task-slicing.md workflow-routing.md sdd-global-guidance.md workflow-safety.md language-policy.md reviewability.md worktree-orchestration.md feature-profiles.md; do
  test -f "shared/references/$ref"
  if [[ "$ref" == "tlc-baseline.md" || "$ref" == "tdd-baseline.md" ]]; then
    grep -F -q 'Baseline version: 0.6.0' "shared/references/$ref"
  fi
done
for skill in sdd-create-specs sdd-implement-task sdd-validation; do
  grep -F -q 'feature-profiles.md' "skills/$skill/SKILL.md"
  grep -F -q 'feature_profile' "skills/$skill/SKILL.md"
done
test -f "shared/baselines/registry.yml"
grep -F -q 'tlc-spec-driven' shared/baselines/registry.yml
grep -F -q 'tdd' shared/baselines/registry.yml
for profile in en-US pt-BR; do
  test -f "shared/language-profiles/$profile.md"
done
for template in context spec design tasks task-prompt check-report validation-report pr-description pr-review pr-fix domain-glossary; do
  test -f "shared/templates/$template.template.md"
done
for skill in sdd-create-prompts sdd-implement-task sdd-implement-multi sdd-task-check sdd-validation; do
  grep -F -q 'tdd-baseline.md' "skills/$skill/SKILL.md"
done
for skill in sdd-create-specs sdd-create-prompts sdd-implement-task sdd-implement-multi sdd-task-check sdd-validation; do
  grep -F -q 'task-slicing.md' "skills/$skill/SKILL.md"
  grep -F -q 'domain-glossary.md' "skills/$skill/SKILL.md"
  grep -F -q 'project-context.md' "skills/$skill/SKILL.md"
done
grep -F -q 'discover' bin/sdd-agentic-flow.js
grep -F -q 'project-context.md' skills/setup-sdd-agentic-flow/SKILL.md
for template in task-prompt tasks check-report validation-report; do
  grep -F -q 'TDD' "shared/templates/$template.template.md"
done
for preset in core planning execution pr multi-worktree full local-files github; do
  node -e 'const p=require("./presets/'"$preset"'.json"); if (p.version!=="0.6.0" || !Array.isArray(p.skills) || !p.skills.includes("sdd-route")) process.exit(1);'
done
for file in README.md README.pt-BR.md LICENSE NOTICE LICENSING.md SECURITY.md CONTRIBUTING.md CHANGELOG.md ROADMAP.md docs/agent-compatibility.md docs/design-principles.md docs/trust-model.md docs/uninstall.md docs/execution-modes.md docs/inspirations.md docs/recommended-harness.md docs/using-with-codex.md docs/using-with-cursor.md docs/using-with-claude-code.md docs/prompt-recipes.md docs/i18n.md docs/language-profiles.md docs/language-profiles.pt-BR.md docs/tdd-baseline.md docs/invocation-model.md docs/why-this-exists.md docs/domain-vocabulary.md docs/architecture.md docs/compatibility-promise.md docs/tlc-integration.md examples/golden/invoice-approval/source-item.md examples/golden/task-management/source-item.md examples/language-profiles/en-US-config.yml examples/language-profiles/pt-BR-config.yml; do
  test -f "$file"
done
grep -F -q 'no telemetry' README.md
grep -F -q 'TDD baseline' README.md
grep -F -q 'Plan → Prompt → Implement → Check → PR → Review → Fix → Validate' README.md
grep -F -q 'sdd-route' README.md docs/invocation-model.md
grep -F -q 'mattpocock/skills' NOTICE LICENSING.md docs/tdd-baseline.md
grep -F -q 'Prompt injection safety' shared/references/workflow-safety.md
grep -F -q 'no postinstall' CONTRIBUTING.md
bash ./scripts/sanitize-private-context.sh
cache="$(mktemp -d)"
npm --cache "$cache" pack --dry-run >/dev/null
rm -rf "$cache"
echo "PASS skills, safety, licensing, and package checks"
