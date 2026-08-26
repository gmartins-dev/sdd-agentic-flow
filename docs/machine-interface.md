# Machine interface

Operational JSON emits one locale-independent document:

```json
{"schema_version":2,"cli_version":"<installed-version>","command":"doctor","ok":true,"data":{}}
```

`init --plan --json` reports the exact workspace/Git roots, creates, preserves,
and excludes without mutation. `doctor --json` exposes independent
Installation, Workspace, and Policy readiness plus `config_origin`.

Machine output contains no bundle-selection data or removed commands. Keys,
enums, status tokens, and error codes are stable English technical tokens.
`ok` describes command execution, not readiness health. JSON never prompts,
emits ANSI, persists credentials, or grants mutation authority.

Schema 2 remains compatible for the 7.x line. New fields may be additive;
removal, renaming, or incompatible semantic changes wait for a future major.

See [information representation model](information-representation-model.md).
