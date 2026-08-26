# Workspace initialization

`install` exposes the official skill bundle, `init` prepares one exact Git
workspace, and `config` persists optional policy overrides. Missing config uses
the canonical values in [effective-defaults.md](effective-defaults.md).

An initialized workspace contains the local marker:

```yaml
schema: saf-workspace/v1
```

The marker carries no policy, identity, version, timestamp, or mutable status.
The host owns worktree creation and concurrency. A skill may apply these
semantics after an explicitly authorized worktree plan by creating the marker,
preserving existing context and config, and reconciling only SAF-owned exclude
blocks. It must not locate or invoke the CLI package to do so.
