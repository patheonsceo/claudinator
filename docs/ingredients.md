# Ingredients

Ingredients work in any look. Toggle them in the `/claudinator` picker with their letter keys. Each look turns on its own favorites by default, and anything you choose yourself always wins.

| Key | Ingredient | What it does |
|---|---|---|
| `r` | Recency fade | Rows from the previous turn dim; older rows dim further. Your eye lands on the newest line. Needs fullscreen mode. |
| `d` | Mini diffs | Each edit shows up to three changed lines under its row. With it off, Claude Code shows its full diff. |
| `f` | File colors | Each file keeps one color everywhere it appears. |
| `q` | Quiet | Hides reads, searches, commands and web fetches, leaving a "· N steps hidden" line. Claude's prose, edits, failures, agents and other tools stay. |
| `h` | Headlines | When a turn finishes, a short title, taken from the first sentence of Claude's answer, appears above its prompt. |
| `n` | Footnotes | Reads, searches and web fetches become numbered marks on Claude's reply, with the notes listed on the receipt. Commands, edits, failures and interrupted calls keep their rows, as do calls made by subagents or while Footnotes is off. Terminal only: elsewhere, and on a turn whose receipt could not list its notes, the rows stay. |
| `t` | Time strip | While Claude works through a todo list, a strip just above the prompt fills task by task and names the task in hand ("2 of 4 · Fixing total"). Under every receipt, one line shows where that run's time went: thinking, tools and waiting on you, each in the look's own color, plus how many tasks were done. Calls that run side by side count once, and a call that asked splits into your wait and its run. Needs 60 columns. |
| `a` | Attention ladder | When Claude waits on your permission: a toast after 30 seconds, then, if you turn them on in `/config`, a short system sound and a desktop notification after 2 minutes. It stops as soon as you answer, and stays quiet in modes where nobody is asked (auto, don't ask, bypass). On by default (toast only). |
| `i` | -inator mode | A layer of personality: "Scheming…" while Claude thinks, and a quip on every receipt. |

## See each one

### Mini diffs
![Mini diffs](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/ingredient-mini-diffs.gif)

### Recency fade
![Recency fade](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/ingredient-recency.gif)

### File colors
![File colors](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/ingredient-file-colors.gif)

### Quiet
![Quiet](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/ingredient-quiet.gif)

### Headlines
![Headlines](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/ingredient-headlines.gif)

### Footnotes
![Footnotes](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/ingredient-footnotes.gif)

### Time strip
![Time strip](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/ingredient-time-strip.gif)

### Attention ladder
![Attention ladder](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/attention.gif)

### -inator mode
![-inator mode](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/ingredient-inator.gif)

## Sound and notifications

The attention ladder's last step is off until you turn it on in `/config`:

- **Sound when Claude needs you** plays a short system sound with `pw-play` or `paplay` (Linux) or `afplay` (macOS).
- **Desktop notification when Claude needs you** uses `notify-send` (Linux) or `osascript` (macOS).

Claudinator runs only these programs, with fixed arguments, and only for these two options.

## Per-project defaults

A project can set defaults for everyone who works in it with `.claude/claudinator.json`:

```json
{ "look": "broadsheet", "ingredients": { "fileColors": true } }
```

Settings apply in this order, later winning: built-in defaults, the look's own defaults, your `/config` options, the project's file, then your own choices in the picker or with `/look`. So `/look off` always works.

A project can never hide tool calls from you: its file cannot turn on Quiet or Footnotes, and a look it picks never brings them along.
