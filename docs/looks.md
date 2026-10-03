# Looks

A look is a complete visual language for the parts of Claude Code that Claudinator draws: tool rows, folded groups, results, prompt rows, headlines, the live line while Claude works, and the receipt that closes each turn. Switch with `/look <name>`, or open `/claudinator` and press a number.

Every look ships with a matching Claude Code theme and terminal color schemes, dark and light. See [themes.md](themes.md).

## 1 · Hairline

![Hairline](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/look-hairline.gif)

Swiss-quiet. One column of icons (`◇` read, `⌕` search, `◆` edit, `›` run), the path with its folder dimmed, `+/−` for edits, and a thin duration bar that turns amber when a step takes three seconds or more. The live line breathes: three dots and a highlight sweeping across the word. The receipt: `── ◆ Turn 7 · 2m 14s · 2 files · +103 −10 · 41% ctx ──`.

Defaults: Recency fade, Mini diffs.

## 2 · Broadsheet

![Broadsheet](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/look-broadsheet.gif)

The session reads like a well-edited story. Runs of tool calls fold into one italic sentence ("↳ Read cart.js, searched for “total” and ran 1 command."), edits stand on their own line, your prompt is a pull quote, and each turn closes on a centered colophon. While Claude thinks, a typewriter types out what it is weighing.

Defaults: Headlines, Footnotes.

## 3 · Mission Control

![Mission Control](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/look-mission.gif)

A precision instrument. A rail down the left, each call stamped with its time into the turn, uppercase readings, meters on edits, and slow steps in amber. A telemetry band above the prompt shows context, your rate limits with their reset times, and spend. The receipt is a reading too: `╞═ T07 ═ 2:14 ═ FILES 2 ═ Δ +103 −10 ═ CTX ▰▰▰▰▱▱ 41% ═╡`.

Defaults: Recency fade, Time strip.

## 4 · Prism

![Prism](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/look-prism.gif)

Premium color. Every file gets its own color, used in its tool chip, its legend dot and its segment of the fingerprint ribbon that closes each turn. A gradient flows over the live line.

Defaults: File colors, Mini diffs.

## 5 · Sumi

![Sumi](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/look-sumi.gif)

Ink and negative space. Reads and commands become a faint trace of dots; only edits get a mark, one indigo seal. While Claude thinks, an ensō draws itself beside one word set wide.

Defaults: Recency fade.

## 6 · Blueprint

![Blueprint](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/look-blueprint.gif)

Every turn is a technical drawing. Tool calls are dimension lines, edits get callout letters (A), (B), (C), and each turn closes on a title block with drawing number, revision and sign-off. Turn on `-inator mode` and the drawing is signed by Dr. Claude.

Defaults: Mini diffs, Headlines.

## 7 · Thermal

![Thermal](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/look-thermal.gif)

Each turn prints like a shop receipt: tool calls are line items priced in seconds, then the total, the files changed, the context used, a barcode and a tear-off line.

## Off

Claude Code draws everything itself. Claudinator stays loaded but draws nothing.
