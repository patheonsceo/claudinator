# Privacy and data handling

Claudinator runs inside Claude Code on your machine. This page lists everything it reads, keeps and runs.

## What it reads

- The details Claude Code passes to each row it draws: tool names, their full inputs (for example a command or the text of an edit), results and durations, your prompts and Claude's replies as they are drawn.
- Live events in the current session: each prompt you send, each turn starting and ending with Claude's answer, each tool call with its full input and whether it succeeded, and whether Claude Code asked your permission for it.
- Your session's context use, rate limits and cost after each turn, for receipts and Mission Control's telemetry.
- Your Claude Code theme setting, to tell light themes from dark.
- Its own settings: your saved choice, the plugin's options in `/config`, and `.claude/claudinator.json` in the current project if that file exists.

## What it keeps

- On disk, in Claude Code's plugin store (`~/.claude/plugins/store/`): your look and ingredient choices, and your pins.
- In memory, for the current session only: each turn's prompt and a short title taken from its answer, each tool call's timing, footnote numbers, the files changed and their line counts. That is gone when the session ends. Claudinator writes no logs.

## What it runs

Nothing, unless you turn on the attention ladder's sound or desktop notification in `/config`. Then, after Claude has waited two minutes on your permission, it runs one of `pw-play`, `paplay` or `afplay` (sound) and one of `notify-send` or `osascript` (notification), with fixed arguments. The notification's text is passed as plain arguments, never inside a script.

## What it never does

- It makes no network requests.
- It never reads Claude's history, memory or transcript files, and never reads the conversation back.
- It never calls a model.
- It never lets a project hide tool calls from you. A project's `.claude/claudinator.json` can suggest a look and ingredients, but it cannot turn on Quiet or Footnotes, a look it picks never brings them, and anything you choose yourself takes precedence.

## Check it yourself

`claude plugin validate` lists every Claude Code API a plugin calls:

```sh
claude plugin validate .claude-plugin/plugin.json
```
