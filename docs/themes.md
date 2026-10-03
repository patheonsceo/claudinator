# Themes

Claudinator restyles rows inside Claude Code. Two more layers finish a look, and every look ships both, dark and light:

| Layer | What it colors | How you turn it on |
|---|---|---|
| **Claude Code theme** | Claude Code's own interface: the input box border, your messages' background, accents, dim text, diff colors | `/theme`, then pick *Claudinator Hairline Dark* or *Light* |
| **Terminal color scheme** | The terminal window itself: its background and the 16 base colors | Add the file for your terminal, below |

Claude Code cannot change your terminal's own colors, so the color schemes are files you add once. They live in [`terminal/`](../terminal).

## Claude Code theme

Run `/theme` and pick **Claudinator Hairline Dark** or **Claudinator Hairline Light** (marked *from claudinator*). To set it in a settings file instead:

```json
{ "theme": "custom:claudinator:hairline-dark" }
```

## Terminal color schemes

Each file below exists as `claudinator-hairline-dark` and `claudinator-hairline-light`.

| Terminal | File | Install |
|---|---|---|
| Ghostty | [`terminal/ghostty/`](../terminal/ghostty) | Copy to `~/.config/ghostty/themes/`, then add `theme = claudinator-hairline-dark` to your Ghostty config. |
| kitty | [`terminal/kitty/`](../terminal/kitty) | Copy next to `kitty.conf`, then add `include claudinator-hairline-dark.conf` to it. |
| WezTerm | [`terminal/wezterm/`](../terminal/wezterm) | Copy to `~/.config/wezterm/colors/`, then set `config.color_scheme = 'Claudinator Hairline Dark'`. |
| Alacritty | [`terminal/alacritty/`](../terminal/alacritty) | Copy to `~/.config/alacritty/`, then add the file to `import` under `[general]` in `alacritty.toml`. |
| Windows Terminal | [`terminal/windows-terminal/`](../terminal/windows-terminal) | Paste the JSON into the `schemes` list of your settings, then set the profile's `colorScheme` to `Claudinator Hairline Dark`. |
| iTerm2 | [`terminal/iterm2/`](../terminal/iterm2) | Settings → Profiles → Colors → Color Presets → Import, then pick it. |

## For contributors

Every theme file is generated from one palette per look in [`palettes/`](../palettes). After changing a palette, run:

```sh
node tools/themes.mjs          # regenerate every file
node --test tools/themes.test.mjs             # test the generator
```

CI runs `node tools/themes.mjs --check` and fails if a committed file is out of date.
