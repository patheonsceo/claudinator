# Claudinator

**Give Claude Code a glow-up.** Claudinator is a Claude Code plugin that restyles the interface you look at all day: tool calls, the thinking line, the line that closes each turn, and the prompt hints. It also adds panes for finding your way around long sessions. You pick a **look**, mix in **ingredients**, and every change applies live to the session in front of you.

> **Status: in design.** Nothing is installable yet. The design spec lives in [`docs/design/`](docs/design/), and progress is tracked in [`CHANGELOG.md`](CHANGELOG.md). Watch the repo to hear about the first release.

## What it will do

**Looks** set the whole visual language:

| Look | In one line |
|---|---|
| Hairline | Swiss-quiet. One column of icons, everything aligned, color only where something changed. |
| Broadsheet | The session reads like a story: turn headlines, footnoted tool calls, a typewriter thinking line. |
| Mission Control | Precision readouts: per-step timelines, a telemetry band, a time strip on every turn. |
| Prism | Every file gets its own color, and each turn ends on a fingerprint ribbon. |
| Sumi | Ink and negative space. Reads become a trace of dots; only edits get a mark. |
| Blueprint | Every turn is a technical drawing, with callouts and a title block. |
| Thermal | Each turn prints like a shop receipt, barcode and tear-off line included. |

**Ingredients** work in any look: recency fade, file colors, footnotes, mini diffs, time strip, headlines, quiet transcript, the attention ladder, and `-inator mode`, an optional layer of personality.

**Panes** help you navigate: Chapters (each prompt as a chapter you can jump to), Ledger (every file changed this session) and Pins (decisions worth keeping in view).

Switch any of it from the `/claudinator` picker inside Claude Code, or share your exact setup with a short code.

## Requirements

- Claude Code v2.1.287 or later, which is the first version with mods.
- The terminal or the Code tab of the Claude Desktop app. Fullscreen mode gives the full experience. In the classic scrolling layout, new rows get the look, but rows already in your terminal's history keep the drawing they had.

## Privacy

Claudinator runs entirely on your machine. It makes no network requests, sends nothing anywhere, and never reads Claude's history files. Panes are built in memory from the current session and cleared when it ends. Anything that would use more than that, such as sounds or desktop notifications, is off until you turn it on. The full data handling notes will ship with the first release.

## Not affiliated with Anthropic

Claudinator is an independent, community-built plugin. It is not made, endorsed or supported by Anthropic. "Claude" and "Claude Code" are trademarks of Anthropic, PBC.

## Contributing

Ideas and bug reports are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). For security issues, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
