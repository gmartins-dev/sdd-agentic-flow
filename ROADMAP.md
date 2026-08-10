# Roadmap

- **v1.9.0 (2026-08-10):** Method & Reliability. Deepens v1.8.0's autonomy foundation instead of
  adding a new mechanism — closes individually audited gaps rather than the originally drafted
  candidate wholesale (see "Corrections vs. the v1.9 candidate draft" below). New `sdd-release`
  skill (14th public skill; packs `core`/`full`/`local-files`/`github`, matching
  `sdd-validation`): checks release readiness (version consistency, changelog presence,
  configured checks) and reports tag/publish commands for a human to run — config-driven and
  portable, it does not shell out to this repository's own `scripts/release-checklist.sh`. New
  `shared/references/handoff-standard.md` defines when a skill populates the
  previously-unused `shared/templates/handoff.template.md` and how it cross-references
  `.sdd/autonomy/loop-state.md` without duplicating it; wired into the 7 skills whose work can
  span a session/agent boundary. `check-report`/`validation-report` gain a top-line `Status:`
  field, with `shared/references/evidence-standard.md` documenting the mapping from each
  skill's own local vocabulary to guardrail 1's generic pass/not-pass check. `sdd-brainstorm`
  gains an explicit Known/Assumed/Unknown/Needs research split before handing off to
  `sdd-create-specs`; `sdd-implement-multi` now explicitly links
  `worktree-orchestration.md`. Zero breaking changes, same as every release since v1.0.

  **Corrections vs. the v1.9 candidate draft below and its
  `.local/gmm/sdd-agentic-flow/v1.9.0-implementation-plan.md` skeleton:** progressive disclosure
  was audited and found not needed — all 13 pre-existing skills measured 55–70 lines at audit
  time (before this release's own content additions nudged `sdd-brainstorm` to 71), far under
  the ~500-line guidance even after v1.8.0's `## Autonomy` section addition; no refactor
  shipped. The skeleton's claim of 2 orphaned golden-flow fixtures (and an earlier re-check
  during this release that initially assumed 3) was also wrong on inspection:
  `project-context-lifecycle` and `version-migration` have no on-disk fixture files by design
  and are already proved by dedicated `test/cli.test.js` tests; `invoice-approval` is a
  deliberately smaller, non-golden-flow fixture per
  `.local/gmm/sdd-agentic-flow/ai-context-report.md`, not an untested golden flow — there was
  nothing to wire. A formal no-progress/repeated-failure signal for `loop-state.md` (raised in a
  separate pre-planning discussion, not in the original v1.9 candidate) was evaluated and
  explicitly deferred: no real stuck-loop incident has been observed, and building the
  taxonomy ahead of a validated need would contradict this release's own audit-first discipline
  — noted below as a v2.0/evidence-graph candidate. A Token Economics benchmark needs a live,
  human-run comparison and is left for the maintainer to run separately, outside this release.

- **v1.8.0 (2026-08-09):** Autonomy levels. `workflow.autonomy_level` (`manual`/`supervised`/
  `autonomous`, default `manual`) ships as a **new axis orthogonal to** the 5 existing
  `execution_modes` (`docs/execution-modes.md`) — it does not replace or duplicate them.
  7 deterministic guardrails (completion status, evidence validation, verification gates, scope
  boundary, transition validity, resource sufficiency, human override) gate every automatic
  transition; any failure returns control to a human, same as `manual`. An `autonomy_profile`
  frontmatter extension ships across all 13 skills (`supported_levels`, `auto_continue_condition`,
  `blocking_conditions`, `evidence_required`), validated by `scripts/check-skills.sh` the same way
  `extends`/`requires`/`produces`/`depends_on`/`conflicts` already are. `.sdd/config.yml` gains
  `workflow.execution_mode`/`autonomy_level`/`autonomy_budget` (all additive; an existing config
  without them defaults to `guided`/`manual`, identical to pre-v1.8.0 behavior — `doctor
  --autonomy` reports `WARN`, not `FAIL`). New CLI surface: `init --execution-mode
  --autonomy-level`, `doctor --autonomy [--verbose]`, `context autonomy-state`, and
  `autonomous-resume [--force | --override-guard=<1-7> --reason="..."]`. There is no
  orchestration engine in this CLI — these commands validate the static contract and manage
  `.sdd/autonomy/loop-state.md`, the execution-state file an agent maintains while running a
  workflow; they never invoke a skill themselves. Two new docs
  (`docs/autonomy-levels.md`, `docs/autonomy-guardrails.md`) plus a new shared reference
  (`shared/references/autonomy-guardrails.md`); `docs/execution-modes.md`,
  `docs/configuration.md`, `docs/compatibility-promise.md`, `docs/troubleshooting.md`, and
  `docs/inspirations.md` updated to cross-reference it. MCP stays **awareness, not a
  platform**: `autonomy_level` governs skill-to-skill transitions only, never tool use — a skill
  may call any available MCP integration at any autonomy level, exactly as before. Zero breaking
  changes: every field and command is additive, and no skill's documented behavior changed.
- **v1.7.0 (2026-08-09):** Local CLI testing without publishing. `npm run cli:dev` runs
  `bin/sdd-agentic-flow.js` straight from source against a persistent scratch project and an
  isolated `HOME`, for the fastest possible edit-and-look loop (`--fresh` resets it). `npm run
  cli:sandbox` goes further: a real `npm pack` — the exact tarball `npm publish` would ship —
  installed and run via `npx "file:<tarball>"` in a brand-new project directory with its own
  isolated `HOME`, exercising the same npm package resolution and `bin` shim a first-time
  consumer gets, on demand instead of only inside `test/cli.test.js`'s tarball e2e tests. Both
  scripts are plain Node with no new dependency, matching the existing `scripts/pack-dry.js`.
  Purely a contributor-workflow change — no CLI-facing behavior, skill, or capability-contract
  change, so it ships outside `compatibility-promise.md`'s scope.
- **v1.6.2 (2026-08-09):** Fixes v1.6.1's `npm publish` automation, which tagged and released on
  GitHub correctly but never actually reached npm — `publish-npm.yml` listened for `release:
  published`, an event GitHub does not fire for a release created by another workflow's own
  `GITHUB_TOKEN`. `npm publish` now runs in-process inside `.github/workflows/release.yml`
  itself; `publish-npm.yml` is removed (npmjs.com allows only one Trusted Publisher per package,
  and it's registered to `release.yml`). First version actually published through the fully
  automated pipeline end to end (push → CI → tag → release → npm publish, zero manual steps).
- **v1.6.1 (2026-08-09):** `npm publish` automation attempted via a second, event-triggered
  workflow (`publish-npm.yml`) — tag/GitHub release succeeded via v1.6.0's `release.yml`, but the
  `npm publish` step never ran (see v1.6.2). Reverses v1.6.0's "manual forever" decision on `npm
  publish` specifically, by explicit request; tag/GitHub-release automation from v1.6.0 itself is
  unaffected. `v1.6.2` is the version that actually completed the automated `npm publish`.
- **v1.6 (2026-08-09):** Project & Repository Engineering Quality. Applies the same rigor v1.5
  brought to skill content to the project's own engineering, driven by a direct repository audit
  rather than an assumed gap list. **Process change, the headline item:** tag creation and the
  GitHub release are now automatic — a `.github/workflows/release.yml` workflow, triggered only
  after `ci.yml` finishes successfully on `main`, tags and publishes a GitHub release once
  `package.json`'s version is ahead of the latest tag and `CHANGELOG.md` has a matching section
  (an accidental bump with no changelog entry is skipped, not released). The human decision point
  moves from "authorize the tag/release" to "authorize the push of the version-bump commit to
  `main`" — `npm publish` stays manual forever, with no exception, and is not part of this
  workflow. Also: closed the real security-scanning gap (CodeQL, `npm audit --audit-level=high`
  as a CI gate, Dependabot for `github-actions`+`npm`) — the `npm audit` fix required bumping
  `markdownlint-cli` to clear real high-severity transitive advisories, which introduced a new
  table-formatting lint rule (`MD060`) disabled in `.markdownlint.json` since it's unrelated
  noise, not a real defect, across many already-existing tables. Deduplicated the
  version-consistency check that `scripts/release-checklist.sh` and `scripts/check-skills.sh`
  each reimplemented independently into `scripts/check-version-consistency.js`. Added the
  open-source governance files a public repo was missing (`CODE_OF_CONDUCT.md`, issue/PR
  templates, `CODEOWNERS`, a `SECURITY.md` supported-versions table and disclosure SLA). Closed
  the `README.pt-BR.md` structural parity gap (8 missing section equivalents: Commands, Packs,
  Skill map, Agent workflows, Domain vocabulary, Examples, Safety boundaries, Publishing).
  Test coverage is now visible in CI via Node's native `--experimental-test-coverage`, no new
  dependency. `CONTRIBUTING.md` now also references `shared/references/evidence-standard.md`
  alongside `skill-authoring-standard.md`. No skill content changed — that stays v1.5's scope.
- **v1.5.1 (2026-08-09):** Docs-only patch — cites the open Agent Skills Standard
  (`agentskills/agentskills`) in `docs/inspirations.md` as an interoperability reference and
  points `docs/agent-compatibility.md`'s "Generic / other Markdown-first agent" row at it,
  since this toolkit's `SKILL.md` format already matches that shape by construction. No CLI,
  skill-content, or capability-contract change, so it ships as a patch, entirely outside
  `compatibility-promise.md`'s scope. Everything else proposed alongside that standard —
  `evals/`/`scripts`/`assets` skill subdirectories, `doctor --skills`, `skill validate`/`skill
  test`, quality-gate tooling — stays out of scope; a dedicated skill test framework was
  already deferred to v1.7+ in the v1.5.0 plan, and no "compliant"/"certified" claim is made
  without a formal validator run.
- **v1.5 (2026-08-09):** Skill System Consolidation. Prompted by a real audit of the 11 skills
  shipped in v1.4 rather than an assumed gap: the "evidence before claims" principle already
  existed, reworded slightly differently, in 6 of them, and `sdd-route` duplicated the routing
  table `shared/references/workflow-routing.md` already owned — both real maintenance drift,
  not missing content. Extracted both into new shared references
  (`skill-authoring-standard.md`, `evidence-standard.md`) that the affected skills now reference
  instead of re-deriving. Closed the one real flow gap the audit found — no stage before
  `sdd-create-specs` for an idea that isn't spec-ready yet — with `sdd-brainstorm`, and added
  `sdd-explain-me` for on-demand, never-required plain-language explanations of an already
  specified feature; both only ever hand off to existing skills rather than duplicating their
  output. 13 skills total, up from 11 — the result of closing two real gaps, not a "more skills"
  goal. Also normalized frontmatter key order across all 13 skills once the audit found the
  inconsistency was wider than assumed (7 of 11, not only `sdd-create-pr`), and added a
  dependency-independence analysis step to `sdd-implement-multi` before any parallelization
  recommendation. One new golden flow (`idea-to-spec`), bringing the total to 5.
- **v1.4 (2026-08-09):** CLI UX & Guided Onboarding. Colored, TTY-aware status output;
  "did you mean" suggestions on unknown commands/packs/agents and a clearer `uninstall`
  neither-flag message; a new public `--quiet` flag on `init`/`install`/`uninstall`/`discover`;
  partial core-skill install detection in `doctor` and the bare-invocation screen; `doctor` fix
  hints; a new opt-in `doctor --check-updates` (the sole, explicit exception to "no network
  access by default"); a numbered interactive menu on bare invocation, offered only when the
  process is genuinely interactive (real TTY on both streams, no `CI` env var) and never
  affecting piped/scripted/CI/agent invocations; and two exit-code bug fixes. Stays
  zero-runtime-dependency throughout — every addition is hand-rolled, informed by patterns
  studied in `anomalyco/opencode` and `vercel-labs/skills`.
- **v1.3 (2026-08-08):** Uninstall completeness and post-command guidance. Added
  `uninstall --apply --full` for a genuine clean-reinstall reset — it removes
  `.sdd/context/project-context.md`, `.sdd/snapshots`, and `.sdd/reports` on top of what
  `--include-config` already covered, while `.specs/features` stays permanently protected, same
  as source code, under every flag combination. `init` and `install` now print a short
  "Suggested next step" line on success (pointing at `install core`, then `doctor` and
  `sdd-route`), suppressed during `doctor --smoke`'s internal calls so its own output stays
  clean. Also fixed a `docs/upgrading.md` line that overstated `.sdd/config.yml` as never
  touched by `uninstall`, when `--include-config`/`--full` always removed it on request. All
  changes are additive under the v1.0 stability commitment — no documented command or flag was
  removed or had its default meaning changed.
- **v1.2 (2026-08-08):** CLI UX audit and upgrade. Fixed a real bug where `doctor` (and
  `doctor --contracts`, and the language-profile check) reported false `WARN`s after the
  documented Quick Start flow (`init` → `install core`, default `--scope user`), because those
  checks were hardcoded to project scope and never looked at the resolved user-scope install
  location. Added `--br`/`--en` as shorthand aliases for `init --language pt-BR`/`en-US`; real
  per-command help (`help <command>` / `<command> --help`, previously only `init --help`
  existed and the other five commands `FAIL`ed on `--help`); and a contextual, read-only status
  screen for bare `npx sdd-agentic-flow` (no command) instead of silently aliasing to the full
  `help` reference. All changes are additive under the v1.0 stability commitment — no
  documented command or flag was removed or had its default meaning changed.
- **v1.1 (2026-08-08):** dropped Node.js 18/20 as supported versions — CI-required minimum is
  now Node 22 (Maintenance LTS), with 24 (Active LTS) and 26 (Current) also required; a
  compatibility-reducing change under the v1.0 stability commitment, so it ships as a minor
  release with a matching `CHANGELOG.md` entry rather than silently. Also fixed four
  independent CI bugs (macOS `bash` 3.2 vs `mapfile`, Windows CRLF vs Biome, Windows `.cmd`
  spawn without a shell, Puppeteer sandbox on `ubuntu-latest`) and switched CI from
  `npm install` to `npm ci` for reproducible installs.
- **v1.0 (2026-08-08):** public go-live — first public stability commitment. The CLI's
  documented argument surface and the environment support matrix now follow the same
  minor/major-only change rule already established for skill capability contracts (see the
  "v1.0 stability commitment" section in [compatibility promise](docs/compatibility-promise.md)).
  No new product features; this release audits and freezes what v0.6–v0.9 already built.
- **v1.x (open):** future work adopted from validated need, not assumed in advance — candidates
  include adapters beyond `local-files`/`github` (Jira, Linear, Azure DevOps, Notion, Slack) and
  maturity-model documentation. Nothing in this line is committed or scheduled.

## Strategic direction (v2.0) — candidate, not a commitment

v1.9.0 (`sdd-release`, handoff standard, `Status:` field, audited-and-closed progressive
disclosure/golden-fixture gaps) shipped above, closing the "how do we know it's working
correctly?" question the earlier v1.9 candidate posed. What follows is the remaining
candidate, validated against the current architecture, not a committed schedule — it only
becomes a real dated entry once it actually ships, following the same audit-first discipline
every release above already used (a real gap found by reading the code, not an assumed one).
No week or date estimate is given on purpose. Full implementation-level detail lives outside
this file, in a dedicated `v{X.Y.Z}-implementation-plan.md` under
`.local/gmm/sdd-agentic-flow/` — the same convention already used for v0.7.0 through v1.9.0.

| Version | Question it answers | Answer |
| --- | --- | --- |
| v2.0 | How does this become a portable methodology? | Evidence graph + portable `.sdd/` context + cross-agent parity |

A formal no-progress/repeated-failure signal for `.sdd/autonomy/loop-state.md` (an
`Attempt:`/`Progress:` field per `## Current State` block, self-evaluated by the invoking agent
the same way guardrails 1–6 already are) was raised and evaluated during v1.9.0's planning and
explicitly deferred, not folded into v2.0's deliverables below by default — it becomes real
scope only if a genuine stuck-loop incident is observed in practice, evaluated fresh against
whatever the evidence graph below actually needs at that time.

### v2.0 — Agentic SDD Platform (candidate)

**Goal & business value:** a user can swap AI agents without relearning the methodology — that is
v2.0's real acceptance test, not a feature checklist.

**Deliverables:** a documented canonical workflow
(`IDEA → EXPLORE → DEFINE → SPECIFY → PLAN → IMPLEMENT → VERIFY → REVIEW → RELEASE → HANDOFF`)
with an adaptive variant sized to the change, without becoming a workflow engine. An evidence
graph linking requirement → spec → task → code → test → validation → PR, exposed via
`doctor --evidence-graph` — not a new, parallel `validate` command, since `doctor` already owns
`--json`/`--contracts`/`--smoke`/`--check-updates`. `.sdd/` as portable cross-agent context,
evolving what already exists (`config.yml`, `context/`, `reports/`, `snapshots/`, plus v1.8's
`autonomy/loop-state.md`) rather than a parallel structure — the exact shape of any new
execution-state file is an audit decision at implementation time, not decided here. Cross-agent
portability documented as an extension of the adapter pattern already in place
(`local-files`/`github`, `docs/adapters.md`) — adapters stay at the edge, carrying no
methodological logic of their own. Closing whatever a "CLI 2.0" audit would still ask for on top
of what already exists today (`doctor --json`, `--quiet`, `install --plan` /
`uninstall --plan|--apply`, CI-safe detection, `doctor --check-updates`) — the real work here is
closing v1.8/v1.9-specific gaps, not building CLI ergonomics from zero.

**Prerequisites/dependencies:** v1.8's `autonomy_profile`/`loop-state.md`; v1.9.0's
`handoff-standard.md` and `Status:`-field evidence model; the existing adapter pattern
(`docs/adapters.md`).

**Acceptance criteria:** a full workflow demonstrably runs end to end while swapping the agent
mid-way without reconfiguring the method; `doctor` covers the evidence graph and compatibility
checks without needing a second command; nothing breaks the v1.0 stability commitment.

**Risks & mitigation:** the evidence graph could grow into an observability platform, which
contradicts the toolkit's identity → mitigated by keeping it a file-based artifact, no new
service or database, same rule as the non-goals below.

**Out of scope (holds for the whole v1.8 → v2.0 line):** an agent runtime/scheduler, a hosted MCP
platform, a model-provider abstraction/router, a heavy workflow-DAG engine, a proprietary skill
format, a skill marketplace ahead of validated need, mandatory telemetry. Matches
`docs/design-principles.md`: concrete claims over broad compatibility, security, or autonomy
promises.

- **v0.1:** local-first core and full public skill pack.
- **v0.2:** Adoption & Trust Release: interactive setup, local validation, rollback, agent docs, and public examples.
- **v0.3:** Language Profiles & Brazilian Workflow Release.
- **v0.4:** TDD Implementation Baseline.
- **v0.5:** Workflow Navigation & Task Quality.
- **v0.6:** Foundation Architecture Release — capability contracts, a baseline registry,
  project discovery and context, feature profiles, and a baseline compliance gate.
- **v0.7:** Operational Excellence (start) — capability contracts v2 (`depends_on`/`conflicts`
  plus consumer-side `doctor --contracts`), light artifact contracts, Project Discovery 2.0
  (architecture/CI/platform signals), an agent-neutrality regression guard and action
  vocabulary, the first decision guides and a compatibility matrix, and the
  `sdd-reverse-engineer` skill.
- **v0.8:** Flow Consolidation & Dynamic Project Context Release — resolved
  `sdd-reverse-engineer`'s place in the Flow by merging it into `sdd-create-specs` as an
  existing-code mode, restoring a single entry point for the Specification step (12 skills →
  11). Also formalized Dynamic Project Context:
  `project-context.md` now carries provenance (generated-at, repository revision, branch), with
  new `context status`/`context refresh` commands to inspect and regenerate it explicitly,
  additive to the unchanged `discover [--force]`. Deliberately no Context Indexing, Context
  Query, knowledge graph, RAG, or vector database — those remain out of scope for the core
  product, to protect the toolkit's focused SDD-flow identity.
- **v0.9:** Installation, Portability & Public Readiness Release — `install` defaults to a
  zero-project-footprint `--scope user`, with an Agent Integration Layer for 4 officially
  supported agents (Codex CLI, Cursor, Claude Code, VS Code + GitHub Copilot); a cross-platform
  CI matrix (Node 18–24 on Linux, full pipeline on macOS/Windows) and a centralized platform
  layer in the CLI; a vendored `requires_cli` version-compatibility gate; the skill catalog
  (`docs/skills-catalog.md`); 5 golden flows proved as integration tests; and
  `docs/upgrading.md`/`docs/troubleshooting.md`/`docs/environment-compatibility.md` closing the
  documentation gaps the beta had accumulated. See `CHANGELOG.md` for the full list. Skill
  cards ✅ delivered (`docs/skills-catalog.md`).

With v1.0.0, the project leaves beta: the CLI argument surface and environment support matrix
now carry the stability commitment described at the top of this file. Future v1.x scope
remains open and will be defined from validated needs rather than assumed in advance.
