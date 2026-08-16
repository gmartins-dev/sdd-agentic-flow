#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

node -e 'JSON.parse(require("fs").readFileSync("package.json"));'
test -f dist/sdd-agentic-flow.js

skills=(saf-setup saf-create-spec saf-create-prompts saf-implement saf-implement-multi saf-check-task saf-create-pr saf-review-pr saf-fix-pr saf-validate)
for skill in "${skills[@]}"; do
  file="skills/$skill/SKILL.md"
  test -f "$file"
  for marker in '## When to use' '## When not to use' '## Inputs' '## Workflow' '## Safety' '## Output' '.sdd-agentic-flow/config.yml' 'tlc-baseline.md' 'workflow-safety.md'; do
    grep -F -q -- "$marker" "$file"
  done
  if [[ "$skill" != "saf-setup" ]]; then
    grep -F -q 'npx sdd-agentic-flow init' "$file"
  fi
done

route_file="skills/saf-route/SKILL.md"
test -f "$route_file"
for marker in '## When to use' '## When not to use' '## Inputs' '## Workflow' '## Safety' '## Output' '.sdd-agentic-flow/config.yml' 'workflow-routing.md' 'workflow-safety.md' 'source of truth'; do
  grep -F -q -- "$marker" "$route_file"
done

# saf-brainstorm and saf-explain are baseline:[] root/branch skills like saf-route.
new_skills=(saf-brainstorm saf-explain)
for skill in "${new_skills[@]}"; do
  file="skills/$skill/SKILL.md"
  test -f "$file"
  for marker in '## When to use' '## When not to use' '## Inputs' '## Workflow' '## Safety' '## Output' '.sdd-agentic-flow/config.yml' 'workflow-safety.md' 'npx sdd-agentic-flow init'; do
    grep -F -q -- "$marker" "$file"
  done
done

all_skills=(saf-setup saf-route saf-brainstorm saf-create-spec saf-explain saf-create-prompts saf-implement saf-implement-multi saf-check-task saf-create-pr saf-review-pr saf-fix-pr saf-validate)
for skill in "${all_skills[@]}"; do
  file="skills/$skill/SKILL.md"
  for marker in 'extends:' 'requires:' 'consumes:' 'produces:' 'baseline:' 'compatible_with:' 'depends_on:' 'conflicts:' 'requires_cli:' 'autonomy_profile:' 'supported_levels:' 'auto_continue_condition:' 'blocking_conditions:' 'evidence_required:'; do
    grep -F -q -- "$marker" "$file"
  done
done

# Milestone 4 (Skill Catalog): every skill must have an entry in docs/skills-catalog.md, so the
# human-facing catalog cannot silently drop a skill without this check failing.
for skill in "${all_skills[@]}"; do
  grep -F -q -- "\`$skill\`" docs/skills-catalog.md
done

npx tsx scripts/check-version-consistency.ts

node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { validateContractReferences, parseContractArray } =
  require(path.resolve(process.cwd(), 'dist/contract-graph.js'));
const { OFFICIAL_SKILLS } = require(path.resolve(process.cwd(), 'dist/skill-identity.js'));

const skillNames = OFFICIAL_SKILLS;
const frontmatterOf = (content) => (content.match(/^---\n([\s\S]*?)\n---/) || [, content])[1];
const skills = skillNames.map((name) => ({
  name,
  frontmatter: frontmatterOf(fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8')),
}));
const presetFiles = fs.readdirSync('presets').filter((file) => file.endsWith('.json'));
const presets = presetFiles.map((file) => JSON.parse(fs.readFileSync(`presets/${file}`, 'utf8')));

let drift = false;

// Version consistency: package.json is the single source of truth. The walk lives in
// scripts/check-version-consistency.ts (run above via tsx).
{
  const sourceSkillNames = fs.readdirSync('skills').filter((name) => fs.existsSync(`skills/${name}/SKILL.md`));
  const missingFromOfficial = sourceSkillNames.filter((name) => !OFFICIAL_SKILLS.includes(name));
  const extraInOfficial = OFFICIAL_SKILLS.filter((name) => !sourceSkillNames.includes(name));
  if (missingFromOfficial.length) {
    console.error(`src/skill-identity.ts: OFFICIAL_SKILLS is missing ${missingFromOfficial.join(', ')}`);
    drift = true;
  }
  if (extraInOfficial.length) {
    console.error(
      `src/skill-identity.ts: OFFICIAL_SKILLS has unknown skill(s) ${extraInOfficial.join(', ')}`,
    );
    drift = true;
  }
}

// compatible_with vs presets/*.json membership.
for (const { name, frontmatter } of skills) {
  const actual = presets
    .filter((preset) => preset.skills.includes(name))
    .map((preset) => preset.name)
    .sort();
  const declared = (parseContractArray(frontmatter, 'compatible_with') || []).sort();
  if (!declared.length) {
    console.error(`missing compatible_with in skills/${name}/SKILL.md`);
    drift = true;
    continue;
  }
  if (JSON.stringify(actual) !== JSON.stringify(declared)) {
    console.error(
      `compatible_with drift for ${name}: presets=[${actual.join(', ')}] declared=[${declared.join(', ')}]`,
    );
    drift = true;
  }
}

// v1.8.0: autonomy_profile.supported_levels must be a non-empty subset of the 3 known
// autonomy_levels — the same style of validation compatible_with already gets above, reusing
// parseContractArray since supported_levels is declared flow-style, same as compatible_with.
const KNOWN_AUTONOMY_LEVELS = ['manual', 'supervised', 'autonomous'];
for (const { name, frontmatter } of skills) {
  const levels = parseContractArray(frontmatter, 'supported_levels');
  if (!levels || !levels.length) {
    console.error(`missing autonomy_profile.supported_levels in skills/${name}/SKILL.md`);
    drift = true;
    continue;
  }
  for (const level of levels) {
    if (!KNOWN_AUTONOMY_LEVELS.includes(level)) {
      console.error(`${name}: autonomy_profile.supported_levels has unknown level '${level}'`);
      drift = true;
    }
  }
}

// depends_on/baseline referential integrity + depends_on and extends cycle detection.
const registry = fs.readFileSync('shared/baselines/registry.yml', 'utf8');
const knownBaselineIds = [...registry.matchAll(/^\s*-\s*id:\s*(\S+)\s*$/gm)].map(
  (match) => match[1],
);
const { failures, cycles } = validateContractReferences(skills, { knownBaselineIds });
for (const failure of failures) {
  console.error(failure);
  drift = true;
}
for (const cycle of cycles) {
  console.error(`contract cycle detected: ${cycle.join(' -> ')}`);
  drift = true;
}

// conflicts referential validity (against the full catalog) + actual per-preset
// co-install violations.
for (const { name, frontmatter } of skills) {
  for (const target of parseContractArray(frontmatter, 'conflicts') || []) {
    if (!skillNames.includes(target)) {
      console.error(`${name}: conflicts references unknown skill '${target}'`);
      drift = true;
    }
  }
}
for (const preset of presets) {
  const inPreset = new Set(preset.skills);
  for (const { name, frontmatter } of skills) {
    if (!inPreset.has(name)) continue;
    for (const target of parseContractArray(frontmatter, 'conflicts') || [])
      if (inPreset.has(target)) {
        console.error(`preset ${preset.name} installs conflicting skills ${name} and ${target}`);
        drift = true;
      }
  }
}

if (drift) process.exit(1);
NODE

node <<'NODE'
const fs = require('node:fs');
const skills = fs
  .readdirSync('skills', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const vendorPattern = /\b(claude|cursor|codex|gemini|copilot)\b/i;
let violation = false;
for (const skill of skills) {
  const file = `skills/${skill}/SKILL.md`;
  if (!fs.existsSync(file)) continue;
  const stripped = fs
    .readFileSync(file, 'utf8')
    .replace(/<!--\s*compatibility-layer\s*-->[\s\S]*?<!--\s*\/compatibility-layer\s*-->/g, '');
  if (vendorPattern.test(stripped)) {
    console.error(`agent-neutrality violation in ${file}`);
    violation = true;
  }
}
if (violation) process.exit(1);
NODE

# Milestone 2 (Platform Abstraction): the CLI must never shell out to Bash/POSIX-specific
# commands or use shell-string interpolation. `execFileSync('git', [...])` with an argument
# array is the only allowed external process.
if grep -nE "execSync\(|child_process\.exec\(|require\('node:child_process'\)\.exec\(|mkdir -p|rm -rf|cp -R" src/*.ts; then
  echo "shell-out or POSIX-shell-specific usage detected in src/*.ts" >&2
  exit 1
fi

for ref in tlc-baseline.md tdd-baseline.md task-slicing.md workflow-routing.md sdd-global-guidance.md workflow-safety.md language-policy.md reviewability.md worktree-orchestration.md feature-profiles.md artifact-contracts.md skill-authoring-standard.md evidence-standard.md engineering-principles.md autonomy-guardrails.md handoff-standard.md work-types.md spec-lifecycle.md; do
  test -f "shared/references/$ref"
  if [[ "$ref" == "tlc-baseline.md" || "$ref" == "tdd-baseline.md" ]]; then
    grep -F -q 'Baseline version: 0.7.0' "shared/references/$ref"
  fi
done
for skill in saf-create-spec saf-implement saf-validate; do
  grep -F -q 'feature-profiles.md' "skills/$skill/SKILL.md"
  grep -F -q 'feature_profile' "skills/$skill/SKILL.md"
done
test -f "shared/baselines/registry.yml"
grep -F -q 'tlc-spec-driven' shared/baselines/registry.yml
grep -F -q 'tdd' shared/baselines/registry.yml
# v1.14.0: both condensed baselines bump together; the TDD loop token is the
# contractual-seam sensor loop, not red/green/refactor-as-proof.
[[ "$(grep -F -c -- 'baseline_version: 0.7.0' shared/baselines/registry.yml)" -eq 2 ]]
grep -F -q 'test-at-contractual-seam' shared/baselines/registry.yml
if grep -F -q 'produce RED when practical' skills/saf-implement/SKILL.md; then
  echo "saf-implement still contains 'produce RED when practical'" >&2
  exit 1
fi
for marker in 'adequacy' 'anti-tautology' 'authority' 'contractual seam' 'oracle' 'invariant' 'minimize redundancy'; do
  grep -F -i -q -- "$marker" shared/references/evidence-standard.md
done
grep -F -q '## TDD baseline' README.md README.pt-BR.md
for template in tasks task-prompt; do
  grep -F -q '## TDD baseline' "shared/templates/$template.template.md"
  grep -F -q 'Public seam' "shared/templates/$template.template.md"
  grep -F -q 'Expected RED command' "shared/templates/$template.template.md"
done
for template in check-report validation-report; do
  grep -F -q '## TDD evidence' "shared/templates/$template.template.md"
done
grep -F -q 'quality.require_tdd' docs/configuration.md
grep -F -q 'require_tdd:' dist/doctor.js dist/setup.js
# v1.14.0: golden tasks keep Expected RED but must not instruct fabricating a fail.
if grep -E -n 'Expected RED command:.*fails:' examples/golden/*/tasks.md; then
  echo "golden tasks still instruct a fabricated RED failure" >&2
  exit 1
fi
for f in examples/golden/task-management/tasks.md examples/golden/idea-to-spec/tasks.md; do
  grep -F -q 'n/a — not used as proof' "$f"
  grep -F -q 'Requirement anchors: REQ-' "$f"
done
for template in check-report validation-report; do
  grep -F -q 'current vs historical vs not-run' "shared/templates/$template.template.md"
done
# v1.15.0: false-positive catalog and fresh-eyes protocol (presence checks).
# These greps fail if the catalog or the check/validation order is deleted.
for class in \
  'Tautological oracle' \
  'Error propagation' \
  'Green-but-wrong' \
  'Shallow sensor' \
  'Stale evidence' \
  'Silent gap' \
  'False success / self-assessment' \
  'Inherited author narrative' \
  'Suite weakening' \
  'Completion theater'; do
  grep -F -q -- "$class" shared/references/evidence-standard.md
done
grep -F -q 'self-report is not evidence' shared/references/evidence-standard.md
grep -F -q 'requirement → sensor → current result' shared/references/evidence-standard.md
grep -F -q 'strength ladder' shared/references/evidence-standard.md
for skill in saf-check-task saf-validate; do
  grep -F -q 'must not inherit author narrative' "skills/$skill/SKILL.md"
  grep -F -qi 'self-report is not evidence' "skills/$skill/SKILL.md"
  grep -F -q 'requirement → sensor → current result' "skills/$skill/SKILL.md"
done
grep -F -q 'self-assessment' skills/saf-implement/SKILL.md
grep -F -q 'suite weakening' skills/saf-implement/SKILL.md
grep -F -q 'observable expected outcome' skills/saf-create-spec/SKILL.md
grep -F -q 'reproduction sensor' shared/references/feature-profiles.md
grep -F -q 'green-but-wrong' examples/golden/task-management/validation-report.md
if grep -F -q -- '--type=bugfix' dist/sdd-agentic-flow.js; then
  echo "CLI must not gain --type=bugfix in v1.15.0" >&2
  exit 1
fi
# v1.16.0: work-type contracts, unchanged behavior, spec analysis, living spec
# (presence checks). These greps fail if those contracts are deleted.
grep -F -q 'unchanged behavior' shared/references/work-types.md
grep -F -q 'Spec analysis' skills/saf-create-spec/SKILL.md
grep -F -q 'living' shared/references/tlc-baseline.md
grep -F -q 'work intent' skills/saf-create-spec/SKILL.md
grep -F -q 'uncertainty' shared/references/feature-profiles.md
grep -F -q 'DAG' shared/references/worktree-orchestration.md
grep -F -q 'waves' shared/references/worktree-orchestration.md
grep -F -q 'Named feedback loop' docs/sdd-methodology.md
grep -F -q 'not a runtime to copy' docs/inspirations.md
if grep -F -q -- 'workflow.work_type' .sdd-agentic-flow/config.yml 2>/dev/null; then
  echo "config must not gain workflow.work_type" >&2
  exit 1
fi
# Upstream version pins (v0.9.0): each baseline entry must declare which upstream skill
# version/tag it was adapted from, mechanically, not only in NOTICE/docs prose that could
# drift unnoticed.
for marker in 'upstream_version:' 'upstream_source:'; do
  count="$(grep -F -c -- "$marker" shared/baselines/registry.yml)"
  [[ "$count" -eq 2 ]]
done
grep -F -q 'upstream_version' NOTICE
grep -F -q 'v1.2.3' NOTICE docs/tdd-baseline.md
for profile in en-US pt-BR; do
  test -f "shared/language-profiles/$profile.md"
done
for template in context spec design tasks task-prompt check-report validation-report pr-description pr-review pr-fix domain-glossary; do
  test -f "shared/templates/$template.template.md"
done
for skill in saf-create-prompts saf-implement saf-implement-multi saf-check-task saf-validate; do
  grep -F -q 'tdd-baseline.md' "skills/$skill/SKILL.md"
done
# Skills that classify pass/fail/ready reference the shared evidence standard.
for skill in saf-create-spec saf-implement saf-check-task saf-validate saf-review-pr saf-fix-pr; do
  grep -F -q 'evidence-standard.md' "skills/$skill/SKILL.md"
done
# v1.18.0: how-to-change-code contract. Not a skill, not a registry baseline.
for skill in saf-create-spec saf-create-prompts saf-implement \
  saf-implement-multi saf-check-task saf-review-pr saf-fix-pr; do
  grep -F -q 'engineering-principles.md' "skills/$skill/SKILL.md"
done
# v1.19.0: spec-package lifecycle and scoped context. Not a skill, not a CLI.
for skill in saf-create-spec saf-create-prompts saf-implement \
  saf-check-task saf-explain saf-validate saf-route; do
  grep -F -q 'spec-lifecycle.md' "skills/$skill/SKILL.md"
done
grep -F -q 'Load rule' shared/references/spec-lifecycle.md
grep -F -q 'do not glob' shared/references/spec-lifecycle.md
grep -F -q 'spec-lifecycle.md' shared/references/tlc-baseline.md
if grep -F -q -- 'specs.active_slug' dist/sdd-agentic-flow.js; then
  echo "CLI must not gain specs.active_slug in v1.19.0" >&2
  exit 1
fi

# v1.9.0 (Handoff Standard): the 7 skills whose work can pause across a session/agent boundary
# must reference the shared handoff-standard.md rather than re-deriving when to write handoff.md.
for skill in saf-implement saf-implement-multi saf-check-task saf-validate saf-fix-pr saf-create-pr; do
  grep -F -q 'handoff-standard.md' "skills/$skill/SKILL.md"
done
for skill in saf-create-spec saf-create-prompts saf-implement saf-implement-multi saf-check-task saf-validate; do
  grep -F -q 'task-slicing.md' "skills/$skill/SKILL.md"
  grep -F -q 'domain-glossary.md' "skills/$skill/SKILL.md"
  grep -F -q 'project-context.md' "skills/$skill/SKILL.md"
done
grep -F -q 'discover' dist/sdd-agentic-flow.js
grep -F -q 'project-context.md' skills/saf-setup/SKILL.md
for template in task-prompt tasks check-report validation-report; do
  grep -F -q 'TDD' "shared/templates/$template.template.md"
done
for template in check-report validation-report; do
  grep -F -q 'Validation scope' "shared/templates/$template.template.md"
done
for skill in saf-check-task saf-validate; do
  grep -F -q 'change-impact-validation.md' "skills/$skill/SKILL.md"
done
grep -F -q 'canonical-vocabulary.md' shared/references/action-vocabulary.md
for preset in core planning execution pr multi-worktree full local-files github; do
  node -e 'const p=require("./presets/'"$preset"'.json"); if (!Array.isArray(p.skills) || !p.skills.includes("saf-route")) process.exit(1);'
done
for file in README.md README.pt-BR.md LICENSE NOTICE LICENSING.md SECURITY.md CONTRIBUTING.md CHANGELOG.md ROADMAP.md docs/agent-compatibility.md docs/design-principles.md docs/trust-model.md docs/uninstall.md docs/execution-modes.md docs/autonomy-levels.md docs/autonomy-guardrails.md docs/inspirations.md docs/recommended-harness.md docs/using-with-codex.md docs/using-with-cursor.md docs/using-with-claude-code.md docs/using-with-vscode-copilot.md docs/prompt-recipes.md docs/i18n.md docs/language-profiles.md docs/language-profiles.pt-BR.md docs/tdd-baseline.md docs/engineering-principles.md docs/spec-lifecycle.md docs/invocation-model.md docs/why-this-exists.md docs/domain-vocabulary.md docs/architecture.md docs/compatibility-promise.md docs/baselines.md docs/tlc-integration.md docs/installation-scope.md docs/environment-compatibility.md docs/skills-catalog.md docs/v2-breaking-changes.md docs/troubleshooting.md examples/golden/invoice-approval/source-item.md examples/golden/task-management/source-item.md examples/language-profiles/en-US-config.yml examples/language-profiles/pt-BR-config.yml; do
  test -f "$file"
done
grep -F -q 'no telemetry' README.md
grep -F -q 'TDD baseline' README.md
grep -F -q 'Plan → Prompt → Implement → Check → PR → Review → Fix → Validate' README.md
grep -F -q 'saf-route' README.md docs/invocation-model.md
grep -F -q 'mattpocock/skills' NOTICE LICENSING.md docs/tdd-baseline.md
grep -F -q 'Prompt injection safety' shared/references/workflow-safety.md
grep -F -q 'postinstall' CONTRIBUTING.md
bash ./scripts/sanitize-private-context.sh
cache="$(mktemp -d)"
npm --cache "$cache" pack --dry-run >/dev/null
rm -rf "$cache"
echo "PASS skills, safety, licensing, agent-neutrality, and package checks"
