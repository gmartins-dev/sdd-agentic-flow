# Golden flow: project-context lifecycle

Proved by `test/cli.test.ts` — `context status detects repository revision drift in a real git
repository` (added in v0.8.0). This directory has no separate fixture: the test creates a real,
temporary Git repository directly, since project-context provenance is inherently about Git
state, not static files.

## Commands

```bash
git init && git commit -m init   # a real repository, so provenance has a revision to track
sdd-agentic-flow init
sdd-agentic-flow context status
# ... make a commit ...
sdd-agentic-flow context status
sdd-agentic-flow context refresh
sdd-agentic-flow context status
```

## Expected result

- Right after `init`, `context status` reports a `repository revision` and a `branch` line with
  no drift warning.
- After a new commit, `context status` reports `Repository has changed since context
  generation.` and recommends `sdd-agentic-flow context refresh`.
- `doctor --json`'s `project_context` check message includes "repository has changed since
  generation" at that point.
- After `context refresh`, the drift warning is gone again.

Outside a Git repository, the same flow degrades gracefully: `> Repository revision: not a git
repository`, never a failure — see the [trust model](../../../docs/trust-model.md)'s formal
requirement that Git is an optional integration, not a runtime requirement.
