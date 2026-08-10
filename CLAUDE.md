# Development instructions for this repository

These instructions apply to anyone (human or AI agent) developing `sdd-agentic-flow`
itself. Consumer workflows start at [AGENTS.md](AGENTS.md); that file routes install,
SDD workflow, and trust docs. This file covers maintainer rules only. The `skills/` this
package ships to consumers stay agent-neutral by design (see
[docs/compatibility-promise.md](docs/compatibility-promise.md)).

## Git commits: never attribute AI agents as co-authors

Never add a `Co-Authored-By:` trailer naming an AI coding agent or vendor to a commit in
this repository. That includes Claude Code, Cursor, Codex, GitHub Copilot, Gemini, Windsurf,
and any similar agent identity (for example `cursoragent@cursor.com` or `Co-Authored-By:
Claude ...`). This overrides default commit-message behavior from agent clients for this
repo specifically.

Every commit's sole author and contributor must be the human maintainer
(`gmartins-dev <guilhermemm.dev@gmail.com>`). The GitHub contributor graph for this
repository must never show AI agents or their vendors.

Do not add other attribution trailers that credit an agent (`Signed-off-by` for an agent,
`Helped-by` for an agent, etc.).

A `commit-msg` hook enforces this as a backstop in case an agent session misses this file —
see `.githooks/commit-msg` and the "Git hooks" section in `CONTRIBUTING.md` for how to
enable it.
