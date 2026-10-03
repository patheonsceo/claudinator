# Privacy and data handling

Claudinator runs inside Claude Code on your machine. This page lists everything it reads, keeps and runs.

## What it reads

- The details Claude Code passes to each row it draws: tool names, inputs, results and durations.
- Live events in the current session: the moment a prompt is sent (only the time, never the text), a turn starting and ending, and each tool call and whether it succeeded.
- Your session's context usage, after each turn, for the receipt.
- Its own settings: your saved choice, the plugin's options in `/config`, and `.claude/claudinator.json` in the current project if that file exists.

## What it keeps

- Your look and ingredient choice, in Claude Code's plugin store (`~/.claude/plugins/store/`).
- Nothing else. What it knows about the session lives in memory and is gone when the session ends. Claudinator writes no logs.

## What it never does

- It makes no network requests.
- It never reads Claude's history, memory or transcript files, and never reads the conversation back.
- It never calls a model and never runs a program.
- It never lets a project hide tool calls from you. A project's `.claude/claudinator.json` can choose a look, but it cannot turn on Quiet; only you can.

## Check it yourself

`claude plugin validate` lists every Claude Code API a plugin calls. For Claudinator:

```sh
claude plugin validate .claude-plugin/plugin.json
```

prints `$.clock`, `$.command.register`, `$.fs.read` (the project settings file), `$.session.usage`, `$.state`, `$.store`, and `$.ui` calls, and nothing else.
