# Testing Claudinator

## Automated

```sh
claude plugin validate --strict .                          # the marketplace
claude plugin validate --strict .claude-plugin/plugin.json # the plugin and its mod: lists every hook and API call
claude plugin test .
node --test tools/ && node tools/themes.mjs --check   # theme files match their palettes
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
| 4 | The live line animates (dots and sweep) and its clock ticks | | |
| 5 | The receipt shows turn number, duration, files, `+/−`, context | | |
| 6 | `/claudinator` opens the picker; `2` switches to Off and every row reverts | | new rows only |
| 7 | `1` switches back to Hairline | | new rows only |
| 8 | `r`, `d`, `f`, `q` toggle each ingredient live | | new rows only |
| 9 | After a second prompt, the first turn's rows fade (Recency fade on) | | n/a |
| 10 | `/look off` and `/look hairline` work while Claude is busy | | |
| 11 | At 80 columns, rows truncate and drop the duration bar; no wrapping | | |
| 12 | In a light theme (`/theme`), every color stays readable | | |
| 13 | Restart Claude Code: the last choice is restored | | |
| 14 | `claude --debug-file /tmp/cz.log --plugin-dir .`: no `refused` or `hook skipped` lines for `claudinator` | | |
