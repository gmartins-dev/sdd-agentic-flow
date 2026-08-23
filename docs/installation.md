# Installation

Requires Node.js >= 22. The CLI is local-first and adds no runtime dependency to the consumer.

```bash
npx sdd-agentic-flow init
npx sdd-agentic-flow install full
npx sdd-agentic-flow doctor
```

`init` creates `.sdd-agentic-flow/config.yml`, project context, and regenerable usage guidance.
Use `--language en-US|pt-BR`, `--preset manual|supervised|autonomous`, and explicit policy flags
when automation needs deterministic setup. `--interactive` requires a real TTY and unset `CI`.

`install <pack>` accepts `planning`, `execution`, `review`, `multi-task`, or `full` and defaults to user scope. Use `--scope project` for `.agents/skills/` in the
repository. User targets are selected with repeatable `--target agents|cursor|claude|copilot`.
Use `--plan` for a read-only preview. For non-TTY automation, pass the explicit pack, scope, and
target options required by the command; `install` does not accept `--yes`.

Use `config installation` to save desired packs, targets, and sharing intent. It never installs
skills. Use `config policy` for workflow execution/autonomy policy.

Use `context refresh` to regenerate project context after repository changes. It is the only
public context mutation command; `context status` is read-only.

See [installation scope](installation-scope.md), [configuration](configuration.md), and
[environment compatibility](environment-compatibility.md).
