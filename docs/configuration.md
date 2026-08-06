# Configuration

`.sdd/config.yml` controls specs root, source type, language, workflow and safety.
The generated file is intentionally explicit and can be edited by the project owner.

It stores project name, default branch, agent target, human-output language, source type,
workflow choices, and quality gates. `init` preserves an existing configuration; interactive
init also exits without overwriting it.

Keep `quality` gates enabled unless the project records an explicit exception. The `safety`
keys keep commit, push, and merge/deploy disabled by default.
