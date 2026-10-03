# Testing Claudinator

## Automated

```sh
claude plugin validate --strict .                          # the marketplace
claude plugin validate --strict .claude-plugin/plugin.json # the plugin and its mod: lists every hook and API call
claude plugin test .
node --test tools/themes.test.mjs && node tools/themes.mjs --check   # theme files match their palettes
npx -y -p typescript@5 tsc -p .   # after one `claude --plugin-dir .` load has written the types
```

CI runs both validations and the tests on Claude Code 2.1.288 and the latest release.

## Manual checklist (every release)

Run each check in a scratch project with `claude --plugin-dir /path/to/claudinator --model haiku`, once with `CLAUDE_CODE_NO_FLICKER=1` (fullscreen) and once with `CLAUDE_CODE_NO_FLICKER=0` (classic). Use a prompt that reads two files, edits one and runs a command.

| # | Check | Fullscreen | Classic |
|---|---|---|---|
| 1 | Tool rows draw in Hairline: glyph, verb, path, `+/−`, duration | | |
| 2 | A group of reads draws as one phrase with file names under it | | |
| 3 | Mini diffs show up to three changed lines under an edit | | |
| 4 | The live line animates and its clock ticks | | |
| 5 | The receipt shows turn number, duration, files, `+/−`, context | | |
| 6 | `/claudinator` opens the picker; `1` to `6` switch through every look, and each one draws rows, live line and receipt | | new rows only |
| 7 | `7` switches to Off and every row reverts; `1` brings Hairline back | | new rows only |
| 8 | Each ingredient key (`r d f q h n t a i`) toggles live, and the picker shows its state | | new rows only |
| 9 | Each combo key (`w s o x z`) applies its whole setup | | new rows only |
| 10 | Footnotes: reads fold into marks on the reply and notes on the receipt; commands keep their rows | | |
| 11 | Headlines appear above each finished turn's prompt; `/chapters` lists them and Enter jumps | | n/a |
| 12 | `/ledger` lists changed files; `/pin` and `/pins` keep a note across a restart | | |
| 13 | Time strip: a command that asks permission files its run time under tools and the wait under waiting | | |
| 14 | Attention ladder: a permission prompt left open shows a toast at 30 seconds; answering it stops the ladder | | |
| 15 | `/look share` prints a code, and `/look use <code>` in another session applies it | | |
| 16 | `/look off` and `/look hairline` work while Claude is busy | | |
| 17 | At 80 columns, rows truncate and drop the duration bar; no wrapping | | |
| 18 | In a light theme (`/theme`), every color stays readable in every look | | |
| 19 | Restart Claude Code: the last choice is restored | | |
| 20 | `claude --debug-file /tmp/cz.log --plugin-dir .`: no `refused` or `hook skipped` lines for `claudinator` | | |
