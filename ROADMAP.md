# Roadmap

- **v0.1:** local-first core and full public skill pack.
- **v0.2:** Adoption & Trust Release: interactive setup, local validation, rollback, agent docs, and public examples.
- **v0.3:** Language Profiles & Brazilian Workflow Release.
- **v0.4:** TDD Implementation Baseline.
- **v0.5:** Workflow Navigation & Task Quality.
- **v0.6:** Foundation Architecture Release — capability contracts, a baseline registry,
  project discovery and context, feature profiles, and a baseline compliance gate.
- **v0.7:** Operational Excellence (start) — capability contracts v2 (`depends_on`/`conflicts`
  plus consumer-side `doctor --contracts`), light artifact contracts, Project Discovery 2.0
  (architecture/CI/platform signals), an agent-neutrality regression guard and action
  vocabulary, the first decision guides and a compatibility matrix, and the
  `sdd-reverse-engineer` skill.
- **v0.8:** Flow Consolidation & Dynamic Project Context Release — resolved
  `sdd-reverse-engineer`'s place in the Flow by merging it into `sdd-create-specs` as an
  existing-code mode, restoring a single entry point for the Specification step (12 skills →
  11). Also formalized Dynamic Project Context:
  `project-context.md` now carries provenance (generated-at, repository revision, branch), with
  new `context status`/`context refresh` commands to inspect and regenerate it explicitly,
  additive to the unchanged `discover [--force]`. Deliberately no Context Indexing, Context
  Query, knowledge graph, RAG, or vector database — those remain out of scope for the core
  product, to protect the toolkit's focused SDD-flow identity.

The project remains in beta and active construction. Future beta scope is open and
will be defined from validated needs rather than assumed in advance.

- **v0.8–v0.9:** skill cards, maturity model documentation, and adapters beyond
  `local-files`/`github` (Jira, Linear, Azure DevOps) remain open for this range.
- **v1.0:** public go-live, with an explicit stability commitment for skill contracts
  and baseline versions (see [compatibility promise](docs/compatibility-promise.md)).
