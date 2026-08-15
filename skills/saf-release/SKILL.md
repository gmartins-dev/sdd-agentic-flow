---
name: saf-release
description: Check whether a project or feature is ready to tag and publish a release — version consistency, changelog presence, and configured release checks. Use when the user asks if a release is ready; never tags, publishes, or pushes.
metadata:
  version: 3.2.0
  pack: core
extends: null
requires: [config]
consumes: [project-context]
produces: [release-readiness-report]
baseline: []
compatible_with: [core, full, github, local-files]
depends_on: []
conflicts: []
requires_cli: null
autonomy_profile:
  supported_levels: [manual, supervised, autonomous]
  auto_continue_condition: 'release-readiness-report present with status ready and every configured release check satisfied'
  blocking_conditions: [version_drift, changelog_missing, gates_failed]
  evidence_required: [release-readiness-report]
---

# Check release readiness

## When to use

Use when the user asks whether the project (or one feature) is ready to tag and publish a
release. Read [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md) and
[evidence standard](../sdd-agentic-flow-shared/references/evidence-standard.md).

## When not to use

Do not use to implement code, write a changelog entry from scratch, create a git tag, or run a
publish command — this skill only checks readiness and reports gaps. Do not use for a single
task's readiness; use `saf-check-task` or `saf-validate` instead, whose passing evidence this
skill consumes rather than re-derives.

## Inputs

- `.sdd-agentic-flow/config.yml` — there is no dedicated `release` section today, so this means whatever
  release conventions (version-bearing files, the changelog path, configured build/test/lint
  commands) the project already expresses through its existing structure, not a config field
  this skill requires to be declared.
- The repository's current version marker (for example `package.json`, a `VERSION` file, or
  whatever `.sdd-agentic-flow/config.yml` declares) and its changelog file.
- Accumulated `check-report`/`validation-report` evidence for the work being released.
- `.sdd-agentic-flow/context/project-context.md`, when present, for repository conventions (primary
  language, build/package tooling) that shape which version marker and checks are relevant.

## Workflow

1. Read `.sdd-agentic-flow/config.yml` first. If it is missing, ask the user to run `/saf-setup`
   or `npx sdd-agentic-flow init`. Read `.sdd-agentic-flow/context/project-context.md` when it exists, for
   the repository's primary language and build/package tooling. Read any declared release
   conventions; when none are declared, fall back to the most common convention this project
   already uses (a single version-bearing manifest and a changelog file at the repository
   root), and say so explicitly rather than guessing a convention silently.
2. Confirm the target version is consistent across every version-bearing location the project
   declares or already uses — never assume a single file is authoritative without checking.
3. Confirm the changelog carries a section for the target version with real content, not a
   placeholder heading.
4. Run only configured, safe, applicable checks (tests, lint, a dry-run package/build step),
   applying `../sdd-agentic-flow-shared/references/evidence-standard.md` — reuse `saf-check-task`
   and `saf-validate` evidence already gathered for this work instead of re-running it, and
   record what could not be verified and why.
5. Decide `ready`, `not ready`, `blocked`, or `inconclusive`. A release is `ready` only when
   version consistency holds, the changelog entry is real, and every configured check passed.
6. Report the decision with concrete tag/publish guidance for the human to act on next — the
   exact command to tag and the exact command to publish, drawn from what the project already
   uses, never invented.

## Safety

Read-only. Do not create or push a git tag, run a publish command (`npm publish` or
equivalent), edit the changelog or version files, or make any network or remote-service call by
default. Preserve existing work; redact secrets, credentials, and absolute paths from the
report.

## Output

Return the release identity (version and scope), decision (`ready`/`not ready`/`blocked`/
`inconclusive`), version-consistency evidence, changelog-check evidence, configured-check
results, ranked gaps, and the tag/publish commands for the human to run — this skill never runs
them itself. When the decision is not `ready`, write or update `handoff.md` per
`../sdd-agentic-flow-shared/references/handoff-standard.md` if resolution is likely to span a
session or agent boundary.

## Autonomy

Supports `manual`, `supervised`, and `autonomous` autonomy levels (`workflow.autonomy_level` in
`.sdd-agentic-flow/config.yml`). In `autonomous` mode, a `ready` decision still never triggers a tag or
publish — those remain human actions outside this skill's scope, regardless of autonomy level.
Advancing autonomously past this skill requires a release-readiness-report with status `ready`
and every configured check satisfied; a version mismatch, missing changelog content, or failed
check blocks the advance. See
`../sdd-agentic-flow-shared/references/autonomy-guardrails.md`.
