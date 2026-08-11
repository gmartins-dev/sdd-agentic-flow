# Workflow routing

Use this reference to recommend a local SDD next step. It is guidance, not automatic invocation: read the candidate `SKILL.md` before acting.

| Situation                             | Recommended skill                  |
| --- | --- |
| No `.sdd-agentic-flow/config.yml`                  | `setup-sdd-agentic-flow`           |
| Idea not yet defined (vague goal, or a clear problem with no decided approach) | `sdd-brainstorm` |
| Ambiguous or unstructured request     | `sdd-create-specs`                 |
| Existing undocumented code needing specs | `sdd-create-specs` (existing-code mode) |
| Specified feature needing a pedagogical explanation | `sdd-explain-me`     |
| Ready spec without task prompts       | `sdd-create-prompts`               |
| One ready task                        | `sdd-implement-task`               |
| Multiple dependent tasks              | `sdd-implement-multi`              |
| Completed task                        | `sdd-task-check`                   |
| Completed change needing a PR package | `sdd-create-pr`                    |
| Change ready for review               | `sdd-pr-review`                    |
| Accepted review findings              | `sdd-pr-fix`, then `sdd-pr-review` |
| Integrated feature                    | `sdd-validation`                   |
| Integrated and validated feature, release readiness unclear | `sdd-release` (on demand) |

Routing recommends; it does not install packs, change files, invoke skills, or bypass human decisions.
