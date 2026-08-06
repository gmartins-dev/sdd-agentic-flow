# Worktree orchestration

Use project-configured worktree helpers when available. Otherwise prefer read-only
planning until the user confirms a worktree strategy. Split only genuinely independent
Tasks, record dependencies and path ownership, and do not switch branches or create
worktrees implicitly.
