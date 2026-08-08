# Publishing

Run `npm run release:check` first (Milestone 9) — it chains `npm run check`, `npm run
pack:dry`, `sdd-agentic-flow doctor --smoke`, and a version-consistency grep across
`package.json`, every `skills/*/SKILL.md`, and every `presets/*.json`, stopping at the first
failure. It replaces the manual command list this section used to carry, so this doc never
needs an edit on a routine version bump again.

Then, before publication:

```bash
npm whoami
npm pack --dry-run
npm publish --dry-run --access public
npm publish --access public
```

Codex CLI, Claude Code, and Cursor-style workflows are manually validated — see
[agent compatibility](agent-compatibility.md) for the current, per-agent status of that
validation instead of a version number here (that table is the single source of truth for
which agent/scope combination has actually been exercised).

Automated provenance and release automation are future work.

Review the dry-run file list before publishing. The package never runs these commands
itself and does not create a Git remote, tag, or release. `npm publish` is always manual by
the package owner — no automation in this repository executes it.
