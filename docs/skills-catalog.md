# Skills catalog

A product-level view of the 14 public skills, one section each, ordered like the
[main SDD flow](../README.md#main-sdd-flow) rather than alphabetically. Each entry restates
its skill's capability contract (`extends`/`requires`/`consumes`/`produces`/`baseline`/
`compatible_with`/`depends_on`/`conflicts`/`requires_cli`) in prose. See
[architecture](architecture.md#capability-contracts) for the full contract table and
[compatibility matrix](compatibility-matrix.md) for exactly which pack installs which skill.
`scripts/check-skills.sh` mechanically checks that every skill below has an entry, so this
catalog cannot silently drop one.

## `setup-sdd-agentic-flow`

**Purpose:** Initialize the public SDD Agentic Flow structure in a repository.

**When to use:** Use for a repository that needs the SDD Agentic Flow initialized or repaired.

**When not to use:** Do not use to implement a feature, generate a specification for an already
configured flow, change global defaults, install tools, or access external services.

**Inputs:** Repository root and requested scope; existing `.sdd-agentic-flow/config.yml` if present;
optional project name, artifact location, and workflow preferences; an optional domain
glossary request with explicit authorization. Required input kind: `config`.

**Outputs:** `project-config`, `project-context`.

**Dependencies:** `extends: null` (chain entry point); `depends_on: []`.

**Conflicts:** none.

**Baseline:** `tlc-spec-driven`.

**Pack(s):** `core`, `planning`, `full`, `local-files`, `github`.

**Typical flow position:** first — before `sdd-route`.

## `sdd-route`

**Purpose:** Recommend the next local SDD skill without changing files.

**When to use:** Use before a workflow step when the requested phase, prerequisites, or
installed pack are unclear.

**When not to use:** Do not use to implement, review, create a PR, change files, or replace the
candidate skill's instructions.

**Inputs:** The requested outcome and available local SDD artifacts; `.sdd-agentic-flow/config.yml` when
present; installed skill directories and relevant candidate `SKILL.md` files. Required input
kind: `config`.

**Outputs:** `route-recommendation`.

**Dependencies:** `extends: null`; `depends_on: []`. Read-only — it never invokes another skill
automatically.

**Conflicts:** none.

**Baseline:** none (`baseline: []`) — routing is navigation, not methodology work.

**Pack(s):** `core`, `planning`, `execution`, `pr`, `multi-worktree`, `full`, `local-files`,
`github`.

**Typical flow position:** between any two steps — recommends the next skill whenever the
phase is unclear; not itself a step in the linear chain.

## `sdd-brainstorm`

**Purpose:** Explore a vague idea into a converged, spec-ready problem statement, or shape a
solution once the problem is already clear.

**When to use:** Use when a user has an idea that is not yet ready for `sdd-create-specs` —
either the problem itself is still vague, or the problem is clear but the solution approach is
not decided.

**When not to use:** Do not use to write `spec.md`, `design.md`, or `tasks.md` directly — always
delegated to `sdd-create-specs`. Do not use once the problem and approach are already decided,
for a single ready task, or for explaining an already-specified feature (`sdd-explain-me`).

**Inputs:** The user's idea in whatever shape it currently exists; `.sdd-agentic-flow/config.yml`,
`project-context.md`, and `domain-glossary.md` when present; relevant existing code or docs the
idea touches. Required input kind: `config`.

**Outputs:** `spec-ready-brief` (`.specs/features/<feature>/brief.md`, written only once the
idea converges).

**Dependencies:** `extends: null` (chain entry point, alongside `sdd-create-specs`, `sdd-route`,
`setup-sdd-agentic-flow`); `depends_on: []`.

**Conflicts:** none.

**Baseline:** none (`baseline: []`) — brainstorming is exploration, not methodology work; the
resulting brief is handed to `sdd-create-specs`, which does apply the TLC baseline.

**Pack(s):** `planning`, `full`.

**Typical flow position:** before `sdd-create-specs` — the stage for an idea too vague or
undecided for a specification package to start from.

## `sdd-create-specs`

**Purpose:** Create or update a repository-local, evidence-based SDD specification package,
either from a requested outcome (**source-item mode**) or from existing, undocumented code
(**existing-code mode**).

**When to use:** Use when a feature, change, bug fix, or technical initiative needs an
implementation-ready SDD specification package — whether it starts from a requested outcome or
from code that already exists in the repository with no prior spec and no requested outcome to
start from.

**When not to use:** Do not use for direct implementation, a casual explanation, or an unscoped
brainstorming request. Do not proceed without repository-local configuration; use
`setup-sdd-agentic-flow` first.

**Inputs:** Source-item mode: the requested outcome and known constraints. Existing-code mode:
an explicit, user-named scope — never a whole-repository scope. `.sdd-agentic-flow/config.yml`; relevant
repository evidence (code, tests, existing decisions, prior SDD artifacts). Required input
kinds: `config`, `source-item`.

**Outputs:** `spec-package` (`context.md`, `spec.md`, `design.md`, and `tasks.md` in
source-item mode; `context.md`, `spec.md`, `design.md` — optionally `tasks.md` — labeled
Observed/Inferred/Unknown in existing-code mode).

**Dependencies:** `extends: null`; `depends_on: []`.

**Conflicts:** none.

**Baseline:** `tlc-spec-driven`.

**Pack(s):** `core`, `planning`, `full`, `local-files`, `github`.

**Typical flow position:** between `sdd-route` and `sdd-create-prompts`.

## `sdd-create-prompts`

**Purpose:** Generate self-contained, paste-ready implementation prompts from a validated
repository-local SDD specification package.

**When to use:** Use after an SDD specification package is ready and the user needs bounded
implementation prompts for one or more tasks.

**When not to use:** Do not use to create a specification from scratch, execute
implementation, make repository changes outside prompt artifacts, or guess missing
requirements. Use `sdd-create-specs` first when the specification is incomplete.

**Inputs:** `.sdd-agentic-flow/config.yml`; a validated specification package and its acceptance criteria;
optional task ordering, ownership boundaries, and target agent constraints. Required input
kinds: `config`, `spec-package`.

**Outputs:** `task-prompts`.

**Dependencies:** `extends: sdd-create-specs`; `depends_on: []`.

**Conflicts:** none.

**Baseline:** `tlc-spec-driven`, `tdd`.

**Pack(s):** `planning`, `full`.

**Typical flow position:** between `sdd-create-specs` and `sdd-implement-task`.

## `sdd-explain-me`

**Purpose:** Explain an already-specified or already-implemented SDD feature in plain language,
for a reader with no prior context.

**When to use:** Use on demand, when the feature's author or someone joining without prior
context wants to understand what a feature does and why, without reading every technical
artifact.

**When not to use:** Do not use to author or replace `spec.md`, `design.md`, or `tasks.md` — it
only explains an existing package. Do not use before a spec package exists (`sdd-create-specs`
first) or for an idea still being shaped (`sdd-brainstorm` first).

**Inputs:** One feature identifier with an existing spec package; `.sdd-agentic-flow/config.yml`, the
feature's `context.md`/`spec.md`/`design.md`/`tasks.md`, and accumulated implementation;
`project-context.md`/`domain-glossary.md` when present. Required input kinds: `config`,
`spec-package`.

**Outputs:** `explanation` (`.specs/features/<feature>/explanation.md`).

**Dependencies:** `extends: sdd-create-specs`; `depends_on: []`. Read-only against the spec
package.

**Conflicts:** none.

**Baseline:** none (`baseline: []`) — pedagogical, not methodology work.

**Pack(s):** `planning`, `full`.

**Typical flow position:** optional branch from `sdd-create-specs`, never a required step; used
on demand at any point once a spec package exists.

## `sdd-implement-task`

**Purpose:** Implement exactly one validated SDD task as the smallest tested, merge-ready
increment. Required evidence is adequate behavioral sensors at the contractual seam plus
recorded current results; the RED → GREEN ritual is optional and is not harness proof.

**When to use:** Use for one unambiguous task that is ready to implement or resume.

**When not to use:** Do not use for specification authoring, several tasks, feature-wide
validation, PR review, or a task whose identity, scope, or dependencies are ambiguous.

**Inputs:** A single canonical task reference or explicit feature/task identifiers; repository
SDD artifacts, relevant code, and `.sdd-agentic-flow/config.yml`; optional task prompt or prior handoff, as
supporting evidence only. Required input kinds: `config`, `task-identity`.

**Outputs:** `code-change+tdd-evidence`.

**Dependencies:** `extends: sdd-create-prompts`; `depends_on: []`.

**Conflicts:** none.

**Baseline:** `tlc-spec-driven`, `tdd`.

**Pack(s):** `core`, `execution`, `full`, `local-files`, `github`.

**Typical flow position:** between `sdd-create-prompts` and `sdd-task-check`. For multiple
dependency-aware tasks, use `sdd-implement-multi` instead to plan the execution order first.

## `sdd-implement-multi`

**Purpose:** Plan or coordinate implementation of multiple dependency-aware SDD tasks.

**When to use:** Use only when the user explicitly requests multi-task or feature
orchestration — a feature has multiple explicitly selected tasks and needs a dependency-aware
execution plan.

**When not to use:** Do not use for one task (use `sdd-implement-task`), vague feature
requests, specification creation, PR work, or when dependencies and task identities cannot be
resolved.

**Inputs:** One feature identifier and optional explicit task subset; `.sdd-agentic-flow/config.yml`,
feature SDD artifacts, and repository state; user-approved concurrency/worktree constraints
when implementation orchestration is requested. Required input kinds: `config`,
`spec-package`.

**Outputs:** `execution-plan`.

**Dependencies:** `extends: sdd-create-prompts`; `depends_on: []`. Delegates to
`sdd-implement-task` for each task's actual implementation.

**Conflicts:** none.

**Baseline:** `tlc-spec-driven`, `tdd`.

**Pack(s):** `execution`, `multi-worktree`, `full`.

**Typical flow position:** alternative to `sdd-implement-task`, between `sdd-create-prompts`
and `sdd-task-check`, when tasks have cross-dependencies.

## `sdd-task-check`

**Purpose:** Independently check one implemented SDD task against its acceptance criteria and
configured gates before handoff. Ground the oracle in spec / repo contracts / configured
gates. Treat PASS as evidence, not a verdict. Missing RED is not an automatic fail.

**When to use:** Use after implementing one task and before commit or PR handoff.

**When not to use:** Do not use to implement fixes, review an entire feature, approve a PR, or
infer an ambiguous task identity.

**Inputs:** One canonical task reference; `.sdd-agentic-flow/config.yml`, the task's SDD artifacts, current
diff, and configured validation commands. Required input kinds: `config`, `task-evidence`.

**Outputs:** `check-report`.

**Dependencies:** `extends: sdd-implement-task`; `depends_on: []`. Read-only except for
disposable test artifacts permitted by configuration.

**Conflicts:** none.

**Baseline:** `tlc-spec-driven`, `tdd`.

**Pack(s):** `core`, `execution`, `full`, `local-files`, `github`.

**Typical flow position:** between `sdd-implement-task` and `sdd-create-pr`.

## `sdd-create-pr`

**Purpose:** Prepare a task-scoped pull-request package from validated SDD evidence.

**When to use:** Use after a single task passes its checks and the user explicitly requests PR
preparation or creation.

**When not to use:** Do not use before task validation, for feature-wide PRs without explicit
scope, to fix code, or to publish a PR by default.

**Inputs:** One validated task reference, branch/head context, and task-check evidence;
`.sdd-agentic-flow/config.yml`, SDD artifacts, current diff, and repository PR conventions; explicit
confirmation when an external PR mutation is requested. Required input kinds: `config`,
`task-evidence`.

**Outputs:** `pr-package`.

**Dependencies:** `extends: sdd-task-check`; `depends_on: []`.

**Conflicts:** none.

**Baseline:** `tlc-spec-driven`.

**Pack(s):** `pr`, `full`, `github`.

**Typical flow position:** between `sdd-task-check` and `sdd-pr-review`.

## `sdd-pr-review`

**Purpose:** Review one task-scoped pull request against its SDD, diff, and configured checks.

**When to use:** Use when the user asks to review a PR associated with one SDD task.

**When not to use:** Do not use to implement fixes, validate a whole feature, create a PR, or
review a PR whose task scope cannot be resolved.

**Inputs:** PR URL/number or local branch plus one task reference; `.sdd-agentic-flow/config.yml`, task SDD
artifacts, diff, and available check evidence. Required input kinds: `config`, `pr-reference`.

**Outputs:** `review-findings`.

**Dependencies:** `extends: sdd-create-pr`; `depends_on: []`. Read-only.

**Conflicts:** none.

**Baseline:** `tlc-spec-driven`.

**Pack(s):** `pr`, `full`, `github`.

**Typical flow position:** after `sdd-create-pr`; loops with `sdd-pr-fix` (review → fix →
review) until findings are accepted, then proceeds to `sdd-validation`.

## `sdd-pr-fix`

**Purpose:** Apply the smallest task-scoped fixes for verified SDD pull-request findings.

**When to use:** Use only when the user explicitly asks to repair actionable, verified
findings on one task-scoped PR.

**When not to use:** Do not use for unverified comments, broad cleanup, feature redesign,
sibling tasks, or automatic commits and pushes.

**Inputs:** One task reference and a review report, PR findings, or user-supplied evidence;
`.sdd-agentic-flow/config.yml`, SDD artifacts, current diff, and configured validation commands. Required
input kinds: `config`, `pr-reference`, `review-findings`.

**Outputs:** `fix-evidence`.

**Dependencies:** `extends: sdd-pr-review`; `depends_on: []`. Hands off to `sdd-pr-review` for
focused re-review.

**Conflicts:** none.

**Baseline:** `tlc-spec-driven`.

**Pack(s):** `pr`, `full`, `github`.

**Typical flow position:** between `sdd-pr-review` and its own re-review loop back into
`sdd-pr-review`.

## `sdd-validation`

**Purpose:** Independently validate an accumulated SDD feature implementation against its
specification and configured gates. Re-read spec and repo contracts; reject stale results
as current proof; record explicit evidence gaps.

**When to use:** Use when the user asks whether one implemented feature is ready against its
SDD, after task work is accumulated.

**When not to use:** Do not use to implement code, repair findings, validate only one task,
create a PR, or infer a feature identity from ambiguous branch names.

**Inputs:** One feature identifier; `.sdd-agentic-flow/config.yml`, feature context/spec/design/tasks
artifacts, accumulated implementation, and configured gates. Required input kinds: `config`,
`spec-package`, `task-evidence`.

**Outputs:** `validation-report`.

**Dependencies:** `extends: sdd-task-check`; `depends_on: []`. Read-only except for a
permitted local report or disposable test artifacts.

**Conflicts:** none.

**Baseline:** `tlc-spec-driven`, `tdd`.

**Pack(s):** `core`, `full`, `local-files`, `github`.

**Typical flow position:** after `sdd-pr-review` confirms the PR is ready.

## `sdd-release`

**Purpose:** Check whether a project or feature is ready to tag and publish a release —
version consistency, changelog presence, and configured release checks.

**When to use:** Use when the user asks whether the project (or one feature) is ready to tag
and publish a release.

**When not to use:** Do not use to implement code, write a changelog entry from scratch, create
a git tag, or run a publish command — this skill only checks readiness and reports gaps.

**Inputs:** `.sdd-agentic-flow/config.yml`, including any declared release conventions; the repository's
current version marker and changelog file; accumulated `check-report`/`validation-report`
evidence for the work being released. Required input kind: `config`.

**Outputs:** `release-readiness-report`.

**Dependencies:** `extends: null` (chain entry point, invoked on demand); `depends_on: []`.
Read-only.

**Conflicts:** none.

**Baseline:** none (`baseline: []`) — release readiness is process work, not methodology work.

**Pack(s):** `core`, `full`, `local-files`, `github`.

**Typical flow position:** last — after `sdd-validation` and, when a PR was used,
`sdd-pr-review` confirm the work is ready; never tags or publishes itself.
