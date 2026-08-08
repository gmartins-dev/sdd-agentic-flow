# Uninstall

Start with a read-only plan:

```bash
sdd-agentic-flow uninstall --plan
```

Apply removal only after review:

```bash
sdd-agentic-flow uninstall --apply
sdd-agentic-flow uninstall --apply --include-config
```

`--apply` removes only official skill directories under `.agents/skills` and `sdd-agentic-flow-shared`. It preserves `.specs/features`, `.sdd/reports`, `.sdd/snapshots`, source code, and unknown paths. `--include-config` additionally removes `.sdd/config.yml`; use it only when retiring the toolkit configuration. Any local edits inside an official toolkit skill directory are removed with that directory.

Run `doctor` after removal to verify the remaining project state.

See [upgrading](upgrading.md) for what's preserved and what changes when you update to a new
CLI version.
