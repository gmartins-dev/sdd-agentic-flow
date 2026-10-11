# Host capabilities

This document answers which host runtime capabilities SAF can optionally use.
It is declarative: SAF does not detect these capabilities at runtime. For skill
format, installation scope, and discovery compatibility, see
[agent compatibility](agent-compatibility.md).

| Capability | Host evidence source | Status | Last verified | SAF fallback |
| --- | --- | --- | --- | --- |
| Skill loading | Skill behavior campaign: Claude Code 2.1.287 (`.claude/skills`), codex-cli 0.162.1 (`.agents/skills`) | manually verified | 2026-10-11 | Markdown skills remain portable guidance |
| Fresh worker / isolated context | Host documentation or manual workflow | not verified | — | Re-ground verifier oracle from canonical artifacts (`VERIFY-001`) |
| Parallel workers | Host documentation or manual workflow | not verified | — | Execute dependency waves serially |
| Worktree isolation | Host/tooling configuration | documented | 2026-08-19 | Do not run concurrent mutable tasks |
| Deterministic hooks | Host documentation | not verified | — | Instruction and SAF contract only |
| MCP / external tools | Host configuration | not verified | — | Keep workflow local and tool-agnostic |

`documented` means an applicable published contract exists; `manually verified`
means a workflow was exercised; `not verified` is an honest gap; `unsupported`
means SAF cannot rely on it. Portable syntax does not imply portable semantics.

## Enforcement levels

1. **Instruction** — `SKILL.md` guidance; probabilistic and host-read.
2. **Contract** — SAF artifacts and `doctor` can inspect mechanically.
3. **Host enforcement** — hooks, sandboxing, and approvals owned by the host.

For example, SAF can require no push without authorization in a contract; only
the host can enforce a sandbox or approval mechanism. This does not make SAF a
host runtime.

Rewind, checkpoints, and rollback are host capabilities too: reverting a
conversation does not undo a file or an external effect a process already
produced. Evidence that a host follows SAF is a third responsibility, separate
from both: the maintainer [skill behavior evaluation](skill-behavior-evaluation.md)
observes host runs from outside, and a row above moves to `manually verified`
only when such a run exercised it.

The 2026-10-11 campaign verified skill loading only: Codex loaded the named skill in all 12
fixtures, while Claude Code loaded it when the prompt named the skill and not in the three
resume prompts that did not. Both hosts ran Bash inside their own sandbox; in Claude Code's
sandbox a detached background process ended with the command that started it.
