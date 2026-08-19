# Machine interface

Operational JSON commands emit exactly one locale-independent document to stdout. The envelope is:

```json
{"schema_version":1,"cli_version":"5.0.0","command":"doctor","ok":true,"data":{}}
```

`command` is the complete canonical command path. Keys, enums, status tokens, and error codes are stable English technical tokens; message text is advisory. `ok` describes execution, not health: `doctor` may return `ok: true` with `data.status: "WARN"`.

JSON is available for `init`, `config show`, `config policy`, `config installation`, `install`, `context status`, `context refresh`, `context autonomy-state`, `doctor`, `upgrade --check`, `upgrade --plan`, `uninstall`, `list`, and `version`. `help`, `completion`, `learn-sdd`, `upgrade` apply, and `autonomous-resume` remain human-only.

Handled failures use `error: {"code":"...","details":{}}`; stable codes are `usage_error`, `authorization_required`, `interaction_unavailable`, `unsupported_state`, `validation_failed`, `collision`, `not_found`, and `internal_error`. `message` and `try` are optional advisory fields and are never machine-parsed. Human failures remain stderr-only. JSON never prompts, emits ANSI, or mixes progress with the document.

`--json` does not grant mutation authority. Class-B mutations still require `--yes`; human-authority commands have no JSON apply form.
