# Commands

| Command | Purpose |
| --- | --- |
| `install` | Install the 12-skill official bundle and shared layer |
| `install --plan` | Preview installation or a bounded pre-v7 reset |
| `install --yes` | Explicitly authorize a displayed pre-v7 reset before installation |
| `init` | Initialize the exact current Git workspace |
| `init --plan` | Preview the same workspace plan without writes |
| `config show` | Show effective policy and its origin |
| `config policy` | Preview or persist explicit policy overrides |
| `config installation` | Save scope, targets, and project adoption intent |
| `doctor` | Report Installation, Workspace, and Policy readiness |
| `doctor --json` | Emit machine schema 2 |
| `upgrade --skills-only` | Reconcile current v3 managed assets from the local package |
| `uninstall --plan` | Preview bounded SAF-owned cleanup |
| `uninstall --yes` | Apply the approved cleanup |

`install` accepts no positional bundle selector or `--pack`. `init` accepts no
policy/setup flags. Missing config uses built-in defaults; invalid or future
state is preserved and fails closed.

See [CLI interaction](cli-interaction.md), [installation](installation.md),
[configuration](configuration.md), and [trust model](trust-model.md).
