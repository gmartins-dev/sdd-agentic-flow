# v3 breaking changes

Version 3 changes the public skill namespace from `sdd-*` to `saf-*`. The npm
package and CLI command remain `sdd-agentic-flow`.

## Skill names

| Previous | v3 |
| --- | --- |
| `setup-sdd-agentic-flow` | `saf-setup` |
| `sdd-route` | `saf-route` |
| `sdd-brainstorm` | `saf-brainstorm` |
| `sdd-create-specs` | `saf-create-spec` |
| `sdd-create-prompts` | `saf-create-prompts` |
| `sdd-explain-me` | `saf-explain` |
| `sdd-implement-task` | `saf-implement` |
| `sdd-implement-multi` | `saf-implement-multi` |
| `sdd-task-check` | `saf-check-task` |
| `sdd-create-pr` | `saf-create-pr` |
| `sdd-pr-review` | `saf-review-pr` |
| `sdd-pr-fix` | `saf-fix-pr` |
| `sdd-validation` | `saf-validate` |
| `sdd-release` | `saf-release` |

There are no legacy alias stubs. Consult `list` for the installed pack roster.

## Clean reinstall

v3 does not migrate a v2 installation automatically. When the installer detects
legacy provenance or `sdd-*` skills, it blocks the operation without changing
files. Remove the previous installation deliberately, then run:

```bash
npx sdd-agentic-flow install core
```

## Installation intent

`configure` edits local desired installation intent; `install` reconciles that
intent. `--plan` remains read-only. Neither command commits, pushes, merges, or
publishes changes.
