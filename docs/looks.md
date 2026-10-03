# Looks

A look is a complete visual language for the parts of Claude Code that Claudinator draws. Switch with `/look <name>` or the `/claudinator` picker.

## Hairline

![Hairline](https://raw.githubusercontent.com/patheonsceo/claudinator/media/0.1.0/look-hairline.gif)

Swiss-quiet. One column of icons, aligned metadata in your theme's dim color, and color only on what changed.

- **Tool rows:** `◇ Read`, `⌕ Search`, `◆ Edit`, `› Run`, the path with its folder dimmed, `+/−` for edits, and a thin duration bar that turns amber when a step takes three seconds or more.
- **Groups:** a run of reads and commands reads as one phrase, such as *Read 2 files, ran 1 command*, with the file names underneath.
- **Results:** collapse to their telling line, such as `╰ Tests: 24 passed`. Failures always stay visible.
- **Live line:** breathing dots, a highlight sweeping across the word, what Claude is doing, and a stopwatch.
- **Receipt:** `── ◆ Turn 7 · 2m 14s · 2 files · +103 −10 · 41% ctx ──`.

Hairline colors itself with your Claude Code theme, so it follows light, dark and custom themes.

## Off

Claude Code draws everything itself. Claudinator stays loaded but draws nothing.
