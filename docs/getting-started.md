# Getting started

Use the explicit lifecycle in a Git workspace:

```bash
npx sdd-agentic-flow install
npx sdd-agentic-flow init --plan
npx sdd-agentic-flow init
npx sdd-agentic-flow doctor
```

Install SAF once for your agent host, initialize every exact workspace or
linked worktree, and configure only when the built-in `apply` + `supervised`
policy needs an override. `init` is idempotent and does not create config.

`doctor` reports Installation, Workspace, and Policy independently. Use
`doctor --json` for machine schema 2. A missing config or generated context is
non-blocking by itself; invalid or future state fails closed.

For a pre-v7 footprint, preview with `install --plan`, inspect every removal,
then explicitly authorize the bounded reset and install with `install --yes`.

See [installation](installation.md) and [troubleshooting](troubleshooting.md).
