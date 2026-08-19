# Design principles

- Local-first and config-first.
- TLC baseline inside; stricter safeguards allowed when the project needs them.
- Safety over automation; evidence before completion.
- No configuration value overrides safety. `autonomy_level: autonomous` is not a license to commit, push, or publish.
- Modular packs; no vendor lock-in.
- Explicit local writes, reversible toolkit installation, human final authority.
- Concrete claims over broad compatibility, security, or autonomy promises.
- Session handoffs via `handoff.md` when work spans agents or sessions (see [handoff standard](../shared/references/handoff-standard.md)).
- Language-agnostic engineering principles as a shared contract, not a skill (see [engineering principles](engineering-principles.md)).
- The [engineering model](engineering-model.md) explains the repository-native
  control layer: SAF defines admissible transitions while the host executes.
