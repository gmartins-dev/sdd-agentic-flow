# Inspirations

## Core inspirations

- TLC / `tlc-spec-driven`
- Spec-Driven Development
- Behavioral evidence at contractual seams (TDD remains a valid technique)
- `mattpocock/skills` public `tdd` skill
- Markdown-first agent skills
- safe-by-default local tooling
- review discipline and anti-slop practices

## What this toolkit incorporates

- TLC-style phase discipline
- traceability, acceptance criteria, and evidence before completion
- staged planning, implementation, review, and validation
- behavior-focused sensors at contractual seams; TDD ritual optional, never harness proof

## What this toolkit expands

- multi-skill workflow and installable packs
- local CLI, doctor, smoke validation, uninstall model, safety model, and agent-client-agnostic documentation
- optional multi-worktree planning guidance

## Adjacent writing (cited, not copied)

Short pointers to public essays that describe layers this toolkit already implements. They
are not product requirements and are not reproduced here.

- Daniel Moka, *Agentic Engineering 101* (Craft Better Software, 2026) — prompt, context,
  harness, loop, and graph as workflow rails.
- Ruben Hassid, *What is an Agent?* (2026) — an agent as LLM + tools + memory + feedback
  loop, on a spectrum of autonomy.
- Eduardo Spinelli de Lima, *Harness para codebases* (2026) — instruction in context is
  probabilistic; destructive guards belong in deterministic hooks on the **agent product
  you use**, not in this toolkit.
- Birgitta Böckeler / Martin Fowler, *TDD inside the agent loop* (2026) — in that setup,
  forcing the full RED → GREEN ritual did not show a consistent quality win; same-agent RED
  is not semantic proof. Adjacent only: this toolkit does not treat that article as
  project-normative and does not claim TDD is generally worse than test-last.
- Thoughtworks Radar, *Feedback sensors for coding agents*, and Fowler, *Harness
  engineering for coding agent users* — compilers, linters, typecheckers, and test suites
  as session feedback. This toolkit uses **configured** gates; it does not reimplement
  scanners or mutation engines.
- Mathews & Nagappan, *Test-Driven Development for Code Generation* (arXiv:2402.13521) —
  tests **given as input** can improve generation. That is not the same as requiring the
  TDD ritual as verification evidence.

## Interoperability references

- Agent Skills Standard ([agentskills/agentskills](https://github.com/agentskills/agentskills),
  [agentskills.io](https://agentskills.io/home)): an open specification for `SKILL.md`
  frontmatter, structure, and progressive-disclosure conventions shared across multiple AI
  coding clients. `sdd-agentic-flow` was not designed against this standard, but every one of
  its 14 skills already matches its core shape by construction: `name` equal to the skill
  directory, kebab-case, and a `description` following a "what it does. Use when..." pattern.
  Listed here as a compatibility reference, not a claim of formal compliance. No external
  validator has been run against this toolkit's skills. Fields added since (`autonomy_profile`
  in v1.8.0, alongside the pre-existing `extends`/`requires`/`produces`/`depends_on`/`conflicts`)
  stay plain YAML frontmatter, read by no vendor-specific API. The same posture is re-audited
  each time the frontmatter grows rather than assumed to still hold.

## No endorsement

Inspiration and attribution do not imply endorsement by original authors or projects. See [NOTICE](../NOTICE), [LICENSING.md](../LICENSING.md), the adapted [TLC baseline](../shared/references/tlc-baseline.md), and the adapted [TDD baseline](../shared/references/tdd-baseline.md).

Both upstream sources are pinned to a specific version, tracked in
`shared/baselines/registry.yml`, and updated deliberately rather than silently.
See [Baselines](baselines.md#upstream-version-pins).
