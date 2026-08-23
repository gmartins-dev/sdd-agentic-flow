# Documentation index

Task-oriented map for `sdd-agentic-flow`. Commands, paths, and skill names stay in English everywhere.

## Installation and setup

| Doc | When to read |
| --- | --- |
| [getting-started.md](getting-started.md) | One-command guided setup |
| [what-is-sdd.md](what-is-sdd.md) | Plain-language SDD overview and where the CLI fits |
| [commands.md](commands.md) | CLI command reference |
| [installation.md](installation.md) | First install, pack selection, re-running install safely |
| [installation-scope.md](installation-scope.md) | Choosing `--scope user` vs `--scope project` |
| [configuration.md](configuration.md) | Editing `.sdd-agentic-flow/config.yml`, project context, autonomy fields |
| [environment-compatibility.md](environment-compatibility.md) | Node.js version, OS, shell requirements |
| [uninstall.md](uninstall.md) | Removing installed skills and optional config |
| [compatibility-promise.md](compatibility-promise.md) | Active compatibility contract |

## SDD workflow

| Doc | When to read |
| --- | --- |
| [sdd-agentic-flow-model.md](sdd-agentic-flow-model.md) | One-page mental model, graphs, glossary, and control map |
| [engineering-model.md](engineering-model.md) | Control-plane principles and host boundary |
| [sdd-methodology.md](sdd-methodology.md) | What SDD means in this toolkit and why specs help agents |
| [saf-skills-usage-guide.md](saf-skills-usage-guide.md) | Running the full SDD chain with coding agents |
| [developer-journey.md](developer-journey.md) | Illustrative intent-to-transition developer lifecycle |
| [workflow.md](workflow.md) | Short workflow summary and pointers |
| [invocation-model.md](invocation-model.md) | How skills are invoked and routed |
| [skills-catalog.md](skills-catalog.md) | Full skill reference (purpose, inputs, outputs, packs) |
| [skills.md](skills.md) | Skills layer overview |
| [prompt-recipes.md](prompt-recipes.md) | Copy-paste prompt patterns |
| [tdd-baseline.md](tdd-baseline.md) | TDD baseline overview (detail in shared reference) |
| [engineering-principles.md](engineering-principles.md) | How agents change code (shared contract, not a skill) |
| [spec-lifecycle.md](spec-lifecycle.md) | Resolve one package; load only what the active operation requires |
| [baselines.md](baselines.md) | What this package ships vs external TLC/TDD skills |
| [tlc-integration.md](tlc-integration.md) | How the TLC baseline fits the local workflow |

## Guides

| Doc | When to read |
| --- | --- |
| [guides/choosing-a-feature-profile.md](guides/choosing-a-feature-profile.md) | Picking `small_fix`, `medium_feature`, `large_feature`, or `epic` |
| [guides/adopting-in-a-brownfield-repo.md](guides/adopting-in-a-brownfield-repo.md) | Adding SDD to an existing codebase |
| [guides/condensed-vs-full-tlc-tdd.md](guides/condensed-vs-full-tlc-tdd.md) | Condensed baselines vs full external skills |

## Trust, safety, and autonomy

| Doc | When to read |
| --- | --- |
| [trust-model.md](trust-model.md) | Product trust boundaries (local-first, no telemetry) |
| [safety-model.md](safety-model.md) | Agent behavior rules and safety policy |
| [execution-modes.md](execution-modes.md) | `plan`, `guided`, `apply`, `review`, `full` |
| [autonomy-levels.md](autonomy-levels.md) | `manual`, `supervised`, `autonomous` |
| [autonomy-guardrails.md](autonomy-guardrails.md) | Seven guardrails that gate automatic transitions |

## Agent compatibility

| Doc | When to read |
| --- | --- |
| [agent-compatibility.md](agent-compatibility.md) | Validated agent workflows and limits |
| [host-capabilities.md](host-capabilities.md) | Optional host capabilities and enforcement levels |
| [using-with-cursor.md](using-with-cursor.md) | Cursor setup |
| [using-with-claude-code.md](using-with-claude-code.md) | Claude Code setup |
| [using-with-codex.md](using-with-codex.md) | Codex CLI setup |
| [using-with-vscode-copilot.md](using-with-vscode-copilot.md) | VS Code + GitHub Copilot setup |
| [recommended-harness.md](recommended-harness.md) | Optional companion tooling |

## Architecture and compatibility

| Doc | When to read |
| --- | --- |
| [architecture.md](architecture.md) | CLI, packs, skills, shared layer, consumer project |
| [cli-interaction.md](cli-interaction.md) | Output modes, stdout/stderr, colors, branding vs protocol |
| [cli-terminal-behavior.md](cli-terminal-behavior.md) | TTY, plain output, prompts, terminal capabilities, and interruption |
| [machine-interface.md](machine-interface.md) | JSON envelope, stable tokens, and machine-readable errors |
| [information-representation-model.md](information-representation-model.md) | Authority, persistence, and derived representations |
| [compatibility-promise.md](compatibility-promise.md) | Versioning and capability-contract rules |
| [compatibility-matrix.md](compatibility-matrix.md) | Supported combinations |
| [design-principles.md](design-principles.md) | Design goals |
| [why-this-exists.md](why-this-exists.md) | Problem statement |
| [adapters.md](adapters.md) | Provider-neutral adapter boundary and local source type |
| [domain-vocabulary.md](domain-vocabulary.md) | Domain glossary and language profiles |
| [handoff-standard.md](../shared/references/handoff-standard.md) | When skills write `handoff.md` across session boundaries |
| [evidence-standard.md](../shared/references/evidence-standard.md) | Sensor → evidence → verification → decision; `Status:` field |

## Language and i18n

| Doc | When to read |
| --- | --- |
| [i18n.md](i18n.md) | Bilingual policy |
| [language-profiles.md](language-profiles.md) | `en-US` and `pt-BR` profile contract |
| [language-profiles.pt-BR.md](language-profiles.pt-BR.md) | Same contract in Brazilian Portuguese |
| [saf-skills-usage-guide.pt-BR.md](saf-skills-usage-guide.pt-BR.md) | Usage guide in Brazilian Portuguese |

## Maintainer

| Doc | When to read |
| --- | --- |
| [publishing.md](publishing.md) | Release and npm publish process for this repository |

## Help

| Doc | When to read |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Agent routing for install, workflow, trust, and maintainer branches |
| [faq.md](faq.md) | Common questions |
| [troubleshooting.md](troubleshooting.md) | `doctor` warnings and failures |
| [inspirations.md](inspirations.md) | Curated sources with epistemic roles; project contracts remain authoritative |
