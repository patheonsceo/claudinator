# Panes

One pane, three tabs. Open it with a command, switch tabs with `c`, `l` and `p`, and close it with Esc. On a wide fullscreen terminal it docks beside the transcript; otherwise it sits above the prompt.

![Chapters, Ledger and Pins](https://raw.githubusercontent.com/patheonsceo/claudinator/media/1.0.0/navigator.gif)

## Chapters (`/chapters`)

Every turn in this session, by its headline (or your prompt, while it runs), with its line changes and duration. Select one and press Enter to jump the transcript to that prompt. Jumping needs fullscreen mode; in the classic layout the transcript is your terminal's own scrollback, which Claudinator cannot move.

## Ledger (`/ledger`)

Every file changed this session, with its total lines added and removed and the turns that changed it. Press Enter on a file to jump to its last edit.

## Pins (`/pins`, `/pin`)

Notes worth keeping in view, such as a decision you made with Claude. `/pin Use BroadcastChannel for the lock` adds a note; `/pin` alone pins the last turn's headline. Pins are kept across sessions, up to 50, and each one has a remove button.

Chapters and Ledger are built in memory from the current session and are gone when it ends. Pins are the only session-derived text Claudinator saves, because you asked it to.
