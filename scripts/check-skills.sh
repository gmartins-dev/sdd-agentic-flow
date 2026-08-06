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
  grep -F -q 'version: 0.2.0' "$file"
  if [[ "$skill" != "setup-sdd-agentic-flow" ]]; then
    grep -F -q 'npx sdd-agentic-flow init' "$file"
  fi
done

for ref in tlc-baseline.md sdd-global-guidance.md workflow-safety.md language-policy.md reviewability.md worktree-orchestration.md; do
  test -f "shared/references/$ref"
done
for template in context spec design tasks task-prompt check-report validation-report pr-description pr-review pr-fix; do
  test -f "shared/templates/$template.template.md"
done
for preset in core planning execution pr multi-worktree full local-files github; do
  node -e 'const p=require("./presets/'"$preset"'.json"); if (p.version!=="0.2.0" || !Array.isArray(p.skills)) process.exit(1);'
done
for file in README.md README.pt-BR.md LICENSE NOTICE LICENSING.md SECURITY.md CONTRIBUTING.md CHANGELOG.md ROADMAP.md docs/agent-compatibility.md docs/design-principles.md docs/trust-model.md docs/uninstall.md docs/execution-modes.md docs/inspirations.md docs/recommended-harness.md docs/using-with-codex.md docs/using-with-cursor.md docs/using-with-claude-code.md docs/prompt-recipes.md docs/i18n.md examples/golden/invoice-approval/source-item.md examples/golden/task-management/source-item.md; do
  test -f "$file"
done
grep -F -q 'no telemetry' README.md
grep -F -q 'Prompt injection safety' shared/references/workflow-safety.md
grep -F -q 'no postinstall' CONTRIBUTING.md
bash ./scripts/sanitize-private-context.sh
cache="$(mktemp -d)"
npm --cache "$cache" pack --dry-run >/dev/null
rm -rf "$cache"
echo "PASS skills, safety, licensing, and package checks"
