# Changelog

All notable changes to Claudinator are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-10-04

### Added
- Five new looks, each with its own Claude Code theme and terminal color schemes: Broadsheet, Mission Control, Prism, Sumi and Blueprint.
- Ingredients: Headlines, Footnotes, Time strip, the Attention ladder (a toast at 30 seconds, and an opt-in sound and desktop notification at 2 minutes) and -inator mode.
- Each look turns on its own default ingredients; your own choices always win.
- Panes: Chapters (`/chapters`, jump to any turn), Ledger (`/ledger`) and Pins (`/pins`, `/pin`).
- Combos (Daily driver, Storyteller, Show-off, Doof mode, Zen) and six-character share codes (`/look share`, `/look use <code>`).
- `/config` options for the starting look and the attention ladder's sound and notification.
- A guide to adding a look, and GIFs of every look, ingredient, pane and combo.

### Changed
- The picker offers every look on `1` to `6` and Off on `7`, every ingredient on its letter key, and the combos.
- `/config` no longer offers each ingredient; looks bring their defaults and the picker saves your choices.
- Every look was polished against its lookbook design: its own marks and verbs on every row, a blank line before each step and around each receipt, and an animated live line above the prompt (Hairline's sliding trace, Broadsheet's pen and typewriter, Mission Control's sparkline, Prism's flowing dots, Sumi's self-drawing ensō, Blueprint's calipers). Hairline gains Hairline+'s aligned verb column, folded file lists and context bar.
- The time strip becomes live progress: while Claude works through a todo list, a gridded strip above the prompt fills task by task and names the task in hand. Each run closes with one line of where its time went, in the look's colors, plus the tasks done.
- Each look's Claude Code theme tints diffs with the look's own green and red instead of saturated blocks.
- The picker is redesigned: a header with your setup, palette swatches for each look, ingredient switches, and the share code set apart. Each look's Claude Code theme also tints the docked pane and `!` command and memory messages, which Claude Code otherwise draws a fixed gray.

### Security
- A project file cannot turn on Quiet or Footnotes, and a look it picks never brings them.
- Every path, command and tool name is made printable before any look draws it.
- Notification text reaches `notify-send` and `osascript` as plain arguments, never as options or script, and is escaped for servers that read markup.
- A project file cannot turn the attention ladder off.

### Known issues
- After a combo or a share code, later `/look` switches keep that setup's ingredients instead of bringing the new look's defaults.
- `/pin` with no note during a running turn says there is nothing to pin, rather than pinning the last finished turn.
- While a call waits on you, every row redraws once a second, and the animation timer reads your settings ten times a second even when idle. Neither is visible, but both cost a little CPU.

## [0.1.0] - 2026-10-03

### Added
- The Hairline look for tool rows, tool groups, results, prompt rows, the live line and turn receipts.
- Ingredients: Recency fade, Mini diffs, File colors and Quiet.
- The `/claudinator` picker and the `/look` command, applied live and saved for every session.
- Per-project settings in `.claude/claudinator.json` (a project cannot turn on Quiet), and defaults in `/config`.
- Hairline as a Claude Code theme (dark and light) and as color schemes for Ghostty, kitty, WezTerm, Alacritty, Windows Terminal and iTerm2, generated from one palette.
- This repository as a plugin marketplace, CI, and the demo GIF pipeline.
- Design spec: looks, ingredients, panes, settings, data handling, testing, media and release process, with evidence from a feasibility spike.
- Repository foundation: README, license, contribution and security policies, issue and pull request templates.

[Unreleased]: https://github.com/patheonsceo/claudinator/compare/claudinator--v1.0.0...HEAD
[1.0.0]: https://github.com/patheonsceo/claudinator/compare/claudinator--v0.1.0...claudinator--v1.0.0
[0.1.0]: https://github.com/patheonsceo/claudinator/releases/tag/claudinator--v0.1.0
