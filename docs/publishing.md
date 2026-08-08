# Publishing

Run locally before publication:

```bash
npm whoami
npm pack --dry-run
npm publish --dry-run --access public
npm publish --access public
```

For v0.7.0, also run `npm run check`, `npm run pack:dry`, `sdd-agentic-flow doctor --json`, and `sdd-agentic-flow doctor --smoke`. Codex CLI, Claude Code, and Cursor-style workflows were manually validated as of v0.6.0; re-validate before adding a new compatibility claim beyond that baseline.

Automated provenance and release automation are future work.

Review the dry-run file list before publishing. The package never runs these commands
itself and does not create a Git remote, tag, or release.
