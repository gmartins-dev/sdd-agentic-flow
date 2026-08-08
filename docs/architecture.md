# Architecture

`sdd-agentic-flow` is a local-first, zero-runtime-dependency toolkit that gives coding agents a
Spec Driven Development foundation: capability-contracted skills built on condensed TLC and TDD
baselines, adaptive feature-profile sizing, and optional auto-discovered project context. This
document describes how those pieces fit together.

## Layers

```text
CLI (bin/sdd-agentic-flow.js)
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
  .sdd/config.yml                     user-declared policy (specs root, workflow, quality, safety)
  .sdd/context/project-context.md     auto-discovered facts (read-only, from discover/init)
  .sdd/context/domain-glossary.md     optional, human-authored product vocabulary
  .specs/features/**                  working SDD artifacts (context/spec/design/tasks)
  .agents/skills/**                   installed skill copies + sdd-agentic-flow-shared
```

Each layer only depends on the layer below it. Skills never call the CLI, and the CLI never
authors SDD artifacts — it only creates configuration, discovers context, and copies files.

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

### Field semantics at a glance

| Field | Answers | Not to be confused with |
| --- | --- | --- |
| `extends` | "What is the one upstream skill this continues from?" | `depends_on` — `extends` is a single required chain link, not an optional extra input. |
| `depends_on` | "What other skill's *output* does this skill also need, beyond its `extends` parent?" | `requires` — `depends_on` names other **skills**; `requires` names **input kinds** (`config`, `task-identity`), never a skill. |
| `conflicts` | "Which skills must never be installed alongside this one?" | `depends_on` — `conflicts` names an incompatibility, not a needed output. |
| `requires` | "What input kinds must exist before this skill can act?" | `consumes` — a missing `requires` input blocks the skill; a missing `consumes` artifact does not. |
| `consumes` | "What optional context artifacts does this skill read when present?" | `requires` — `consumes` is best-effort context, never a precondition. |
| `produces` | "What artifact kind does this skill hand off when it finishes?" | `compatible_with` — `produces` is workflow output, `compatible_with` is pack membership. |

`doctor --contracts` validates that every skill installed in a **consumer** repository
(`.agents/skills/*/SKILL.md`) still carries all 6 required fields and reports on the 2 optional
ones — `FAIL` if a required field is missing (signals a corrupted or hand-edited installed
skill), `WARN` if `depends_on`/`conflicts` are absent. This complements
`scripts/check-skills.sh`, which validates the same fields **at the source** (this repository)
before anything is packed or installed.

`doctor --contracts` also validates that `depends_on`/`conflicts` reference real skill names
(and, for `conflicts`, that referenced skills are not actually co-installed), that `baseline`
entries exist in `shared/baselines/registry.yml`, and that `depends_on`/`extends` form no cycle
— surfacing any of these as a `FAIL` inside this same check rather than a new status value. It
does not re-verify `compatible_with` against pack membership: a consumer repository has no
local `presets/` directory to check against (`install` only copies `shared/`, never `presets/`);
that exact-match check only runs at the source, in `scripts/check-skills.sh`.

| Skill                    | extends           | requires                              | produces                 | baseline             |
| ------------------------ | ------------------ | -------------------------------------- | ------------------------- | --------------------- |
| `setup-sdd-agentic-flow` | —                   | config                                 | project-config, project-context | tlc-spec-driven  |
| `sdd-route`               | —                   | config                                 | route-recommendation      | —                      |
| `sdd-create-specs`        | —                   | config, source-item                    | spec-package               | tlc-spec-driven        |
| `sdd-create-prompts`      | sdd-create-specs    | config, spec-package                   | task-prompts                | tlc-spec-driven, tdd |
| `sdd-implement-task`      | sdd-create-prompts  | config, task-identity                  | code-change+tdd-evidence    | tlc-spec-driven, tdd |
| `sdd-implement-multi`     | sdd-create-prompts  | config, spec-package                   | execution-plan              | tlc-spec-driven, tdd |
| `sdd-task-check`          | sdd-implement-task  | config, task-evidence                  | check-report                | tlc-spec-driven, tdd |
| `sdd-create-pr`           | sdd-task-check      | config, task-evidence                  | pr-package                   | tlc-spec-driven       |
| `sdd-pr-review`           | sdd-create-pr       | config, pr-reference                   | review-findings               | tlc-spec-driven       |
| `sdd-pr-fix`              | sdd-pr-review       | config, pr-reference, review-findings  | fix-evidence                   | tlc-spec-driven       |
| `sdd-validation`          | sdd-task-check      | config, spec-package, task-evidence    | validation-report              | tlc-spec-driven, tdd |

## Canonical baselines

TLC and TDD are registered in `shared/baselines/registry.yml` with a `baseline_version`
independent from the package version. `sdd-agentic-flow` ships **condensed, adapted** versions
of both (`shared/references/tlc-baseline.md`, `shared/references/tdd-baseline.md`) — not the
full external `tlc-spec-driven`/`tdd` skills they are inspired by. See
[TLC integration](tlc-integration.md) for the exact boundary and the
[compatibility promise](compatibility-promise.md) for what changes across versions.

`doctor` enforces a Baseline Compliance gate that checks the shipped baseline files,
adaptive-sizing guidance, traceability guidance, and the evidence-first quality gate are present
and configured. See [TLC integration](tlc-integration.md) for the exact scope of what this gate
can and cannot verify.

## Project context

- `.sdd/config.yml` — user-declared policy. Hand-authored (via `init`), never auto-written
  after creation.
- `.sdd/context/project-context.md` — auto-discovered facts (README, AI instruction files,
  docs/ADR presence, package identity, monorepo tooling, test config). Regenerated by
  `discover`/`discover --force`/`context refresh`, never hand-authored.
- `.sdd/context/domain-glossary.md` — optional, human-authored product vocabulary, created only
  with explicit authorization.

Skills read all three when present and never conflate discovered facts with declared policy.

### Dynamic Project Context

`project-context.md` is the canonical, versioned artifact for Dynamic Project Context: a derived
snapshot of the repository, not authoritative source code. It carries its own provenance
(generated-at timestamp, repository revision, branch, discovery version) so its freshness is
inspectable rather than assumed. `context status` reports that provenance and states, factually,
whether the repository has moved on since generation; `context refresh` regenerates it on demand.
Skills already consume this artifact as a shared baseline and layer only task-specific inspection
on top of it — they do not re-discover project-wide facts it already captures.

This is deliberately the full scope of Dynamic Project Context today. Indexing (accelerating
retrieval in large repositories) and querying (finding task-relevant context on demand) are
recognized as natural future layers on top of this artifact, but are out of scope for the current
product: context is derived, versioned, inspectable, and regenerable, but the repository remains
the sole source of truth, and no indexing/retrieval technology is part of the core product
contract.

## Extensions and adapters

Language profiles, multi-worktree orchestration, and feature profiles are extensions: they
enrich the TLC/TDD baselines but never weaken or replace them (see the "Extensions" section of
`shared/references/tlc-baseline.md`). `local-files` and `github` are adapters —
documentation-level only; see [adapters](adapters.md). Jira, Linear, and Azure DevOps adapters,
along with skill-cards/playbooks/decision-guide documentation, are deferred beyond v0.6 — see
[ROADMAP.md](../ROADMAP.md).
