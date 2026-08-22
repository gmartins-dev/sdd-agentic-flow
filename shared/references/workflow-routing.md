# Workflow routing

Use this reference to recommend a local SDD next step. It is guidance, not automatic invocation: read the candidate `SKILL.md` before acting.

| Situation                             | Recommended skill                  |
| --- | --- |
| No `.sdd-agentic-flow/config.yml`                  | `saf-setup`           |
| Idea not yet defined or a decided problem with unresolved approach | `saf-brainstorm` (durable mode for persistent investigations) |
| Discovery-only workspace | `saf-brainstorm` to resume or converge; not implementation-ready |
| Ambiguous or unstructured request     | `saf-create-spec`                 |
| Existing undocumented code needing specs | `saf-create-spec` (existing-code mode) |
| Specified feature needing a pedagogical explanation | `saf-explain`     |
| Ready spec without task prompts       | `saf-create-prompts`               |
| One ready task                        | `saf-implement`               |
| Multiple dependent tasks              | `saf-implement-multi`              |
| Completed task                        | `saf-check-task`                   |
| Completed change needing a PR package | `saf-create-pr`                    |
| Change ready for review               | `saf-review-pr`                    |
| Accepted review findings              | `saf-fix-pr`, then `saf-review-pr` |
| Integrated feature                    | `saf-validate`                   |

Route first by artifact/workflow state, then by uncertainty. Consequential human judgment or ambiguous package identity is a human gate. Routing recommends; it does not install packs, change files, invoke skills, or bypass human decisions.
