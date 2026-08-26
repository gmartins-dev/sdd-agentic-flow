# Information representation model

Status: active architecture contract for SAF

This document is the broad architecture and audit owner for how SAF information is represented,
materialized, persisted, communicated, and projected. Narrow structural contracts remain owned by
their existing references.

## Core rule

Meaning determines representation. Authority determines persistence. Consumer determines parsing
strictness. Projection never becomes authority.

**Markdown-first means engineering intent remains directly human- and agent-readable. It does not
mean every SAF state domain must use Markdown.** A representation is selected for a concrete
consumer, authority, editing, durability, and parsing need; no new format is introduced without a
concrete consumer or authority requirement.

## Terms

| Term | Meaning |
| --- | --- |
| Contract kind | A logical information object named by a SAF contract, such as `spec-package` or `check-report`. |
| Artifact | A durable information object with a repository, project, user, host, or feature scope. |
| Materialization | A concrete realization of a contract kind, such as a file-set or host response. |
| Representation | The syntax or encoding used by a materialization, such as Markdown, JSON, or constrained YAML-compatible text. |
| Projection | A derived, regenerable materialization that is not the authority for the facts it displays. |
| Authority | The owner that canonically defines a fact or supported subset of facts. |
| Origin | Descriptive provenance of information: human-authored, SAF-authored, repository-derived, host-produced, or external; multiple origins may coexist. |

A logical output is not automatically a file. A route recommendation is a host response; a spec
package is a persistent composite file-set; implementation evidence is a composite repository
state. The materialization dimensions below remain independent.

## Materialization dimensions

| Dimension | Allowed conceptual values |
| --- | --- |
| Carrier | `file`, `file-set`, `repository-state`, `host-response`, `process-output` |
| Composition | `atomic`, `composite` |
| Projection | `source`, `yes` |
| Durability | `persistent`, `ephemeral` |

Examples:

| Logical kind | Carrier | Composition | Projection | Durability |
| --- | --- | --- | --- | --- |
| `spec-package` | file-set | composite | source | persistent |
| `route-recommendation` | host-response | atomic | source | ephemeral |
| Evidence Graph HTML | file | atomic | yes | persistent |
| code-change+tdd-evidence | repository-state | composite | no | persistent |

Composition, editability, machine interpretation, and embedded formats are separate dimensions.
`SKILL.md` is compositional because Agent Skills frontmatter is combined with a Markdown body;
`loop-state.md` is a single human-editable Markdown control representation that is also
machine-interpreted.

## Representation classes

### Semantic artifacts

Narrative meaning, rationale, decisions, requirements, and evidence interpretation normally use
Markdown. The format is intentionally inspectable by people and coding agents, and its authority
comes from the owning artifact contract rather than from a renderer.

### Human-declarative state

Exact fields that humans intentionally inspect or edit use constrained SAF-owned YAML-compatible
text only where the current domain contract already does so. The representation is not a claim of
arbitrary YAML support.

### Machine contracts

Exact programmatic interchange uses JSON by default when deserialization dominates and human
editing is not part of the operational contract. Packs, evaluation corpora, manifests, and CLI
machine output follow this rule.

### Projections and exports

HTML, Mermaid, and future CSV views are derived outputs. They can be regenerated, are not canonical
owners, and must preserve the security and escaping boundaries of their existing producers.

## Interpretation levels

| Level | Meaning | Current use |
| --- | --- | --- |
| L0 | Opaque content; the consumer does not interpret structure. | Allowed for narrative payloads outside a named contract. |
| L1 | Landmark-aware structure such as headings, identifiers, and required sections. | Current Markdown artifact contracts and skill sections. |
| L2 | Bounded structured regions inside a broader artifact. | Reserved in this release; no current artifact contract declares one. |
| L3 | Fully structured contract with complete constrained parsing. | JSON machine envelopes and narrow SAF-owned state profiles where documented. |

An illustrative YAML or JSON fence in documentation does not declare an L2 semantic island. A
current contract may adopt an L2 island only through a future scoped requirement with a concrete
consumer, authority, parser boundary, and regression evidence.

## Authority and synchronization

Each canonical fact has one authority. A file-set may be the authority for a package while a
summary, handoff, HTML view, Mermaid diagram, or CLI response projects selected facts from it.
Synchronization direction is one-way from authority to projection. A projection may be deleted and
regenerated; it must not silently become a second writer or an alternative interpretation.

The shared artifact contract owns mechanically recognizable landmarks. The skill-authoring
reference owns universal closeout semantics. The machine-interface document owns CLI JSON. The
evidence contract owns freshness semantics. This model relates those owners; it does not replace
them with a global database or registry.

## Selection and persistence criteria

Choose a representation by answering, in order:

1. What meaning or exact field set must be carried?
2. Which producer and consumer own the contract?
3. Must a human intentionally edit it, or does exact deserialization dominate?
4. Is it atomic or composite, persistent or ephemeral, source or projection?
5. What parsing strictness and round-trip guarantee does the current implementation provide?
6. What authority, origin, freshness, invalidation, and regeneration behavior must be visible?

Persisted formats should state newline behavior, canonical ordering, unknown-field handling,
comment preservation, atomicity, and round-trip semantics. Future consequential structured-state
writers should prefer deterministic atomic replacement. Existing direct-write behavior is not
changed merely for consistency in this release.

## SAF Markdown profile

The supported semantic baseline is:

- ATX headings;
- paragraphs;
- lists;
- links;
- fenced code blocks; and
- code spans.

The explicit extension is GFM-style pipe tables where an artifact contract requires them. SAF must
not claim strict CommonMark conformance while pipe tables are normative; pipe tables are an
extension beyond the [CommonMark specification](https://spec.commonmark.org/0.31.2/).

Mermaid fenced blocks are projection-only. Raw HTML structure, MDX/JSX, host-specific directives,
vendor embeds, and renderer-only state are not semantic authority. Existing Markdown files do not
change extension or serialization format because another representation appears more structured.

## SAF-owned YAML-compatible profiles

SAF-owned YAML-compatible formats use the narrow common posture below:

- UTF-8;
- one document;
- simple mappings and simple sequences;
- controlled scalars and quoting; and
- no anchors, aliases, custom tags, merge keys, or multi-document streams.

The `.yml` extension is a storage choice, not a claim of arbitrary [YAML 1.2.2](https://yaml.org/spec/1.2.2/)
support. Agent Skills frontmatter is not a SAF-owned YAML profile; `SKILL.md` remains governed by
the [Agent Skills specification](https://agentskills.io/specification).

Round-trip terms are precise:

| Term | Meaning |
| --- | --- |
| `none` | There is no write-back contract. |
| `structural` | Recognized structure survives, but formatting and comments may not. |
| `semantic` | The meaning of supported fields survives read/write. |
| `lossless` | Unmodified information survives except for explicitly documented normalization. |

### `config.yml` / saf-config/v3

`src/config-domain.ts` recognizes the schema, workflow execution/autonomy fields, feature profile,
and language profile needed by current policy checks. It uses targeted textual mutation for
`execution_mode` and `autonomy_level`, preserving unrelated content and existing layout around
those fields. Unknown content is retained by targeted mutation; missing or invalid recognized
fields fail closed. The current guarantee is **semantic for supported policy fields and structural
for the surrounding document**, not lossless normalization of every possible YAML construct.

### Install intent / saf-install-intent/v3

`src/install-domain.ts` accepts one document with `schema`, `user.targets`, and
project profiles containing canonical `git_common_dir`, `project_relative_path`, and
`adoption_mode`. It emits stable ordering and rejects non-current schemas before operational reuse.

### Install provenance / saf-install-provenance/v3

`src/upgrade.ts` writes schema, package/version identity, apply state, scope/target, skill identity,
and lists for managed skills and managed paths. It emits stable field/list ordering and a
final newline, and persists through a temporary file followed by rename. The reader recognizes
supported scalars/lists and ignores unsupported content rather than claiming general YAML parsing.
The supported-field guarantee is **semantic** and the canonical serialization is **structural**.

## Machine interfaces and hybrid artifacts

`docs/machine-interface.md` owns CLI JSON. Operational JSON emits one locale-independent document
with `schema_version`, `cli_version`, `command`, and `ok`; technical keys, enums, status tokens,
and error codes are canonical English tokens. JSON output never grants mutation authority, prompts,
emits ANSI, or mixes progress with the document.

`SKILL.md` combines external Agent Skills frontmatter with a Markdown body. `loop-state.md` is the
human-readable, human-editable, machine-interpreted, append-oriented control state under
`.sdd-agentic-flow/autonomy/`; its representation does not change in this release.

Packs and evaluation corpora are JSON because exact programmatic loading is their primary consumer.
The CLI, not its JSON projection, remains the authority for mutation policy and execution.

## Projections and security boundary

Evidence Graph HTML and Mermaid diagrams are derived projections. Evidence Graph HTML remains
offline: no network resources, no executable JavaScript, no CSP relaxation, and no new embedded-data
runtime. HTML escaping and Mermaid validation remain owned by their existing projection tests.
Regeneration never grants a projection authority over specs, code, or evidence.

## Origin, freshness, and invalidation

Origin is descriptive rather than a closed enum. A document may combine human-authored intent,
SAF-authored scaffolding, repository-derived context, host-produced output, and external evidence.
The owner records whichever sources matter without duplicating them as competing authorities.

Freshness and invalidation are domain-specific. Evidence freshness remains governed by
`shared/references/evidence-standard.md`; there is no universal `current`/`stale` vocabulary for
all artifacts. Project context reports repository provenance and can be refreshed. Projections are
regenerable and become stale when their authority changes, but they do not acquire authority by
being newer.

## Contract-kind inventory

The exact vocabulary below is owned by `src/contract-kinds.ts` and is limited to the `requires`,
`consumes`, and `produces` fields of official SAF skill contracts. It is not a registry for
baselines, autonomy evidence/blocking tokens, skill statuses, finding states, sensor classes, or
configuration enums.

| Token | Current materialization/classification |
| --- | --- |
| `config` | persistent project-control file; required input |
| `source-item` | source item/process input; required input |
| `task-identity` | ephemeral task selection; required input |
| `task-evidence` | composite task evidence; required input |
| `spec-package` | persistent feature-workspace file-set; source contract |
| `discovery-state` | persistent feature-workspace discovery materialization; optional context |
| `spec-ready-brief` | persistent or ephemeral discovery handoff; optional context |
| `domain-glossary` | project/user context file; optional context |
| `project-context` | project-control generated file; optional or produced context |
| `route-recommendation` | ephemeral host response; produced projection-like response, not durable authority |
| `project-config` | persistent project-control configuration; produced artifact |
| `task-prompts` | persistent feature-workspace prompts; produced handoff |
| `code-change+tdd-evidence` | persistent composite repository-state evidence |
| `explanation` | persistent or ephemeral human-facing document; produced projection |
| `execution-plan` | persistent feature-workspace orchestration plan; produced artifact |
| `multi-task-evidence` | composite repository-state/process output; produced evidence |
| `check-report` | persistent task report with landmarks; produced durable artifact |
| `change-review-package` | persistent task review package; produced durable artifact |
| `review-findings` | persistent task review ledger; produced durable artifact |
| `fix-evidence` | composite task evidence; produced repository-state output |
| `validation-report` | persistent feature validation report with landmarks; produced durable artifact |

`route-recommendation`, `task-identity`, and other ephemeral/composite entries are intentionally
included in the logical vocabulary but are not automatically durable artifact contracts. The
artifact-contract reference covers only its landmarked persisted materializations.

## Audited representation matrix

| Domain | Producer / consumers | Authority | Scope/residency | Editability / level | Carrier / composition | Representation / round-trip |
| --- | --- | --- | --- | --- | --- | --- |
| `SKILL.md` and shared references | bundle source; hosts and skills consume | source file and external Agent Skills spec for frontmatter | package / host installation | human-readable; L1 hybrid | file / composite | YAML frontmatter + Markdown; external contract |
| `context.md`, `discovery.md`, `brief.md` | spec skills; agents/humans | feature workspace artifact | feature-workspace | human-editable; L1 | file / atomic | Markdown landmarks; structural |
| `spec.md`, `design.md`, `tasks.md` | spec skill; implementation/check/validate | respective SDD artifact | feature-workspace | human/agent-readable; L1 | file-set / composite | Markdown/GFM tables; structural |
| prompts, checks, validation, review, fix, handoff | workflow skills; later workflow stages | each named report/package owner | feature-workspace or `.sdd-agentic-flow/reports` | human-readable; L1 | file or file-set / atomic or composite | Markdown landmarks; structural |
| `config.yml` | init/config; CLI/doctor | config domain | project-control | human-editable and machine-interpreted; L3 narrow | file / atomic | SAF-owned YAML-compatible text; semantic supported fields |
| install intent | install/setup; install/upgrade/uninstall | install domain | user | machine-maintained, inspectable; L3 narrow | file / atomic | SAF-owned YAML-compatible text; semantic/structural |
| install provenance | install/upgrade/doctor | provenance writer/reader | host-installation | machine-maintained, inspectable; L3 narrow | file / atomic | SAF-owned YAML-compatible text; semantic/structural |
| `loop-state.md` | autonomous host; resume/doctor | host execution state | project-control | human-editable, machine-interpreted; L1 hybrid | file / atomic | Markdown control text; no write-back migration |
| skill sidecars/manifests | package/CLI; machine loaders | YAML/JSON source files | package / host installation | machine-oriented; L3 | file / atomic | restricted YAML or JSON; exact contract parsing |
| CLI `--json` | CLI; scripts/automation | CLI command implementation | ephemeral process output | machine-oriented; L3 | process-output / atomic | one JSON document; no mutation authority |
| Evidence Graph HTML | graph producer; human browser | source specs/code/reports | project-control projection | not hand-authored; derived | file / atomic | offline escaped HTML; regenerable |
| Mermaid diagrams | docs/templates; renderer/human | Markdown source/template | package documentation projection | not authority; derived | embedded block / atomic | Mermaid fence; regenerable |

The following expanded audit records the remaining fields required for every entry: purpose,
origin, mutation owner/pattern, freshness/invalidation, regenerability, and outer/embedded or
external representations. `—` means the dimension has no applicable contract rather than an
unknown value.

| Domain | Purpose | Producer / consumers | Authority / origin / scope | Editability / mutation owner | Level / round-trip / freshness | Regenerability | Carrier / composition / derivation / durability | Outer / embedded / external |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Skills and shared references | durable instructions and capability contracts | package source / hosts, skills | source files / human + SAF-authored / package and host | human-editable; maintainer/source update | L1 / structural / source freshness | package can be rebuilt | file-set / composite / source / persistent | Markdown file with Agent Skills frontmatter / external Agent Skills spec |
| Discovery and context artifacts | cheap discovery and project/feature context | discovery/context skills / spec skills and agents | named artifact / human + repository-derived / feature or project | human/agent edit; owning workflow writes | L1 / structural / repository refresh where applicable | context can be regenerated; discovery is not inferred | file or file-set / atomic or composite / source / persistent | Markdown / none / SDD lifecycle references |
| Normative spec package | requirements, design, and task authority | `saf-create-spec` / prompts, implementation, checks, validation | `spec.md`, `design.md`, `tasks.md` / human + agent-authored / feature-workspace | workflow-owned files; spec skill owns creation | L1 / structural / changes invalidate downstream evidence | can be regenerated only through living-spec update | file-set / composite / source / persistent | Markdown with GFM tables / none / artifact-contracts reference |
| Prompts and handoffs | bounded execution transfer | prompt/implementation skills / coding agents | prompt or handoff artifact / agent-authored + human constraints / feature-workspace | producing skill writes; later skill reads | L1 / structural / stale when task/spec changes | regenerable from spec/tasks, not authority | file or file-set / atomic or composite / derived handoff / persistent | Markdown / none / prompt and handoff standards |
| Checks, reviews, fixes, validations | current evidence and decision support | check/review/fix/validate skills / later gates and humans | each report for its result; spec remains oracle / repository-derived + agent-authored / feature or report scope | producing skill writes; no report-only mutation authority | L1 / structural / evidence contract controls freshness | rerunnable from current state; reports are snapshots | file or repository-state / atomic or composite / evidence projection / persistent | Markdown landmarks / none / evidence/artifact contracts |
| Project config | optional workflow policy and feature profile | config / CLI and doctor | config domain / human-authored / project-control | targeted config-domain mutation | L3 narrow / semantic supported fields, structural surroundings / read before mutation | absent config resolves to built-in defaults | file / atomic / source / persistent | constrained YAML-compatible text / none / saf-config/v3 |
| Install intent | user/project installation intent | configure / install, upgrade, uninstall | install-domain serializer/reader / human-authored + SAF-authored / user | install-domain writer; temp-file/rename | L3 narrow / semantic supported fields, structural serialization / schema or intent change | serializer can rewrite canonical form | file / atomic / source / persistent | constrained YAML-compatible text / none / saf-install-intent/v3 |
| Install provenance | ownership and managed-path record | install/upgrade / doctor, uninstall, cleanup | provenance writer/reader / SAF-authored + host-produced / host-installation | upgrade/install writer; temp-file/rename | L3 narrow / semantic supported fields, structural serialization / package or apply-state change | writer can regenerate from install result | file / atomic / source / persistent | constrained YAML-compatible text / none / saf-install-provenance/v3 |
| Loop state | autonomous resume and guardrail control | host runtime / resume and doctor | host loop-state writer / human + host-produced / project-control | human/host edit; append-oriented control pattern | L1 / none beyond named fields / invalidated by new execution state | not disposable during an active run; no migration | file / atomic / source / persistent | Markdown control text / none / autonomy guardrails reference |
| Packs, evals, manifests | exact machine loading and packaging | package source / CLI and test loaders | JSON source files / SAF-authored + repository-derived / package or host | maintainer/source update | L3 / lossless within JSON contract / package version change | regenerated from source only when explicitly owned | file / atomic / source / persistent | JSON / none / RFC 8259 boundary |
| CLI JSON | deterministic process interchange | CLI / scripts and automation | CLI command implementation / host-produced / ephemeral process | not human-edited; CLI owns output | L3 / none / each invocation is fresh | rerun command; output is not state | process-output / atomic / projection / ephemeral | JSON envelope / command data / machine-interface document |
| Evidence Graph HTML | human-readable traceability projection | graph producer / browser and reviewers | specs/code/reports remain authority / repository-derived + SAF-authored / project-control | not hand-authored; graph producer owns | L1 projection / none / stale when source evidence changes | yes, regenerate from graph inputs | file / atomic / derived / persistent | escaped offline HTML / serialized graph data / HTML security boundary |
| Mermaid diagrams | renderable documentation visualization | templates/docs / Mermaid renderer and humans | Markdown source/template / human-authored + SAF-authored / package docs | maintainer/template owner | L1 projection / none / stale when source diagram changes | yes, sync/render from source | embedded block / atomic / derived / persistent | Markdown fence / Mermaid syntax / Mermaid renderer |

## Deferred and out of scope

This release does not adopt structured islands, migrate extensions, add JSON sidecars, create an
append-only runtime event stream, install a full YAML parser, normalize all writers, add a broad
generated documentation system, or create a new public skill. These require independent concrete
consumer/authority decisions and regression evidence.
