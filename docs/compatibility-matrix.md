# Pack matrix

Skills define intrinsic capabilities. Installation packs define distribution only; pack
membership is not duplicated in `SKILL.md` frontmatter. `npm run skills:lint` validates the
pack registry against `OFFICIAL_SKILLS` and verifies that `full` is the complete roster.

| Pack | Purpose | Skills |
| --- | --- | --- |
| `planning` | discovery, specification, explanation, and prompt creation | `saf-setup`, `saf-route`, `saf-brainstorm`, `saf-create-spec`, `saf-create-prompts`, `saf-explain` |
| `execution` | single-task implementation and feature validation | `saf-route`, `saf-implement`, `saf-check-task`, `saf-validate` |
| `review` | local change-review workflow | `saf-route`, `saf-create-pr`, `saf-review-pr`, `saf-fix-pr` |
| `multi-task` | dependency-aware multi-task execution | `saf-route`, `saf-implement`, `saf-implement-multi`, `saf-check-task`, `saf-validate` |
| `full` | complete SAF workflow | all 13 official skills |

`full` is the recommended capability set. Operating policy is separate: guided onboarding
defaults to `full + supervised`; non-interactive fail-safe operation uses `full + manual`.

The current pack set is clean-slate. `core`, `local-files`, `github`, `pr`, and `multi-worktree`
are not aliases or supported pack IDs.
