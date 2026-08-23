# Machine interface

Operational JSON commands emit exactly one locale-independent document to stdout. The envelope is:

```json
{"schema_version":1,"cli_version":"6.4.0","command":"doctor","ok":true,"data":{}}
```

`command` is the complete canonical command path. Keys, enums, status tokens, and error codes are stable English technical tokens; message text is advisory. `ok` describes execution, not health: `doctor` may return `ok: true` with `data.status: "WARN"`.

JSON is available for `init`, `config show`, `config policy`, `config installation`, `install`, `context status`, `context refresh`, `context autonomy-state`, `doctor`, `upgrade --check`, `upgrade --plan`, `uninstall`, `list`, and `version`. `help`, `completion`, `learn-sdd`, `upgrade` apply, and `autonomous-resume` remain human-only.

Handled failures use `error: {"code":"...","details":{}}`; stable codes are `usage_error`, `authorization_required`, `interaction_unavailable`, `unsupported_state`, `validation_failed`, `collision`, `not_found`, and `internal_error`. `message` and `try` are optional advisory fields and are never machine-parsed. Human failures remain stderr-only. JSON never prompts, emits ANSI, or mixes progress with the document.

`--json` does not grant mutation authority. Class-B mutations still require `--yes`; human-authority commands have no JSON apply form.

## Representation boundary

CLI JSON is the exact machine representation for operational output. It is one locale-independent
JSON document on stdout with stable technical tokens; it is not a second authority for command
policy, configuration, or repository state. The CLI implementation and its persisted domain
owners remain canonical.

The broader information representation model is documented in
[`docs/information-representation-model.md`](information-representation-model.md). That model also
documents the current hybrid `SKILL.md` and `loop-state.md` representations and the fact that
Evidence Graph HTML and Mermaid are derived projections.
