# What is Spec-Driven Development?

Spec-Driven Development (SDD) is a workflow for turning a requested outcome into
evidence-based specifications, bounded implementation tasks, independent checks, and
human-gated Git work when you use coding agents.

## The problem

Ad-hoc prompting drifts. Teams lose traceability between intent, code, tests, and review.
Agents fill gaps with guesses when requirements are implicit.

## The basic idea

Write the outcome first: requirements, acceptance criteria, design decisions, and tasks.
Implement one task at a time with sensors at public seams. Check and validate before calling
work done.

## SDD vs "just prompting"

Prompting is an interaction technique. SDD is a process: artifacts, gates, evidence, and
explicit handoffs between human and agent steps.

## What changes when AI is involved?

Agents can implement quickly, but they need boundaries: scope, safety, autonomy level, and
checkpoints. SDD makes those boundaries explicit in repository-local artifacts.

## Typical flow

Plan → Prompt → Implement → Check → PR → Review → Fix → Validate

Skills in the `sdd-agentic-flow` package implement each step. The CLI prepares configuration,
installs skills, and validates setup — it does **not** invoke skills.

## Where sdd-agentic-flow fits

```text
Human → CLI (init, install, doctor, config) → Agent Skills → Coding Agent → Human-gated Git
```

The CLI is a **control plane**: setup, inspect, guide, maintain.

## SDD is a methodology, not a magic prompt

Skills encode conventions (TLC lifecycle, TDD baseline, evidence standards). Success still
requires clear specs and human judgment at gates.

## What SDD does not guarantee

SDD does not replace code review, security review, or release discipline. It does not auto-commit,
auto-push, or hide autonomy behind the CLI.

## Further reading

- [SDD skills usage guide](saf-skills-usage-guide.md)
- [Installation](installation.md)
- [Configuration](configuration.md)
- [Commands reference](commands.md)
