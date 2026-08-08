# Golden flow: version migration (v0.8.0 → v0.9.0)

Proved by `test/cli.test.js` — `golden flow: upgrading from a v0.8.0-shaped installation is
safe under the new install default`. See [upgrading](../../../docs/upgrading.md) for the
prose write-up this test backs.

## What "v0.8.0-shaped" means

Before v0.9.0, `install` always wrote into the project — there was no `--scope` flag, so
today's `--scope project` was the only possible behavior. The test simulates this directly by
running `install core --scope project` against the current binary; the resulting
`.agents/skills/` tree is byte-for-byte what a real v0.8.0 `install core` would have produced,
since `--scope project`'s code path is unchanged from pre-v0.9.0 `install`.

## Commands

```bash
sdd-agentic-flow init
sdd-agentic-flow install core --scope project   # simulates a pre-v0.9.0 installation
```

Upgrading to the current binary and running `install` again with no flags:

```bash
sdd-agentic-flow install core                   # new default: --scope user
```

## Expected result

- The pre-existing `.agents/skills/` tree from the simulated v0.8.0 installation is byte-for-
  byte unchanged — different scopes, no interference. Nothing is silently deleted or migrated.
- Running `install core --scope project` again afterward reports `preserved`, exactly as
  `install` has always behaved for already-installed files.
- `doctor --contracts --json` on the project reports `capability_contracts: PASS` and an
  overall status that is not `FAIL`.

Anyone who wants to keep installing into the project going forward simply keeps passing
`--scope project` explicitly — see [installation scope](../../../docs/installation-scope.md).
