# Roadmap

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

## Strategic direction (v1.8 → v2.0) — candidates, not commitments

The three candidates below follow the same rule as `v1.x (open)` above: validated against the
current architecture, not a committed schedule. Each only becomes a real dated entry once it
actually ships, following the same audit-first discipline v1.5 and v1.6 already used (a real gap
found by reading the code, not an assumed one). No week or date estimates are given on purpose —
every release above shipped once validated, not on a pre-set calendar, and a multi-month schedule
would misrepresent how this project actually moves. Full implementation-level detail for
whichever candidate is picked up next lives outside this file, in a dedicated
`v{X.Y.Z}-implementation-plan.md` under `.local/gmm/sdd-agentic-flow/` — the same convention
already used for v0.7.0 through v1.6.0.

| Version | Question it answers | Answer |
| --- | --- | --- |
| v1.8 | How does the agent work better, with more autonomy? | `autonomy_level` + deterministic guardrails + ecosystem awareness |
| v1.9 | How do we know it's working correctly? | Deeper skill contracts + verification + handoff |
| v2.0 | How does this become a portable methodology? | Evidence graph + portable `.sdd/` context + cross-agent parity |

### v1.8 — Autonomy & Ecosystem (candidate)

**Goal & business value:** let the agent advance between skills without constant supervision,
without trading "autonomy" for "magic" — every automatic advance stays auditable and reversible.

**Deliverables:** `autonomy_level` (`manual`/`supervised`/`autonomous`) as a **new axis
orthogonal to**, not a replacement for, the 5 existing `execution_modes`
(`plan`/`guided`/`apply`/`review`/`full`, `docs/execution-modes.md`). 7 deterministic guardrails
(completion status, evidence validation, verification gates, scope boundary, transition validity,
resource sufficiency, human override) checked before any automatic transition. An `autonomy_profile`
frontmatter extension across the 13 skills, validated by `scripts/check-skills.sh` the same way
`extends`/`requires`/`consumes`/`produces`/`depends_on`/`conflicts` already are. New
`.sdd/config.yml` fields plus `doctor --autonomy`, `context autonomy-state`, `autonomous-resume`;
a `.sdd/autonomy/loop-state.md` execution-state file. MCP stays **awareness, not a platform**:
skills may optionally detect and use an available MCP integration (e.g. GitHub) the same way they
already treat the `local-files`/`github` adapters — no CLI hosting an MCP server — plus secret
safety (never persist a secret into generated config). Agent Skills Standard: an alignment audit
across the 13 skills documenting where the format already converges (most of it), without
forcing compliance or a certification claim — same posture as v1.5.1.

**Prerequisites/dependencies:** the existing skill-contract system; `bin/contract-graph.js`; the
5 `execution_modes` already documented; the v1.0 stability commitment (any new config/CLI field
must be additive).

**Acceptance criteria:** `npm run check` passes; all 13 skills carry a valid `autonomy_profile`;
no invalid `execution_mode`×`autonomy_level` combination goes unflagged; nothing documented today
changes behavior.

**Risks & mitigation:** CLI surface growing without a validated need → mitigated by extending
`doctor` instead of adding new commands wherever possible; "autonomy" becoming an excuse to skip
evidence → guardrails are blocking by design, not suggestions.

**Out of scope for this version:** progressive-disclosure refactor of the skills, formal Agent
Skills Standard compliance enforcement, an MCP-aware skill redesign, multi-agent orchestration —
all move to v1.9/v2.0 only if validated.

### v1.9 — Method & Reliability (candidate)

**Goal & business value:** deepen what already exists instead of duplicating it — if there's a
real gap, it's in already-shipped skills needing to be clearer and more verifiable, not in
inventing new systems.

**Deliverables:** progressive disclosure across the 13 skills (Agent Skills Standard-aligned):
each `SKILL.md` under ~500 lines, detailed material moved into `references/`/`scripts/`/`assets/`,
validated by an extension of `scripts/check-skills.sh`. `sdd-brainstorm` gains an explicit
known/assumed/unknown/needs-research split before handing off to `sdd-create-specs` (implicit
today). Git guardrails and parallel-agent guidance formalized (when branch/commit/worktree are
allowed; when parallelizing is appropriate). A `handoff.md` standard for cross-session/cross-agent
continuity, integrated with v1.8's `.sdd/autonomy/loop-state.md`. A new skill, `sdd-release`, to
make version/changelog/publish auditable — today that discipline lives only in
`scripts/release-checklist.sh` and the maintainer's own process. A first Token Economics
benchmark: measure tokens/iterations/rework with vs. without the method on the same model — not a
promise of model-to-model equivalence.

**Prerequisites/dependencies:** v1.8's `autonomy_profile` and `loop-state.md`;
`scripts/check-skills.sh` as the validation base.

**Acceptance criteria:** all 13 skills pass a `check-skills.sh --progressive-disclosure` check (or
equivalent); no skill's main body references more than it needs to; `sdd-release` covers
everything `release-checklist.sh` already does today, with no regression.

**Risks & mitigation:** refactoring all 13 skills at once is a large regression surface →
validate against the existing 5 golden flows before/after migrating each skill individually, not
in one batch.

**Correction vs. the draft:** `sdd-explain-me` **already exists**, shipped in v1.5 — it is not a
new v1.9 item. It only re-enters scope here if the progressive-disclosure audit finds a real,
validated gap in it.

**Out of scope:** a multi-agent orchestration engine, a skill dependency resolver, a skill
marketplace, a bespoke agent framework.

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

**Prerequisites/dependencies:** v1.8's `autonomy_profile`/`loop-state.md`; v1.9's deepened skill
contracts and progressive disclosure; the existing adapter pattern (`docs/adapters.md`).

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
