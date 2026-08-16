# Architecture

`sdd-agentic-flow` is a local-first, zero-runtime-dependency toolkit that gives coding agents a
Spec-Driven Development foundation: capability-contracted skills built on condensed TLC and TDD
baselines, adaptive feature-profile sizing, and optional auto-discovered project context.
The sections below show how those pieces fit together.

## Layers

```text
CLI (dist/sdd-agentic-flow.js, built from src/)
  |  list, init, discover, context, install, doctor, uninstall
  v
Pack registry (presets/*.json)
  |  installable groupings of skills + shared layer + optional adapter doc
  v
Skills (skills/*/SKILL.md)
  |  capability-contracted: extends, requires, consumes, produces, baseline, compatible_with
  v
Shared layer (shared/)
  |  references/ (TLC baseline, TDD baseline, feature profiles, safety, routing, ...)
  |  baselines/registry.yml (canonical baseline versions)
  |  templates/, language-profiles/
  v
Consumer project (installed via `install <pack>` into a target repository)
  .sdd-agentic-flow/config.yml                     user-declared policy (specs root, workflow, quality, safety)
  .sdd-agentic-flow/context/project-context.md     auto-discovered facts (read-only, from discover/init)
  .sdd-agentic-flow/context/domain-glossary.md     optional, human-authored product vocabulary
  .specs/features/**                  working SDD artifacts (context/spec/design/tasks)
  .agents/skills/**                   installed skill copies + sdd-agentic-flow-shared
```

Each layer only depends on the layer below it. Skills never call the CLI. The CLI never
authors SDD artifacts; it only creates configuration, discovers context, and copies files.

## Maintainer source layout

Maintainer code lives under `src/` (strict TypeScript) and compiles to `dist/` for the
published npm bin (`dist/sdd-agentic-flow.js`). Modules are flat — grouped by responsibility,
not by framework layer.

| Module | Responsibility |
| --- | --- |
| `sdd-agentic-flow.ts` | Bootstrap, top-level routing (`runCommand`), process entry |
| `paths.ts` | Canonical toolkit/package/project path vocabulary; `detectShellInfo()` |
| `cli-help.ts` | `USAGE`, `COMMAND_HELP`, per-command help rendering |
| `setup.ts` | `init` and guided setup orchestration |
| `project-context.ts` | `discover`, `context status`/`refresh`, autonomy state |
| `install.ts` | `install` command orchestration and application |
| `doctor.ts` | `doctorChecks()`, contracts/smoke/autonomy sensors, `doctor`, `--evidence-graph` orchestration |
| `evidence-graph.ts` | Read-only v4 requirement traceability collector/model (no I/O) |
| `uninstall.ts` | Uninstall plan/apply and v4 `--purge` clean reset |
| `config.ts`, `config-domain.ts`, `configure.ts` | Config read/validate/mutate and `config`/`configure` commands |
| `install-domain.ts`, `install-preflight.ts` | Pack resolution, preflight checks for install |
| `contract-graph.ts` | Skill contract graph validation helpers |
| `doctor-view.ts` | Human-readable doctor output formatting |
| `onboarding.ts`, `menu.ts`, `selector.ts` | Interactive onboarding and menu flows |
| `messages.ts` | Locale strings and message catalog |
| `skill-identity.ts` | Official skill name registry |
| `ui.ts` | Output modes, logging, `didYouMean()` |
| `brand-art.ts` | Welcome chevron art (human-rich / human-plain) |
| `update-check.ts`, `upgrade.ts` | Registry update check and `upgrade` command |
| `version-compat.ts` | Vendored semver-range comparator for `requires_cli` |

Use [CONTRIBUTING.md](../CONTRIBUTING.md#where-new-cli-code-belongs) when adding or moving CLI
logic — extend the module that already owns the command or concern rather than growing the
entrypoint.

Use [canonical vocabulary](../shared/references/canonical-vocabulary.md) for harness terms.
It distinguishes the public Skill contract from host runtime mechanics such as Tools, Hooks,
Agents, and Workers.

## Capability contracts

Every skill's frontmatter declares:

- `extends` — the immediate upstream skill in the SDD workflow chain, or `null` for a chain
  entry point.
- `requires` — inputs it needs before it can act (for example `config`, `task-identity`).
- `consumes` — optional context artifacts it reads when present (for example
  `domain-glossary`, `project-context`).
- `produces` — the artifact kind it hands off (for example `spec-package`, `check-report`).
- `baseline` — which canonical baseline(s) govern its work (`tlc-spec-driven`, `tdd`, or
  both).
- `compatible_with` — which packs install it; mechanically cross-checked against
  `presets/*.json` by `scripts/check-skills.sh` so this field cannot silently drift.
- `depends_on` — optional, non-linear complements to `extends` (which is strictly a single
  upstream chain link). Empty by default; a skill declares one here only when it needs another
  skill's output alongside its `extends` parent.
- `conflicts` — optional list of skills that should not be installed together in the same pack.
  Empty by default.
- `requires_cli` — optional (Milestone 3, v0.9.0): the minimum `sdd-agentic-flow` CLI version
  this skill needs, as a range (`x.y.z`, `>=x.y.z`, or `^x.y.z`). `null` by default, meaning no
  constraint. Validated by `doctor --contracts` using `src/version-compat.ts` (compiled to
  `dist/version-compat.js`). See
  [compatibility promise](compatibility-promise.md#requires_cli).

### Field semantics at a glance

| Field | Answers | Not to be confused with |
| --- | --- | --- |
| `extends` | "What is the one upstream skill this continues from?" | `depends_on`. `extends` is a single required chain link, not an optional extra input. |
| `depends_on` | "What other skill's *output* does this skill also need, beyond its `extends` parent?" | `requires`. `depends_on` names other **skills**; `requires` names **input kinds** (`config`, `task-identity`), never a skill. |
| `conflicts` | "Which skills must never be installed alongside this one?" | `depends_on`. `conflicts` names an incompatibility, not a needed output. |
| `requires` | "What input kinds must exist before this skill can act?" | `consumes`. A missing `requires` input blocks the skill; a missing `consumes` artifact does not. |
| `consumes` | "What optional context artifacts does this skill read when present?" | `requires`. `consumes` is best-effort context, never a precondition. |
| `produces` | "What artifact kind does this skill hand off when it finishes?" | `compatible_with`. `produces` is workflow output; `compatible_with` is pack membership. |
| `requires_cli` | "What is the minimum CLI version this skill needs?" | `baseline`. `requires_cli` gates on the CLI's own version, not a methodology baseline. |

`doctor --contracts` validates that every skill installed in a **consumer** repository
(`.agents/skills/*/SKILL.md`) still carries all 6 required fields and reports on the 3 optional
ones (`depends_on`, `conflicts`, `requires_cli`). It returns `FAIL` if a required field is
missing (signals a corrupted or hand-edited installed skill), `WARN` if an optional field is
absent, and a separate deterministic `FAIL` if a declared `requires_cli` range is not satisfied
by the installed CLI's version. This complements
`scripts/check-skills.sh`, which validates the same fields **at the source** (this repository)
before anything is packed or installed.

`doctor --contracts` also validates that `depends_on`/`conflicts` reference real skill names
(and, for `conflicts`, that referenced skills are not actually co-installed), that `baseline`
entries exist in `shared/baselines/registry.yml`, and that `depends_on`/`extends` form no cycle.
Any of these failures surface as a `FAIL` inside this same check rather than a new status value.
It does not re-verify `compatible_with` against pack membership: a consumer repository has no
local `presets/` directory to check against (`install` only copies `shared/`, never `presets/`).
That exact-match check only runs at the source, in `scripts/check-skills.sh`.

| Skill | extends | requires | produces | baseline |
| --- | --- | --- | --- | --- |
| `saf-setup` | —                   | config                                 | project-config, project-context | tlc-spec-driven  |
| `saf-route`               | —                   | config                                 | route-recommendation      | —                      |
| `saf-brainstorm`          | —                   | config                                 | spec-ready-brief           | —                      |
| `saf-create-spec`        | —                   | config, source-item                    | spec-package               | tlc-spec-driven        |
| `saf-explain`          | saf-create-spec    | config, spec-package                   | explanation                | —                      |
| `saf-create-prompts`      | saf-create-spec    | config, spec-package                   | task-prompts                | tlc-spec-driven, tdd |
| `saf-implement`      | saf-create-prompts  | config, task-identity                  | code-change+tdd-evidence    | tlc-spec-driven, tdd |
| `saf-implement-multi`     | saf-create-prompts  | config, spec-package                   | execution-plan              | tlc-spec-driven, tdd |
| `saf-check-task`          | saf-implement  | config, task-evidence                  | check-report                | tlc-spec-driven, tdd |
| `saf-create-pr`           | saf-check-task      | config, task-evidence                  | pr-package                   | tlc-spec-driven       |
| `saf-review-pr`           | saf-create-pr       | config, pr-reference                   | review-findings               | tlc-spec-driven       |
| `saf-fix-pr`              | saf-review-pr       | config, pr-reference, review-findings  | fix-evidence                   | tlc-spec-driven       |
| `saf-validate`          | saf-check-task      | config, spec-package, task-evidence    | validation-report              | tlc-spec-driven, tdd |

## Canonical baselines

TLC and TDD are registered in `shared/baselines/registry.yml` with a `baseline_version`
independent from the package version. `sdd-agentic-flow` ships **condensed, adapted** versions
of both (`shared/references/tlc-baseline.md`, `shared/references/tdd-baseline.md`), not the
full external `tlc-spec-driven`/`tdd` skills they are inspired by. See
[Baselines](baselines.md) for the exact boundary and the
[compatibility promise](compatibility-promise.md) for what changes across versions.

`doctor` enforces a Baseline Compliance gate that checks the shipped baseline files,
adaptive-sizing guidance, traceability guidance, and the evidence-first quality gate are present
and configured. See [Baselines](baselines.md) for the exact scope of what this gate
can and cannot verify. The canonical sensor → evidence → verification → decision contract
lives in [evidence-standard.md](../shared/references/evidence-standard.md).

## Project context

- `.sdd-agentic-flow/config.yml`: user-declared policy. Hand-authored (via `init`), never auto-written
  after creation.
- `.sdd-agentic-flow/context/project-context.md`: auto-discovered facts (README, AI instruction files,
  docs/ADR presence, package identity, monorepo tooling, test config). Regenerated by
  `discover`/`discover --force`/`context refresh`, never hand-authored.
- `.sdd-agentic-flow/context/domain-glossary.md`: optional, human-authored product vocabulary, created only
  with explicit authorization.

Skills read all three when present and never conflate discovered facts with declared policy.

### Dynamic Project Context

`project-context.md` is the canonical, versioned artifact for Dynamic Project Context: a derived
snapshot of the repository, not authoritative source code. It carries its own provenance
(generated-at timestamp, repository revision, branch, discovery version) so its freshness is
inspectable rather than assumed. `context status` reports that provenance and states, factually,
whether the repository has moved on since generation; `context refresh` regenerates it on demand.
Skills already consume this artifact as a shared baseline and layer only task-specific inspection
on top of it. They do not re-discover project-wide facts it already captures.

This is deliberately the full scope of Dynamic Project Context today. Indexing (accelerating
retrieval in large repositories) and querying (finding task-relevant context on demand) are
recognized as natural future layers on top of this artifact, but are out of scope for the current
product: context is derived, versioned, inspectable, and regenerable, but the repository remains
the sole source of truth, and no indexing/retrieval technology is part of the core product
contract.

## Extensions and adapters

Language profiles, multi-worktree orchestration, and feature profiles are extensions: they
enrich the TLC/TDD baselines but never weaken or replace them (see the "Extensions" section of
`shared/references/tlc-baseline.md`). `local-files` and `github` are adapters:
documentation-level only; see [adapters](adapters.md). Jira, Linear, and Azure DevOps adapters,
along with skill-cards/playbooks/decision-guide documentation, are deferred beyond v0.6; see
[ROADMAP.md](../ROADMAP.md).
