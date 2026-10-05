# Claudinator

**Give Claude Code a glow-up.** Claudinator restyles the parts of Claude Code you look at all day: tool calls, the thinking line, the line that closes each turn, and the prompt rows. Pick one of six **looks**, mix in **ingredients**, and every change applies live to the session in front of you. Panes let you jump around long sessions, and a share code carries your exact setup to a friend.

![One session switching through all six looks](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/hero.gif)

## Install

```sh
claude plugin marketplace add patheonsceo/claudinator
claude plugin install claudinator@claudinator
```

Then start Claude Code. Hairline is on by default. Type `/claudinator` to open the picker.

Requires Claude Code v2.1.287 or later. Fullscreen mode (`CLAUDE_CODE_NO_FLICKER=1`) gives the full experience: switching looks repaints the whole session. In the classic layout, new rows follow your choice and rows in your terminal history keep theirs.

## Try it

- **Watch a turn.** Ask Claude to fix something and run the tests. Each step is one considered row, edits show their changed lines, and the turn closes with a receipt.
- **Switch looks live.** Type `/claudinator` and press `1` to `6`. Your whole session redraws in each look.
- **Read a long session like a story.** Type `/look storyteller`: Broadsheet with headlines and footnotes, so Claude's prose reads cleanly and the tool calls sit in numbered notes.
- **Find your way back.** Type `/chapters` to see every turn by its headline, and press Enter on one to jump to it.
- **Share your setup.** Type `/look share` and send the code. Your friend types `/look use` and the code.

## Looks

| | Look | What it is |
|---|---|---|
| 1 | **Hairline** | Swiss-quiet: an icon column, aligned metadata, color only where something changed. |
| 2 | **Broadsheet** | The session reads like a story: sentences for tool calls, chapter headlines, a typewriter while Claude thinks. |
| 3 | **Mission Control** | A precision instrument: a timestamped rail, live telemetry above the prompt, readings on every turn. |
| 4 | **Prism** | Premium color: every file its own color, tool chips, and a fingerprint ribbon closing each turn. |
| 5 | **Sumi** | Ink and negative space: reads become a quiet trace, only edits get a mark. |
| 6 | **Blueprint** | Every turn a technical drawing, with callouts and a title block. The `-inator mode` skin. |

Each look also ships a matching **Claude Code theme** and **terminal color schemes** for Ghostty, kitty, WezTerm, Alacritty, Windows Terminal and iTerm2. See [docs/looks.md](docs/looks.md) for a GIF of each and [docs/themes.md](docs/themes.md) to install the themes.

## Ingredients

Ingredients work in any look. Each look turns on its own favorites, and your choices always win.

| Key | Ingredient | What it does |
|---|---|---|
| `r` | Recency fade | Older turns dim so the newest line stands out. |
| `d` | Mini diffs | Edits show their key changed lines under the row. |
| `f` | File colors | Each file keeps one color everywhere. |
| `q` | Quiet | Hides reads, searches and commands, leaving a one-line trace. |
| `h` | Headlines | Each finished turn gets a title above its prompt. |
| `n` | Footnotes | Tool calls become numbered notes on Claude's prose. |
| `t` | Time strip | Each run's time under its receipt: thinking, tools and waiting on you. (The working bar above the prompt is always on.) |
| `a` | Attention ladder | When Claude waits on your permission: a toast at 30 seconds, then an optional sound and desktop notification at 2 minutes. |
| `i` | -inator mode | A layer of personality. Curse you, flaky tests. |

See [docs/ingredients.md](docs/ingredients.md) for a GIF of each.

## Panes and commands

| Command | What it does |
|---|---|
| `/claudinator` | Open the picker: number keys pick a look, letter keys toggle ingredients and combos. |
| `/look <name>` | Switch to a look (`/look sumi`) or a combo (`/look zen`). Works while Claude is busy. |
| `/look share`, `/look use <code>` | Print your setup as a code, or apply someone else's. |
| `/chapters` | Every turn by its headline; press Enter to jump to it. |
| `/ledger` | Every file changed this session, with its line counts. |
| `/pins`, `/pin [note]` | Notes worth keeping in view. `/pin` alone pins the last turn. |

**Combos** apply a whole setup at once: Daily driver (`w`), Storyteller (`s`), Show-off (`o`), Doof mode (`x`) and Zen (`z`). See [docs/panes.md](docs/panes.md) and [docs/sharing.md](docs/sharing.md).

## Privacy

Claudinator runs entirely on your machine. It makes no network requests, calls no model, and never reads Claude's history files. It reads the tool calls and prompts it draws, keeps only your choices and pins on disk, and runs a program only if you turn on the attention ladder's sound or desktop notification. A project can never use it to hide tool calls from you. The full list is in [docs/privacy.md](docs/privacy.md).

### What it reads, runs and hooks

- **Reads:** the conversation as Claude Code draws it (your prompts, Claude's replies, each tool call and its result) to restyle those rows; the theme row of `/config`, to choose light or dark colors; and `.claude/claudinator.json` in your project, if it exists. It never reads your settings file or any credential.
- **Sends:** nothing leaves your machine. The only data that leaves Claudinator is the text of a desktop notification, handed to your own system's notifier, and only if you turn notifications on.
- **Runs:** nothing by default. With the attention ladder's sound on, after Claude has waited two minutes on your permission it plays a system sound with the first of `pw-play`, `paplay` or `afplay` that is installed. With its notification on, it shows "Claude needs you" and the waiting call (for example `Run npm test`) with `notify-send` or `osascript`. Each runs with fixed arguments, no shell, and the text passed as plain arguments.
- **Hooks:**
  - `ui.render` restyles rows, the working line, receipts, prompts and panes. It changes only how they look.
  - `session.start` and `command.run` register and answer `/claudinator`, `/look`, `/chapters`, `/ledger`, `/pins` and `/pin`.
  - `prompt.submit`, `turn.start`, `turn.complete` and `tool.call` observe your prompts, turns and tool calls to build headlines, receipts and Chapters. They pass every event on unchanged.
  - `PostToolUse` and `PostToolUseFailure` read how long each tool ran.
  - `PermissionRequest` notes when a permission dialog opens, so the attention ladder can start; it never answers it, and the decision is always yours.
  - `SessionStart` resets its in-memory view of the session after `/clear`, a resume or a fork.

## Not affiliated with Anthropic

Claudinator is an independent, community-built plugin. It is not made, endorsed or supported by Anthropic. "Claude" and "Claude Code" are trademarks of Anthropic, PBC.

## Contributing

Ideas, looks and bug reports are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md), [docs/adding-a-look.md](docs/adding-a-look.md) and [docs/testing.md](docs/testing.md). For security issues, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
