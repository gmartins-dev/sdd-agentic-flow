# Inspirations

## Core inspirations

- TLC / `tlc-spec-driven`
- Spec-Driven Development
- TDD / test-first development
- `mattpocock/skills` public `tdd` skill
- Markdown-first agent skills
- safe-by-default local tooling
- review discipline and anti-slop practices

## What this toolkit incorporates

- TLC-style phase discipline
- traceability, acceptance criteria, and evidence before completion
- staged planning, implementation, review, and validation
- behavior-focused TDD at public seams and vertical slices

## What this toolkit expands

- multi-skill workflow and installable packs
- local CLI, doctor, smoke validation, uninstall model, safety model, and agent-client-agnostic documentation
- optional multi-worktree planning guidance

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
`shared/baselines/registry.yml`, and updated deliberately rather than silently. See
See [Baselines](baselines.md#upstream-version-pins).
