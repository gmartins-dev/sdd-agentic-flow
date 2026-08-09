# Changelog

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
