# Agent instructions

`sdd-agentic-flow` ships Markdown skills and a local CLI for Spec-Driven Development with coding agents. Pick the branch that matches your task.

## Maintain this repository

You change the toolkit itself (CLI, skills, docs, tests). Read [CLAUDE.md](CLAUDE.md) first for commit rules. Then read [CONTRIBUTING.md](CONTRIBUTING.md) for the validation loop (`npm run check`), local CLI sandboxes, and policy constraints. Consumer-facing skills under `skills/` stay agent-neutral; repo-specific rules live here and in CLAUDE.md.

## Install the toolkit in a project

Run `npx sdd-agentic-flow init`, then `install full`, then `doctor`. Start at [docs/installation.md](docs/installation.md) for pack selection and scope. Read [docs/installation-scope.md](docs/installation-scope.md) before choosing `--scope user` (default, no project footprint) or `--scope project`. See [docs/configuration.md](docs/configuration.md) for `.sdd-agentic-flow/config.yml`.

## Run an SDD workflow

Read [docs/sdd-methodology.md](docs/sdd-methodology.md) for what Spec-Driven Development means in this toolkit. Follow [docs/saf-skills-usage-guide.md](docs/saf-skills-usage-guide.md) for the Plan → Prompt → Implement → Check → PR → Review → Fix → Validate chain. When the next step is unclear, invoke `saf-route`. Read [docs/invocation-model.md](docs/invocation-model.md) for how skills are selected, not chained automatically. Agent-specific setup: [docs/using-with-cursor.md](docs/using-with-cursor.md), [docs/using-with-claude-code.md](docs/using-with-claude-code.md), [docs/using-with-codex.md](docs/using-with-codex.md), [docs/using-with-vscode-copilot.md](docs/using-with-vscode-copilot.md).

## Trust and safety boundaries

Read [docs/trust-model.md](docs/trust-model.md) for what the CLI does and does not do (local-first, no telemetry, no automatic Git). Read [docs/safety-model.md](docs/safety-model.md) for how agents should treat external content and safety policy. For autonomy levels and guardrails, read [docs/autonomy-levels.md](docs/autonomy-levels.md) and [docs/autonomy-guardrails.md](docs/autonomy-guardrails.md).

## Shared references vs docs

Skills are the public capability layer; the coding-agent host owns runtime execution. SAF defines workflow constraints and admissible transitions, while current evidence supports verification before work can advance. Skills load canonical rules from `shared/references/` at install time (TDD baseline, safety, routing, evidence, handoffs). Human-oriented explanations and CLI surfaces live under [docs/](docs/README.md). When a doc points at a shared reference, treat the shared file as the skill contract and the doc as the reader's guide.

## Language

English is canonical for commands, paths, skill names, and technical tokens. Brazilian Portuguese introductions: [README.pt-BR.md](README.pt-BR.md), [docs/saf-skills-usage-guide.pt-BR.md](docs/saf-skills-usage-guide.pt-BR.md), [docs/language-profiles.pt-BR.md](docs/language-profiles.pt-BR.md). See [docs/i18n.md](docs/i18n.md).

## Troubleshooting

If `doctor` reports a `WARN` or `FAIL` you do not understand, read [docs/troubleshooting.md](docs/troubleshooting.md).
