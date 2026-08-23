# Recommended optional companion stack

SAF is the workflow harness. The tools below are optional coding-agent-host, runtime, and
development-tooling complements; they do not replace or enlarge SAF's runtime ownership.

## Core

- sdd-agentic-flow

## Optional complements

- Codex CLI, Claude Code, or Cursor
- RTK, local MCPs, anti-slop review tools, context/headroom tools, and complementary local skills

Use complements only when they improve your local workflow. Do not treat them as dependencies of `sdd-agentic-flow`.

## Autonomous completion

With `execution_mode: full` and `autonomy_level: autonomous`, the invoking
coding-agent host may continue the local SAF workflow through repair, review,
and validation without intermediate questions. This is outcome ownership
within delegated authority, not a runtime scheduler or external-action grant.
The host must escalate hard safety boundaries, external or irreversible
authority, underdetermined intent, exhaustion, and no meaningful progress.

Rules in `AGENTS.md` / `CLAUDE.md` are context: the agent may follow them, or may not.
Destructive guards (`docker compose down -v`, `rm -rf`, dropping a database) belong in
hooks of the **agent product you use**. Those hooks are vendor-specific and live outside
this toolkit. `sdd-agentic-flow` does not install `.claude/settings.json`, Cursor hooks, or
any other agent-vendor config.
