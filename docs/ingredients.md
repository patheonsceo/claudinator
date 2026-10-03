# Ingredients

Ingredients work in any look. Toggle them in the `/claudinator` picker, or set defaults in `/config`.

| Ingredient | Key | Default | What it does |
|---|---|---|---|
| Recency fade | `r` | on | Rows from the previous turn dim; older rows dim further. Your eye lands on the newest line. Needs fullscreen mode. |
| Mini diffs | `d` | on | Each edit shows up to three changed lines under its row. |
| File colors | `f` | off | Each file keeps one color everywhere it appears. |
| Quiet | `q` | off | Hides reads, searches and passing commands. Claude's prose, edits and failures stay. |

### Mini diffs

![Mini diffs](https://raw.githubusercontent.com/patheonsceo/claudinator/media/0.1.0/ingredient-mini-diffs.gif)

### Recency fade

![Recency fade](https://raw.githubusercontent.com/patheonsceo/claudinator/media/0.1.0/ingredient-recency.gif)

### File colors

![File colors](https://raw.githubusercontent.com/patheonsceo/claudinator/media/0.1.0/ingredient-file-colors.gif)

### Quiet

![Quiet](https://raw.githubusercontent.com/patheonsceo/claudinator/media/0.1.0/ingredient-quiet.gif)

## Per-project settings

A project can set a look and ingredients for everyone who works in it with `.claude/claudinator.json`:

```json
{ "look": "hairline", "ingredients": { "fileColors": true } }
```

Choices a project sets show as *(project)* in the picker. A project cannot turn on Quiet: hiding tool calls is always your own choice.
