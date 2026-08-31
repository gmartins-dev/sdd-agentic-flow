# CLI interaction contract

How `sdd-agentic-flow` presents output to humans and machines. This is presentation
policy, not a second command surface.

**Branding is presentation, never protocol.** Exit codes, flags, and `doctor --json`
shape are frozen by [compatibility-promise.md](compatibility-promise.md). Human prose,
colors, and small brand marks are not.

## Output modes

One command, three modes — decided by `outputMode(streams, env, flags)` in `src/ui.ts`:

| Mode            | When                                                                            | Brand / connectors                 | ANSI | Symbols                    |
| --------------- | ------------------------------------------------------------------------------- | ---------------------------------- | ---- | -------------------------- |
| **human-rich**  | stdout TTY, stdin TTY, not `CI`, no `--quiet`, no `--json`                      | SAF chevron art and guided journey | yes  | Unicode blocks + `✓` / `│` |
| **human-plain** | `NO_COLOR`, `--ascii`, `SDD_ASCII=1`, pipe/redirect, CI, or no usable TTY color | full chevron art (`#`/`+`/`=`)     | no   | ASCII (`OK`, `->`, …)      |
| **machine**     | explicit structured output (`--json`)                                           | no                                 | no   | ASCII / status words       |

Rules:

- TTY controls decoration, not protocol. `doctor | less` is human-plain; only an explicit
  structured flag such as `doctor --json` is machine output.
- CI is deterministic human-plain output unless an explicit structured flag is supplied.
- `--quiet` suppresses decorative next-step blocks and rich connectors; it does **not**
  suppress `FAIL` lines on stderr.
- `--json` never carries art and never changes the existing check object shape (additive
  rows only when an opt-in flag is passed — see the compatibility promise).
- Human-rich uses the SAF terminal journey symbols. Force ASCII with `--ascii` or
  `SDD_ASCII=1`; every structural symbol has a readable fallback.

## Colors

- **Off** when `NO_COLOR` is set (any value), or the target stream is not a TTY.
- **`FORCE_COLOR`** is honored only when the stream **is** a TTY. It never forces ANSI into
  a pipe (CLIG / picocolors convention).
- Status words (`PASS` / `WARN` / `FAIL` / …) may be colored; symbols are optional extras
  in human modes only.
- Rich status, note, and spinner primitives are provided by the bundled terminal UI adapter;
  command semantics and terminal mode selection remain SAF-owned.
- Welcome prints a **compact** three-chevron brand mark (~8–10 lines, ≤52 columns) in
  human-rich / human-plain only (embedded in `src/brand-art.ts` so it ships in the npm
  package — no runtime read of `public/`). In human-rich TTY, the three bands reveal
  left→right (~160ms steps) to echo the chevron flow; human-plain / `--ascii` stay
  instant. If the TTY reports `columns` or `rows` too small for the block, welcome falls
  back to a one-line mark (`›››` / `>>>`) with no animation. Set `SDD_BRAND_ANIMATE=0` to
  skip the reveal. Machine output gets no art. SVG is never rendered in the CLI.

## stdout vs stderr

| Stream     | Content                                                          |
| ---------- | ---------------------------------------------------------------- |
| **stdout** | Status lines, doctor report, help, welcome, suggested next steps |
| **stderr** | Structured failures (`FAIL` + optional Reason / Try)             |

Handled failures use exit code `1`. Unexpected/internal errors use `2`. Success is `0`.

## Structured failures

Human-facing errors on stderr look like:

```text
FAIL unknown command: foo.

Reason:
  Command `foo` does not exist.

Try:
  npx sdd-agentic-flow help
  Did you mean `help`?
```

Did-you-mean suggestions appear under `Try:` and are never executed automatically. Suggestions
use commands from the supported CLI surface, such as `npx sdd-agentic-flow init --plan`.

## Next steps

After a mutating command succeeds (`init`, `install`, `context refresh`,
`autonomous-resume`), the CLI may print a short, copy-pasteable
`Suggested next step` in human-rich / human-plain only. It is omitted under `--quiet`
and in **machine** mode (`--json`). Welcome (bare invocation) still
points at one next command in every mode (compact status prose in machine) and, when
relevant, the opt-in `upgrade` / `doctor --check-updates` hint. On **human-rich** interactive
TTY only, welcome may offer an explicit update-check action before any registry
request; machine/pipe/CI/human-plain never ask. See [trust model](trust-model.md).

The doctor Fix/Next footer is **human-rich only** (never on `--json`, pipes, or
human-plain).

## Interactive menu

Shown only when stdout and stdin are TTYs and `CI` is unset. First use presents a
state-aware welcome; ready and attention states offer **Exit**, **Change settings**,
**Check for updates**, **Validate setup**, and **Advanced options**. Nested flows expose
**Back**, **Cancel**, or **Apply** when applicable. Updates remain opt-in.

Guided setup is an inline CLI flow, not a full-screen TUI. It has one recommended path and an
optional customization path, including an operating-policy step (Supervised recommended), then a
single review before the first write. It derives first-use, partial, and ready state from
configuration, installation intent, context, and `doctor`; it does not store a separate onboarding
marker. Before apply, **Back** only changes in-memory choices. After apply, **Workflow** runs
`config policy`; **Sharing and coding agents** runs `config installation` — each is a deliberate
change, not a rollback. A handled failure keeps the human in the flow with retry, validation,
change, or exit.

The first-use journey records four decisions: sharing mode, explicitly selected coding-agent
hosts, workflow mode (including a custom execution/autonomy pair), and language profile. Feature
profile is resolved per work package by `saf-create-spec`, not by installation setup. Host detection
is local evidence from PATH and known host directories only; it never invokes a provider or contacts
a network service. A missing detection is shown as a choice rather than silently selecting every target.

Terminal capability changes presentation, never workflow correctness: rich terminals get arrow
navigation, while `NO_COLOR`, `--ascii`, `SDD_ASCII=1`, missing raw mode, pipes, and CI receive
the complete numbered/plain interaction. Rich TTY operations may use a transient spinner that
collapses to one durable result; plain, CI, pipe, and machine output never animate.

Rich layout measures terminal cells rather than JavaScript string length. SAF sanitizes untrusted
paths and metadata as inert display text before styling them; canonical values used for planning
and mutation are unchanged.

Bare welcome may show **Operating policy** and **Installation** blocks when config
and skills are present. Copy does not claim the CLI invokes skills.

## Related

- [compatibility-promise.md](compatibility-promise.md) — what is frozen across versions
- [trust-model.md](trust-model.md) — local-first, no telemetry, opt-in update check
- [troubleshooting.md](troubleshooting.md) — interpreting doctor WARN/FAIL
