# Claudinator design spec

- **Date:** 2026-10-03
- **Status:** Approved 2026-10-03; delivered in 0.1.0 and 1.0.0
- **Target:** Claude Code v2.1.287 or later (mods), verified on v2.1.288
- **Visual reference:** the lookbook, which shows every look and ingredient as an interactive mock. Screens from it will be added to `docs/media/` with the first release.

## 1. What we are building

Claudinator is one Claude Code plugin that restyles the Claude Code interface and adds navigation panes. The user picks a **look** (a complete visual language), mixes in **ingredients** (features that work in any look), and opens **panes** (Chapters, Ledger, Pins). Every change applies live to the running session from an in-app picker, and the setup can be shared as a short code.

It is built for people who spend all day in Claude Code and pay for it: the interface should feel premium, calm, and theirs.

### Goals

1. **Premium feel by default.** Tool calls, the thinking line and the end of each turn look considered, not default.
2. **Awareness.** At a glance: what Claude is doing, what changed, and whether it needs you.
3. **Navigation and recall.** Long sessions stay easy to scan and to move around in.
4. **Choice.** Any look with any ingredients, switched live, saved, and shareable.
5. **Publication grade.** Listed in our own marketplace from v0.1, and submitted to Anthropic's plugin directory at v1.0.

### Non-goals

- Restyling the permission prompt. Claude Code does not let mods change it.
- Reading Claude's history files, past sessions or memory (Directory Policy 1F).
- Network access of any kind. Claudinator makes no requests.
- A settings website or account. Everything lives on the user's machine.

## 2. Constraints we design around

These come from the spike (section 13) and from the plugin docs and directory policy.

| Constraint | Consequence for the design |
|---|---|
| A plugin has exactly one hooks module (`hooks/hooks.json` names one entry file). | One plugin, one entry file that wires events to an internal engine. |
| `$` can only be passed to functions declared in the entry file, never across an import. | The entry file builds a small object of capabilities (as Claude Code's own `diff` mod does) and passes it, with the element constructors, into pure modules in `src/`. |
| Every render hook re-runs for every row on each `$.ui.invalidate`. | Renderers are pure, cheap functions of `(props, settings, session model)`. No per-row caching from the first render: the first `ToolUse` render arrives with `input: {}` while it streams. |
| **Fullscreen mode** repaints every row; the **classic layout** freezes rows already in terminal history. | Fullscreen is the full experience. In the classic layout, new rows get the current look and old rows keep theirs. The picker says which mode you are in. |
| A row can be hidden by returning an empty `Box`; a one-line gap remains. | Footnotes, Quiet and Sumi's traces are feasible. Looks are designed with that gap in mind. |
| `Raster` and `Image` exist only in the terminal; an unknown element makes Claude Code draw its own row. | Every renderer branches on `e.surface` and has a text fallback for the Desktop app. |
| `$.audio` plays nothing in a Linux terminal. | Sounds go through `$.audio` where it works and through an opt-in `$.process.run` player on Linux. Off by default. |
| Directory Policy 1D: collect only the data a feature needs, and never log conversation data. | Panes are built in memory from live events in this session. Nothing about the conversation is written to disk except what the user pins. |
| Directory Policy 1F: never query chat history or memory. | No `$.session.messages()` scans and no transcript files. After `/resume`, panes start from the resumed point. |
| Plugin limits: no top-level `bin/`, no `CLAUDE.md`, no binaries except images and fonts, under 256 KiB per non-image file, at most 512 files, readable source, no lockfile at the root. | Repository layout in section 9. GIFs live on a separate `media` branch so installs stay small. |
| Installed mods must stay under the 10 second hook budget and Claude Code throttles redraws (10 a second, 30 for a visible pane, band and hint line). | Animations are driven by `$.clock.every` and `$.ui.blit`. No heavy work in render hooks. |

## 3. The experience

### 3.1 Looks

A look is a complete visual language for every surface Claudinator draws. Seven looks ship by v1.0, plus **Off**, which passes everything through to Claude Code untouched.

| Look | Visual idea | Signature moment |
|---|---|---|
| **Hairline** | Swiss-quiet. One icon column, aligned metadata in dim gray, color only on changes and on "needs you". Duration bars that turn amber when a step is slow. | Breathing dots, a shimmer across the word, and a thin progress line while Claude thinks. |
| **Broadsheet** | The session reads like a story. Runs of reads fold into one italic sentence, edits stand on their own line, times sit in the margin. | A typewriter thinking line, and the turn colophon. |
| **Mission Control** | A precision instrument. Timestamped rail, a mini timeline on every tool row, live readouts. | The telemetry band and the time strip. |
| **Prism** | Premium color. Tinted chips with rounded half-block ends, each file in its own color. | The fingerprint ribbon at the end of each turn. |
| **Sumi** | Ink and negative space. Reads shrink to a dot trace; only edits get a mark, one indigo seal. | The ensō that draws itself while Claude thinks. |
| **Blueprint** | Every turn is a technical drawing: dimension lines, callout letters on edits. | The title block that closes each turn. The natural `-inator mode` skin. |

A seventh look, Thermal (each turn printed as a shop receipt), was built and then cut before 1.0.0: it did not meet the bar the other six set.

Each look has a dark and a light palette and matches the user's Claude Code theme. Each look also ships a companion **Claude Code theme** (through `experimental.themes`) that recolors the parts a mod cannot touch, such as the prompt box border and dialogs. Using the companion theme is optional.

### 3.2 Surfaces each look draws

| Surface (render site) | What a look does with it |
|---|---|
| `ToolUse`, `ToolGroup`, `ToolResult` | The tool rows: icons or chips, paths, `+/−` counts, durations. Groups fold or unfold by look. Results collapse except failures. |
| `Spinner` | The live line, with three states: **thinking**, **running a tool**, and **needs you**. Each has its own calm rhythm. |
| `TurnDuration` | The receipt that closes a turn: duration, files changed, `+/−`, context used. |
| `UserMessage` | The prompt row, and the turn headline above it when Headlines is on. |
| `AssistantMessage` | Footnote markers when Footnotes is on. Otherwise untouched: Claude's prose is never restyled. |
| `PromptHint`, `SessionMode` | The hint line and mode labels in the look's voice, plus the context forecast. |
| `AbovePrompt` band | Mission Control's telemetry; the attention ladder's first step. Always includes other mods' band content. |
| `Pane` | Chapters, Ledger, Pins and the picker. |

### 3.3 Ingredients

Ingredients work in every look. Each look has a sensible default set, and the user can turn any ingredient on or off.

| Ingredient | What it does |
|---|---|
| **Recency fade** | Older rows step toward the background color, so the eye lands on the newest line. Fullscreen only. |
| **File colors** | Each file keeps one color everywhere: rows, the ledger, the receipt. Colors come from a stable hash of the path. |
| **Footnotes** | Reads, searches and passing commands become numbered footnotes on Claude's prose. Edits and failures stay in place. |
| **Mini diffs** | Each edit shows its two or three most telling changed lines under the row, taken from the tool's own input. |
| **Time strip** | The receipt adds a bar showing where the turn's time went: thinking, tools, and waiting on you. |
| **Headlines** | When a turn finishes, a short title appears above its prompt, so a long session reads like a table of contents. Titles are derived locally (section 6.3). |
| **Quiet transcript** | Hides everything except Claude's prose and the changes it made, with a one-line count of hidden steps. |
| **Attention ladder** | When Claude needs you: the live line glows, then a toast after 30 seconds, then (opt-in) a sound and a desktop notification after 2 minutes. |
| **-inator mode** | A layer of personality: spinner words like "Scheming" and "Monologuing", receipts like "in which the Race-Condition-inator is defeated". |

### 3.4 Panes

- **Chapters.** Each prompt in this session is a chapter with its title, files touched, `+/−` and age. `↑↓` to move, `⏎` to jump the transcript to it, `/` to search. Jumping uses `$.ui.scroll({ to: { requestId } })` with the prompt row's id, which Claude Code allows because the user pressed the key. It works in fullscreen mode; in the classic layout the transcript is terminal scrollback, so the pane shows the chapter's details instead.
- **Ledger.** Every file changed this session, with totals and the turns that changed it. `⏎` shows the diff.
- **Pins.** Notes worth keeping in view. `/pin <text>` adds one. Pins are the only conversation-derived data Claudinator saves, because the user asked for them, and they can be deleted from the pane.

Panes use the active look's styling. On a wide terminal they dock as a sidebar, and on a narrow one they sit above the prompt.

### 3.5 The picker and commands

| Command | What it does |
|---|---|
| `/claudinator` | Opens the picker pane: **Looks**, **Ingredients** and **Combos** tabs, a footer showing the share code and whether you are in fullscreen. Every press applies live. |
| `/look <name>` | Switches look directly, for example `/look sumi`. `/look off` passes everything through. |
| `/look share` | Prints a short code for the current setup, such as `HL-7F3A`. |
| `/look use <code>` | Applies a shared setup. |
| `/chapters`, `/ledger`, `/pins` | Open a pane directly. |
| `/pin <text>` | Pins a note. |

Five **combos** ship as one-press presets: Daily driver (Hairline with headlines, file colors and the attention ladder), Storyteller (Broadsheet with footnotes), Show-off (Prism with a time strip), Doof mode (Blueprint with `-inator mode`) and Zen (Sumi with footnotes and fade).

Commands are registered last in `session.start`, because a name collision throws and would skip the rest of the setup. Commands that only change the drawing are registered with `immediate: true` so they work while Claude is busy.

## 4. Architecture

```
hooks/register.ts        The only file that touches $. Registers every hook and
                          command, builds the capability object, owns timers.
src/engine/
  settings.ts             Settings schema, defaults, validation, migration,
                          share-code encode/decode, combos.
  session-model.ts        In-memory model of this session, built from live
                          events: turns, tool calls, files, timings, pins.
  format.ts               Paths, durations, counts, pluralisation.
  palette.ts              Color math: hashing file colors, fading toward the
                          background, gradients, 256-color fallback.
src/looks/
  look.ts                 The Look interface every look implements.
  hairline/ … blueprint/
src/ingredients/          One file per ingredient: a pure transform applied by
                          the engine before or after the look draws a row.
src/panes/                picker.ts, chapters.ts, ledger.ts, pins.ts
themes/                   Companion Claude Code themes, one JSON per look.
types/index.d.ts          The $.state contract.
```

**The capability object.** `register.tsx` creates one plain object in `session.start` whose methods each make a single literal mods API call (`invalidate`, `toast`, `openPane`, `storeGet`, `storeSet`, `playSound`, and so on). Pure modules receive that object and the element constructors from `$.ui.resolve(e)`. This satisfies the validator rule and keeps every module in `src/` testable without Claude Code.

**The Look interface.** Each look exports one object with a renderer per surface: `toolUse`, `toolGroup`, `toolResult`, `live` (thinking, running and needs-you states), `receipt`, `userMessage`, `headline`, `hint`, `band`, and a `paneStyle` used by every pane. A renderer receives the row's props, the resolved settings, the session model, the element table and the surface, and returns an element tree or `null` for "draw nothing here".

**Render flow for one row.**

1. The `ui.render` hook for that site calls `engine.render(site, e, caps)`.
2. With the look set to Off, it returns `next(e)` at once.
3. Ingredients that decide visibility run first (Quiet, Footnotes). A hidden row returns an empty `Box`.
4. The look draws the row.
5. Ingredients that decorate run on the result (Recency fade recolors, Mini diffs appends lines, File colors applies hues).
6. If the tree uses an element the surface lacks, the look's text fallback is used instead.

**Live updates.** Settings live in `$.state` atoms, so a change in the picker redraws every site that reads them, with no manual invalidation. Animations (the shimmer, the ensō, the Mission Control trace) run from one `$.clock.every` timer that ticks only while a turn is running, and stops when it ends.

## 5. Settings

- **Shape.** `{ version, look, ingredients: { recency, fileColors, footnotes, miniDiffs, timeStrip, headlines, quiet, attention, inator }, attention: { toastAfterSec, notifyAfterSec, sound, desktopNotify }, panes: { autoOpenChapters } }`. Unknown or invalid values fall back to defaults, and older versions are migrated.
- **Where they live, in order of precedence.** (Revised 2026-10-03 after the v0.1 review: a project now sets defaults instead of overriding the user, so `/look off` always works and a project can never force anything on someone.)
  1. The user's own choices in `$.store`, saved field by field: only what they changed in the picker or with `/look`. Shared by every session on the machine.
  2. A project file `.claude/claudinator.json`, if present: defaults for everyone in that repo. It is read-only to Claudinator and can never turn on Quiet.
  3. Defaults from `userConfig` in the manifest, editable in `/config` (`look` as a picker, each ingredient as a boolean).
  4. Built-in defaults: Hairline with recency fade and mini diffs. The attention ladder (toast step only) joins the defaults when it ships in 0.5.0.
- **Live values.** The resolved settings are mirrored into `$.state` atoms for the session. They are reloaded from the store in `classic.SessionStart` after `/clear`, `/resume` and `/branch`, which reset `$.state`.
- **Share codes.** A versioned, compact encoding of look and ingredients (for example `HL-7F3A`) with a checksum character. A code from a newer version that we cannot read is rejected with a clear message.

## 6. Data handling

### 6.1 What Claudinator reads

- The props Claude Code passes to each render site (tool names, inputs, results, durations), to draw that row.
- Live events in the current session (`tool.call` results, turn start and end, prompt submitted), to build the in-memory session model behind panes, receipts and headlines.
- `$.session.usage()` for context, quota and cost readouts.
- Its own settings, from `$.store`, the optional project file and `userConfig`.

### 6.2 What Claudinator stores

- Settings and pins in `$.store` (a JSON file under `~/.claude/plugins/store/`).
- Nothing else. The session model lives in memory and ends with the session. Claudinator writes no logs.

### 6.3 What Claudinator never does

- No network requests. `$.http` is never called, and `claude plugin validate` output will show that.
- No reading of history, memory or transcript files, and no `$.session.messages()` scans.
- No model calls. Headlines are derived locally: the first clause of Claude's final reply, trimmed to a short title, with the user's prompt as a fallback. A model-written headline may come later as an explicitly opt-in, disclosed option.
- No running of programs unless the user turns on sound or desktop notifications. Then it runs only the player or notifier the user's system provides (`pw-play`, `paplay`, `afplay`, `notify-send` or `osascript`), with fixed arguments.

The README's privacy section and the directory submission's data-handling answers are written from this section.

## 7. Fallbacks and edge cases

- **Desktop app.** `Raster`-based pieces (Mission Control's trace and meters, Prism's ribbon and particle band) fall back to text equivalents. Recency fade works through colors.
- **Classic scrolling layout.** Everything draws on new rows. The picker shows a one-line note that switching looks won't repaint your history, and how to turn on fullscreen.
- **Narrow terminals.** Below 100 columns, looks drop secondary columns (duration bars, mini timelines) in a fixed order. Panes sit above the prompt.
- **No truecolor.** If `COLORTERM` is not `truecolor` or `24bit`, palettes map to the nearest 256-color values. Prism's gradients degrade to solid colors.
- **Other mods.** The band always includes `await next(e)`. Rows we don't restyle pass through untouched. With the look set to Off, Claudinator draws nothing.
- **Managed machines.** If an organization blocks user-installed mods (`allowManagedModsOnly`), Claudinator simply does not load. The README says so.
- **A renderer throws.** The hook's error handler logs one line through `$.ui.log` when the plugin was loaded with `--plugin-dir`, and the row falls back to Claude Code's own drawing.

## 8. Testing

- **Unit tests** for every pure module (settings, share codes, session model, formatting, palette math, each look's renderers against a fake element table), run with `claude plugin test`.
- **Integration tests** with `$.ui.mount` on both the `terminal` and `desktop` surfaces: every look renders every site without a refused tree, buttons in the picker change settings, and Quiet and Footnotes hide the rows they should.
- **Validation.** `claude plugin validate --strict .` passes, and the `calls:` list contains only the APIs section 6 discloses.
- **Manual check per release** in a real terminal, fullscreen and classic, at 80, 120 and 200 columns, in dark and light themes: a written checklist in `docs/testing.md`.
- **CI** on every push and pull request: validate, then test.

## 9. Repository layout

The plugin sits at the root of its own repository, which the directory recommends, and the repository is also its own marketplace.

```
.claude-plugin/
  plugin.json             name, displayName, version, description, author,
                          homepage, repository, license, keywords, icon,
                          userConfig, types, experimental.themes
  marketplace.json        { name: "claudinator", plugins: [{ name: "claudinator", source: "./" }] }
hooks/
  hooks.json              { "modules": ["./register.ts"] }
  register.tsx
src/                      engine, looks, ingredients, panes (section 4)
themes/                   companion Claude Code themes
types/index.d.ts
tests/                    *.test.ts
demos/
  fixture/                a small sample project the demos run against
  tapes/                  one VHS tape per look, ingredient and release
  record.sh               renders every tape to GIF
docs/
  design/                 specs like this one
  plans/                  implementation plans
  looks.md, ingredients.md, privacy.md, testing.md
.github/                  CI workflow, issue and pull request templates
README.md  CHANGELOG.md  CONTRIBUTING.md  SECURITY.md  LICENSE
```

**Installing.** `claude plugin marketplace add patheonsceo/claudinator`, then `claude plugin install claudinator@claudinator`.

## 10. Media: a GIF for every release, look and ingredient

- **Tooling.** VHS tapes drive a real Claude Code session in a scripted terminal and render GIFs. Tapes are code, so every GIF can be re-recorded after a change.
- **Fixture.** Demos run against `demos/fixture/`, a small project with a planted bug, using a fixed prompt so sessions are short and similar each time.
- **What gets recorded.**
  - Each release: one hero GIF of the headline change.
  - Each look: the same short turn, in that look.
  - Each ingredient: a before and after of the same turn.
- **Budget.** At most 2 MB and 15 frames a second per GIF, recorded at 1200 by 700 pixels with a consistent font and window.
- **Where they live.** On an orphan `media` branch, referenced from the README by raw URL. The default branch, which is what users install, stays free of large files.

## 11. Releases and repository practice

- **Versions.** Semantic versioning. `version` lives only in `plugin.json` and is bumped on every release, because Claude Code only offers updates when it changes.
- **Tags.** `claude plugin tag --push` creates `claudinator--v<version>`, and a GitHub release follows with the changelog section and that release's GIFs.
- **Commits.** Conventional Commits (`feat(looks): …`, `fix(engine): …`, `docs: …`). Each commit leaves the plugin loadable, validated and tested.
- **Changelog.** Keep a Changelog, updated in the same pull request as the change.
- **Directory submission (at v1.0).**
  - The repository is public with a README of the required depth: what it does, three example uses, and everything it reads and runs.
  - A LICENSE file and a security contact.
  - `displayName` "Claudinator", and author "patheonsceo".
  - A "not affiliated with Anthropic" line, and no Claude or Anthropic logos.
  - Expect a human review, because the name contains "Claud" and the mod observes every tool call.

## 12. Milestones

| Version | Theme | Contents |
|---|---|---|
| **0.1.0** | Foundation | Engine, settings and `$.state`, the picker, the **Hairline** look on every surface, ingredients **Recency fade**, **Mini diffs**, **File colors** and **Quiet**, Desktop and classic fallbacks, tests, CI, the marketplace, the GIF pipeline and the first GIFs. |
| **0.2.0** | Navigation | **Chapters**, **Ledger** and **Pins** panes; **Headlines** and **Footnotes**. |
| **0.3.0** | Looks I | **Broadsheet**, **Prism**, **Mission Control** (with **Time strip** and the telemetry band). |
| **0.4.0** | Looks II | **Sumi**, **Blueprint** and **-inator mode** (Thermal was cut). |
| **0.5.0** | Attention and sharing | The **attention ladder** with opt-in sound and notifications, **combos**, and **share codes**. |
| **1.0.0** | Polish and listing | Companion themes for every look, full docs, a performance pass, and the directory submission. |

**Later ideas, not scheduled:** wallpaper sync (an accent taken from the desktop palette), a bridge to notch apps such as OpenAgentIsland, earcons, a context forecast in the hint line, handoff notes, idle dim, diff peek in the Ledger, a PNG session card, and an extension point so others can publish community looks.

## 13. Spike evidence

The 2026-10-03 spike loaded a throwaway mod into a separate session (Claude Code v2.1.288) and showed:

- In fullscreen mode, `$.ui.invalidate` repainted every earlier row: the headline above the prompt, the tool group and the receipt. Switching from a pane's hotkey repainted the whole transcript instantly.
- In the classic layout, rows already in terminal history kept their old drawing. Only on-screen rows updated.
- Returning an empty `Box` hid a `ToolGroup` and its result completely, leaving the row's one-line gap.
- `UserMessage` accepted a line drawn above Claude Code's own row, which is how Headlines work.
- The first `ToolUse` render carries `input: {}`. The full input arrives on later renders.
- Short runs of reads and commands arrive as one `ToolGroup`, not as separate `ToolUse` rows.

## 14. Open questions

1. **Name review.** "Claudinator" passes every written naming rule. A directory reviewer may still hold it as close to a known brand. If they object, the fallback is to keep the repository and change `displayName` only, since `name` must never change.
2. **Default sound.** Sounds are off by default. Should the attention ladder's final step have a sound on by default on macOS, where it needs no extra program?
3. **Smart headlines.** Do we want an opt-in, model-written headline mode later, given that it spends the user's usage and sends turn text to the model?
