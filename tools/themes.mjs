#!/usr/bin/env node
// Builds every theme file from the palettes in ../palettes/:
//   node tools/themes.mjs           write the files
//   node tools/themes.mjs --check   fail if any committed file is out of date
// One palette per look gives a Claude Code theme (themes/) and color schemes
// for the terminals people use (terminal/), dark and light.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ANSI_NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

function v(palette, variant) {
  const value = palette.variants[variant]
  if (!value) throw new Error(`${palette.id} has no ${variant} variant`)
  return value
}

function title(palette, variant) {
  return `Claudinator ${palette.name} ${v(palette, variant).label}`
}

function slug(palette, variant) {
  return `claudinator-${palette.id}-${variant}`
}

// Surfaces Claude Code paints a fixed gray in every theme: the pane docked beside
// the transcript, and `!` command and memory messages. Unless a palette sets them,
// they take the look's raised surface, the color of your own prompts.
const RAISED_SURFACES = ['composerSidebarBackground', 'bashMessageBackgroundColor', 'memoryBackgroundColor']

export function claudeTheme(palette, variant) {
  const x = v(palette, variant)
  const raised = x.tokens.userMessageBackground
  const surfaces = raised === undefined ? {} : Object.fromEntries(RAISED_SURFACES.map(key => [key, raised]))
  return { name: title(palette, variant), base: x.base, overrides: { ...surfaces, ...x.tokens } }
}

export function ghostty(palette, variant) {
  const x = v(palette, variant)
  const t = x.terminal
  return [
    `# ${title(palette, variant)}`,
    ...x.ansi.map((c, i) => `palette = ${i}=${c}`),
    `background = ${t.background}`,
    `foreground = ${t.foreground}`,
    `cursor-color = ${t.cursor}`,
    `selection-background = ${t.selection}`,
    `selection-foreground = ${t.selectionText}`,
    '',
  ].join('\n')
}

export function kitty(palette, variant) {
  const x = v(palette, variant)
  const t = x.terminal
  return [
    `# ${title(palette, variant)}`,
    `foreground ${t.foreground}`,
    `background ${t.background}`,
    `cursor ${t.cursor}`,
    `selection_foreground ${t.selectionText}`,
    `selection_background ${t.selection}`,
    ...x.ansi.map((c, i) => `color${i} ${c}`),
    '',
  ].join('\n')
}

const q = s => JSON.stringify(s)

export function wezterm(palette, variant) {
  const x = v(palette, variant)
  const t = x.terminal
  return [
    '[colors]',
    `foreground = ${q(t.foreground)}`,
    `background = ${q(t.background)}`,
    `cursor_bg = ${q(t.cursor)}`,
    `cursor_border = ${q(t.cursor)}`,
    `cursor_fg = ${q(t.background)}`,
    `selection_bg = ${q(t.selection)}`,
    `selection_fg = ${q(t.selectionText)}`,
    `ansi = [${x.ansi.slice(0, 8).map(q).join(', ')}]`,
    `brights = [${x.ansi.slice(8).map(q).join(', ')}]`,
    '',
    '[metadata]',
    `name = ${q(title(palette, variant))}`,
    '',
  ].join('\n')
}

export function alacritty(palette, variant) {
  const x = v(palette, variant)
  const t = x.terminal
  const block = (name, colors) => [`[colors.${name}]`, ...ANSI_NAMES.map((n, i) => `${n} = ${q(colors[i])}`)]
  return [
    `# ${title(palette, variant)}`,
    '[colors.primary]',
    `background = ${q(t.background)}`,
    `foreground = ${q(t.foreground)}`,
    '',
    '[colors.cursor]',
    `cursor = ${q(t.cursor)}`,
    `text = ${q(t.background)}`,
    '',
    '[colors.selection]',
    `background = ${q(t.selection)}`,
    `text = ${q(t.selectionText)}`,
    '',
    ...block('normal', x.ansi.slice(0, 8)),
    '',
    ...block('bright', x.ansi.slice(8)),
    '',
  ].join('\n')
}

export function windowsTerminal(palette, variant) {
  const x = v(palette, variant)
  const t = x.terminal
  const names = ['black', 'red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'white']
  const scheme = {
    name: title(palette, variant),
    background: t.background,
    foreground: t.foreground,
    cursorColor: t.cursor,
    selectionBackground: t.selection,
  }
  names.forEach((n, i) => {
    scheme[n] = x.ansi[i]
  })
  names.forEach((n, i) => {
    scheme[`bright${n[0].toUpperCase()}${n.slice(1)}`] = x.ansi[i + 8]
  })
  return JSON.stringify(scheme, null, 2) + '\n'
}

function colorDict(hex) {
  const c = i => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(6)
  return [
    '\t<dict>',
    '\t\t<key>Alpha Component</key>\n\t\t<real>1</real>',
    `\t\t<key>Blue Component</key>\n\t\t<real>${c(5)}</real>`,
    '\t\t<key>Color Space</key>\n\t\t<string>sRGB</string>',
    `\t\t<key>Green Component</key>\n\t\t<real>${c(3)}</real>`,
    `\t\t<key>Red Component</key>\n\t\t<real>${c(1)}</real>`,
    '\t</dict>',
  ].join('\n')
}

export function iterm2(palette, variant) {
  const x = v(palette, variant)
  const t = x.terminal
  const entries = [
    ...x.ansi.map((c, i) => [`Ansi ${i} Color`, c]),
    ['Background Color', t.background],
    ['Foreground Color', t.foreground],
    ['Bold Color', t.foreground],
    ['Cursor Color', t.cursor],
    ['Cursor Text Color', t.background],
    ['Selection Color', t.selection],
    ['Selected Text Color', t.selectionText],
  ]
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    `<!-- ${title(palette, variant)} -->`,
    '<plist version="1.0">',
    '<dict>',
    ...entries.map(([key, hex]) => `\t<key>${key}</key>\n${colorDict(hex)}`),
    '</dict>',
    '</plist>',
    '',
  ].join('\n')
}

/** The theme line for VHS, which records the demo GIFs. */
export function vhsTheme(palette, variant) {
  const x = v(palette, variant)
  const t = x.terminal
  const theme = { name: title(palette, variant) }
  ANSI_NAMES.forEach((n, i) => {
    theme[n] = x.ansi[i]
  })
  ANSI_NAMES.forEach((n, i) => {
    theme[`bright${n[0].toUpperCase()}${n.slice(1)}`] = x.ansi[i + 8]
  })
  Object.assign(theme, { background: t.background, foreground: t.foreground, selection: t.selection, cursor: t.cursor })
  return `Set Theme ${JSON.stringify(theme)}`
}

/** Every file one palette produces, as { path, content }. */
export function outputs(palette) {
  const files = []
  for (const variant of Object.keys(palette.variants)) {
    const name = slug(palette, variant)
    files.push(
      { path: `themes/${palette.id}-${variant}.json`, content: JSON.stringify(claudeTheme(palette, variant), null, 2) + '\n' },
      { path: `terminal/ghostty/${name}`, content: ghostty(palette, variant) },
      { path: `terminal/kitty/${name}.conf`, content: kitty(palette, variant) },
      { path: `terminal/wezterm/${name}.toml`, content: wezterm(palette, variant) },
      { path: `terminal/alacritty/${name}.toml`, content: alacritty(palette, variant) },
      { path: `terminal/windows-terminal/${name}.json`, content: windowsTerminal(palette, variant) },
      { path: `terminal/iterm2/${name}.itermcolors`, content: iterm2(palette, variant) },
    )
  }
  return files
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const isCheck = process.argv.includes('--check')
  const palettes = readdirSync(join(root, 'palettes'))
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(root, 'palettes', f), 'utf8')))
  const files = palettes.flatMap(outputs)
  // Each look's demo recordings use its own terminal colors and its own Claude Code theme.
  for (const palette of palettes) {
    files.push({ path: `demos/themes/${palette.id}.tape`, content: vhsTheme(palette, 'dark') + '\n' })
    files.push({
      path: `demos/themes/${palette.id}.settings.json`,
      content: JSON.stringify({ statusLine: { type: 'command', command: 'true' }, theme: `custom:claudinator:${palette.id}-dark` }, null, 2) + '\n',
    })
  }
  const stale = []
  for (const file of files) {
    const path = join(root, file.path)
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null
    if (current === file.content) continue
    if (isCheck) {
      stale.push(file.path)
      continue
    }
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, file.content)
  }
  if (isCheck && stale.length > 0) {
    console.error(`Out of date, run node tools/themes.mjs:\n  ${stale.join('\n  ')}`)
    process.exit(1)
  }
  console.log(isCheck ? `${files.length} theme files up to date` : `Wrote ${files.length} theme files`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
