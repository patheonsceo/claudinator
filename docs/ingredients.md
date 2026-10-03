# Ingredients

Ingredients work in any look. Toggle them in the `/claudinator` picker, or set defaults in `/config`.

| Ingredient | Key | Default | What it does |
|---|---|---|---|
| Recency fade | `r` | on | Rows from the previous turn dim; older rows dim further. Your eye lands on the newest line. Needs fullscreen mode. |
| Mini diffs | `d` | on | Each edit shows up to three changed lines under its row. |
| File colors | `f` | off | Each file keeps one color everywhere it appears. |
| Quiet | `q` | off | Hides reads, searches, commands and web fetches, leaving a "· N steps hidden" line. Claude's prose, edits, failures, agents and other tools stay. |

### Mini diffs

![Mini diffs](https://raw.githubusercontent.com/patheonsceo/claudinator/media/0.1.0/ingredient-mini-diffs.gif)

### Recency fade

![Recency fade](https://raw.githubusercontent.com/patheonsceo/claudinator/media/0.1.0/ingredient-recency.gif)

### File colors

![File colors](https://raw.githubusercontent.com/patheonsceo/claudinator/media/0.1.0/ingredient-file-colors.gif)

### Quiet

![Quiet](https://raw.githubusercontent.com/patheonsceo/claudinator/media/0.1.0/ingredient-quiet.gif)

## Per-project settings

A project can set default looks and ingredients for everyone who works in it with `.claude/claudinator.json`:

```json
{ "look": "hairline", "ingredients": { "fileColors": true } }
```

Anything you choose yourself, in the picker or with `/look`, takes precedence over the project's defaults, so `/look off` always works. A project cannot turn on Quiet: hiding tool calls is always your own choice.

Settings apply in this order, later winning: built-in defaults, your `/config` options, the project's file, then your own choices.

Quiet hides reads, searches, commands and web fetches. Agents and other tools, such as MCP tools that send messages, always stay visible, and every hidden row leaves a "· N steps hidden" line.
