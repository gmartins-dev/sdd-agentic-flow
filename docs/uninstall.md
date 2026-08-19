# Uninstall

Preview first:

```bash
sdd-agentic-flow uninstall --plan
```

Apply a reviewed local removal with `--yes` outside a human TTY:

```bash
sdd-agentic-flow uninstall --yes [--scope user|project|all] [--target agents|cursor|claude|copilot]
sdd-agentic-flow uninstall --plan --purge
sdd-agentic-flow uninstall --yes --purge
```

Normal removal touches only managed v5 assets declared by recognized provenance and reconciles
the matching installation intent. Foreign paths, historical paths, source, and `.specs/features`
are preserved. `--purge` is allowed for project/all scope and removes only recognized project
control state: config, generated context, snapshots, reports, explanations, autonomy loop state,
usage, and localized usage guides.

There is no `--apply`, `--include-config`, `--full`, or `--agent` in v5. See the
[v5+ compatibility promise](compatibility-promise.md) for the breaking boundary.
