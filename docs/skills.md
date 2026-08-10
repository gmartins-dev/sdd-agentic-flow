# Skills

Deciding which skill to use? See the [skills catalog](skills-catalog.md) — Purpose, When to
use/not to use, Inputs/Outputs, Dependencies, Conflicts, Baseline, Pack(s), and flow position
for each of the 14 public skills.

See the [invocation model](invocation-model.md) for orchestration guidance. `sdd-route` is read-only: it recommends a local next skill but does not invoke it.

Each public skill reads `.sdd/config.yml`, uses the internal TLC baseline, and leaves
final authority with the user. Implementation, checking, validation, and prompt skills
also use the [TDD baseline](tdd-baseline.md) for code tasks. Skills are
authored/normalized with `$skill-creator`; users do not need that development-time tool.

Every skill declares a capability contract in its frontmatter (`extends`, `requires`,
`consumes`, `produces`, `baseline`, `compatible_with`). See [architecture](architecture.md)
for the full contract table and how skills, the shared layer, and project context fit
together.

Skills resolve shared references from their installed sibling directory and should
return `Blocked` when configuration, task identity, or required evidence is absent.

See the public [skill map](../README.md#skill-map) for purpose, inputs, outputs, mutation behavior, execution modes, and recommended use.

See the [compatibility matrix](compatibility-matrix.md) for exactly which packs install which
skill. For decision help, see the guides on
[choosing a feature profile](guides/choosing-a-feature-profile.md),
[adopting in a brownfield repo](guides/adopting-in-a-brownfield-repo.md), and
[condensed vs. full TLC/TDD](guides/condensed-vs-full-tlc-tdd.md).
