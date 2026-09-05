# CLI terminal behavior

The CLI separates `OutputFormat` (`human` or `machine`), `HumanPresentation` (`rich` or `plain`), and `TerminalCapabilities` (`interactive`, `color`, `unicode`, `cursor`, `rawInput`, `animation`, `width`, and sampled `height`).

Normal TTY sessions use human-rich output and prompts. `NO_COLOR` keeps the rich layout while
removing ANSI color. `--ascii` and `TERM=dumb` use human-plain output; `TERM=dumb` keeps numbered
input. A TTY without raw mode uses numbered readline. CI, pipes, closed stdin, and redirected
stdout never prompt or redraw. `--json` never prompts and never emits ANSI or cursor control.

Selectors use raw arrows only when interactive raw input and cursor capabilities are present. Enter, numeric shortcuts, Space for multi-select, Escape, and Ctrl-C are supported; EOF cancels deterministically and restores terminal state. `--interactive` requires TTY stdin/stdout and an unset `CI`.

Human content wraps at the detected terminal width using visible terminal-cell geometry. Rich TTY
welcome branding uses a deterministic 590 ms materialization when the terminal is at least 80×48;
late output skips stale frames and settles on the exact static logo. `NO_COLOR` preserves motion
without ANSI color. The supported evidence matrix covers 40, 54, 60, 80, and 120 columns in `en-US` and `pt-BR`; long command
and path tokens remain intact on continuation lines. Rich TTY operations may use a transient
spinner and leave one durable result. Plain, CI, pipe, and machine output do not animate. The CLI
does not use an alternate buffer, mouse, dashboard, or persistent UI state.

Untrusted terminal text is rendered inert or visibly escaped before styling. ANSI stripping is a
layout helper only; it is not the sanitization boundary.

The shared tokens, glyph fallbacks, renderer ownership, and gallery evidence are documented in
[the terminal design system](terminal-design-system.md).
