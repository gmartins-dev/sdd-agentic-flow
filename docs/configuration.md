# Configuration

`.sdd/config.yml` controls specs root, source type, language, workflow and safety.
The generated file is intentionally explicit and can be edited by the project owner.

Keep `quality` gates enabled unless the project records an explicit exception. The
`safety` keys keep commit, push, and merge/deploy disabled by default.
# Configuration

`.sdd/config.yml` stores project name, default branch, agent target, human-output language, source type, workflow choices, quality gates, and safety defaults. `init` preserves an existing configuration; interactive init also exits without overwriting it.
