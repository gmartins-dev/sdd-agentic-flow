# Recommended optional harness

`sdd-agentic-flow` is self-contained. The tools below are optional complements, not requirements to install, run, or benefit from the toolkit.

## Core

- sdd-agentic-flow

## Optional complements

- Codex CLI, Claude Code, or Cursor
- RTK, local MCPs, anti-slop review tools, context/headroom tools, and complementary local skills

Use complements only when they improve your local workflow. Do not treat them as dependencies of `sdd-agentic-flow`.

Rules in `AGENTS.md` / `CLAUDE.md` are context: the agent may follow them, or may not.
Destructive guards (`docker compose down -v`, `rm -rf`, dropping a database) belong in
hooks of the **agent product you use**. Those hooks are vendor-specific and live outside
this toolkit. `sdd-agentic-flow` does not install `.claude/settings.json`, Cursor hooks, or
any other agent-vendor config.
