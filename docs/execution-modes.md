# Execution modes

| Mode | Purpose | Mutations | Git and release boundary |
| --- | --- | --- | --- |
| `plan` | Analyze, specify, prompt, and report | No source-code changes | Never commit or publish |
| `guided` | Suggest or apply reviewed local patches | Only with human approval | Never commit or push |
| `apply` | Implement explicitly authorized local work | Local files only | Never commit, push, merge, deploy, or publish |
| `review` | Inspect and validate evidence | No changes | No Git/release actions |
| `full` | Coordinate local planning, execution, and validation | Explicitly authorized local changes only | Still no commit, push, merge, deploy, or publish by default |

Use `plan` when requirements are uncertain, `guided` for supervised edits, `apply` for bounded approved work, and `review` before acceptance. `full` does not mean fully autonomous.
