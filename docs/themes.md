# Themes

Claudinator restyles rows inside Claude Code. Two more layers finish a look, and all six looks ship both, dark and light:

| Layer | What it colors | How you turn it on |
|---|---|---|
| **Claude Code theme** | Claude Code's own interface: the input box border, your messages' background, accents, dim text, diff colors | `/theme`, then pick *Claudinator <Look> Dark* or *Light* |
| **Terminal color scheme** | The terminal window itself: its background and the 16 base colors | Add the file for your terminal, below |

Claude Code cannot change your terminal's own colors, so the color schemes are files you add once. They live in [`terminal/`](../terminal).

## Claude Code theme

Run `/theme` and pick the look's theme, such as **Claudinator Prism Dark** (marked *from claudinator*). To set one in a settings file instead, use `custom:claudinator:<look>-<dark|light>`:

```json
{ "theme": "custom:claudinator:prism-dark" }
```

The looks' ids are `hairline`, `broadsheet`, `mission`, `prism`, `sumi` and `blueprint`. Claudinator reads your theme setting to pick its own colors for light or dark, so a light theme gives the looks their light colors too.

Besides recoloring the prompt box, dialogs and accents, each theme tints the surfaces Claude Code otherwise leaves a fixed gray: the pane docked beside the transcript (the picker, Chapters, Ledger and Pins) and `!` command and memory messages take the look's raised surface color.

## Terminal color schemes

Each file below exists for every look as `claudinator-<look>-dark` and `claudinator-<look>-light`, for example `claudinator-blueprint-dark`.

| Terminal | File | Install |
|---|---|---|
| Ghostty | [`terminal/ghostty/`](../terminal/ghostty) | Copy to `~/.config/ghostty/themes/`, then add `theme = claudinator-blueprint-dark` to your Ghostty config. |
| kitty | [`terminal/kitty/`](../terminal/kitty) | Copy next to `kitty.conf`, then add `include claudinator-blueprint-dark.conf` to it. |
| WezTerm | [`terminal/wezterm/`](../terminal/wezterm) | Copy to `~/.config/wezterm/colors/`, then set `config.color_scheme = 'Claudinator Blueprint Dark'`. |
| Alacritty | [`terminal/alacritty/`](../terminal/alacritty) | Copy to `~/.config/alacritty/`, then add the file to `import` under `[general]` in `alacritty.toml`. |
| Windows Terminal | [`terminal/windows-terminal/`](../terminal/windows-terminal) | Paste the JSON into the `schemes` list of your settings, then set the profile's `colorScheme` to `Claudinator Blueprint Dark`. |
| iTerm2 | [`terminal/iterm2/`](../terminal/iterm2) | Settings → Profiles → Colors → Color Presets → Import, then pick it. |

## For contributors

Every theme file is generated from one palette per look in [`palettes/`](../palettes). After changing a palette, run:

```sh
node tools/themes.mjs          # regenerate every file, including each look's demo recording theme
node --test tools/themes.test.mjs             # test the generator
```

CI runs `node tools/themes.mjs --check` and fails if a committed file is out of date.
