# Changelog

## Unreleased

## 6.5.0

### Local-first adoption and explicit sharing

Adds personal, specs-shared, and team adoption presets with optional
`adoption_mode` in installation intent v2. SAF now reconciles only its own
blocks in `.git/info/exclude`, preserves foreign skills and tracked files, and
keeps generated execution state local in team adoption. Git remains optional;
the CLI never edits `.gitignore`, global excludes, commits, or pushes.

## 6.4.3

### Documentation and CLI guidance consistency

Corrects stale CLI guidance that suggested the removed `configure` command and removes
unnecessary historical version labels from user-facing help and recovery messages. Aligns
documentation, onboarding suggestions, and error guidance with the current command surface
without adding commands, flags, dependencies, runtime authority, telemetry, or network behavior.

## 6.4.2

### CLI contract and argument validation fixes

Corrects active installation guidance so automation does not use the unsupported
`install --yes` form, and makes `list` reject unknown arguments with structured
usage and recovery guidance. Adds focused regression coverage without adding a
new command, flag, dependency, runtime authority, telemetry, or network behavior.

## 6.4.1

### CLI uninstall and help fixes

Fixes target- and scope-aware uninstall planning/application, including validation and
preservation of non-selected and foreign files. Completes canonical help parity for `learn-sdd`,
`completion`, and `version`, and aligns active uninstall and compatibility documentation with the
v6 contract. Adds deterministic regression coverage for the corrected CLI behavior.

## 6.4.0

### CLI audit reliability and release certification

Adds normalized black-box audit evidence with independent execution outcomes and coverage,
content-based persistent-state snapshots, safe disposable source materialization, and
registry-derived coverage for `learn-sdd` and supported shell completions. Adds a maintainer
release-certification prompt for stateful journeys, package boundaries, terminal behavior,
documentation coherence, and bounded findings. No runtime dependency, telemetry, implicit
network behavior, workflow authority, or automatic remote mutation is introduced.

Corrects stale CLI documentation for the machine-interface version example and the current
`uninstall --purge` command.

## 6.3.1

### Autonomous contract hardening

Hardens autonomous repair-transition semantics, evidence authority, and
loop-state diagnostics without changing the public Skill roster, lifecycle or
execution/runtime boundary. Aligns public invocation guidance with normal and
authorized repair transitions, and adds deterministic fail-closed diagnostics
for contradictory autonomy state.

## 6.3.0

### Autonomous end-to-end completion

Adds bounded end-to-end autonomous completion for delegated local work.
Recoverable checks, review findings, validation findings, re-planning, and
intent-preserving reconciliation now route through authorized repair
transitions without unnecessary human interruption. Execution-mode limits,
read-only verification, host-owned turns, safety boundaries, and the existing
13-Skill public roster remain unchanged. No scheduler, provider integration,
remote mutation, or automatic release authority is introduced.

## 6.2.0

### Harness contract integrity

Strengthens effective-contract authority, consequential contract-change
proposals, minimum-sufficient context selection, independent verification,
multi-task parallel-admission guidance, and repository-level harness
diagnostics. No new lifecycle, admission status, runtime scheduler, public
Skill, machine schema, provider integration, telemetry, or automatic remote
mutation is introduced.

## 6.1.0

Information representation architecture release. Adds a documented model for
SAF contract kinds, materializations, authority, persistence, projections, and
freshness; introduces a narrow registry for official skill capability
contracts; strengthens artifact and skill closeout ownership guidance; and
adds focused documentation, configuration, installation-intent, provenance,
and contract-conformance checks. This is an additive release with no format
migration, public skill roster change, runtime dependency, telemetry, or
automatic remote mutation.

## 6.0.1

Documentation coherence and v6 installation hardening. Adds deterministic documentation
contract checks, strengthens grounded documentation and change-impact guidance, and finalizes
the clean-slate pack/install vocabulary and upgrade validation introduced after v6.0.0.

## 6.0.0

Breaking skill-contract consolidation: `packs` replaces `compatible_with`; the `github`
pack is removed; `multi-worktree` is renamed to `multi-task`; installation intent is now
`saf-install-intent/v2` and v1 requires reinstalling. Core change review is local-only,
durable discovery is pre-spec working knowledge, prompts are provider-neutral, and multi-task
guidance is isolation-neutral. No new skill, runtime dependency, scheduler, telemetry, or
automatic remote action was added.

## 5.0.0

Clean-slate CLI grammar and terminal/machine contracts. Removes legacy `discover`,
`configure`, agent aliases, and uninstall apply aliases; adds canonical completions,
strict v1 state schemas, transactional provenance, and v5 terminal capability semantics.

## 4.4.0

Agentic Workflow Harness identity and developer lifecycle — compatible minor release.

**Added:**

- Public taxonomy, illustrative developer journey, and focused positioning-regression sensor.
- Package-lock root metadata to the version stamp and consistency contract.

**Changed:**

- Active documentation and generated guidance distinguish SAF workflow constraints from coding-agent-host runtime execution.
- Optional companion tooling and the published npm bin wrapper chain are documented accurately.

**Compatibility:**

- No runtime capability, public-skill, configuration, artifact schema, dependency, telemetry, or automatic Git change.

## 4.3.0

Engineering control-plane coherence — compatible minor release.

**Added:**

- Qualified engineering-model and host-capabilities documentation.
- `doctor --harness`, a curated projection of canonical repository/project readiness checks.
- `doctor --evidence-graph <slug> --html [--output <path>]`, a safe deterministic HTML projection.

**Changed:**

- Public model distinguishes host execution from SAF constraints and treats Evidence Graph as a read-only projection.
- Shared verification guidance prefers fresh independent context when a host supports it and defines an explicit re-grounding fallback.

**Compatibility:**

- No runtime dependencies, public skills, scheduler, telemetry, implicit HTML write, or automatic Git mutation added.

## 4.2.0

Init, usage guide, and local artifact improvements.

**Added:**

- `scripts/sync-workflow-diagram.ts` keeps README workflow mermaid in sync with
  `shared/templates/workflow-diagram.mmd`.
- `init` writes a localized usage stub (mermaid + internal link) and copies the active-locale
  full guide into `.sdd-agentic-flow/`.
- `inferInitDefaults()` pre-fills `config.yml` from `package.json`, Git, and agent hint files.
- Explanation outputs from `saf-explain` live at
  `.sdd-agentic-flow/explanations/<feature>.md` (flat path, not under `.specs/`).

**Changed:**

- Renamed canonical docs to `docs/saf-skills-usage-guide.md` and `.pt-BR.md` (redirect stubs at
  old `sdd-skills-usage-guide*` paths).
- `init` appends `.sdd-agentic-flow/` to `.git/info/exclude` automatically when installation
  intent scope is `user`; `--local-git-exclude` remains for project scope.

**Deprecated:**

- `.specs/features/<feature>/explanation.md` — use `.sdd-agentic-flow/explanations/<feature>.md`.

## 4.1.0

Operating policy and autonomous workflow UX — compatible minor release.

**Added:**

- Operating-policy selector in guided `init` onboarding (Supervised recommended, Manual, Autonomous, Advanced).
- Split returning setup menu: **Change operating policy** (`config policy`) vs **Change installation setup** (`configure --interactive`).
- Policy block in setup Review and Current setup (preset title + canonical `execution_mode + autonomy_level` pair).
- i18n keys for setup policy and menu labels (en-US + pt-BR).

**Changed:**

- Guided onboarding Enter-through default: **Supervised** (`apply + supervised`) instead of Manual.
- Piped `init --interactive` preset prompt default: **supervised** (fail-safe non-TTY `init` without flags remains `guided + manual`).
- `initInteractive` shares onboarding preset default with guided setup.
- `init` no longer treats implicit CLI defaults as explicit policy flags (`policyFromCli`); guided setup always offers the policy step unless `--preset` or explicit `--execution-mode` / `--autonomy-level` are passed.

## 4.0.1

**Fixed:**

- Restore `bin/sdd-agentic-flow.js` as the published npm bin entry so `npx sdd-agentic-flow`
  resolves correctly from the repository root and matches the pre-v3.5 bin layout.

## 4.0.0

Harness integrity, evidence graph, and clean reset — breaking major release.

**Added:**

- Shared contracts: `system-invariants.md`, `task-context-package.md`, `decision-gates.md`,
  `bounded-execution.md`.
- Read-only evidence graph: `sdd-agentic-flow doctor --evidence-graph <feature-slug>`.
- Cross-scope purge reinstall: `uninstall --plan --purge` and `uninstall --apply --purge --yes`.
- `src/evidence-graph.ts` collector/model with doctor orchestration in `src/doctor.ts`.

**Changed (breaking):**

- v4 artifact contract: stable `REQ-*` identifiers, `Requirement anchors` in tasks/prompts,
  `Feature: <slug>` and evidence index tables with freshness in check/validation reports.
- `saf-create-spec` SPEC-Q completion gate; bounded-execution semantics in implement/check skills.
- Templates, `artifact-contracts.md`, and skill producer/consumer guidance updated atomically.
- No migration layer: legacy reports without `Feature:` remain history but cannot satisfy v4 graph paths.

**Compatibility:**

- No runtime dependencies, scheduler, telemetry, or automatic Git mutation added.
- Purge preserves `.specs/features/**`, source, Git history, and foreign skills.

## 3.6.0

Maintainer architecture and code-quality consolidation after the TypeScript migration.

**Changed:**

- Decomposed the CLI entrypoint into cohesive command modules: `paths.ts`, `cli-help.ts`,
  `setup.ts`, `project-context.ts`, `install.ts`, `doctor.ts`, and `uninstall.ts`.
- `src/sdd-agentic-flow.ts` is now a bootstrap/router (~1,280 lines, down from ~4,400).
- Enabled `noUnusedLocals` / `noUnusedParameters` in `tsconfig.json`; Biome defers unused-symbol
  checks to TypeScript.
- Version consistency tooling now treats `src/paths.ts` as the canonical VERSION derivation
  source (removed legacy `bin/` fallback).
- Operational docs, golden walkthroughs, and `LICENSING.md` now reference `src/` / `dist/` /
  `test/cli.test.ts` instead of the removed pre-TypeScript layout.
- Added maintainer source-layout guidance to `docs/architecture.md` and `CONTRIBUTING.md`.

**Compatibility:**

- Published CLI behavior, command surface, skills, presets, and packaging contract are unchanged.
  Consumers still invoke `npx sdd-agentic-flow` from compiled `dist/` output.

## 3.5.0

TypeScript strict migration release.

**Changed:**

- CLI and supporting modules now live under `src/` and ship as compiled JavaScript in
  `dist/` (`package.json` `"bin"` points at `dist/sdd-agentic-flow.js`).
- Maintainer tests and scripts are TypeScript (`test/*.test.ts`, `scripts/*.ts`) and run via
  `tsx`; legacy `bin/*.js` sources were removed.
- Release and skill checks (`check-skills.sh`, `release-checklist.sh`, version consistency)
  validate `dist/` / `src/` layout instead of `bin/`.

**Compatibility:**

- Published CLI behavior and command surface are unchanged. Consumers still invoke
  `npx sdd-agentic-flow`; only the maintainer build layout changed.

## 3.4.0

Guided CLI setup UX release.

**Changed:**

- Interactive setup now starts with **Recommended setup** or **Customize setup**, then presents
  one review before the first write. Customization covers pack, scope, targets, and project sharing.
- Setup progress is semantic (`Project`, `Skills`, `Context`, `Validation`) rather than a count of
  prompts. Before apply, Back changes draft choices only; after apply, change setup is deliberate.
- Ready and attention states show a canonical current-setup summary. Partial setup can continue
  saved intent or change its choices.
- Guided failure recovery offers retry, validation, change choices, or exit. `Ready` is printed
  only after `doctor` passes.
- Wizard, recovery, and summary prose are catalogued in English and Brazilian Portuguese. Menu
  wording is now **Commands and advanced options**.

**Compatibility:**

- No command, flag, JSON shape, onboarding state file, runtime dependency, telemetry, or automatic
  skill execution was added. Plain/non-interactive behavior remains deterministic.

## 3.3.1

CLI correction release following real-user TTY and packaged-consumer validation.

**Fixed:**

- TTY selector arrows now redraw the active cursor; `q` and `0` exit interactive menus.
- Interactive menus return to navigation after actions instead of terminating unexpectedly.
- Fresh project-scope installs no longer trigger false legacy-installation warnings.
- Saved installation intent is resumed, including project/core selections.
- Full installation intent and full-pack upgrades are reported and reconciled correctly.
- Portuguese navigation copy and the generated local usage guide no longer send ready users
  through an incorrect `install core` loop.

**Tests:**

- Added raw selector exit/redraw regression coverage and full-pack detection coverage.

## 3.3.0

Adaptive validation and workflow consolidation.

**Changed:**

- Public workflow now ends at feature validation and ships 13 skills.
- Task and feature verification derive a minimum adequate sensor set from requirements, diff,
  contractual seams, repository contracts, and risk; reports record selected and omitted sensors.
- Canonical vocabulary distinguishes SDD intent, capability, execution, control, and verification.

## 3.2.0

Continuous guided onboarding release.

**Changed:**

- In a real TTY, `init` now guides a first project from configuration through
  `full` installation, project context, and `doctor`; `--non-interactive` keeps
  automation deterministic.
- Returning setup is derived from durable configuration, intent, skills, context,
  and doctor results. No onboarding state file is stored.
- Existing valid `core` installations are preserved until setup is deliberately changed.

**Added:**

- Dependency-free keyboard/numeric selector with a plain-terminal fallback and cancellation.
- `docs/getting-started.md` for the one-command first-run path.

## 3.1.0

CLI UX, localization, diagnostic, and interaction-coherence release.

**Changed:**

- Normal CLI reports are human-readable in pipes and CI; `doctor --json` remains the explicit
  structured output contract.
- Interactive init and install now have truthful grouped progress, complete reviews, strict
  target selection, and confirmation before mutation.
- `configure` is discoverable in top-level help and distinguishes saved installation intent from
  a subsequent reconcile.
- Doctor leads with a verdict, counts, root-cause-oriented primary remediation, and concise
  default detail; `--verbose` retains the full check list.
- User-install doctor check IDs are stable target-based identifiers (`installation_user_agents`,
  `installation_user_cursor`, `installation_user_claude`, `installation_user_copilot`) while
  messages retain the diagnostic path.
- Plans identify intent, target labels, physical units, repository impact, no-mutation status,
  and the exact follow-up command. Uninstall previews are grouped; `uninstall --verbose` adds
  exact paths.

**Added:**

- Dependency-free EN/pt-BR CLI message catalog and locale resolver.
- State-aware quick actions, complete `help configure`, and plain-language SDD learning output.

Safety defaults, exit codes, installed skill contracts, and the `doctor --json` object shape are
unchanged.

## 3.0.0

Major skill-identity and installation-model release.

**Breaking changes:**

- Public skill names now use the `saf-*` namespace; legacy `sdd-*` and
  `setup-sdd-agentic-flow` names are not installed as aliases.
- Existing legacy installations are diagnosed and blocked for deliberate clean reinstall;
  they are never migrated automatically.

**Added and changed:**

- Intent-aware installation with user and repository-scoped profiles, target selection,
  `configure`, provenance schema 2, reconciliation plans, and safe local/shared project
  sharing transitions.
- Reconciliation supports CREATE, UPDATE, PRESERVE, REMOVE, COLLISION, and BLOCKED states.
- `saf-implement-multi` plans and executes dependency waves with explicit worktree,
  integration, and per-task check boundaries.
- `doctor` and installation plans report persisted intent and reconciliation state.

See `docs/v3-breaking-changes.md` for the complete rename map and reinstall guidance.

## 2.1.0

DX / CLI UX / onboarding minor. Turns the CLI into a coherent **control plane** for setup,
inspect, guide, and maintain on top of v2.0.0 — without invoking skills or adding runtime
dependencies.

**Added:**

- `config` command: `config show`, `config policy`, `--plan`, `--yes` (operating policy only).
- Configuration domain module (`bin/config-domain.js`) for read/validate/mutate of
  `workflow.execution_mode` and `workflow.autonomy_level`.
- Install preflight classification (CREATE / PRESERVE / COLLISION) and enhanced
  `install --plan` output; FOREIGN collisions block mutating apply.
- `install --interactive` wizard (installation model, targets, preflight, confirm).
- Minimal UI primitives (`renderSection`, `renderKeyValue`, `renderStep`, …) respecting
  `outputMode()`.
- State-aware welcome (policy + installation summary) and menu routes (`config policy`,
  `install core --plan`, `learn-sdd`).
- Redesigned `init --interactive` (seven steps, preset UX, review; existing config →
  `config policy`).
- `docs/what-is-sdd.md`, `docs/commands.md`.

**Changed:**

- Doctor/welcome/install next-step copy no longer implies the CLI invokes `sdd-route` or any
  skill.
- `init --interactive` step order aligns with preset-first operating policy UX.

**Baseline changes:** reviewed, no `baseline_version` bump (stays `0.7.0`).

**Explicit non-goals (not in this release):**

- No third config axis; no CLI skill orchestrator; no `config language`.
- No project multi-path install selection; `--scope project` still writes `.agents/skills/` only.
- No multi `--agent` flag expansion (deferred).
- No full-screen TUI or new runtime dependencies.

## 2.0.0

Public-readiness / consolidation major. One methodology, one **canonical workflow
path** (Plan → Prompt → Implement → Check → PR → Review → Fix → Validate; Release
on demand), three operating presets, one router. TLC condensed stages remain the
methodology; the skill path implements that methodology.

`init --preset` writes the two existing fields (`execution_mode`, `autonomy_level`).
Aliases (`man`, `assist`|`assisted`, `auto`) resolve to canonical names; config stores
canonical values only. `--preset` cannot combine with `--execution-mode` or
`--autonomy-level`. `--execution-mode` does not accept `auto` as `full`.

CLI `migrate` is removed. Leftover `.sdd/` is a `doctor` WARN and a manual rename.
Breaking notes live in `docs/v2-breaking-changes.md`, not onboarding.
`docs/upgrading.md` is gone from the getting-started path.

Autonomous does not mean unattended. No configuration value overrides safety.
Commit, push, merge, tag, and publish stay human on every preset. 13 skills; no
public `auto-sdd` / `sdd-run`; the CLI does not run a skill loop. No third stored
config axis (`workflow.mode`).

**Baseline changes:** reviewed, no `baseline_version` bump (stays `0.7.0`).

**Explicit non-goals (not in this release):**

- No `workflow.mode` / third config axis.
- No CLI skill orchestrator / public `auto-sdd`.
- No graph engine / `doctor --evidence-graph`.

## 1.19.0

Spec package lifecycle and scoped context. Path `.specs/features/<slug>/`
unchanged. Skills resolve one feature package, then load only artifacts the
active operation already requires. Do not glob every `spec.md`. Optional
advisory `Lifecycle:` (`implemented`, not `completed`) and canonical
`Extends:` / `Supersedes:` lines. No CLI, no auto-archive, no `STATE.md`, no
`validation.md` under `.specs`.

**Baseline changes:** reviewed, added on-demand load invariant (never load
multiple feature specs simultaneously). No `baseline_version` bump (stays
`0.7.0`).

**Explicit non-goals (not in this release):**

- No `.specs/active/` + `.specs/archive/` restructure.
- No CLI `archive` / `specs status`; no `specs.active_slug`.
- No auto-archive on validation PASS; no TLC `STATE.md` / `LESSONS.md` /
  `.specs/**/validation.md`.
- No required YAML `status:` / `## Lifecycle` H2; no 15th skill.

## 1.18.0

Shared engineering-principles contract for how agents change code. Language- and
architecture-agnostic. Consumed by implement / prompts / specs / check /
pr-review / pr-fix. Not a 15th skill. Not a web or security pack. Not a
`baseline_version` bump.

**Explicit non-goals (not in this release):**

- No `skills/engineering-principles/`, no pack `web` / `security`.
- No stack-specific CSP / Helmet / `npm audit` / Lighthouse catalog in core.
- No CLI flag, no `workflow.engineering_principles`, no registry baseline.
- Engineering-fit findings do not flip check/validation `PASS` by themselves.

## 1.17.0

Positioning and curated foundations (documentation-only). Skills are the
**execution layer** of a local-first agentic software-engineering harness, not
the whole product. `docs/inspirations.md` now opens with an epistemic-role
hierarchy and the caveat that those sources are not normative specifications.
No skill renamed. No CLI flag. No `baseline_version` bump.

**Explicit non-goals (not in this release):**

- No `docs/references/` folder.
- No token or speed multipliers.
- No survey-driven feature backlog from Awesome-Issue-Solving.

## 1.16.0

Progressive rigor and work-type content contracts. Additive minor on the v1.14.0
evidence contract and v1.15.0 completion integrity. No `baseline_version` bump
(`tdd` and `tlc-spec-driven` stay `0.7.0`). No skill renamed. No
capability-contract field removed. Artifact field labels stay. No fifth
`feature_profile`. No `workflow.work_type`. No CLI `--type`.

**What changed:**

- Inferred **work intent** (`feature` / `bugfix` / `refactor` / `investigation` /
  `maintenance`) is documented in `shared/references/work-types.md` and stated in
  the spec package. Combine with existing `feature_profile` for ceremony.
- **Bugfix** at any profile requires **unchanged behavior** plus regression
  sensors (and the v1.15.0 reproduction sensor). Not a new header, not
  `bugfix.md`.
- Feature-profile **selection follows uncertainty and risk**, not only diff
  size. Default remains `medium_feature`.
- `sdd-create-specs` runs a **spec-analysis** pass (or records an explicit skip
  when `small_fix` and well-understood). No 15th skill.
- **Living specs:** on drift, stop and reconcile with the human. Do not silently
  implement a better requirement or rewrite the spec to match the code.
- `sdd-implement-multi` documents **DAG → waves**. No runtime scheduler.
  Worktrees stay explicit-user-only.
- Named **feedback loop** (implement → check → needs-changes → validation →
  human). Not auto-run. Direct → brainstorm → specs remains the Plan analogue.
- **Sensor taxonomy** (example / property / contract / static / integration /
  differential-mutation) as methodology classes, not shipped engines.

**Explicit non-goals (not in this release):**

- No CLI `--type`, no `workflow.work_type`, no fifth `feature_profile`, no 15th
  skill, no Analyze CLI, no DAG executor.
- No PBT / fuzz / mutation engines, no Kiro review-loop runtime, no required
  `## Unchanged behavior` or `## System Invariants` headers.
- No claim that this toolkit is Kiro or that it ships property-based testing.
- The v1.15.0 false-positive catalog is unchanged.

## 1.15.0

Completion integrity and false-positive resistance. Additive minor on the v1.14.0
evidence contract. No `baseline_version` bump (`tdd` and `tlc-spec-driven` stay
`0.7.0`). No skill renamed. No capability-contract field removed. Artifact field
labels stay. `quality.require_tdd` is not renamed.

**What changed:**

- `shared/references/evidence-standard.md` names ten **false-positive classes**. A
  catalog hit forbids `Status: pass` / `Status: ready`. Self-report is not evidence.
- Check and validation follow a fresh-eyes **state-checking** order: re-read spec and
  repo contracts, re-derive expected, re-run current sensors, map
  `requirement → sensor → current result`, apply the catalog, then Status. They must
  not inherit the author’s evidence narrative.
- Complementary **evidence strength ladder**. Lower rungs cannot outrank spec or
  repository contracts. Agent narrative is never sufficient.
- Specs require an **observable expected outcome** per acceptance criterion. Optional
  invariants live inside existing headers (`INV-…`); no required `## Invariants`
  section. Prompts copy those outcomes; implementers must not derive expected from
  the code.
- `sdd-implement-task` refuses completion on self-assessment and refuses suite
  weakening.
- Bug-fix work under existing `small_fix` requires a **reproduction sensor** that
  fails on current code. No new profile. No CLI `--type`.
- Non-shallow litmus: name a wrong implementation current sensors would still pass,
  or record a shallow-sensor / evidence gap.
- `scripts/check-skills.sh` greps the catalog and fresh-eyes tokens (presence
  checks).

**Explicit non-goals (not in this release):**

- No Verifier sub-agent, LLM-judge, PBT, mutation, discrimination, or TF-IDF detector.
- No CLI `--type=bugfix` / `--type=quick`, no fifth `feature_profile`, no new config
  key, no `doctor --quality` or `doctor --evidence-graph`.
- No new Status enum, no new evidence file format, no required `## Invariants` header.
- No claim that TDD is inferior. No 3–8× / 60–80% token-savings claim as a product
  fact. Advani (2026) percentages are not this toolkit’s measured risk.

## 1.14.0

Behavioral evidence and feedback sensors. Baseline minor (`tdd` and `tlc-spec-driven`
`0.6.0` → `0.7.0`). No skill renamed. No capability-contract field removed. Artifact
field labels stay (`Public seam`, `Expected RED command`, `## TDD baseline`,
`## TDD evidence`). `quality.require_tdd` is not renamed or deprecated.

**Baseline changes:**

- TDD loop: `[red, green, refactor]` →
  `[name-behavior, test-at-contractual-seam, implement, record-evidence]`.
- Required: name the behavior from the spec, place a sensor at the contractual seam,
  implement, record **current** evidence. Required behavioral coverage is not weakened.
- Recommended: test-first / scenarios before code when they sharpen the spec. This
  package does not claim test-first is inferior to test-last.
- Optional: full RED → GREEN → REFACTOR when the human wants that granularity. Same-agent
  RED is not harness proof. `Expected RED command` may be `n/a` and must not be
  fabricated.
- TLC stages unchanged. TLC invariant no longer embeds RED → GREEN as the proof
  mechanism.
- `shared/references/evidence-standard.md` is the operational contract: sensor →
  evidence → verification → decision; adequacy; anti-tautology / epistemic independence
  (oracle grounded in authority, not a second agent or second test suite); authority
  order; freshness; sensor composition; explicit gaps. A passing sensor is evidence,
  not a correctness verdict. The human remains the gate.
- `produces: [code-change+tdd-evidence]` and `evidence_required: [tests, tdd-evidence]`
  keep their names. Meaning: adequate behavioral sensors + recorded current evidence.

**Explicit non-goals (not in this release):**

- No claim that TDD or test-first is generally inferior to test-last.
- No wording that “TDD was replaced by tests.”
- No mutation engine, TLC Discrimination Sensor, TLC Verifier, second-agent verifier,
  quality-gate CLI, `doctor --quality`, `doctor --evidence-graph`, or
  `workflow.risk_profile`.
- No Böckeler generalization and no 3–8× token-savings claim in README or model docs.
- No new Status enum, no new evidence file format, no rename of frozen field labels.
- No `docs/references/agentic-foundations.md` catalog.

## 1.13.1

Compact welcome brand mark. Presentation-only patch; no baseline or command-contract
changes.

**Brand art:** Replaces the tall/wide three-chevron splash with a terminal-safe compact
mark (~8–10 lines, ≤52 columns). Human-rich TTY reveal steps are ~160ms (was ~60ms).
Tiny TTY (`columns` / `rows` too small) falls back to a one-line `›››` / `>>>` mark with
no animation. Machine / pipe / CI / `SDD_BRAND_ANIMATE=0` behavior unchanged.

## 1.13.0

Confirm-gated CLI/skills upgrade UX. Additive minor; no breaking changes. Does **not**
change the baseline contract.

**Upgrade command:** `upgrade`, `upgrade --check`, `upgrade --plan`, `upgrade --skills-only`.
`--check` is the upgrade-specific read-only registry check; `doctor --check-updates` remains
the broader diagnostic. `--plan` may access the registry and never mutates. `--skills-only`
never uses the network and never changes the CLI package. Interactive TTY confirms before
global `npm install -g` or skills refresh; machine/non-interactive default is check-only
(exit 0 when an update exists; non-zero when the registry is unreachable). npx/local sessions
print `npx sdd-agentic-flow@latest` instead of self-replacing.

**Welcome exception:** human-rich interactive TTY may ask `Check for updates? [y/N]` (default
N) before any registry request. `SDD_NO_UPDATE_PROMPT=1` skips the ask. Machine/pipe/CI/plain
never ask. Documented as one of three network entry points in
[docs/trust-model.md](docs/trust-model.md).

**Skills safety:** managed refresh compares bundled sources to installed files; never silently
overwrites diffs. Writes `sdd-agentic-flow-shared/install-provenance.yml`. Partial CLI/skills
failure reports state without rollback.

**QoL (orthogonal):** did-you-mean on `discover` / `migrate` / `context` / `autonomous-resume`;
menu entry **Check for updates / upgrade**.

## 1.12.0

CLI UX foundation, no breaking changes. Completes the remaining items from the internal
CLI UX plan after v1.11.0 shipped usage.md / update hint / `--local-git-exclude`.

**Output modes:** `bin/ui.js` adds `outputMode` (`human-rich` / `human-plain` / `machine`),
`symbol()`, and `FORCE_COLOR` support (TTY only). `--ascii` / `SDD_ASCII=1` forces ASCII
symbols. Brand marks and `│` connectors appear only in human-rich TTY sessions — never in
pipes, CI, `--json`, or `--quiet`.

**Errors and next steps:** `fail` on stderr uses What / Reason / Try; did-you-mean stays
under `Try:` and never mutates the filesystem. `nextStep` after successful `init`,
`install`, `discover`, `migrate`, `context refresh`, and `autonomous-resume`.

**Onboarding:** Welcome prints the full three-chevron brand art on human TTY (embedded in
`bin/brand-art.js`: Unicode blocks + stepped purple in human-rich; `#`/`+`/`=` in
human-plain). human-rich TTY reveals the three bands left→right (~60ms); plain / `--ascii`
are instant; `SDD_BRAND_ANIMATE=0` disables the reveal. Omitted in machine/pipe/CI.
Contextual interactive menu via `menuActionsFor(state)`; `Useful when:` blocks on `init` /
`install` / `doctor` / `context` / `migrate` help. Doctor human report gains a Fix/Next
footer; `--json` shape unchanged.

**Docs:** public [CLI interaction contract](docs/cli-interaction.md).

**Maintainer:** `package.json` remains the single version source; `npm run version:stamp`
writes skill/preset copies; consistency checks fail closed on drift.

**Explicitly excluded:** `doctor --evidence-graph` (Slice B), TUI/runtime deps, automatic
npm nags, new meta-commands (`status` / `setup` / CLI `sdd-route`).

## 1.11.0

Discovery and positioning, no breaking changes. Closes the post-1.10.0 Slice A gaps: the
consumer can find the skills usage guide without a phantom package `docs/` path, can hide
regenerable toolkit state from `git status` without editing the team's `.gitignore`, and
the public docs state the AI-first audience without inventing a new mechanism.

**`init` / `install` / `welcome`:** `init` writes `.sdd-agentic-flow/usage.md` (regenerable
stub: Plan→Validate chain, invoke `sdd-route`, canonical GitHub URL). Re-running `init`
refreshes that stub and still never overwrites `config.yml`. `install` next-steps and
`init` stdout point at that local file and/or the GitHub URL — never
`docs/sdd-skills-usage-guide.md` as if it existed in the consumer cwd. Bare `welcome`
mentions `doctor --check-updates` and still makes **zero** network requests.

**`init --local-git-exclude`:** opt-in, default off. Appends `.sdd-agentic-flow/` to
`.git/info/exclude` (idempotent). Does not edit `.gitignore`, does not exclude `.specs/`.
Degrades with `WARN` when Git is absent. `uninstall --apply --full` also removes
`usage.md`.

**`sdd-explain-me`:** explanation template and `## Output` now require a source-artifact
anchor per section (`Not in source artifacts` or omit — never invent). `Status: written`
only after the cross-check step.

**Positioning:** Graph note on the mental-model table (`sdd-route` + optional `REQ-{id}`;
`doctor --evidence-graph` remains a watched direction, not a command). README / pt-BR
audience paragraph. Short citations in `docs/inspirations.md`. Vendor hooks stay in the
agent product you use (`docs/recommended-harness.md`).

**Explicitly excluded:** `doctor --evidence-graph` (Slice B), CLI UX foundation
(`outputMode`, logo, structured `fail`), vendor hooks in `install`, automatic npm nags,
`docs/references/agentic-foundations.md`.

## 1.10.0

**Breaking change — toolkit path rename.** Canonical toolkit state moves from `.sdd/` to
`.sdd-agentic-flow/` (same inner tree: `config.yml`, `context/`, `autonomy/`, `snapshots/`,
`reports/`). `.specs/features/` is unchanged. The CLI no longer reads legacy `.sdd/`; use
`sdd-agentic-flow migrate --apply` to move an existing tree atomically. `doctor` warns when
`.sdd/` exists without `.sdd-agentic-flow/`. New `scripts/check-sdd-paths.sh` gate in
`npm run check`.

**P0 coherence (same release):** new [mental model doc](docs/sdd-agentic-flow-model.md) (four
layers + SDD), README "Beyond prompts" / pt-BR "Além dos prompts", cross-agent parity section in
[agent-compatibility.md](docs/agent-compatibility.md), five Autonomy Golden Flows (`AUTO-001`–
`AUTO-005`) with fixtures and integration tests, plus a migrate golden flow.

## 1.9.2

Docs-only patch, no breaking changes. Closes 2 of the 3 items from a `.local/gmm` candidate
skeleton ("Flow State & Skill Transition Semantics"), following the same audit-first discipline
as every release since v1.5: only a gap confirmed by reading the current repository became a
change, the speculative sketch was not applied as written.

**Flow-phase read path:** `docs/sdd-methodology.md` already carries a `Phase | Typical skill`
table mapping every skill to its SDD flow phase (Plan/Prompt/Implement/Check/PR/Review/Fix/
Validate/Release) — no schema gap existed. The real gap was that
`shared/references/autonomy-guardrails.md`'s `.sdd/autonomy/loop-state.md` section, and its
public mirror `docs/autonomy-guardrails.md`, never pointed a reader at that table, so nothing
told you where to look to read a `Skill:` entry's flow phase. Both now cross-reference it. No new
field.

**Completion semantics ↔ handoff:** `shared/references/handoff-standard.md` already referenced
`evidence-standard.md`'s `Status:` field for its terminal-state definition, but the reverse link
was missing — `evidence-standard.md`'s "`Status:` field and the guardrail 1 mapping" section
never mentioned that the same field is also what determines whether a skill should write
`handoff.md`. It now does, with no change to the existing per-skill vocabulary or the guardrail 1
mapping table.

**Explicitly excluded:** the skeleton's third item, a no-progress/repeated-failure signal
(`Attempt:`/`Progress:` fields in `loop-state.md`) was re-evaluated and stays deferred — its own
stated precondition (a real, observed stuck-loop incident) remains unmet, same conclusion v1.9.0
reached. No `.sdd/autonomy/loop-state.md` schema change, no new guardrail, no
`scripts/check-skills.sh` change. A separately proposed governance layer (a `docs/decisions/`
ADR folder, templates, an "official methodology" doc, a pre-committed `v1.10` schedule) was also
evaluated and rejected as disproportionate and a duplicate of what `ROADMAP.md`'s own dated
entries already do; only a one-paragraph pointer was added to `CONTRIBUTING.md` instead.

## 1.9.1

Closes 4 small, real gaps found by directly auditing the repository after v1.9.0 shipped — no
new mechanism, same audit-first discipline. All additive, no breaking changes.

**Version-consistency hardening (the headline item):** `bin/sdd-agentic-flow.js`'s own `const
VERSION` and `OFFICIAL_SKILLS` array drifted from `package.json`/`skills/` during v1.9.0 —
`VERSION` stayed at `1.8.0` and the roster drifted, and
`npm run check` still passed, because `scripts/check-version-consistency.js` only ever walked
`skills/*/SKILL.md` and `presets/*.json`, never `bin/`. Only manual testing caught it, after the
fact. `check-version-consistency.js` now also checks `bin/`'s `VERSION` (consumed by both
`scripts/check-skills.sh` and `scripts/release-checklist.sh`, which share this module); a new
`OFFICIAL_SKILLS`-vs-`skills/` parity check was added directly to `check-skills.sh`, since a
skill dropped from that array would silently stop being removable by `uninstall`. Both checks
were proven against the actual v1.9.0 bug shape (temporarily reintroducing it locally) before
being kept.

## 1.9.0

Deepens what v1.8.0 shipped instead of adding a new autonomy mechanism — closes real,
individually audited gaps in the existing skill contracts, evidence model, and continuity
story. No orchestration engine, retry/repair loop, or new mandatory skill sections; every
change stays additive under the v1.0 stability commitment.

**Handoff standard**: `shared/templates/handoff.template.md` existed since an earlier release
but nothing required a skill to populate it. New `shared/references/handoff-standard.md`
defines exactly when a skill writes or updates `handoff.md` (session end with open work, an
agent swap, or a blocker needing a human decision — never on a terminal `Status:`) and how it
cross-references `.sdd/autonomy/loop-state.md` instead of duplicating it. Wired into the 7
skills whose work can span a session or agent boundary: `sdd-implement-task`,
`sdd-implement-multi`, `sdd-task-check`, `sdd-validation`, `sdd-pr-fix`, and `sdd-create-pr`.

**`Status:` field on report artifacts**: `check-report` and `validation-report` (both
templates and `shared/references/artifact-contracts.md`) gain a top-line `Status:` field, so
[guardrail 1](docs/autonomy-guardrails.md) ("the skill reports `PASS`/`DONE`") is mechanically
checkable from the artifact itself instead of only from surrounding prose.
`shared/references/evidence-standard.md` documents the mapping from each skill's own local
vocabulary (`sdd-task-check`: `pass`/`needs changes`/`blocked`/`inconclusive`; `sdd-validation`:
`ready`/`not ready`/`blocked`/`inconclusive`) to that guardrail's generic pass/not-pass check —
this does not introduce a universal status enum; per-skill vocabulary is unchanged.

**`sdd-brainstorm`** gains an explicit Known/Assumed/Unknown/Needs research split before
handing off to `sdd-create-specs`, mirroring `sdd-create-specs`' existing-code-mode
Observed/Inferred/Unknown labels instead of inventing new terminology.

**`sdd-implement-multi`** now explicitly links
`shared/references/worktree-orchestration.md` from its worktree-isolation rule, closing the
one skill that actually needed the link — a repository audit found the file was already
required to exist by `scripts/check-skills.sh` but cited by no skill.

**Audited and found no gap, on purpose:**

- **Progressive disclosure** — all 13 pre-existing skills measured at 55–70 lines at audit
  time (before this release's own content additions to `sdd-brainstorm`/`sdd-implement-multi`
  nudged one of them to 71), far under the Agent Skills Standard's ~500-line guidance even
  after v1.8.0's `## Autonomy` section addition. No refactor shipped; this finding is the
  result, not a placeholder.
- **Orphaned golden-flow fixtures** — `examples/golden/project-context-lifecycle/` and
  `examples/golden/version-migration/` have no on-disk fixture files by design (both are
  proved by dedicated `test/cli.test.js` tests that construct their scenario directly) and
  were never untested; `examples/golden/invoice-approval/` is a deliberately smaller,
  non-golden-flow fixture (a `source-item.md` + `expected-sdd-summary.md` pair with no output
  artifacts to mechanically assert against), not an orphaned golden flow. No test-wiring
  shipped, because there was nothing to wire.
- **A first-principles no-progress/repeated-failure signal** for `.sdd/autonomy/loop-state.md`
  — considered and explicitly deferred, not built: no real stuck-loop incident has been
  observed, and `## Blocker History` plus guardrail 6 already give an agent a place to record
  "this isn't working." Building a formal `Attempt:`/`Progress:` taxonomy ahead of a validated
  need would contradict the audit-first discipline this release itself follows. Noted as a
  v2.0/evidence-graph candidate, not a v1.9 deliverable.

**Out of scope, deliberately**: a Token Economics benchmark (needs a live, human-run
comparison, not fabricable inside a documentation/skill-content release) is left for the
maintainer to run separately; new mandatory skill sections (`## Verification`, `## Completion
Criteria`, `## Escalation`); any orchestration engine, retry budget, or agent runtime.

## 1.8.0

Adds autonomy levels: `workflow.autonomy_level` (`manual`/`supervised`/`autonomous`, default
`manual`) is a new axis **orthogonal to**, not a replacement for, the 5 existing
`execution_modes` (`plan`/`guided`/`apply`/`review`/`full`, `docs/execution-modes.md`).
`execution_mode` answers "what is a skill authorized to do"; `autonomy_level` answers "does a
skill need a human between it and the next one." `plan` and `guided` never combine with
`autonomous` — `doctor --autonomy` flags either combination as `FAIL`.

`autonomous` only advances between skills when 7 deterministic guardrails all pass: completion
status, evidence validation, verification gates, scope boundary, transition validity, resource
sufficiency, and human override. Any single failure returns control to a human, exactly as
`autonomy_level: manual` already would — see `docs/autonomy-guardrails.md`.

All 13 skills gain an `autonomy_profile` frontmatter block (`supported_levels`,
`auto_continue_condition`, `blocking_conditions`, `evidence_required`), validated by
`scripts/check-skills.sh` the same way `extends`/`requires`/`produces`/`depends_on`/`conflicts`
already are. `.sdd/config.yml` gains `workflow.execution_mode`/`autonomy_level`/`autonomy_budget`
— all additive; an existing config predating v1.8.0 that has neither field defaults to
`guided`/`manual`, identical to previous behavior (`doctor --autonomy` reports `WARN`, not
`FAIL`).

New CLI surface: `init --execution-mode <mode> --autonomy-level <level>` (also available via
`init --interactive`), `doctor --autonomy [--verbose]`, `context autonomy-state`, and
`autonomous-resume [--force | --override-guard=<1-7> --reason="..."]`. There is no orchestration
engine in this CLI — these commands validate the static contract and manage
`.sdd/autonomy/loop-state.md`, the execution-state file an agent maintains while running a
`supervised`/`autonomous` workflow; none of them invoke a skill on their own.

Two new docs (`docs/autonomy-levels.md`, `docs/autonomy-guardrails.md`) plus a new shared
reference (`shared/references/autonomy-guardrails.md`); `docs/execution-modes.md`,
`docs/configuration.md`, `docs/compatibility-promise.md`, `docs/troubleshooting.md`, and
`docs/inspirations.md` updated to cross-reference the new model. MCP stays **awareness,
not a platform**: `autonomy_level` governs skill-to-skill transitions only, never tool use — a
skill may call any available MCP integration at any autonomy level, exactly as before.

Zero breaking changes: every new field, frontmatter block, and command is additive, and no
skill's previously documented behavior changed.

## 1.7.0

Adds a way to try out CLI changes — onboarding wording, a new flag, changed command behavior —
without ever running `npm publish`. `npm run cli:dev` runs `bin/sdd-agentic-flow.js` straight
from source against a persistent scratch project and an isolated `HOME`, for the fastest
possible edit-and-look loop; `--fresh` resets it. `npm run cli:sandbox` goes further: it runs a
real `npm pack` — the exact tarball `npm publish` would ship — then installs and runs it via
`npx "file:<tarball>"` in a brand-new project directory with its own isolated `HOME`, exercising
the same npm package resolution and `bin` shim a first-time consumer gets, on demand instead of
only inside `test/cli.test.js`'s tarball e2e tests. Both scripts are plain Node with no new
dependency, matching the existing `scripts/pack-dry.js`. Documented in a new "Testing CLI
changes locally, without publishing" section in `CONTRIBUTING.md`.

## 1.6.2

Fixes a real gap in v1.6.1's automated `npm publish`: it never actually ran. The workflow
(`publish-npm.yml`) listened for the GitHub `release: published` event, but GitHub does not fire
that event for a release created by another workflow's own `GITHUB_TOKEN` — the same
recursion-prevention rule already observed with a tag push not re-triggering `ci.yml`. `npm
publish` now runs in-process inside `.github/workflows/release.yml` itself, right after tag and
GitHub release creation, in the same job — sidestepping the trigger limitation entirely, still
with no `NPM_TOKEN` stored (`id-token: write` / OIDC). `publish-npm.yml` is removed: npmjs.com
allows only one Trusted Publisher per package, and `release.yml` is the one registered, so a
second workflow that could never authenticate was dead code. `docs/publishing.md` updated to
match. This is the first version actually published through the fully automated pipeline, end
to end, with zero manual steps after the version-bump push.

## 1.6.1

`npm publish` is now automated too, closing the one gap v1.6.0 deliberately left manual. A new
`.github/workflows/publish-npm.yml` runs after a GitHub Release is published (which `release.yml`
already creates automatically once `ci.yml` is green on `main`) and runs `npm publish
--access public --provenance` using npm's **Trusted Publishing (OIDC)** — no `NPM_TOKEN` secret
is stored in this repository; the workflow exchanges its GitHub Actions identity for a
short-lived publish token, authorized only for this exact repository/workflow via a one-time
Trusted Publisher registration on npmjs.com. Before publishing, it re-verifies `package.json`'s
version against the release tag and re-runs `npm run check` + `npm run pack:dry` as
defense-in-depth. **This is the first version published through the fully automated pipeline
end to end: version bump → push → CI → tag/release → npm publish, with no manual step after the
push.** `docs/publishing.md`, `README.md`, and `README.pt-BR.md` updated to match — `npm
publish` is no longer manual-forever, a deliberate reversal of that v1.6.0 decision, requested
and confirmed explicitly. Also fixes a real CI regression this change introduced:
`docs/publishing.md`'s new links to npmjs.com made `markdown-link-check` fail (npmjs.com returns
403 to the check's requests), fixed by broadening `.markdown-link-check.json`'s existing
npmjs.com ignore pattern.

## 1.6.0

Project & Repository Engineering Quality — the same rigor v1.5.0 applied to skill content,
applied here to the project's own engineering (CI, release tooling, governance, documentation
parity). Driven by a direct repository audit, not an assumed gap list. No skill content changed.

**Process change (the most important item in this release): tag and GitHub release are now
automatic.** A new `.github/workflows/release.yml` workflow runs only after `.github/workflows/
ci.yml` finishes successfully on `main` (`workflow_run`, filtered to `conclusion == 'success'`
and `head_branch == 'main'`), so it never acts on red CI. It compares `package.json`'s version
against the latest existing `vX.Y.Z` tag; if the new version is higher **and** `CHANGELOG.md` has
a matching `## X.Y.Z` section, it creates an annotated tag, pushes it, and runs `gh release
create` with notes extracted from that section (`scripts/extract-changelog-section.js`). A
version bump with no matching changelog entry is skipped, with a workflow warning, rather than
treated as an intentional release — and ordinary pushes to `main` that aren't a version bump are
no-ops, so the workflow is idempotent. The human decision point moves from "authorize the
tag/release" to "authorize the push of the version-bump commit to `main`" — once that commit is
green on CI, tag and release follow without a second manual stop.
**`npm publish` stays entirely manual, with no exception — it is not part of this workflow, and
none is planned.** See `docs/publishing.md` for the full updated process.

Also in this release:

- **Security scanning (previously nonexistent):** `.github/workflows/codeql.yml` (CodeQL for
  JavaScript, on push/PR to `main` and weekly), `npm audit --audit-level=high` as a blocking step
  in the CI `check` job, and `.github/dependabot.yml` covering `github-actions` and `npm`.
  Clearing the real high-severity advisories `npm audit` found required bumping
  `markdownlint-cli` (0.44.0 → 0.49.1, a devDependency, zero runtime dependencies preserved);
  that bump introduced a new table-formatting lint rule (`MD060`) that flagged many pre-existing
  tables project-wide with no actual defect, so it's disabled in `.markdownlint.json`.
- **Deduplicated version-consistency logic:** `scripts/release-checklist.sh` (manual pre-release
  gate) and `scripts/check-skills.sh` (CI gate) each reimplemented the same `package.json` vs.
  `skills/*/SKILL.md` vs. `presets/*.json` version-comparison walk independently. Both now call
  the single `scripts/check-version-consistency.js`; each script's own error-message format and
  exit code are unchanged.
- **Governance:** `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1), `.github/ISSUE_TEMPLATE/`
  (bug report, feature request), `.github/PULL_REQUEST_TEMPLATE.md`, `.github/CODEOWNERS`, and a
  `SECURITY.md` supported-versions table plus an explicit disclosure SLA, now pointing at
  GitHub's private vulnerability reporting instead of an unstated private channel.
- **`README.pt-BR.md` structural parity:** added the 8 section equivalents that were missing
  relative to `README.md` — Commands, Packs, Skill map, Agent workflows, Domain vocabulary,
  Examples, Safety boundaries, Publishing — keeping every command/flag/skill name in English per
  `docs/i18n.md`.
- **Test coverage visible in CI:** `npm test` now runs `node --test --experimental-test-coverage`
  (native to Node, the project's already-required minimum) — no new dependency.
- **`CONTRIBUTING.md`:** the existing "proposing a new skill?" sentence now also references
  `shared/references/evidence-standard.md` alongside `shared/references/skill-authoring-standard.md`.

## 1.5.1

Docs-only patch — no CLI, skill-content, or capability-contract change, so it's entirely
outside `compatibility-promise.md`'s scope (that promise governs the CLI argument surface,
skill capability contracts, and the environment matrix, not prose). Cites the open
[Agent Skills Standard](https://github.com/agentskills/agentskills) in `docs/inspirations.md`
as an interoperability reference: this toolkit's 13 skills already match its `SKILL.md` shape
by construction, without having been designed against it. Adds a matching pointer from
`docs/agent-compatibility.md`'s "Generic / other Markdown-first agent" row.

Everything else proposed alongside that standard — `evals/`/`scripts/`/`assets/` skill
subdirectories, `doctor --skills`, `skill validate`/`skill test` commands, quality-gate tooling
— stays out of scope. A dedicated skill test framework was already deferred to v1.7+ in the
v1.5.0 plan, and per `docs/design-principles.md`'s "concrete claims over broad compatibility...
promises", no "compliant" or "certified" claim is made without a formal validator run.

## 1.5.0

Skill system consolidation. Prompted by a real audit of the 11 skills shipped in 1.4.0: the
"evidence before claims" principle already existed, reworded slightly differently, in 6 of
them (a maintenance drift, not a missing principle), `sdd-route` duplicated the routing table
`shared/references/workflow-routing.md` already owned, and the flow had no stage before
`sdd-create-specs` for an idea that isn't spec-ready yet. This release consolidates what already
existed and closes those two real gaps — it is not a "more skills" release; 13 skills is the
result, not the goal.

- **Two new shared references formalize what the 11 skills already did in practice, once.**
  `shared/references/skill-authoring-standard.md` documents the six required `SKILL.md`
  sections every skill already followed, plus the `Status`/`Next recommended skill`/`Reason`
  output convention (previously only `sdd-route`'s template) now expected from every skill's
  `## Output`. `shared/references/evidence-standard.md` extracts the "evidence before claims"
  principle into one place; `sdd-create-specs`, `sdd-implement-task`, `sdd-task-check`,
  `sdd-validation`, `sdd-pr-review`, and `sdd-pr-fix` now reference it while keeping their own
  domain vocabulary (Observed/Inferred/Unknown, "never turn missing evidence into a pass",
  "evidence from prior runs is context, not proof", and so on) as a local application of the
  shared rule, not a restatement of it.
- **`sdd-route` no longer duplicates the routing table.** It now reads
  `shared/references/workflow-routing.md` as the single source of truth instead of carrying its
  own copy that could silently drift from it.
- **`sdd-task-check` and `sdd-validation` now cross-reference each other explicitly** in their
  `## When not to use` sections (one task before handoff/PR vs. an already-accumulated feature),
  not only through the `extends` chain and a single description sentence.
- **`sdd-brainstorm` (new)** — the flow's missing stage before `sdd-create-specs`, for an idea
  that is still vague or a problem whose solution approach isn't decided yet. Runs in an
  exploratory mode (ask one systematic question at a time until the problem is clear) or a
  design mode (challenge assumptions, explore alternatives), and only ever hands off a
  `brief.md` to `sdd-create-specs` — it never writes `spec.md`, `design.md`, or `tasks.md`
  itself.
- **`sdd-explain-me` (new)** — an on-demand, never-required skill that explains an
  already-specified or already-implemented feature in plain language for a reader with no prior
  context, distinct from `spec.md` (normative), `design.md` (technical), and `tasks.md`
  (operational). New `shared/templates/explanation.template.md`.
- **`sdd-implement-multi` gained an explicit dependency-independence analysis step** before any
  parallel-execution recommendation — checking shared files, contracts, types, and implied
  ordering — instead of relying only on the existing "never share a mutable worktree" safety
  rule to catch a bad parallelization call after the fact.
- **New lightweight handoff convention, not a new skill** (an explicit product decision this
  release): `shared/templates/handoff.template.md`, which any skill may suggest when a user
  pauses or resumes work across sessions or agents. Documented in
  `shared/references/sdd-global-guidance.md`.
- **`presets/planning.json` and `presets/full.json`** now install `sdd-brainstorm` and
  `sdd-explain-me`; `docs/skills-catalog.md`, `docs/compatibility-matrix.md`,
  `docs/architecture.md`, and the README skill map/flow diagram were all updated to match, and
  `bin/sdd-agentic-flow.js`'s `OFFICIAL_SKILLS` list now includes both so `uninstall` and
  install-detection cover them correctly.
- **New golden flow**: `examples/golden/idea-to-spec/`, proved by
  `test/cli.test.js`'s `golden flow: idea to spec` test — a converged `sdd-brainstorm` brief
  handing off into a real `sdd-create-specs` package.
- **Frontmatter key order normalized across all 13 skills** (`name` → `description` →
  `metadata` → ...). The 1.4.0 audit that flagged this found the inconsistency was wider than
  initially assumed — 7 of the 11 skills, not only `sdd-create-pr` — so this release normalizes
  all of them to one order rather than fixing a single file.

## 1.4.0

CLI UX & Guided Onboarding. Prompted by a broader push to make the CLI feel like a mature,
predictable product rather than a collection of commands, informed by patterns studied in
`anomalyco/opencode` and `vercel-labs/skills` (adopted for their approach, not their feature
set). All changes are additive per [compatibility-promise.md](docs/compatibility-promise.md) —
no documented command or flag was removed, and no existing flag's default meaning changed. Stays
zero-runtime-dependency throughout (see [trust-model.md](docs/trust-model.md)): every addition
below is hand-rolled, no new npm dependency was introduced.

- **Colored status output, hand-rolled.** `PASS`/`WARN`/`FAIL`/`INFO`/`PLAN`/`PACK` now render
  in color when writing to a real terminal. Disabled automatically whenever the target stream
  isn't a TTY (every piped/CI/agent invocation, byte-identical to pre-1.4.0 output) or the
  `NO_COLOR` env var is set (any value). New `bin/ui.js`, wired into `log()`/`fail()`.
- **Actionable "did you mean" suggestions** on 5 failure paths: an unknown top-level command, an
  unknown `help <command>` topic, an unknown `install <pack>`, an unknown `install --agent`, and
  `uninstall` called with neither `--plan` nor `--apply` now also names `uninstall --plan` as the
  safe first step. `bin/ui.js`'s `didYouMean()`, `bin/sdd-agentic-flow.js`.
- **New public `--quiet` flag on `init`, `install`, `uninstall`, and `discover`.** Previously an
  internal-only option used solely to keep `doctor --smoke`'s isolated calls clean; now
  documented. Suppresses the "Suggested next step" line on `init`/`install` and the trailing
  "preserves ..." explanatory line on `uninstall`. `discover --quiet` is accepted for flag
  symmetry but currently has no decorative output to suppress.
- **Partial core-skill install detection.** `doctor` and the bare-invocation status screen used
  to treat skill installation as binary (all 5 `CORE_SKILLS` present, or none). Both now surface
  a distinct WARN when *some but not all* are present — e.g. an interrupted install — naming
  exactly which are missing and pointing at `install core` to repair. `bin/sdd-agentic-flow.js`'s
  new `coreSkillsPresence()`.
- **`doctor` prints a one-line fix hint** under any `WARN`/`FAIL` row whose fix is a single,
  unambiguous command (`config`, `skills`, `shared_layer`, `language_profile`). Human-readable
  output only — `--json` shape unchanged for these rows.
- **New opt-in `doctor --check-updates` flag.** Makes exactly one request to the npm registry to
  check for a newer version, only when explicitly passed — the sole, explicit exception to "no
  outbound CLI network access by default" (see [trust-model.md](docs/trust-model.md)). Bounded
  3-second timeout; any failure (offline, unreachable, malformed response) degrades to an
  informational row and never affects `doctor`'s overall status or exit code. New
  `bin/update-check.js`. This is an additive `--json` shape change (a new `update_check` row,
  present only when the flag is passed) per compatibility-promise.md's additive-changes rule.
- **Bare `npx sdd-agentic-flow` now offers a numbered interactive menu** after the existing
  read-only status screen, but only when the process is genuinely interactive: both stdout and
  stdin are a real TTY, and `process.env.CI` is unset. Every other invocation — piped, scripted,
  CI, agent-invoked, or an explicit command — is byte-for-byte unchanged from before this
  release. Selecting a menu entry runs the exact same code path the equivalent typed command
  uses; the uninstall entry only ever runs `--plan` (never `--apply`), explaining afterward how
  to run `--apply` explicitly. New `bin/menu.js`.
- **Two exit-code bug fixes:** `doctor --json` with invalid flags used to print a `FAIL`-shaped
  JSON body without setting a non-zero exit code; it now correctly exits `1`. `init --interactive`
  with invalid input used to fall through to the generic exit code `2` reserved for unexpected
  internal errors, indistinguishable from a real crash; it now exits `1` like every other
  input-validation failure in this CLI.
- **Exit codes documented for the first time**: `0` success, `1` handled/validation failure, `2`
  unexpected/internal error (already existed via `main()`'s top-level catch, just undocumented).
  See README.md and [compatibility-promise.md](docs/compatibility-promise.md).

## 1.3.0

Uninstall completeness and post-command guidance. Prompted by a user trying to fully reset a
project for a clean reinstall and finding no single command for it, and by a broader ask for
clearer CLI feedback. All changes are additive per
[compatibility-promise.md](docs/compatibility-promise.md) — no documented command or flag was
removed, and no existing flag's default meaning changed.

- **New `uninstall --apply --full` flag**: a complete-reset path for a clean reinstall. It
  implies `--include-config` and additionally removes `.sdd/context/project-context.md`,
  `.sdd/snapshots`, and `.sdd/reports` — regenerable local state that plain `--apply` and
  `--apply --include-config` always left behind. `.specs/features` is still never removed by
  any flag combination, in any scope: it holds hand-authored specs, the same "preserved like
  source code" invariant already documented for every other `uninstall` mode. `--full` is
  `--apply`-only, same convention as `--include-config` — combining it with `--plan` fails.
  `bin/sdd-agentic-flow.js`, [uninstall](docs/uninstall.md).
- **Doc fix: `docs/upgrading.md` overstated what's preserved.** It read "`install`/`uninstall`
  never touch `.sdd/config.yml`", which was already inaccurate — `uninstall --apply
  --include-config` has always removed it on request. Reworded to describe the actual,
  flag-gated behavior.
- **`init` and `install` now print a short "Suggested next step" line after a successful,
  non-`--plan` run** — `init` points at `install core`; `install` points at `doctor` plus a
  one-line pointer to the `sdd-route` skill and the main flow (Plan → Prompt → Implement →
  Check → PR → Review → Fix → Validate). Both were previously silent about what to do next
  beyond the static `README.md` Quick Start. Suppressed via an internal `quiet` option during
  `doctor --smoke`'s isolated init/install calls, so the smoke check's own output stays
  unpolluted. Per `docs/compatibility-promise.md`'s "what still stays free to change without
  notice" clause, this is human-readable-text-only — no flag or exit-code behavior changed.

## 1.2.0

CLI UX audit and upgrade. Prompted by an audit of the documented Quick Start flow
(`init` → `install core` → `doctor`) and the other `npx sdd-agentic-flow` commands. All changes
are additive per [compatibility-promise.md](docs/compatibility-promise.md) — no documented
command or flag was removed, and no existing flag's default meaning changed.

- **Bug fix: `doctor` false-`WARN`/false-message after the default, recommended install flow.**
  `doctor`'s `skills`, `shared_layer`, `project_readiness`, `tdd-baseline`, and the four
  baseline-compliance checks, plus `doctor --contracts` and the `language_profile` check, were
  hardcoded to read `cwd/.agents/skills/...` — project scope only. Since `install`'s default
  (and recommended) scope is `user`, running the exact Quick Start sequence from `README.md`
  left `doctor` reporting overall `WARN` with six misleading messages, directly contradicting
  `doctor`'s own `Installation` section, which correctly showed the user-scope install as
  `PASS`. Added `resolveSkillsRoot(cwd)` (checks project scope first, then every resolved
  user-scope target, same resolution `install` itself uses) and routed all of the above checks
  through it. `bin/sdd-agentic-flow.js`.
- **`--br`/`--en` aliases for `init`'s `--language` flag**: `init --br` is shorthand for
  `init --language pt-BR`, `init --en` for `init --language en-US`. Left-to-right scan, same as
  the existing `install`/`uninstall` flag parsing — whichever of `--language`/`--br`/`--en`
  appears last wins.
- **Real per-command help**: `sdd-agentic-flow help <command>` and
  `sdd-agentic-flow <command> --help` now render the same detailed usage block (description,
  `USAGE`, `OPTIONS`, `EXAMPLES`) for `init`, `install`, `doctor`, `uninstall`, `discover`,
  `context`, and `list` — previously only `init --help` existed, and it printed a bare one-line
  usage string; `install --help`/`doctor --help`/`uninstall --help`/`discover --help`/
  `context --help` all used to `FAIL` with exit code 1 as an unrecognized flag. `help` with no
  argument still shows the full command reference, reorganized with a `QUICK START` block and a
  `MORE HELP` pointer to the new per-command form; every line from the previous reference is
  still present.
- **Bare `npx sdd-agentic-flow` (no command) now shows a contextual, read-only status screen**
  instead of silently aliasing to `help`'s full reference (the un-narrated previous behavior of
  `argv`'s `command = 'help'` default). It reports whether `.sdd/config.yml`, installed core
  skills (and which scope), and the generated project context exist, points at exactly one
  suggested next command based on that state, and lists the same quick commands as the Quick
  Start section — never a prompt, never an implicit action, always exit `0`. Per
  `docs/compatibility-promise.md`'s "what still stays free to change without notice" clause,
  this is a human-readable-text-only change, not a change to any documented flag's behavior;
  `help`, `--help`, and `-h` are unaffected and keep returning the full reference exactly as
  before.

## 1.1.0

**Breaking compatibility-reducing change (per the v1.0 stability commitment):** dropped Node.js
18 and 20 as supported/required versions. `package.json`'s `"engines"` moves from `>=18` to
`>=22` — Node 22 (Maintenance LTS), 24 (Active LTS), and 26 (Current) are now the required,
CI-verified versions; see [environment-compatibility.md](docs/environment-compatibility.md) and
Node's own [release schedule](https://nodejs.org/en/about/previous-releases). Node 18 reached
end of life; keeping it as a floor was forcing this package's `devDependencies` chain
(`markdown-link-check` and its own transitive dependencies — `marked`, `commander`, `chalk`,
`proxy-agent`, `undici`) to stay pinned to increasingly old, CommonJS-only major versions to
avoid `ERR_REQUIRE_ESM` crashes, which is exactly the kind of version-pinning debt this
package's own `requires_cli` contract field exists to make visible rather than silently work
around. Node 22+ ships native, unflagged `require()` of ES-module-only packages
(`require(esm)`, stable since Node 22.12), which removes the need for any of those pins —
this release deletes the `overrides` block entirely rather than keep growing it.

- Fixed four real, independent CI bugs surfaced while investigating the above (all still
  correct fixes regardless of the Node floor, kept in this release): `scripts/sanitize-private-context.sh`
  used `mapfile` (bash 4+), which macOS's default bash 3.2 doesn't have — replaced with a
  portable `while read` loop. `scripts/check-mermaid.js`'s `mmdc` (Puppeteer) failed to launch
  Chromium on `ubuntu-latest` ("No usable sandbox!" — Ubuntu 24.04 disabled unprivileged user
  namespaces) — added `scripts/mermaid-puppeteer-config.json` (`--no-sandbox
  --disable-setuid-sandbox`, safe here because this only renders trusted, repo-local Markdown
  for a devDependency-only syntax check). No `.gitattributes` existed, so `windows-latest`
  (`core.autocrlf=true` by default) checked out every text file as CRLF, which Biome's
  LF-only formatter read as a diff on every file — added `.gitattributes`
  (`* text=auto eol=lf`). `execFileSync` couldn't spawn `mmdc.cmd` on Windows without
  `shell: true` (Node's CVE-2024-27980 hardening) — scoped to `win32` only.
- `.github/workflows/ci.yml` now runs `npm ci` instead of `npm install` in both jobs.
  `npm install` re-resolves the dependency graph against `package.json`/`overrides` on every
  run rather than strictly honoring `package-lock.json`, so a fresh CI machine could land on a
  different (but still range-valid) resolution than an already-installed local tree — observed
  directly during this investigation. `npm ci` installs exactly what's committed, and fails
  fast if `package.json`/`package-lock.json` ever drift out of sync.
- `check-platforms` already ran Node 22; it now meaningfully tests the floor version on
  macOS/Windows rather than an arbitrary middle value from a wider matrix.

## 1.0.0

Public Commitment / Go-Live Release. No new product features — this release audits the
architecture v0.6.0–v0.9.0 built, closes the pointwise gaps the audit found, and freezes a
public stability commitment. Verified against seven objective gates:

- **G1 — Identity:** confirmed `README.md`, `docs/why-this-exists.md`, and
  `docs/design-principles.md` describe the product consistently, and that no out-of-scope term
  (Context Indexing, Context Query, RAG, vector DB, Memory Layer, Plugin SDK, Policy Engine)
  appears outside an explicit exclusion. No corrections needed.
- **G2 — Flow:** confirmed the 5 golden-flow integration tests are green and the skill roster
  matches `shared/references/workflow-routing.md`. Found and fixed one real drift: the
  `README.md` "Main SDD flow" mermaid diagram was missing `sdd-implement-multi` (present in
  `skills/`, in the routing table, and in the skill map table, but not in the diagram) — added
  it as the multi-task branch off `sdd-create-prompts`.
- **G3 — Contracts:** `scripts/check-skills.sh` and `doctor --contracts --json` both `PASS`
  against a real packed-and-installed consumer. Confirmed the `tlc-spec-driven`/`tdd` upstream
  version pins in `shared/baselines/registry.yml` are mechanically enforced and re-checked the
  real upstream sources — both unchanged since the v0.9.0 pin (`3.3.0` and `v1.2.3`), so no
  pending re-sync decision to record.
- **G4 — Compatibility:** confirmed `docs/environment-compatibility.md` matches
  `.github/workflows/ci.yml` cell-for-cell (Node 18/20/22/24 on `ubuntu-latest`, full pipeline
  on `macos-latest`/`windows-latest`), and `docs/agent-compatibility.md` accurately reports
  validated vs. not-verified agents. No corrections needed.
- **G5 — Installation:** confirmed the existing `npm pack` integration test is green. Added a
  new integration test, from a real packed-and-extracted tarball, that runs `init` → `install
  core` (default `--scope user`) → `doctor` → `context status` → `uninstall --plan` →
  `uninstall --apply` end to end with no manual input, asserting zero files are written to
  `cwd` by the default-scope install.
- **G6 — Documentation:** `npm run docs:check` passes. Added a documented-CLI-command-exists
  check to `scripts/release-checklist.sh` (extracts every `npx sdd-agentic-flow <cmd>` cited in
  `README.md`/`README.pt-BR.md`/`docs/**` and confirms it exists in the CLI dispatch). Manually
  walked the README → docs journey and found two orphaned docs with no inbound link from
  either README — `docs/installation.md` and `docs/design-principles.md` — and linked both
  from the English and Portuguese READMEs.
- **G7 — Public commitment:** added a "v1.0 stability commitment" section to
  `docs/compatibility-promise.md` — from v1.0.0, the documented CLI argument surface and the
  `docs/environment-compatibility.md` support matrix follow the same minor/major-only change
  rule already used for skill capability contracts; removed the pre-1.0 disclaimer that the
  CLI argument surface carried no semantic-versioning guarantee, since it is no longer true.
  `ROADMAP.md` updated: `v1.0` moved to the top with its release date, `v1.x` opened for
  future, undecided work (adapters beyond `local-files`/`github`, maturity-model docs).

## 0.9.0

Installation, Portability & Public Readiness Release.

- **Breaking capability-contract change (default behavior, not a contract field):**
  `install <pack>` now defaults to `--scope user` — it writes only to per-agent global skill
  directories (e.g. `~/.claude/skills`) and creates **zero files in the consumer project**.
  The pre-v0.9.0 behavior (write into `.agents/skills/` inside the project) is now opt-in via
  `--scope project`. `uninstall` gained the matching `--scope`/`--agent` flags and now removes
  from both scopes by default. See `docs/installation-scope.md` and `docs/upgrading.md` for
  the exact migration story — nothing already installed is touched or removed by this change.
- Added an **Agent Integration Layer** covering 4 officially supported agents — Codex CLI,
  Cursor, Claude Code, and VS Code + GitHub Copilot — each with a global skill directory
  verified against that agent's own documentation. New `install --agent <name>` restricts
  `--scope user` writes to one agent's directories; `.sdd/config.yml`'s existing `agent.target`
  field is now read back as the default when `--agent` is omitted. New `install --plan` dry-run
  mirrors `uninstall --plan`.
- New `doctor` **Installation** section: reports, per scope and per agent target, whether a
  valid `sdd-agentic-flow` installation is present, plus an explicit `✓ No project files
  created by installation` line — correctness-hardened so it only recognizes this package's
  own official skills, never any unrelated skill that happens to share a directory convention.
- New `doctor` **Platform** section: `OS`/`Node` version, filesystem writability, an
  informational `Shell:` line (never used to change CLI behavior), and `Git: available`/`Git:
  not available` (never `FAIL` — Git remains an optional integration, not a runtime
  requirement). Centralized every `os.homedir()`/`process.platform`/`process.env` read into a
  single block in `bin/sdd-agentic-flow.js`.
- CI (`.github/workflows/ci.yml`) now runs the full `npm run check` pipeline on Node 18/20/22/24
  (`ubuntu-latest`), plus a new `check-platforms` job running the same full pipeline on
  `macos-latest` and `windows-latest`. Replaced the POSIX-only `env VAR=val npm pack --dry-run`
  `pack:dry` script (broke under Windows' default `cmd.exe` npm script shell) with a
  cross-platform `scripts/pack-dry.js`.
- Added `bin/version-compat.js`: a minimal, **vendored** version-comparison primitive
  (`parseVersion`/`compareVersions`/`satisfiesRange`, covering exact/`>=`/`^` ranges only) —
  not the npm `semver` package, which would have broken the zero-runtime-dependency invariant.
  Added a 9th, optional capability-contract field, `requires_cli` (a semver-style range,
  `null` by default on all 11 skills), validated deterministically by `doctor --contracts`.
- Added `docs/skills-catalog.md`: a Purpose/When-to-use/When-not-to-use/Inputs/Outputs/
  Dependencies/Conflicts/Baseline/Pack(s)/Typical-flow-position entry for each of the 11
  public skills, ordered like the main Flow. `scripts/check-skills.sh` now fails if any skill
  loses its catalog entry.
- Added 5 **golden flows** as real integration tests in `test/cli.test.js` (not just prose):
  greenfield (init → install → spec artifacts → doctor), existing-code mode (Observed/Inferred/
  Unknown labeling), the v0.8.0 project-context provenance/drift test (now formalized as one of
  the 5), a PR-templates presence-contract flow, and a v0.8.0 → v0.9.0 install-scope migration
  flow. Each has a `walkthrough.md` under `examples/golden/<flow>/`, written after its test
  passed. Rewrote the `task-management` golden fixture's `spec.md`/`design.md`/`tasks.md` to
  actually satisfy `shared/references/artifact-contracts.md`'s required headers (they didn't
  before this release).
- Added `docs/upgrading.md`, `docs/troubleshooting.md`, and `docs/environment-compatibility.md`
  (new); extended `docs/compatibility-promise.md` with an explicit breaking-vs-additive policy
  section; refreshed `docs/publishing.md` to drop its stale "For v0.7.0, also run..." line in
  favor of `npm run release:check`; fixed `docs/installation.md` and both READMEs, which still
  described the pre-v0.9.0 always-project-local install default.
- Diagrams: added `@mermaid-js/mermaid-cli` as a **devDependency only** (never runtime) and a
  new `npm run docs:diagrams` check (part of `npm run docs:check`) that renders every
  ` ```mermaid ` block to catch syntax errors.
- Added `scripts/release-checklist.sh` (`npm run release:check`): chains `npm run check`,
  `npm run pack:dry`, `doctor --smoke`, a dynamic version-consistency check across
  `package.json`/`skills/*/SKILL.md`/`presets/*.json` (using `version-compat.js`, not hardcoded
  strings — `scripts/check-skills.sh`'s own version check was also converted from hardcoded
  string equality to this), and a grep guard against a pinned `sdd-agentic-flow@<version>`
  regressing back into the docs.
- `ROADMAP.md`: marked "skill cards" delivered (`docs/skills-catalog.md`); adapters beyond
  `local-files`/`github` and maturity-model documentation remain open, not decided.
- **Pinned explicit upstream versions for both adapted baselines**, tracked machine-readably
  in `shared/baselines/registry.yml` (`upstream_version`/`upstream_source` per baseline, plus
  `upstream_version_checked_at`) instead of only in prose: `tlc-spec-driven` at its own
  `metadata.version: 3.3.0`, and `tdd` (`mattpocock/skills`, which carries no version of its
  own) at the repository's release tag `v1.2.3`. `NOTICE`, `LICENSING.md`, and
  `docs/tlc-integration.md` (new "Upstream version pins" section) now cite these explicitly.
  `scripts/check-skills.sh` fails if either pin is removed. Rationale: this package already
  promised in `docs/tlc-integration.md`'s synchronization policy to update deliberately, never
  silently, when the upstream skills change — that promise had no pinned starting point to
  diff against; this closes that gap.
- Rationale: this release does not add product surface area so much as it proves the
  architectural shape reached in v0.8.0 is complete, safe by default for a stranger's
  repository, and portable across the agents/platforms this package already claimed to
  support — preparing the ground for v1.0.0, which is expected to be small and mostly freeze
  what already exists.

## 0.8.0

Flow Consolidation & Dynamic Project Context Release.

- **Breaking capability-contract change:** merged `sdd-reverse-engineer` into
  `sdd-create-specs` as an **existing-code mode**, alongside its existing source-item mode.
  `sdd-create-specs` now accepts either a requested outcome/ticket (source-item mode,
  unchanged) or an explicit existing-code scope (existing-code mode), which carries over the
  scope-confirmation gate, the Observed/Inferred/Unknown evidence-labeling discipline, and the
  conditional `tasks.md` creation from the former `sdd-reverse-engineer` skill. Skill count:
  12 → 11. `sdd-reverse-engineer` no longer exists as a standalone skill; any preset, config,
  or automation referencing it directly must switch to `sdd-create-specs`.
- Removed `sdd-reverse-engineer` from `presets/core.json` and `presets/full.json`.
- Updated `shared/references/workflow-routing.md` so "existing undocumented code needing
  specs" routes to `sdd-create-specs` (existing-code mode) instead of a separate skill.
- Rationale: `sdd-reverse-engineer` was a parallel chain entry point competing with
  `sdd-create-specs` for the same "Specification" step, which diluted the Flow's linear
  identity and risked pulling the toolkit toward a general "AI engineering toolbox" rather
  than a focused SDD flow. The capability is preserved; only its position in the chain
  changed. See `docs/guides/adopting-in-a-brownfield-repo.md` for the updated guidance.
- Formalized **Dynamic Project Context**: `.sdd/context/project-context.md` is now the
  canonical, versioned Project Context artifact. It records its own provenance (generated-at
  timestamp, repository revision, branch, discovery version), read via a local, read-only
  `git rev-parse`, degrading gracefully to `not a git repository` / `unknown` outside a Git
  repository or without `git` installed.
- Added `context status` and `context refresh` commands. `context status` reports current
  provenance and states factually (never a heuristic "stale" verdict) whether the repository
  has changed since generation; `context refresh` regenerates the artifact unconditionally,
  equivalent to `discover --force` without needing to remember the flag. `discover [--force]`
  is unchanged and keeps working exactly as before — `context` is additive, not a
  replacement.
- `doctor`'s `project_context` check now notes repository revision drift in its message when
  detected (still `PASS`; informational, not a failure).
- Rationale: skills already consume `project-context.md` as a shared, read-only baseline and
  layer only task-specific inspection on top of it (targeted discovery), so no skill
  workflow changed. Context Indexing, Context Query, knowledge graphs, RAG, and vector
  databases remain explicitly out of scope for the core product — this release only makes
  the existing Discovery mechanism versioned, inspectable, and explicitly regenerable.

## 0.7.0

Operational Excellence (start).

- Added `depends_on` and `conflicts` (optional) to every skill's capability contract, and a
  `doctor --contracts` check that validates all 8 contract fields against skills installed in a
  **consumer** repository — complementing `scripts/check-skills.sh`'s existing source-side
  validation.
- Added light Artifact Contracts: `shared/references/artifact-contracts.md` documents the
  required sections for `spec.md`, `design.md`, `tasks.md`, task prompts, check reports, and PR
  packages, with a presence check in `doctor`.
- Extended Project Discovery with architecture (`domain/`, `hexagonal/`, `ports/`, `adapters/`
  folder naming), CI/CD (`.github/workflows`, `.gitlab-ci.yml`, `.circleci`), and platform
  (ORM/feature-flag config) signals in `.sdd/context/project-context.md`.
- Added an agent-neutrality regression guard to `scripts/check-skills.sh` (fails the build if a
  vendor/agent name appears in a skill body) and
  `shared/references/action-vocabulary.md`, the vendor-neutral verb vocabulary skills use.
- Added the first 3 decision guides (`docs/guides/`) and `docs/compatibility-matrix.md`,
  extending `docs/compatibility-promise.md`.
- Added `sdd-reverse-engineer`, an alternative chain entry point for producing an SDD spec
  package from existing, undocumented code (`core`, `full`).
- Deferred to v0.8-v0.9: skill cards, maturity-model documentation, and adapters beyond
  `local-files`/`github` (Jira, Linear, Azure DevOps). See `ROADMAP.md`.

## 0.6.0

Foundation Architecture Release.

- Added capability contracts (`extends`, `requires`, `consumes`, `produces`, `baseline`,
  `compatible_with`) to every skill's frontmatter; `compatible_with` is mechanically
  cross-checked against `presets/*.json` membership by `scripts/check-skills.sh`.
- Added a Baseline Registry (`shared/baselines/registry.yml`) with an independent
  `baseline_version: 0.6.0` for the condensed TLC and TDD baselines this package ships.
- Added Project Discovery: `sdd-agentic-flow discover [--force]` and automatic discovery
  during `init` write `.sdd/context/project-context.md`, a read-only, auto-discovered
  record of repository signals (README, AI instruction files, docs/ADR presence,
  package identity, monorepo tooling, test config), separate from user-declared policy
  in `.sdd/config.yml`.
- Added Feature Profiles: `workflow.feature_profile` (`small_fix`, `medium_feature`,
  `large_feature`, `epic`), selectable via `init --feature-profile` or the interactive
  prompt, with guidance in `shared/references/feature-profiles.md`.
- Added a Baseline Compliance gate to `doctor`: `baseline-tlc`, `adaptive-sizing`,
  `traceability`, and `evidence-first` checks (presence and configuration checks, not
  behavioral verification).
- Added `docs/architecture.md`, `docs/compatibility-promise.md`, and
  `docs/tlc-integration.md`; updated positioning in `README.md`/`README.pt-BR.md` and
  `package.json` to reflect capability contracts, condensed baselines, and adaptive
  sizing.
- Deferred to v0.7-v0.9: decision guides, playbooks, skill cards, maturity-model
  documentation, and adapters beyond `local-files`/`github` (Jira, Linear, Azure
  DevOps). See `ROADMAP.md`.

## 0.5.0

- Added the read-only `sdd-route` workflow navigation skill and invocation guidance.
- Added task-slicing and optional domain-vocabulary guidance.
- Added routing, workflow, and domain documentation with a main-flow diagram.

## 0.4.0

- Added an internal TDD baseline for behavior-focused implementation evidence.
- Added TDD checks, templates, skill guidance, documentation, and attribution.

## 0.3.0

- Added `en-US` and `pt-BR` language profiles with canonical technical tokens.
- Added `init --language`, language-aware `doctor`, profile installation, and bilingual profile documentation.

## 0.2.0

- Added interactive init, structured doctor output, JSON diagnostics, smoke validation, and scoped uninstall.
- Added Adoption & Trust documentation, agent workflow guides, Portuguese README, CI, and a task-management golden example.

## 0.1.0

- Initial public local-first release.
