# Adding a look

A look is a pure TypeScript module that implements the `Look` interface in [`src/looks/look.ts`](../src/looks/look.ts). Claudinator's hooks module calls it to draw each part of the interface; the look never talks to Claude Code itself. Read Hairline first ([`src/looks/hairline/`](../src/looks/hairline)): it is the reference, and every other look follows its shape.

## What you write

| File | What it holds |
|---|---|
| `src/looks/<id>/index.ts` | `export const <ID>: Look`, assembled from the files below |
| `src/looks/<id>/*.ts` | Your rows, groups, results, prompt row, headline, receipt and live line |
| `palettes/<id>.json` | Dark and light colors: terminal colors, 16 ANSI colors, and Claude Code theme tokens |
| `tests/looks-<id>.test.ts` | Tests for every member of the interface |

Then add your id to `LookId` in [`types/index.d.ts`](../types/index.d.ts), to `LOOK_IDS`, `LOOK_LABELS` and `LOOK_DEFAULTS` in [`src/engine/settings.ts`](../src/engine/settings.ts), to the registry in [`src/looks/index.ts`](../src/looks/index.ts), to the share-code table in [`src/engine/share-code.ts`](../src/engine/share-code.ts), and to the recordings in [`tools/tapes.mjs`](../tools/tapes.mjs). Run `node tools/themes.mjs` and `node tools/tapes.mjs`.

## Rules Claude Code enforces

If a drawing breaks one of these, Claude Code silently draws its own row instead.

- Use only the elements in `ctx.els`: `Box`, `Text`, `Button`, and `Raster` on the terminal only (check `ctx.surface === 'terminal'`).
- Use only the documented props. Colors are Claude Code theme tokens (`text`, `inactive`, `subtle`, `suggestion`, `success`, `error`, `warning`, ...) or `#rrggbb`.
- Never draw raw text from a tool or the user. Pass it through `printable()` or `oneLine()` from [`src/engine/format.ts`](../src/engine/format.ts). Paths from `splitPath()` and `factsOf()` are already clean.
- Keep every string under 10,000 characters, and every `Raster` frame the same width for a given live state.
- Send every color through `tone(color, ctx.fade)` so Recency fade works, and drop backgrounds when `ctx.fade > 0`.

## Shared helpers

[`src/looks/common.ts`](../src/looks/common.ts) has `notesBlock` and `noteText` (footnotes), `timeStripRow` and `timeStripSegments` (time strip), `superscript`, `inatorWord` and `inatorQuip` (-inator mode), and `waitingBand` (attention ladder). Reuse them, styled for your look.

## Checking your look

```sh
claude plugin test .                    # your tests, and every look on every site
npx -y -p typescript@5 tsc -p .         # after one claude --plugin-dir . load
node --test tools/themes.test.mjs && node tools/themes.mjs --check
claude --plugin-dir . --model haiku     # then /look <id> and ask for a small edit
```

The every-look test draws each site on the terminal and desktop surfaces and fails if anything is refused, contains an escape code, or draws a `Raster` on the desktop.
