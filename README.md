# sdd-agentic-flow

A safe, modular Spec Driven Development workflow for coding agents.

`sdd-agentic-flow` incorporates an internal TLC baseline and extends it with
config-first skills, reviewable task flow, safety defaults, packs, and local tooling.

## Install

```bash
npm install -D sdd-agentic-flow
npx sdd-agentic-flow init
npx sdd-agentic-flow install core
```

## Workflow

Specify → Discuss → Design → Tasks → Execute → Verify. The internal skills preserve
traceability, test-first work, and evidence before completion.

## Packs

| Pack | Purpose |
| --- | --- |
| `core` | Setup, specifications, one-task execution, checking, validation. |
| `planning` | Specifications and implementation prompts. |
| `execution` | Single-task and multi-task execution guidance. |
| `pr` | PR preparation, review, and finding repair. |
| `multi-worktree` | Dependency-aware orchestration guidance. |
| `full` | All public skills. |

`local-files` and `github` are compositions for their respective source contexts.

## Configuration

`init` creates `.sdd/config.yml`. It controls the specs root, source type, human
output language, workflow choices, quality gates, and no-commit/no-push defaults.
Existing configuration is preserved.

Use `sdd-agentic-flow list` to inspect `core`, `planning`, `execution`, `pr`,
`multi-worktree`, `full`, `local-files`, and `github` packs.

## Relationship to tlc-spec-driven

The internal methodology baseline is adapted from `tlc-spec-driven`. It is a required
minimum, while this package can add stricter safety and workflow rules. Direct TLC
Execute is not invoked; internal skills implement its intent. See [NOTICE](NOTICE)
and [LICENSING.md](LICENSING.md).

## Privacy and safety

The CLI collects no telemetry and sends no project files, specs, reports, prompts, or
source code to remote services. It is offline by default and does not commit, push,
merge, deploy, or publish by default.

See [workflow safety](shared/references/workflow-safety.md) for the untrusted-input
and prompt-injection model.

## What this does not do

It does not make autonomous commits, push code, merge PRs, deploy, publish packages,
call external APIs from the CLI, require a tracker, or replace human review.

## Support scope

v0.1 supports local-first Markdown skill installation. It does not include remote
sync, GitHub API automation, tracker adapters, automatic updates, merge/deploy
automation, or guaranteed compatibility with every agent client.

## Skill authoring

Public skills are authored and normalized with `$skill-creator` for consistent
structure and agent compatibility. It is a development-time aid, not a dependency
for package users.

## Publishing

Review locally, then follow [docs/publishing.md](docs/publishing.md). No publication
is performed by this package.
