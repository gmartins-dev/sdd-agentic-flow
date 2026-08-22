# Execution isolation

Multi-task execution requires isolated mutable ownership, not a particular tool.

1. Prefer an isolated workspace supplied by the host.
2. Use a Git worktree only when it is available and explicitly authorized.
3. Execute sequentially when no isolated concurrent workspace is available.

Build an acyclic task DAG, then waves. Tasks may share a wave only when their mutable paths, contracts, tests, and runtime state are independent. Never share mutable state between concurrent tasks. Record ownership, sensors, integration boundary, and blockers in `execution-plan.md`.
