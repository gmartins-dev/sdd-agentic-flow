# Publishing

Run locally before publication:

```bash
npm whoami
npm pack --dry-run
npm publish --dry-run --access public
npm publish --access public
```

For v0.4.0, also run `npm run check`, `npm run pack:dry`, `sdd-agentic-flow doctor --json`, and `sdd-agentic-flow doctor --smoke`. Codex CLI, Claude Code, and Cursor-style workflows have been manually validated for this release; validate any additional target before adding a compatibility claim.

Automated provenance and release automation are future work.

Review the dry-run file list before publishing. The package never runs these commands
itself and does not create a Git remote, tag, or release.
