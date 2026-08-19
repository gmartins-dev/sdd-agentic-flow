# CLI terminal behavior

The CLI separates `OutputFormat` (`human` or `machine`), `HumanPresentation` (`rich` or `plain`), and `TerminalCapabilities` (`interactive`, `color`, `unicode`, `cursor`, `rawInput`, `animation`, and `width`).

Normal TTY sessions use human-rich output and prompts. `NO_COLOR`, `--ascii`, and `TERM=dumb` use human-plain output; `TERM=dumb` keeps numbered input. A TTY without raw mode uses numbered readline. CI, pipes, closed stdin, and redirected stdout never prompt or redraw. `--json` never prompts and never emits ANSI or cursor control.

Selectors use raw arrows only when interactive raw input and cursor capabilities are present. Enter, numeric shortcuts, Space for multi-select, Escape, and Ctrl-C are supported; EOF cancels deterministically and restores terminal state. `--interactive` requires TTY stdin/stdout and an unset `CI`.

Human content wraps at the detected terminal width. The supported evidence matrix covers 40, 60, 80, and 120 columns in `en-US` and `pt-BR`; long command and path tokens remain intact on continuation lines. The CLI uses durable stage lines only: no spinner, alternate buffer, mouse, dashboard, or persistent UI state.
