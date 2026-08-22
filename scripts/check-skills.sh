#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

node -e 'JSON.parse(require("fs").readFileSync("package.json"));'
test -f dist/sdd-agentic-flow.js
test -f bin/sdd-agentic-flow.js
npx tsx scripts/check-skill-contracts.ts
npx tsx scripts/check-discovery-boundary.ts
npx tsx scripts/check-version-consistency.ts
for ref in tlc-baseline.md tdd-baseline.md task-slicing.md workflow-routing.md workflow-safety.md feature-profiles.md artifact-contracts.md skill-authoring-standard.md evidence-standard.md engineering-principles.md autonomy-guardrails.md handoff-standard.md work-types.md spec-lifecycle.md execution-isolation.md prompt-authoring-standard.md; do
  test -f "shared/references/$ref"
done
for template in context spec design tasks task-prompt check-report validation-report pr-description pr-review pr-fix domain-glossary discovery; do
  test -f "shared/templates/$template.template.md"
done
bash ./scripts/sanitize-private-context.sh
echo "PASS skills, contracts, safety, and package checks"
