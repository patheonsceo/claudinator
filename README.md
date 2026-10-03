# Claudinator

**Give Claude Code a glow-up.** Claudinator restyles the parts of Claude Code you look at all day: tool calls, the thinking line, and the line that closes each turn. Pick a **look**, mix in **ingredients**, and every change applies live to the session in front of you.

![Claudinator turning stock Claude Code into Hairline](https://raw.githubusercontent.com/patheonsceo/claudinator/media/0.1.0/hero.gif)

## Install

```sh
claude plugin marketplace add patheonsceo/claudinator
claude plugin install claudinator@claudinator
```

Then start Claude Code. Hairline is on by default. Type `/claudinator` to open the picker.

Requires Claude Code v2.1.287 or later. Fullscreen mode (`CLAUDE_CODE_NO_FLICKER=1`) gives the full experience: switching looks repaints the whole session. In the classic layout, new rows follow your choice and rows in your terminal history keep theirs.

## Try it

- **Watch a turn in Hairline.** Ask Claude to fix something and run the tests. Each step is one aligned row, edits show their changed lines, and the turn ends with a receipt: `── ◆ Turn 3 · 48s · 2 files · +12 −4 · 18% ctx ──`.
- **Switch looks live.** Type `/claudinator`, press `2` to see stock Claude Code, then `1` to bring Hairline back.
- **Quiet a long session.** In the picker, press `q`. Reads and searches disappear, and only Claude's prose and the changes stay.
- **Set a default look for a project.** Commit `.claude/claudinator.json` with `{ "look": "hairline" }` so everyone on the repo starts with it. Anyone can still pick their own.

## Looks and ingredients

| | What it is |
|---|---|
| **Hairline** (look) | Swiss-quiet: an icon column, aligned metadata, color only on change. [More](docs/looks.md) |
| **Recency fade** | Older turns dim so the newest line stands out. |
| **Mini diffs** | Edits show up to three changed lines under the row. |
| **File colors** | Each file keeps one color everywhere. |
| **Quiet** | Hide reads, searches and passing commands. |

See [docs/ingredients.md](docs/ingredients.md) for a GIF of each. Six more looks are on the way: Broadsheet, Mission Control, Prism, Sumi, Blueprint and Thermal. See the [roadmap](docs/design/2026-10-03-claudinator-design.md#12-milestones).

## Make it complete: themes

Hairline also comes as a **Claude Code theme** for Claude Code's own interface (the input box, your messages, accents) and as a **color scheme for your terminal** (Ghostty, kitty, WezTerm, Alacritty, Windows Terminal and iTerm2), dark and light. Run `/theme` and pick *Claudinator Hairline Dark*, then add the matching file for your terminal. See [docs/themes.md](docs/themes.md).

## Commands

| Command | What it does |
|---|---|
| `/claudinator` | Open the picker. Number keys pick a look; letter keys toggle ingredients. |
| `/look <name>` | Switch look directly: `/look hairline`, `/look off`. Works while Claude is busy. |

## Privacy

Claudinator runs entirely on your machine. It makes no network requests, calls no model, runs no programs, and never reads Claude's history files. It reads the tool calls it draws, keeps only your look and ingredient choice on disk, and a project can never use it to hide tool calls from you. The full list of what it reads is in [docs/privacy.md](docs/privacy.md).

## Not affiliated with Anthropic

Claudinator is an independent, community-built plugin. It is not made, endorsed or supported by Anthropic. "Claude" and "Claude Code" are trademarks of Anthropic, PBC.

## Contributing

Ideas and bug reports are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/testing.md](docs/testing.md). For security issues, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
