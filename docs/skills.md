# Skills

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
