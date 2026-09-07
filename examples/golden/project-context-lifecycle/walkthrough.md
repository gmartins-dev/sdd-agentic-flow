# Golden flow: project-context lifecycle

Illustrative context lifecycle in a disposable Git repository. Executable context
checks are maintained in `test/project-context.test.ts` and `scripts/cli-exhaustive.ts`.

## Commands

```bash
git init && git commit --allow-empty -m init   # requires configured Git author identity
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

`init` requires a Git workspace. User-scope skill installation works outside Git;
see the [trust model](../../../docs/trust-model.md) for that separate boundary.
