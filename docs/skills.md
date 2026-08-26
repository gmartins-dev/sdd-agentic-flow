# Skills

The official bundle contains 12 skills. See the [skills catalog](skills-catalog.md)
for purpose, semantic inputs, and outputs, and the
[invocation model](invocation-model.md) for orchestration guidance.

Each `SKILL.md` uses portable Agent Skills frontmatter. SAF workflow metadata
lives in `saf-contract.yml`. Shared references provide TLC/TDD, safety, routing,
evidence, and effective-default contracts.

`.sdd-agentic-flow/config.yml` is optional. When absent, every skill uses the
canonical defaults. Missing task identity, spec packages, findings, or required
evidence remains a blocker.

Skills resolve shared references from the installed sibling directory and
leave external or irreversible authority with the user and host.

See [architecture](architecture.md), [compatibility matrix](compatibility-matrix.md),
and [usage guide](saf-skills-usage-guide.md).
