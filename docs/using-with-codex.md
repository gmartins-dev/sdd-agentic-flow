# Using with Codex CLI

Install a pack, keep `.sdd/config.yml` in project context, and select a skill explicitly.

```bash
npx sdd-agentic-flow@0.2.0 install core
```

```text
Use the installed sdd-create-specs skill to turn this source item into an SDD feature spec.
Follow .sdd/config.yml. Do not implement code or create commits. Stop if requirements are ambiguous. Report evidence and limitations.
```

Codex remains responsible for requesting authorization before local mutations and must not commit, push, merge, deploy, or publish by default.
