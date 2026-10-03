import assert from 'node:assert/strict'
import { test } from 'node:test'

import { alacritty, claudeTheme, ghostty, iterm2, kitty, outputs, vhsTheme, wezterm, windowsTerminal } from './themes.mjs'

const variant = {
  label: 'Dark',
  base: 'dark',
  terminal: { background: '#111216', foreground: '#e8e9ee', cursor: '#a0a3ff', selection: '#2a2c3a', selectionText: '#e8e9ee' },
  ansi: ['#000001', '#000002', '#000003', '#000004', '#000005', '#000006', '#000007', '#000008', '#000009', '#00000a', '#00000b', '#00000c', '#00000d', '#00000e', '#00000f', '#000010'],
  tokens: { claude: '#a0a3ff', text: '#e8e9ee' },
}
const palette = { id: 'hairline', name: 'Hairline', variants: { dark: variant } }

test('the Claude Code theme names the look and carries the tokens', () => {
  assert.deepEqual(claudeTheme(palette, 'dark'), { name: 'Claudinator Hairline Dark', base: 'dark', overrides: { claude: '#a0a3ff', text: '#e8e9ee' } })
})

test('surfaces Claude Code leaves gray, such as the pane beside the transcript, take the look\'s raised surface', () => {
  const raised = { ...palette, variants: { dark: { ...variant, tokens: { ...variant.tokens, userMessageBackground: '#17181d' } } } }
  const { overrides } = claudeTheme(raised, 'dark')
  assert.equal(overrides.composerSidebarBackground, '#17181d')
  assert.equal(overrides.bashMessageBackgroundColor, '#17181d')
  assert.equal(overrides.memoryBackgroundColor, '#17181d')
  const own = { ...palette, variants: { dark: { ...variant, tokens: { ...variant.tokens, userMessageBackground: '#17181d', composerSidebarBackground: '#101010' } } } }
  assert.equal(claudeTheme(own, 'dark').overrides.composerSidebarBackground, '#101010')
})

test('diffs are tinted, not painted: the look\'s green and red at a fraction over its background', () => {
  const tinted = { ...palette, variants: { dark: { ...variant, tokens: { ...variant.tokens, success: '#7fd1a8', error: '#ff7a85', diffAdded: '#00ff00' } } } }
  const { overrides } = claudeTheme(tinted, 'dark')
  // 14% of #7fd1a8 over #111216, as the lookbook's diff lines.
  assert.equal(overrides.diffAdded, '#202d2a')
  assert.equal(overrides.diffRemoved, '#322126')
  assert.ok(overrides.diffAddedDimmed && overrides.diffRemovedDimmed && overrides.diffAddedWord && overrides.diffRemovedWord)
})

test('every terminal format carries all sixteen colors and the background', () => {
  for (const render of [ghostty, kitty, wezterm, alacritty, windowsTerminal, iterm2]) {
    const text = render(palette, 'dark')
    for (const hex of variant.ansi) assert.ok(text.includes(hex) || text.includes(componentsOf(hex)), `${render.name} misses ${hex}`)
    assert.ok(text.includes('#111216') || text.includes(componentsOf('#111216')), `${render.name} misses the background`)
  }
})

test('ghostty, kitty and windows terminal use their own key names', () => {
  assert.match(ghostty(palette, 'dark'), /^palette = 15=#000010$/m)
  assert.match(kitty(palette, 'dark'), /^color15 #000010$/m)
  const wt = JSON.parse(windowsTerminal(palette, 'dark'))
  assert.equal(wt.name, 'Claudinator Hairline Dark')
  assert.equal(wt.purple, '#000006')
  assert.equal(wt.brightWhite, '#000010')
})

test('iTerm2 colors are 0 to 1 components in a property list', () => {
  const plist = iterm2(palette, 'dark')
  assert.match(plist, /<key>Ansi 15 Color<\/key>/)
  assert.match(plist, /<key>Background Color<\/key>/)
  assert.ok(!/<real>(?:1\.0*[1-9]|[2-9])/.test(plist), 'no component above 1')
})

test('the VHS theme is one Set Theme line', () => {
  const line = vhsTheme(palette, 'dark')
  assert.match(line, /^Set Theme \{.*\}$/)
  assert.equal(JSON.parse(line.slice('Set Theme '.length)).magenta, '#000006')
})

test('outputs list a file for each format and variant', () => {
  const paths = outputs(palette).map(o => o.path)
  assert.ok(paths.includes('themes/hairline-dark.json'))
  assert.ok(paths.includes('terminal/ghostty/claudinator-hairline-dark'))
  assert.ok(paths.includes('terminal/kitty/claudinator-hairline-dark.conf'))
  assert.ok(paths.includes('terminal/wezterm/claudinator-hairline-dark.toml'))
  assert.ok(paths.includes('terminal/alacritty/claudinator-hairline-dark.toml'))
  assert.ok(paths.includes('terminal/windows-terminal/claudinator-hairline-dark.json'))
  assert.ok(paths.includes('terminal/iterm2/claudinator-hairline-dark.itermcolors'))
})

function componentsOf(hex) {
  // The blue channel tells these test colors apart.
  return (parseInt(hex.slice(5, 7), 16) / 255).toFixed(6)
}
