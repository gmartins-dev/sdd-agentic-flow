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
| **human-plain** | `--ascii`, `SDD_ASCII=1`, `TERM=dumb`, pipe/redirect, CI, or no usable TTY | compact/static fallback | no | ASCII (`OK`, `->`, …) |
| **machine**     | explicit structured output (`--json`)                                           | no                                 | no   | ASCII / status words       |

Rules:

- TTY controls decoration, not protocol. `doctor | less` is human-plain; only an explicit
  structured flag such as `doctor --json` is machine output.
- CI is deterministic human-plain output unless an explicit structured flag is supplied.
- `--quiet` suppresses decorative next-step blocks and rich connectors; it does **not**
  suppress `FAIL` lines on stderr.
- `--json` never carries art and never changes the existing check object shape (additive
  rows only when an opt-in flag is passed — see the compatibility promise).
- Human-rich uses the SAF terminal journey symbols. Force ASCII with `--ascii`, `SDD_ASCII=1`, or
  `TERM=dumb`; every structural symbol has a readable fallback. See
  [the terminal design system](terminal-design-system.md) for the shared token and geometry
  contract.

## Colors

- **Off** when `NO_COLOR` is set (any value), or the target stream is not a TTY. An interactive
  `NO_COLOR` session keeps the rich structure and numbered/raw interaction appropriate to its
  capabilities; only ANSI color is removed.
- **`FORCE_COLOR`** is honored only when the stream **is** a TTY. It never forces ANSI into
  a pipe (CLIG / picocolors convention).
- Status words (`PASS` / `WARN` / `FAIL` / …) may be colored; symbols are optional extras
  in human modes only.
- Rich status, note, and spinner primitives are provided by the bundled terminal UI adapter;
  command semantics and terminal mode selection remain SAF-owned.
- Welcome prints the generated 80×34 filled three-triangle mask from
  `public/ascii/saf-ascii-art.txt` at 80+ columns with sufficient height. The mask is embedded in
  `brand-animation.generated.ts`, so the package has no runtime read of `public/`. At smaller or
  short terminals, the existing compact/progressive fallback is used without scaling the canonical
  canvas. In a human-rich TTY at least 80×48, semantic components materialize left-to-right in a
  deadline-driven 590 ms animation and settle on the exact static frame; delayed output skips stale
  frames. `NO_COLOR` preserves motion without ANSI, while human-plain, `--ascii`, CI, pipes, and
  machine output stay static. Set `SDD_BRAND_ANIMATE=0` to skip the animation. SVG is never
  rendered in the CLI.

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

Guided setup is an inline CLI flow, not a full-screen TUI. Language is the first decision. With a
valid Git workspace, the remaining decisions are Sharing, Coding agents, Workflow, and, only for
Team adoption, specs visibility, followed by one review before Apply. Without Git, setup asks only
for Coding agents after Language, then reviews and applies a user-only installation. The selected
locale is session-local until Apply and owns all following human-facing prompts, plans, warnings,
progress, validation, and results. It has one recommended path and an optional customization path,
including an operating-policy step (Supervised recommended), then a single review before the first write. It derives first-use, partial, and ready state from
configuration, installation intent, context, and `doctor`; it does not store a separate onboarding
marker. Before apply, **Back** only changes in-memory choices. After apply, **Workflow** runs
`config policy`; **Sharing and coding agents** runs `config installation` — each is a deliberate
change, not a rollback. A handled failure keeps the human in the flow with retry, validation,
change, or exit.

The first-use journey records four decisions: language profile, sharing mode, explicitly selected
coding-agent hosts, and workflow mode (including a custom execution/autonomy pair); Team adoption
also records specs visibility. A valid project configuration supplies the initial locale during
normal re-entry, so Language is not asked again. User-only setup does not create project config or
global language preference. Feature
profile is resolved per work package by `saf-create-spec`, not by installation setup. Host detection
is local evidence from PATH and known host directories only; it never invokes a provider or contacts
a network service. A missing detection is shown as a choice rather than silently selecting every target.

Terminal capability changes presentation, never workflow correctness: rich terminals get arrow
navigation, while `--ascii`, `SDD_ASCII=1`, `TERM=dumb`, missing raw mode, pipes, and CI receive
the complete numbered/plain interaction. Interactive `NO_COLOR` keeps the rich layout without
ANSI. Rich TTY operations may use a transient spinner that
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
