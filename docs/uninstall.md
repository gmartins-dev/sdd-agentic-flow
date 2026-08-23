# Uninstall

Preview first:

```bash
sdd-agentic-flow uninstall --plan
```

Apply a reviewed local removal with `--yes` outside a human TTY:

```bash
sdd-agentic-flow uninstall --plan [--scope user|project|all]
sdd-agentic-flow uninstall --plan --scope user --target agents
sdd-agentic-flow uninstall --yes [--scope user|project|all]
sdd-agentic-flow uninstall --yes --target agents
sdd-agentic-flow uninstall --plan --purge
sdd-agentic-flow uninstall --yes --purge
```

Normal removal touches only current v6 managed assets declared by recognized provenance and
reconciles the matching installation intent. `--scope user` selects user installations,
`--scope project` selects the project installation, and `--scope all` selects both. Supplying
`--target` selects one or more user targets (`agents`, `cursor`, `claude`, or `copilot`) and
implies user scope when no scope is supplied. A target cannot be combined with `--scope project`
or `--scope all`.

Foreign paths, historical paths, source, and `.specs/features` are preserved. `--purge` remains
the cross-scope clean reset and cannot be combined with `--scope` or `--target`; it removes only
recognized project control state: config, generated context, snapshots, reports, explanations,
autonomy loop state, usage, and localized usage guides.

There is no `--apply`, `--include-config`, `--full`, or `--agent` in the current v6 interface.
See the [v6 compatibility policy](compatibility-promise.md) for the breaking boundary.
