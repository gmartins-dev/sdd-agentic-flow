# Skills catalog

The official bundle contains 12 Agent Skills-compatible capabilities. Each
skill keeps portable `name`, `description`, and `compatibility` frontmatter;
SAF workflow fields live in its deterministic `saf-contract.yml` sidecar.

| Skill | Purpose | Blocking semantic input |
| --- | --- | --- |
| `saf-route` | Recommend the next local workflow step | None |
| `saf-brainstorm` | Converge a vague idea | User intent |
| `saf-create-spec` | Create an implementation-ready spec package | Source item or bounded existing-code scope |
| `saf-create-prompts` | Create bounded task prompts | Spec package |
| `saf-implement` | Implement exactly one task | Task identity and contract |
| `saf-implement-multi` | Coordinate dependency-aware task waves | Spec package and task graph |
| `saf-check-task` | Independently verify one task | Task evidence |
| `saf-create-pr` | Prepare a local task-scoped PR package | Passing task evidence and explicit request |
| `saf-review-pr` | Review one task-scoped change | Change-review package or equivalent diff context |
| `saf-fix-pr` | Repair accepted PR findings | Review findings |
| `saf-validate` | Validate an accumulated feature | Spec package and task evidence |
| `saf-explain` | Explain a specified feature | Spec package |

`.sdd-agentic-flow/config.yml` is optional enrichment for every skill. When it
is absent, skills use the shared effective defaults. Missing semantic inputs
remain blockers. Sidecar `requires`, `consumes`, `produces`, `depends_on`, and
`conflicts` values are validated during repository and package checks.

See [architecture](architecture.md#capability-contracts),
[invocation model](invocation-model.md), and the [usage guide](saf-skills-usage-guide.md).
