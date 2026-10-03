# Privacy and data handling

Claudinator runs inside Claude Code on your machine. This page lists everything it reads, keeps and runs.

## What it reads

- The details Claude Code passes to each row it draws: tool names, their full inputs (for example a command or the text of an edit), results and durations.
- Live events in the current session: the moment a prompt is sent (only the time, never the text), a turn starting and ending, each tool call with its full input and whether it succeeded, and whether Claude Code asked your permission for it.
- Your session's context usage, after each turn, for the receipt.
- Its own settings: your saved choice, the plugin's options in `/config`, and `.claude/claudinator.json` in the current project if that file exists.

## What it keeps

- Your look and ingredient choice, in Claude Code's plugin store (`~/.claude/plugins/store/`).
- Nothing else on disk. In memory, for the current session only, it keeps each tool call's timing, the paths of files changed and their line counts, and a little bookkeeping to number turns. That is gone when the session ends. Claudinator writes no logs.

## What it never does

- It makes no network requests.
- It never reads Claude's history, memory or transcript files, and never reads the conversation back.
- It never calls a model and never runs a program.
- It never lets a project hide tool calls from you. A project's `.claude/claudinator.json` can suggest a look and ingredients, but it cannot turn on Quiet, and anything you choose yourself takes precedence over it.

## Check it yourself

`claude plugin validate` lists every Claude Code API a plugin calls. For Claudinator:

```sh
claude plugin validate .claude-plugin/plugin.json
```

prints `$.clock`, `$.command.register`, `$.fs.read` (the project settings file), `$.session.usage`, `$.state`, `$.store`, and `$.ui` calls, and nothing else.
