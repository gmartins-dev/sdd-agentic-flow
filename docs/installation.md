# Installation

Requires Node.js >= 22. The CLI is local-first and adds no runtime dependency to the consumer.

```bash
npx sdd-agentic-flow
```

The bare command is the canonical human entry point: it detects first use, partial setup,
healthy setup, and recovery needs, then guides the admissible next action. Guided setup creates
`.sdd-agentic-flow/config.yml`, project context, usage guidance, installs the selected pack, asks
how the project will adopt SAF, and validates the result.

For explicit automation or advanced control, use:

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

Use `config installation` to save desired packs, targets, and optional `adoption_mode`. It never
installs skills. `scope` still controls only where skills are installed. Use `config policy` for
workflow execution/autonomy policy.

## Choose project adoption

SAF is personal by default. Guided setup offers three explicit project presets:

- **Personal** keeps SAF state and the configured `specs.root` local, with user-scope skills.
- **Specs shared** keeps SAF tooling local but leaves only the configured specs root visible to
  Git, with user-scope skills.
- **Team** shares the project config, optional `context/domain-glossary.md`, official project
  skills, and `sdd-agentic-flow-shared`. Derived context and execution state stay local.

The optional `adoption_mode` field in the installation-intent v2 document records desired state. It does not
authorize Git operations. SAF manages only its own blocks in `.git/info/exclude`; it never edits
`.gitignore`, global excludes, tracked files, commits, or pushes. Existing 6.4.x intents without
the field remain **unclassified** until you choose a preset. **Keep current visibility** makes no
change and does not record a preset.

Use `context refresh` to regenerate project context after repository changes. It is the only
public context mutation command; `context status` is read-only.

See [installation scope](installation-scope.md), [configuration](configuration.md), and
[environment compatibility](environment-compatibility.md).
