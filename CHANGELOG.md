# Changelog

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
