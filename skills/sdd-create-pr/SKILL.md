---
name: sdd-create-pr
metadata:
  version: 0.2.0
  pack: pr
description: Prepare a task-scoped pull-request package from validated SDD evidence. Use only when the user explicitly asks to create or prepare a PR; do not use for implementation, review, or automatic publishing.
---

# Prepare an SDD pull request

## When to use

Use after a single task passes its checks and the user explicitly requests PR preparation or creation. Read [the TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md) and [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md).

## When not to use

Do not use before task validation, for feature-wide PRs without explicit scope, to fix code, or to publish a PR by default.

## Inputs

- One validated task reference, branch/head context, and task-check evidence.
- `.sdd/config.yml`, SDD artifacts, current diff, and repository PR conventions.
- Explicit confirmation when an external PR mutation is requested.

## Workflow

1. Read `.sdd/config.yml` first; if it is missing, ask the user to run `/setup-sdd-agentic-flow` or `npx sdd-agentic-flow init`.
2. Verify scope, clean attribution of changed files, validation evidence, and known gaps. Stop on sibling work, missing evidence, or unsafe branch state.
3. Draft a Markdown PR title and body anchored to SDD criteria, changes, validation, risks, and rollback notes.
4. Present the package. Create a remote draft PR only with explicit user authorization and configured credentials; otherwise make no external call.

## Safety

Do not commit, push, create or edit PRs, assign reviewers, alter labels, or mutate trackers by default. Exclude secrets, PII, absolute paths, and unverified claims.

## Output

Return the PR package, task scope, validation summary, blockers, and whether a remote PR was created.
