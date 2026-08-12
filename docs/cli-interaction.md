# CLI interaction contract

How `sdd-agentic-flow` presents output to humans and machines. This is presentation
policy, not a second command surface.

**Branding is presentation, never protocol.** Exit codes, flags, and `doctor --json`
shape are frozen by [compatibility-promise.md](compatibility-promise.md). Human prose,
colors, and small brand marks are not.

## Output modes

One command, three modes — decided by `outputMode(streams, env, flags)` in `bin/ui.js`:

| Mode | When | Brand / connectors | ANSI | Symbols |
| --- | --- | --- | --- | --- |
| **human-rich** | stdout TTY, stdin TTY, not `CI`, no `--quiet`, no `--json` | full chevron art | yes | Unicode blocks + `✓` / `│` |
| **human-plain** | human session but `NO_COLOR`, `--ascii`, `SDD_ASCII=1`, or TTY without color | full chevron art (`#`/`+`/`=`) | no | ASCII (`OK`, `->`, …) |
| **machine** | `--json`, pipe/redirect, `CI`, or non-TTY stdout | no | no | ASCII / status words |

Rules:

- TTY matters more than “not CI”. `doctor | less` does not receive art.
- `--quiet` suppresses decorative next-step blocks and rich connectors; it does **not**
  suppress `FAIL` lines on stderr.
- `--json` never carries art and never changes the existing check object shape (additive
  rows only when an opt-in flag is passed — see the compatibility promise).
- Unicode is assumed for human-rich. Force ASCII with `--ascii` or `SDD_ASCII=1`. The CLI
  does not try to detect “whether Unicode works”.

## Colors

- **Off** when `NO_COLOR` is set (any value), or the target stream is not a TTY.
- **`FORCE_COLOR`** is honored only when the stream **is** a TTY. It never forces ANSI into
  a pipe (CLIG / picocolors convention).
- Status words (`PASS` / `WARN` / `FAIL` / …) may be colored; symbols are optional extras
  in human modes only.
- Welcome prints the **full** three-chevron brand art in human-rich / human-plain only
  (embedded in `bin/brand-art.js` so it ships in the npm package — no runtime read of
  `public/`). In human-rich TTY, the three bands reveal left→right (~60ms steps) to echo
  the chevron flow; human-plain / `--ascii` stay instant. Set `SDD_BRAND_ANIMATE=0` to
  skip the reveal. Machine / pipe / CI / agents get no art. SVG is never rendered in the CLI.

## stdout vs stderr

| Stream | Content |
| --- | --- |
| **stdout** | Status lines, doctor report, help, welcome, suggested next steps |
| **stderr** | Structured failures (`FAIL` + optional Reason / Try) |

Handled failures use exit code `1`. Unexpected/internal errors use `2`. Success is `0`.

## Structured failures

Human-facing errors on stderr look like:

```text
FAIL unknown pack: foo.

Reason:
  Pack `foo` does not exist.

Try:
  sdd-agentic-flow list
  Did you mean `core`?
```

Did-you-mean suggestions appear under `Try:` and are never executed automatically. The CLI
does not suggest nonexistent flags such as `init --force`.

## Next steps

After a mutating command succeeds (`init`, `install`, `discover`, `migrate`,
`context refresh`, `autonomous-resume`), the CLI may print a short, copy-pasteable
`Suggested next step` in human-rich / human-plain only. It is omitted under `--quiet`
and in **machine** mode (pipe/CI/non-TTY/`--json`). Welcome (bare invocation) still
points at one next command in every mode (compact status prose in machine) and, when
relevant, the opt-in `upgrade` / `doctor --check-updates` hint. On **human-rich** interactive
TTY only, welcome may ask `Check for updates? [y/N]` (default **N**) before any registry
request; machine/pipe/CI/human-plain never ask. See [trust model](trust-model.md).

The doctor Fix/Next footer is **human-rich only** (never on `--json`, pipes, or
human-plain).

## Interactive menu

Shown only when stdout and stdin are TTYs and `CI` is unset. Actions are filtered by
whether config and core skills are present. Includes **Check for updates / upgrade** once
config exists. Uninstall in the menu is structurally `--plan` only.

## Related

- [compatibility-promise.md](compatibility-promise.md) — what is frozen across versions
- [trust-model.md](trust-model.md) — local-first, no telemetry, opt-in update check
- [troubleshooting.md](troubleshooting.md) — interpreting doctor WARN/FAIL
