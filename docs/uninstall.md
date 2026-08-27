# Uninstall

Preview first:

```bash
npx sdd-agentic-flow uninstall --plan
```

Apply a reviewed local removal with `--yes` outside a human TTY:

```bash
npx sdd-agentic-flow uninstall --plan [--scope user|project|all]
npx sdd-agentic-flow uninstall --plan --scope user --target agents
npx sdd-agentic-flow uninstall --yes [--scope user|project|all]
npx sdd-agentic-flow uninstall --yes --target agents
npx sdd-agentic-flow uninstall --plan --purge
npx sdd-agentic-flow uninstall --yes --purge
```

Normal removal touches only current managed assets declared by recognized provenance and
reconciles the matching installation intent. `--scope user` selects user installations,
`--scope project` selects the project installation, and `--scope all` selects both. Supplying
`--target` selects one or more user targets (`agents`, `cursor`, `claude`, or `copilot`) and
implies user scope when no scope is supplied. Repeat `--target` to select multiple targets. A target
cannot be combined with `--scope project` or `--scope all`.

Foreign paths, historical paths, source, and `.specs/features` are preserved. `--purge` remains
the cross-scope clean reset and cannot be combined with `--scope` or `--target`; it removes only
recognized project control state: config, generated context, snapshots, reports, explanations,
autonomy loop state, usage, and localized usage guides.

`--purge` is the only cross-scope reset. It requires `--yes` and cannot be combined with
`--scope` or `--target`. `--apply` is not a valid confirmation flag. Use `--yes`.

See the [compatibility policy](compatibility-promise.md) for the current contract and cleanup
rules.
