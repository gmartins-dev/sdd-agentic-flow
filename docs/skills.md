# Skills

Each public skill reads `.sdd/config.yml`, uses the internal TLC baseline, and leaves
final authority with the user. Implementation, checking, validation, and prompt skills
also use the [TDD baseline](tdd-baseline.md) for code tasks. Skills are
authored/normalized with `$skill-creator`; users do not need that development-time tool.

Skills resolve shared references from their installed sibling directory and should
return `Blocked` when configuration, task identity, or required evidence is absent.

See the public [skill map](../README.md#skill-map) for purpose, inputs, outputs, mutation behavior, execution modes, and recommended use.
