# Compatibility matrix

This table is a direct re-presentation of every skill's `compatible_with` frontmatter field —
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
[docs/publishing.md](publishing.md) ("Codex CLI, Claude Code, and Cursor-style workflows were
manually validated as of v0.6.0").

| Skill                     | core | planning | execution | pr  | multi-worktree | full | local-files | github |
| -------------------------- | :--: | :------: | :-------: | :-: | :-------------: | :--: | :---------: | :----: |
| `setup-sdd-agentic-flow`   |  ✓   |    ✓     |           |     |                  |  ✓   |     ✓       |   ✓    |
| `sdd-route`                |  ✓   |    ✓     |     ✓     |  ✓  |        ✓         |  ✓   |     ✓       |   ✓    |
| `sdd-create-specs`         |  ✓   |    ✓     |           |     |                  |  ✓   |     ✓       |   ✓    |
| `sdd-reverse-engineer`     |  ✓   |          |           |     |                  |  ✓   |             |        |
| `sdd-create-prompts`       |      |    ✓     |           |     |                  |  ✓   |             |        |
| `sdd-implement-task`       |  ✓   |          |     ✓     |     |                  |  ✓   |     ✓       |   ✓    |
| `sdd-implement-multi`      |      |          |     ✓     |     |        ✓         |  ✓   |             |        |
| `sdd-task-check`           |  ✓   |          |     ✓     |     |                  |  ✓   |     ✓       |   ✓    |
| `sdd-create-pr`            |      |          |           |  ✓  |                  |  ✓   |             |   ✓    |
| `sdd-pr-review`            |      |          |           |  ✓  |                  |  ✓   |             |   ✓    |
| `sdd-pr-fix`               |      |          |           |  ✓  |                  |  ✓   |             |   ✓    |
| `sdd-validation`           |  ✓   |          |           |     |                  |  ✓   |     ✓       |   ✓    |

`full` installs every skill; every other pack is a scoped subset for a specific workflow slice
(core SDD loop, planning-only, multi-worktree execution, PR review/fix, or an adapter-flavored
bundle). See [Packs](../README.md#packs) for what each pack is for and
[adapters](adapters.md) for what `local-files`/`github` add beyond skill selection.
