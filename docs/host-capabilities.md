# Host capabilities

This document answers which host runtime capabilities SAF can optionally use.
It is declarative: SAF does not detect these capabilities at runtime. For skill
format, installation scope, and discovery compatibility, see
[agent compatibility](agent-compatibility.md).

| Capability | Host evidence source | Status | Last verified | SAF fallback |
| --- | --- | --- | --- | --- |
| Skill loading | Agent compatibility matrix | documented | 2026-08-19 | Markdown skills remain portable guidance |
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
