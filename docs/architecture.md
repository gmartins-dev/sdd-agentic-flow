# Architecture

`sdd-agentic-flow` is a local-first, zero-runtime-dependency toolkit that gives coding agents a
Spec Driven Development foundation: capability-contracted skills built on condensed TLC and TDD
baselines, adaptive feature-profile sizing, and optional auto-discovered project context. This
document describes how those pieces fit together.

## Layers

```text
CLI (bin/sdd-agentic-flow.js)
  |  list, init, discover, install, doctor, uninstall
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
  `discover`/`discover --force`, never hand-authored.
- `.sdd/context/domain-glossary.md` — optional, human-authored product vocabulary, created only
  with explicit authorization.

Skills read all three when present and never conflate discovered facts with declared policy.

## Extensions and adapters

Language profiles, multi-worktree orchestration, and feature profiles are extensions: they
enrich the TLC/TDD baselines but never weaken or replace them (see the "Extensions" section of
`shared/references/tlc-baseline.md`). `local-files` and `github` are adapters —
documentation-level only; see [adapters](adapters.md). Jira, Linear, and Azure DevOps adapters,
along with skill-cards/playbooks/decision-guide documentation, are deferred beyond v0.6 — see
[ROADMAP.md](../ROADMAP.md).
