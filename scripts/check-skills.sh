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
  for marker in '## When to use' '## When not to use' '## Inputs' '## Workflow' '## Safety' '## Output' '.sdd-agentic-flow/config.yml' 'tlc-baseline.md' 'workflow-safety.md'; do
    grep -F -q -- "$marker" "$file"
  done
  if [[ "$skill" != "setup-sdd-agentic-flow" ]]; then
    grep -F -q 'npx sdd-agentic-flow init' "$file"
  fi
done

route_file="skills/sdd-route/SKILL.md"
test -f "$route_file"
for marker in '## When to use' '## When not to use' '## Inputs' '## Workflow' '## Safety' '## Output' '.sdd-agentic-flow/config.yml' 'workflow-routing.md' 'workflow-safety.md' 'source of truth'; do
  grep -F -q -- "$marker" "$route_file"
done

# Milestone 6/7 (v1.5.0): sdd-brainstorm and sdd-explain-me are baseline:[] root/branch skills
# like sdd-route — they follow the 6-section skeleton and the config/init/safety markers, but
# (like sdd-route) never reference tlc-baseline.md, since no TLC/TDD baseline governs them.
# v1.9.0: sdd-release joins this group for the same reason — release readiness is process work,
# not TLC/TDD methodology.
new_skills=(sdd-brainstorm sdd-explain-me sdd-release)
for skill in "${new_skills[@]}"; do
  file="skills/$skill/SKILL.md"
  test -f "$file"
  for marker in '## When to use' '## When not to use' '## Inputs' '## Workflow' '## Safety' '## Output' '.sdd-agentic-flow/config.yml' 'workflow-safety.md' 'npx sdd-agentic-flow init'; do
    grep -F -q -- "$marker" "$file"
  done
done

all_skills=(setup-sdd-agentic-flow sdd-route sdd-brainstorm sdd-create-specs sdd-explain-me sdd-create-prompts sdd-implement-task sdd-implement-multi sdd-task-check sdd-create-pr sdd-pr-review sdd-pr-fix sdd-validation sdd-release)
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

node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { validateContractReferences, parseContractArray } =
  require(path.resolve(process.cwd(), 'bin/contract-graph.js'));
const { parseVersion, compareVersions } =
  require(path.resolve(process.cwd(), 'bin/version-compat.js'));

const skillNames = [
  'setup-sdd-agentic-flow', 'sdd-route', 'sdd-brainstorm', 'sdd-create-specs', 'sdd-explain-me',
  'sdd-create-prompts', 'sdd-implement-task', 'sdd-implement-multi', 'sdd-task-check',
  'sdd-create-pr', 'sdd-pr-review', 'sdd-pr-fix', 'sdd-validation', 'sdd-release',
];
const frontmatterOf = (content) => (content.match(/^---\n([\s\S]*?)\n---/) || [, content])[1];
const skills = skillNames.map((name) => ({
  name,
  frontmatter: frontmatterOf(fs.readFileSync(`skills/${name}/SKILL.md`, 'utf8')),
}));
const presetFiles = fs.readdirSync('presets').filter((file) => file.endsWith('.json'));
const presets = presetFiles.map((file) => JSON.parse(fs.readFileSync(`presets/${file}`, 'utf8')));

let drift = false;

// Version consistency: package.json is the single source of truth. Every skill's
// metadata.version and every preset's "version" must match it exactly. The walk and
// comparison live in scripts/check-version-consistency.js (Milestone 2, v1.6.0), shared with
// scripts/release-checklist.sh, so this check never needs manual editing on a version bump.
const { checkVersionConsistency } = require(
  path.resolve(process.cwd(), 'scripts/check-version-consistency.js'),
);
const versionCheck = checkVersionConsistency();
const packageVersion = versionCheck.packageVersion;
if (!parseVersion(packageVersion)) {
  console.error(`package.json version '${packageVersion}' is not a valid x.y.z version`);
  drift = true;
}
for (const entry of versionCheck.skills) {
  if (entry.drifted) {
    console.error(
      `skills/${entry.name}/SKILL.md metadata.version is '${entry.version}', expected '${packageVersion}' (from package.json)`,
    );
    drift = true;
  }
}
for (const entry of versionCheck.presets) {
  if (entry.drifted) {
    console.error(
      `${entry.file} version is '${entry.version}', expected '${packageVersion}' (from package.json)`,
    );
    drift = true;
  }
}
// v1.9.1: bin/sdd-agentic-flow.js's own VERSION const drifted from package.json during v1.9.0
// with nothing catching it — check-version-consistency.js now walks bin/ too.
if (versionCheck.cli.drifted) {
  console.error(
    `${versionCheck.cli.file} VERSION is '${versionCheck.cli.version}', expected '${packageVersion}' (from package.json)`,
  );
  drift = true;
}

// v1.9.1: bin/sdd-agentic-flow.js's OFFICIAL_SKILLS array (drives uninstall,
// installationStatus(), and doctor --contracts' conflict validation) also drifted from the
// real skill roster during v1.9.0 — sdd-release installed but uninstall never removed it.
// Same drift-detection shape as compatible_with vs. presets/*.json above.
{
  const cliSource = fs.readFileSync('bin/sdd-agentic-flow.js', 'utf8');
  const officialSkillsMatch = cliSource.match(/const OFFICIAL_SKILLS = \[([\s\S]*?)\];/);
  const officialSkills = officialSkillsMatch
    ? [...officialSkillsMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    : [];
  const missingFromOfficial = skillNames.filter((name) => !officialSkills.includes(name));
  const extraInOfficial = officialSkills.filter((name) => !skillNames.includes(name));
  if (missingFromOfficial.length) {
    console.error(
      `bin/sdd-agentic-flow.js: OFFICIAL_SKILLS is missing ${missingFromOfficial.join(', ')}`,
    );
    drift = true;
  }
  if (extraInOfficial.length) {
    console.error(
      `bin/sdd-agentic-flow.js: OFFICIAL_SKILLS has unknown skill(s) ${extraInOfficial.join(', ')}`,
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
if grep -nE "execSync\(|child_process\.exec\(|require\('node:child_process'\)\.exec\(|mkdir -p|rm -rf|cp -R" bin/*.js; then
  echo "shell-out or POSIX-shell-specific usage detected in bin/*.js" >&2
  exit 1
fi

for ref in tlc-baseline.md tdd-baseline.md task-slicing.md workflow-routing.md sdd-global-guidance.md workflow-safety.md language-policy.md reviewability.md worktree-orchestration.md feature-profiles.md artifact-contracts.md skill-authoring-standard.md evidence-standard.md autonomy-guardrails.md handoff-standard.md; do
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
for template in context spec design tasks task-prompt check-report validation-report pr-description pr-review pr-fix domain-glossary release-readiness-report; do
  test -f "shared/templates/$template.template.md"
done
for skill in sdd-create-prompts sdd-implement-task sdd-implement-multi sdd-task-check sdd-validation; do
  grep -F -q 'tdd-baseline.md' "skills/$skill/SKILL.md"
done
# Milestone 2 (Evidence Standard extraction): the skills that classify pass/fail/ready must
# reference the shared evidence-standard.md rather than re-deriving the principle with drift.
# v1.9.0: sdd-release joins the original 6 (same evidence-first classification, one stage later).
for skill in sdd-create-specs sdd-implement-task sdd-task-check sdd-validation sdd-pr-review sdd-pr-fix sdd-release; do
  grep -F -q 'evidence-standard.md' "skills/$skill/SKILL.md"
done

# v1.9.0 (Handoff Standard): the 7 skills whose work can pause across a session/agent boundary
# must reference the shared handoff-standard.md rather than re-deriving when to write handoff.md.
for skill in sdd-implement-task sdd-implement-multi sdd-task-check sdd-validation sdd-pr-fix sdd-create-pr sdd-release; do
  grep -F -q 'handoff-standard.md' "skills/$skill/SKILL.md"
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
  node -e 'const p=require("./presets/'"$preset"'.json"); if (!Array.isArray(p.skills) || !p.skills.includes("sdd-route")) process.exit(1);'
done
for file in README.md README.pt-BR.md LICENSE NOTICE LICENSING.md SECURITY.md CONTRIBUTING.md CHANGELOG.md ROADMAP.md docs/agent-compatibility.md docs/design-principles.md docs/trust-model.md docs/uninstall.md docs/execution-modes.md docs/autonomy-levels.md docs/autonomy-guardrails.md docs/inspirations.md docs/recommended-harness.md docs/using-with-codex.md docs/using-with-cursor.md docs/using-with-claude-code.md docs/using-with-vscode-copilot.md docs/prompt-recipes.md docs/i18n.md docs/language-profiles.md docs/language-profiles.pt-BR.md docs/tdd-baseline.md docs/invocation-model.md docs/why-this-exists.md docs/domain-vocabulary.md docs/architecture.md docs/compatibility-promise.md docs/baselines.md docs/tlc-integration.md docs/installation-scope.md docs/environment-compatibility.md docs/skills-catalog.md docs/upgrading.md docs/troubleshooting.md examples/golden/invoice-approval/source-item.md examples/golden/task-management/source-item.md examples/language-profiles/en-US-config.yml examples/language-profiles/pt-BR-config.yml; do
  test -f "$file"
done
grep -F -q 'no telemetry' README.md
grep -F -q 'TDD baseline' README.md
grep -F -q 'Plan → Prompt → Implement → Check → PR → Review → Fix → Validate' README.md
grep -F -q 'sdd-route' README.md docs/invocation-model.md
grep -F -q 'mattpocock/skills' NOTICE LICENSING.md docs/tdd-baseline.md
grep -F -q 'Prompt injection safety' shared/references/workflow-safety.md
grep -F -q 'postinstall' CONTRIBUTING.md
bash ./scripts/sanitize-private-context.sh
cache="$(mktemp -d)"
npm --cache "$cache" pack --dry-run >/dev/null
rm -rf "$cache"
echo "PASS skills, safety, licensing, agent-neutrality, and package checks"
