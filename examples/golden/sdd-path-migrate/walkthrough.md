# Golden flow: legacy `.sdd/` → `.sdd-agentic-flow/` migration

Proved by `test/cli.test.js` — `golden flow: migrate legacy .sdd/ to .sdd-agentic-flow/`.

## Setup

Simulate a pre-v1.10.0 project with toolkit state under `.sdd/`:

```bash
mkdir -p .sdd/context
# .sdd/config.yml with workflow fields, etc.
```

## Commands

```bash
sdd-agentic-flow migrate --plan
sdd-agentic-flow migrate --apply
sdd-agentic-flow doctor --json
```

## Expected result

- `.sdd/` is moved atomically to `.sdd-agentic-flow/` (same inner tree).
- `doctor` does not warn on `legacy_sdd_root`.
- Re-running `migrate --apply` warns that nothing remains to migrate.

See [upgrading.md](../../../docs/upgrading.md) for the full migration table.
