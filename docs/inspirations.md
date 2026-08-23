# Inspirations

These sources inform the design of `sdd-agentic-flow`; they are not normative specifications. The project’s own contracts, baselines, and compatibility guarantees remain authoritative.

## Authority hierarchy

1. **Normative** — this repo’s contracts and baselines (`shared/references/*`,
   [compatibility promise](compatibility-promise.md))
2. **Methodological** — TLC Spec-Driven
3. **Architectural** — harness / feedback sensors / humans-on-the-loop
4. **Empirical** — tests-as-input, false-success, eval validity
5. **Practice** — Anthropic Claude Code expertise
6. **Interop / CLI craft** — Agent Skills Standard; CLIG as adjacent CLI craft
7. **Landscape** — Awesome-Issue-Solving as a **map of the field**, not a backlog

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
- optional multi-task isolation guidance

## Curated sources by role

Working URLs validated 2026-08-13 unless noted. Role tags are epistemic, not a
second specification.

### Methodological

- TLC Spec-Driven
  ([agent-skills.techleads.club](https://agent-skills.techleads.club/skills/tlc-spec-driven/))
  — Specify → Discuss → Design → Tasks → Execute → Verify. Condensed locally;
  this repo’s TLC baseline is authoritative.

### Architectural

- Martin Fowler, *Harness engineering for coding agent users*
  ([martinfowler.com](https://martinfowler.com/articles/harness-engineering.html))
- Thoughtworks Radar, *Feedback sensors for coding agents*
  ([thoughtworks.com](https://www.thoughtworks.com/radar/techniques/feedback-sensors-for-coding-agents))
  — compilers, linters, typecheckers, and test suites as session feedback. This
  toolkit uses **configured** gates; it does not reimplement scanners or mutation
  engines.
- Kief Morris, *Humans and Agents in Software Engineering Loops*
  ([martinfowler.com](https://martinfowler.com/articles/exploring-gen-ai/humans-and-agents.html))
  — humans remain on the loop. Adjacent framing, not a product spec.
- DeepSeek Harness, Eve, Graph/Loop, harness-score, AI-DLC, and Oracle Agent
  Spec are landscape references: SAF borrows the need for explicit evidence and
  human authority, not their runtime, score, ontology, or ceremony models.

### Empirical

- Mathews & Nagappan, *Test-Driven Development for Code Generation*
  ([arXiv:2402.13521](https://arxiv.org/abs/2402.13521)) — tests **given as
  input** can improve generation. That is not the same as requiring the TDD
  ritual as verification evidence.
- Piya & Sullivan, *LLM4TDD* ([arXiv:2312.04687](https://arxiv.org/abs/2312.04687))
  — tests / prompts / problem shape affect outcomes. Separate “tests as
  information” from “TDD as ritual.”
- *TDFlow* ([arXiv:2510.23761](https://arxiv.org/abs/2510.23761)) — strong
  results when human tests are the target. This toolkit stays **compatible with
  TDD**; it does not treat the ritual as epistemic proof, and it does not claim
  TDD is worse than test-last.
- *SWT-Bench* ([arXiv:2406.12952](https://arxiv.org/abs/2406.12952)) — generated
  tests can filter candidate patches. Tests are sensors, not infallible oracles.
- Konstantinou, Tambon & Papadakis, *On the risk of coding before testing*
  ([arXiv:2607.05139](https://arxiv.org/abs/2607.05139)) — same-model
  implementation → tests can propagate error. The oracle must be grounded in
  an independent authority (spec, contracts, configured gates).
- Laksh Advani, *From Confident Closing to Silent Failure: Characterizing False
  Success in LLM Agents* ([arXiv:2606.09863](https://arxiv.org/abs/2606.09863),
  2026) — agents can assert completion while environment state disagrees; LLM
  judges grade the story, not the state. Adjacent only: those percentages are
  not this toolkit’s measured risk. Do not ask the agent whether it finished;
  observe current sensors. Do not add another LLM-judge as a verifier.
- Wang, Pradel & Liu, *Are “Solved Issues” in SWE-bench Really Solved
  Correctly?*
  ([PDF](https://software-lab.org/publications/icse2026_SWE-bench-correctness.pdf))
  — GREEN on a benchmark is not the same as matching intent.
- OpenAI, *Separating signal from noise in coding evaluations*
  ([openai.com](https://openai.com/index/separating-signal-from-noise-coding-evaluations/))
  — automated clients may see 403; the URL is the public article. Eval design
  can inflate apparent success. Adjacent only.

### Practice

- Anthropic, *Agentic coding and persistent returns to expertise* (Claude Code
  expertise)
  ([anthropic.com](https://www.anthropic.com/research/claude-code-expertise))
  — practice report, not a specification for this toolkit.

### Interop / CLI craft

- Agent Skills Standard ([agentskills/agentskills](https://github.com/agentskills/agentskills),
  [agentskills.io](https://agentskills.io/home)): an open specification for
  `SKILL.md` frontmatter, structure, and progressive-disclosure conventions
  shared across multiple AI coding clients. Listed as a compatibility
  reference, not a claim of formal compliance. See the longer paragraph under
  [Interoperability references](#interoperability-references).
- Command Line Interface Guidelines (CLIG) ([clig.dev](https://clig.dev/)) —
  adjacent CLI craft (TTY vs machine, actionable errors). Not a copied spec.

### Landscape

- Awesome-Issue-Solving ([Zhonghao Jiang](https://github.com/ZhonghaoJiang/Awesome-Issue-Solving))
  — a **map** of scaffold design, process-aware evaluation, and failure modes
  in agentic issue solving. It is **not a commitment** to implement
  localization, reproduction engines, patch selection, or multi-agent runtimes
  in this toolkit.

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
- Kiro, *Spec correctness / property-based testing* — properties/invariants as a way to
  state “always true” rules; PBT is evidence, not proof. Adjacent only: this toolkit does
  not ship a PBT engine and does not require a `## Invariants` spec header. Kiro is
  **not a runtime to copy**; this package ships a portable workflow contract, not an
  agent runtime.
- Spec Kit and OpenSpec appear here as **landscape** (how other toolkits persist or archive
  specs). This toolkit does **not** copy Spec Kit’s folder conventions or OpenSpec’s
  delta → canonical layout; packages stay under `.specs/features/<slug>/`.

Fowler harness engineering, Thoughtworks feedback sensors, Mathews & Nagappan, and Advani
are listed with role tags under [Curated sources by role](#curated-sources-by-role) rather
than duplicated here.

## Interoperability references

- Agent Skills Standard ([agentskills/agentskills](https://github.com/agentskills/agentskills),
  [agentskills.io](https://agentskills.io/home)): an open specification for `SKILL.md`
  frontmatter, structure, and progressive-disclosure conventions shared across multiple AI
  coding clients. `sdd-agentic-flow` was not designed against this standard, but every one of
  its 13 skills already matches its core shape by construction: `name` equal to the skill
  directory, kebab-case, and a `description` following a "what it does. Use when..." pattern.
  Listed here as a compatibility reference, not a claim of formal compliance. No external
  validator has been run against this toolkit's skills. Fields such as `autonomy_profile`,
  alongside `extends`/`requires`/`produces`/`depends_on`/`conflicts`,
  stay plain YAML frontmatter, read by no vendor-specific API. The same posture is re-audited
  each time the frontmatter grows rather than assumed to still hold.

## No endorsement

Inspiration and attribution do not imply endorsement by original authors or projects. See [NOTICE](../NOTICE), [LICENSING.md](../LICENSING.md), the adapted [TLC baseline](../shared/references/tlc-baseline.md), and the adapted [TDD baseline](../shared/references/tdd-baseline.md). This toolkit did not ingest obra/superpowers or web-quality-skills as a catalog; SWE-Skills-Bench is a reason not to grow generic skills.

Both upstream sources are pinned to a specific version, tracked in
`shared/baselines/registry.yml`, and updated deliberately rather than silently.
See [Baselines](baselines.md#upstream-version-pins).
