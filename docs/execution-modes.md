# Execution modes

| Mode | Purpose | Mutations | Git and release boundary |
| --- | --- | --- | --- |
| `plan`   | Analyze, specify, prompt, and report                 | No source-code changes                   | Never commit or publish                                     |
| `guided` | Suggest or apply reviewed local patches              | Only with human approval                 | Never commit or push                                        |
| `apply`  | Implement explicitly authorized local work           | Local files only                         | Never commit, push, merge, deploy, or publish               |
| `review` | Inspect and validate evidence                        | No changes                               | No Git/release actions                                      |
| `full`   | Coordinate local planning, execution, and validation | Explicitly authorized local changes only | Still no commit, push, merge, deploy, or publish by default |

Use `plan` when requirements are uncertain, `guided` for supervised edits, `apply` for bounded
approved work, and `review` before acceptance. `full` grants the local mutation surface required by
an autonomous completion workflow; `autonomy_level` still determines whether the agent continues.

When the current mode or next skill is unclear, use `saf-route` for a read-only recommendation. It does not select a mode, invoke another skill, or bypass an explicit authorization.

For code tasks in `apply` and `full`, use the [TDD baseline](tdd-baseline.md):
name the required behavior, confirm a contractual seam, record current sensor evidence
for review. Test-first is recommended when it sharpens the spec; the full TDD ritual is
optional.

`workflow.autonomy_level` (`manual`/`supervised`/`autonomous`) is a separate, orthogonal axis on
top of these five modes: execution mode says what a Skill may mutate, autonomy level says whether
the agent continues or escalates before the next admissible transition. `plan` and `guided` never
combine with `autonomous`.
Missing configuration uses `apply + supervised`. Use `config policy` to persist
an explicit override. See [autonomy levels](autonomy-levels.md).
