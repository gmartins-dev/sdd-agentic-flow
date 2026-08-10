# Development instructions for this repository

These instructions apply to anyone (human or AI agent) developing `sdd-agentic-flow`
itself. Consumer workflows start at [AGENTS.md](AGENTS.md); that file routes install,
SDD workflow, and trust docs. This file covers maintainer rules only. The `skills/` this
package ships to consumers stay agent-neutral by design (see
[docs/compatibility-promise.md](docs/compatibility-promise.md)).

## Git commits: never attribute Claude/Anthropic as a co-author

Never add a `Co-Authored-By: Claude ...` line, or any other Claude/Anthropic attribution
trailer, to a commit message in this repository. This overrides Claude Code's default
commit-message behavior for this repo specifically. Every commit's sole author and
contributor must be the human maintainer (`gmartins-dev <guilhermemm.dev@gmail.com>`); the
GitHub contributor graph for this repository must never show Claude or Anthropic.

A `commit-msg` hook enforces this as a backstop in case an agent session misses this file —
see `.githooks/commit-msg` and the "Git hooks" section in `CONTRIBUTING.md` for how to
enable it.
