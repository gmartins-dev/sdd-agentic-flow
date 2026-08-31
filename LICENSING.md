# Licensing map

| Area                                                                         | License          | Notes                                                                                                                                                                      |
| ---------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`, `dist/`, `scripts/`, package metadata                                | MIT              | Original package code.                                                                                                                                                     |
| `docs/`, templates, examples, presets                                        | MIT              | Original public content unless marked otherwise.                                                                                                                           |
| `shared/references/tlc-baseline.md`                                          | CC-BY-4.0        | Adapted methodology with attribution in `NOTICE`. Upstream `tlc-spec-driven` pinned at `metadata.version: 3.3.0`.                                                          |
| `shared/references/tdd-baseline.md`                                          | Attribution only | Inspired by `mattpocock/skills`; no separate source license claim is made. Upstream `tdd` skill carries no version of its own — pinned at repository release tag `v1.2.3`. |
| Skills referring to the baseline                                             | MIT              | Original workflow instructions; they preserve the baseline attribution.                                                                                                    |
| Bundled CLI UI (`@clack/prompts`, `@clack/core`, `picocolors`, `sisteransi`) | MIT/ISC          | Build-time dependencies bundled into the self-contained CLI; full notices in `LICENSES/CLI-UI-BUNDLED.txt`.                                                                |

The package metadata uses MIT for original code. Reusers of adapted baseline material
must preserve its CC-BY-4.0 attribution and license notice.

Upstream version pins are tracked machine-readably in `shared/baselines/registry.yml`
(`upstream_version` per baseline) and only change deliberately, alongside a review of whether
`shared/references/tlc-baseline.md`/`tdd-baseline.md` need to follow — never a silent bump.
