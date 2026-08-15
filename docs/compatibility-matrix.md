# Compatibility matrix

The table below re-presents every skill's `compatible_with` frontmatter field.
`scripts/check-skills.sh` mechanically verifies it matches `presets/*.json` membership on every
`npm run check`, so it cannot drift from what a pack actually installs. See the
[compatibility promise](compatibility-promise.md) for what that guarantee does and does not
cover, and [architecture](architecture.md#capability-contracts) for the full contract table.

## Legend

`✓` means **Documented**: the skill declares this pack in its `compatible_with` frontmatter
field, and `scripts/check-skills.sh` mechanically re-verifies that declaration against
`presets/*.json` membership on every `npm run check`, so the mark cannot silently drift from
what the pack actually installs.

`✓` does **not** mean **Verified**: it is not a claim that the skill was manually exercised
against that pack's target agent or workflow. Manual verification is tracked separately in
[agent compatibility](agent-compatibility.md), which lists, per agent, whether user/project
scope and auto-discovery have actually been exercised.

| Skill | core | planning | execution | pr | multi-worktree | full | local-files | github |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `saf-setup`   |  ✓   |    ✓     |           |     |                  |  ✓   |     ✓       |   ✓    |
| `saf-route`                |  ✓   |    ✓     |     ✓     |  ✓  |        ✓         |  ✓   |     ✓       |   ✓    |
| `saf-brainstorm`           |      |    ✓     |           |     |                  |  ✓   |             |        |
| `saf-create-spec`         |  ✓   |    ✓     |           |     |                  |  ✓   |     ✓       |   ✓    |
| `saf-explain`           |      |    ✓     |           |     |                  |  ✓   |             |        |
| `saf-create-prompts`       |      |    ✓     |           |     |                  |  ✓   |             |        |
| `saf-implement`       |  ✓   |          |     ✓     |     |                  |  ✓   |     ✓       |   ✓    |
| `saf-implement-multi`      |      |          |     ✓     |     |        ✓         |  ✓   |             |        |
| `saf-check-task`           |  ✓   |          |     ✓     |     |                  |  ✓   |     ✓       |   ✓    |
| `saf-create-pr`            |      |          |           |  ✓  |                  |  ✓   |             |   ✓    |
| `saf-review-pr`            |      |          |           |  ✓  |                  |  ✓   |             |   ✓    |
| `saf-fix-pr`               |      |          |           |  ✓  |                  |  ✓   |             |   ✓    |
| `saf-validate`           |  ✓   |          |           |     |                  |  ✓   |     ✓       |   ✓    |

`full` installs every skill; every other pack is a scoped subset for a specific workflow slice
(core SDD loop, planning-only, multi-worktree execution, PR review/fix, or an adapter-flavored
bundle). See [Packs](../README.md#packs) for what each pack is for and
[adapters](adapters.md) for what `local-files`/`github` add beyond skill selection.
