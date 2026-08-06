# sdd-agentic-flow

`sdd-agentic-flow` is a local-first, Markdown-first Spec Driven Development toolkit for coding-agent workflows. It installs explicit project-local skills and configuration; it does not replace human review.

## Quick start

```bash
npx sdd-agentic-flow@0.4.0 init
npx sdd-agentic-flow@0.4.0 install core
npx sdd-agentic-flow@0.4.0 doctor
```

Use `init --interactive` to choose a project name, agent target, language, source type, and workflow defaults. Existing `.sdd/config.yml` files are preserved.

Choose a language profile explicitly when creating a project:

```bash
npx sdd-agentic-flow@0.4.0 init --language en-US
npx sdd-agentic-flow@0.4.0 init --language pt-BR
```

See [language profiles](docs/language-profiles.md) for the profile contract.

## Why trust this toolkit?

- The source, CLI, docs, skills, and checks are open source and inspectable.
- The CLI is small, local-first, and has zero runtime dependencies.
- It has no telemetry, postinstall script, or outbound CLI network access by default.
- It does not automatically commit, push, merge, deploy, or publish.
- Installation is explicit into `.agents/skills`; configuration is explicit in `.sdd/config.yml`.
- `doctor` and `doctor --smoke` validate local setup, while publishable files are checked for blocked private-context markers.
- Licensing and TLC attribution are documented in [NOTICE](NOTICE) and [LICENSING.md](LICENSING.md).
- Human review remains the final authority.

See [the trust model](docs/trust-model.md) for scope and limits.

## Commands

```text
init [--interactive] [--language ...] Create local configuration
install <pack>                        Install a project-local pack
doctor [--json] [--smoke]             Validate package or project setup
uninstall --plan                      Show only toolkit assets that would be removed
uninstall --apply [--include-config]  Remove installed toolkit assets
list                                  List packs
```

`doctor --json` writes parseable JSON only. `doctor --smoke` validates init, install, preservation, and doctor in an isolated temporary directory.

## Packs

| Pack             | Purpose                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| `core`           | Safe setup, specification, implementation, checking, and validation baseline. |
| `planning`       | Specs and task prompts.                                                       |
| `execution`      | Single-task and multi-task execution guidance.                                |
| `pr`             | PR preparation, review, and finding repair.                                   |
| `multi-worktree` | Multi-task orchestration guidance.                                            |
| `full`           | All public skills.                                                            |

`local-files` and `github` compose packs for those source contexts.

## Execution modes

The toolkit documents five local operating modes: `plan`, `guided`, `apply`, `review`, and `full`. `full` means a coordinated local workflow, not unrestricted autonomy. See [execution modes](docs/execution-modes.md).

## TDD baseline

`sdd-agentic-flow` uses a TLC baseline for planning and specifications and a TDD
baseline for implementation. The TDD baseline uses behavior-focused tests at
agreed public seams through RED → GREEN → REFACTOR loops and vertical slices.
See [TDD baseline](docs/tdd-baseline.md).

## Uninstall and rollback

```bash
npx sdd-agentic-flow@latest uninstall --plan
npx sdd-agentic-flow@latest uninstall --apply
```

Uninstall removes only known installed toolkit skill directories. It preserves specs, reports, snapshots, source code, and unknown paths. Add `--include-config` only when you also want to remove `.sdd/config.yml`. See [uninstall](docs/uninstall.md).

## Who is this for?

This toolkit is optimized for teams adopting Spec Driven Development; sprint feature delivery in agile, scrum, or kanban workflows; tech leads breaking work into specs, tasks, prompts, reviews, and validation; developers delegating traceable work to coding agents; TDD/test-first teams; and controlled multi-agent or multi-worktree work.

## Not optimized for

It is not optimized for quick one-off scripts, fully autonomous no-review agents, automatic deploy/release pipelines, or workflows that do not want specs, task boundaries, review gates, and validation checkpoints.

## Skill map

| Skill                    | Purpose                     | Input            | Output                 | Mutates files?       | Default mode | Recommended when            |
| ------------------------ | --------------------------- | ---------------- | ---------------------- | -------------------- | ------------ | --------------------------- |
| `setup-sdd-agentic-flow` | Setup project configuration | Project context  | Local setup guidance   | Yes, when authorized | guided       | Starting a project          |
| `sdd-create-specs`       | Plan feature specs          | Source item      | Feature spec set       | Yes, when authorized | plan         | Requirements need structure |
| `sdd-create-prompts`     | Generate task prompts       | Specs/tasks      | Agent-ready prompts    | Yes, when authorized | plan         | Work must be delegated      |
| `sdd-implement-task`     | Implement one task          | Approved task    | Code and evidence      | Yes, when authorized | apply        | One bounded task is ready   |
| `sdd-implement-multi`    | Plan multi-task execution   | Task set         | Execution plan         | Yes, when authorized | guided       | Tasks have dependencies     |
| `sdd-task-check`         | Independent task check      | Task evidence    | Check report           | No                   | review       | Before accepting a task     |
| `sdd-create-pr`          | Prepare PR                  | Completed change | PR package             | Yes, when authorized | guided       | Review package is needed    |
| `sdd-pr-review`          | Review PR                   | PR/change set    | Findings               | No                   | review       | Reviewing a change          |
| `sdd-pr-fix`             | Fix PR findings             | Findings         | Corrected local change | Yes, when authorized | apply        | Findings are accepted       |
| `sdd-validation`         | Validate feature            | Feature evidence | Validation report      | No                   | review       | Before completion           |

## Agent workflows

Read the [skills usage guide](docs/sdd-skills-usage-guide.md), [Codex CLI](docs/using-with-codex.md), [Cursor](docs/using-with-cursor.md), [Claude Code](docs/using-with-claude-code.md), and [prompt recipes](docs/prompt-recipes.md). For an optional AI development harness, see [recommended harness](docs/recommended-harness.md).

The skills are Markdown-first and installed locally. See [agent compatibility](docs/agent-compatibility.md) for validated workflows and limits.

## Examples, language, and inspiration

The complete generic [task-management golden example](examples/golden/task-management/) shows a source item through validation. The primary README is English; read the practical [Portuguese introduction](README.pt-BR.md) and [language policy](docs/i18n.md) for the bilingual policy.

The toolkit adapts TLC and TDD baselines and combines Spec Driven Development,
Markdown-first skills, and local safety practices. See [inspirations](docs/inspirations.md),
[NOTICE](NOTICE), [LICENSING.md](LICENSING.md), and the [Portuguese skills guide](docs/sdd-skills-usage-guide.pt-BR.md).

## Safety boundaries

The CLI does not call external APIs, require a tracker, sync remotely, update itself, or perform Git/release operations. It is not a compliance, security, or production-readiness guarantee. Review outputs and local changes before accepting them.

## Publishing

Review locally, then follow [docs/publishing.md](docs/publishing.md). The package never publishes itself.
