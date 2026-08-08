# Changelog

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
