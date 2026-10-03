import { describe, expect, test } from 'claude-code/testing'

import { resolveSettings, toggled } from '../src/engine/settings'
import type { Ctx, LiveMode, LiveState, ReceiptData, ToolRow } from '../src/looks/look'
import { PRISM } from '../src/looks/prism'
import { DESKTOP_ELS, ctxOf, textOf } from './fixtures'

const PRISM_SETTINGS = resolveSettings([{ look: 'prism' }])
const ctx = (over: Partial<Ctx> = {}): Ctx => ctxOf({ settings: PRISM_SETTINGS, ...over })
const desktop = (over: Partial<Ctx> = {}): Ctx => ctx({ els: DESKTOP_ELS, surface: 'desktop', ...over })
const row = (over: Partial<ToolRow>): ToolRow => ({ id: 't1', tool: 'Read', input: {}, isRunning: false, isErrored: false, isInterrupted: false, ...over })
const edit = row({ tool: 'Edit', input: { file_path: '/work/src/cart.js', old_string: 'return a', new_string: 'return a * qty' }, durationMs: 2_100 })
const inator = { ...PRISM_SETTINGS, ingredients: { ...PRISM_SETTINGS.ingredients, inator: true } }
const noFileColors = toggled(PRISM_SETTINGS, 'fileColors')

type Node = { type: string; props: Record<string, unknown>; children: unknown[] }

/** Every element in a drawn tree, depth first. */
function nodes(tree: unknown): Node[] {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  const n = tree as Node
  return [n, ...nodes(n.children)]
}

/** The pill's label: the filled Text that reads exactly `label`. */
const pillOf = (tree: unknown, label: string): Node | undefined => nodes(tree).find(n => textOf(n) === label && n.props.backgroundColor !== undefined)

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** A raster's cells read back as characters and foreground colors. */
function cellsOf(cells: string): Array<{ char: string; fg: number }> {
  const bytes: number[] = []
  for (let i = 0; i < cells.length; i += 4) {
    const q = [0, 1, 2, 3].map(k => B64.indexOf(cells[i + k] ?? '='))
    const n = ((q[0] ?? 0) << 18) | ((q[1] ?? 0) << 12) | (Math.max(0, q[2] ?? 0) << 6) | Math.max(0, q[3] ?? 0)
    bytes.push((n >> 16) & 255)
    if ((q[2] ?? -1) >= 0) bytes.push((n >> 8) & 255)
    if ((q[3] ?? -1) >= 0) bytes.push(n & 255)
  }
  const word = (i: number): number => ((bytes[i] ?? 0) | ((bytes[i + 1] ?? 0) << 8) | ((bytes[i + 2] ?? 0) << 16) | ((bytes[i + 3] ?? 0) << 24)) >>> 0
  const out: Array<{ char: string; fg: number }> = []
  for (let i = 0; i + 12 <= bytes.length; i += 12) out.push({ char: String.fromCodePoint(word(i)), fg: word(i + 4) })
  return out
}

const charsOf = (cells: string | undefined): string => cellsOf(cells ?? '').map(c => c.char).join('')

const RECEIPT: ReceiptData = {
  durationMs: 134_000,
  stats: {
    turn: 7,
    files: ['/work/src/session.ts', '/work/src/refresh-lock.ts'],
    add: 103,
    del: 10,
    contextPercent: 41.2,
    byFile: [
      { file: '/work/src/session.ts', add: 40, del: 7 },
      { file: '/work/src/refresh-lock.ts', add: 63, del: 3 },
    ],
  },
  notes: [],
  timeStrip: null,
}

const THINKING: LiveState = { mode: 'thinking', detail: '', elapsedMs: 42_000 }
const READING: LiveState = { mode: 'running', detail: 'src/a.ts', activity: 'Reading', elapsedMs: 3_000 }
const RUNNING: LiveState = { mode: 'running', detail: 'pnpm test auth', activity: 'Running', elapsedMs: 3_000 }

/** One of every member's drawing, for checks that apply to all of them. */
function everything(c: Ctx): unknown[] {
  return [
    PRISM.toolRow(edit, c),
    PRISM.toolRow(row({ tool: 'Bash', input: { command: 'ls' }, isErrored: true }), c),
    PRISM.toolRow(row({ tool: 'Task', input: { description: 'explore' }, isRunning: true }), c),
    PRISM.toolGroup([row({ input: { file_path: '/work/a.ts' } }), row({ id: 'b', input: { file_path: '/work/b.ts' } })], c),
    PRISM.quietLine(3, c),
    PRISM.toolResult({ tool: 'Bash', output: { stdout: 'ok' }, isErrored: false }, c),
    PRISM.userMessage('hello', c),
    PRISM.headline({ turn: 7, title: 'The refresh race, fixed' }, c),
    PRISM.receipt({ ...RECEIPT, notes: [{ n: 1, tool: 'Read', input: { file_path: '/work/a.ts' }, durationMs: 100 }], timeStrip: { thinkingMs: 6_000, toolsMs: 2_000, waitingMs: 1_000 } }, c),
    ...(['thinking', 'writing', 'running'] as LiveMode[]).map(mode => PRISM.live({ mode, detail: 'src/a.ts', activity: mode === 'running' ? 'Reading' : undefined, elapsedMs: 3_000 }, 5, c)),
  ]
}

describe('prism tool rows', () => {
  test('a read is a pill in its file color, then folder, file name and time', async () => {
    const tree = PRISM.toolRow(row({ input: { file_path: '/work/src/auth/session.ts' }, durationMs: 200 }), ctx())
    const text = textOf(tree)
    expect(text).toContain('▐ ◇ READ ▌')
    expect(text).toContain('src/auth/session.ts')
    expect(text).toContain('0.2s')
    const pill = pillOf(tree, ' ◇ READ ')
    const name = nodes(tree).find(n => textOf(n) === 'session.ts' && typeof n.props.color === 'string')
    expect(pill?.props.backgroundColor, 'the pill is filled').toMatch(/^#[0-9a-f]{6}$/)
    expect(pill?.props.backgroundColor, 'the pill wears the file color').toBe(name?.props.color)
  })

  test('every chip carries the lookbook mark and word, padded to one width', async () => {
    const cases: Array<[ToolRow, string]> = [
      [row({ input: { file_path: '/work/a.ts' } }), ' ◇ READ '],
      [row({ tool: 'Grep', input: { pattern: 'refreshToken' } }), ' ⌕ FIND '],
      [row({ tool: 'Glob', input: { pattern: '**/*.ts' } }), ' ⌕ FIND '],
      [row({ tool: 'Edit', input: { file_path: '/work/a.ts' } }), ' ◆ EDIT '],
      [row({ tool: 'Write', input: { file_path: '/work/new.ts' } }), ' ✚ NEW  '],
      [row({ tool: 'Bash', input: { command: 'pnpm test' } }), ' › RUN  '],
    ]
    for (const [r, label] of cases) {
      const tree = PRISM.toolRow(r, ctx())
      expect(pillOf(tree, label), label).toBeTruthy()
      const slot = nodes(tree).find(n => n.props.width !== undefined)
      expect(slot?.props.width, 'the chip slot keeps targets in one column').toBe(11)
    }
  })

  test('a command row reads the command once, with no stray run mark before it', async () => {
    const text = textOf(PRISM.toolRow(row({ tool: 'Bash', input: { command: 'node --test' }, durationMs: 500 }), ctx()))
    expect(text).toContain('node --test')
    expect(text.match(/›/g)?.length).toBe(1)
  })

  test('a search row quotes its pattern', async () => {
    expect(textOf(PRISM.toolRow(row({ tool: 'Grep', input: { pattern: 'refreshToken' } }), ctx()))).toContain('"refreshToken"')
  })

  test('non-file chips are muted: commands in the run tint, the rest in the read tint, both with plain text', async () => {
    const run = pillOf(PRISM.toolRow(row({ tool: 'Bash', input: { command: 'ls' } }), ctx()), ' › RUN  ')
    expect(run?.props.backgroundColor).toBe('#3d3022')
    expect(run?.props.color).toBe('#ecebf5')
    const find = pillOf(PRISM.toolRow(row({ tool: 'Grep', input: { pattern: 'x' } }), ctx({ isDark: false })), ' ⌕ FIND ')
    expect(find?.props.backgroundColor).toBe('#e4e0ff')
    expect(find?.props.color).toBe('#1d1b29')
  })

  test('with File colors off, file chips fall back to the read tint', async () => {
    const pill = pillOf(PRISM.toolRow(row({ input: { file_path: '/work/a.ts' } }), ctx({ settings: noFileColors })), ' ◇ READ ')
    expect(pill?.props.backgroundColor).toBe('#2b2550')
  })

  test('an edit shows its counts and, with mini diffs, its changed lines under the target', async () => {
    const tree = PRISM.toolRow(edit, ctx())
    const text = textOf(tree)
    expect(text).toContain('◆ EDIT')
    expect(text).toContain('+1')
    expect(text).toContain('−1')
    expect(text).toContain('- return a')
    expect(text).toContain('+ return a * qty')
    expect(text).toContain('2.1s')
    expect(nodes(tree).filter(n => n.props.paddingLeft === 12).length, 'diff lines start at the target column').toBe(2)
    const plain = textOf(PRISM.toolRow(edit, ctx({ settings: toggled(PRISM_SETTINGS, 'miniDiffs') })))
    expect(plain).toContain('+1')
    expect(plain).not.toContain('- return a')
  })

  test('chip text stays readable: dark ink on light chips, white on saturated light-mode chips', async () => {
    const pill = (isDark: boolean) => pillOf(PRISM.toolRow(row({ input: { file_path: '/work/a.ts' } }), ctx({ isDark })), ' ◇ READ ')
    expect(pill(true)?.props.color).toBe('#0f0d16')
    expect(pill(false)?.props.color).toBe('#ffffff')
  })

  test('a failed call wears the FAIL chip and says so; an interrupted one says STOP', async () => {
    const tree = PRISM.toolRow(row({ tool: 'Bash', input: { command: 'pnpm test' }, isErrored: true }), ctx())
    const text = textOf(tree)
    expect(text).toContain('✕ FAIL')
    expect(text).toContain('failed')
    expect(pillOf(tree, ' ✕ FAIL ')?.props.backgroundColor).toBe('#55202c')
    const stopped = textOf(PRISM.toolRow(row({ tool: 'Edit', input: { file_path: '/work/a.ts' }, isInterrupted: true }), ctx()))
    expect(stopped).toContain('✕ STOP')
    expect(stopped).toContain('interrupted')
  })

  test('a running call shows an ellipsis; a streaming call with empty input still draws', async () => {
    expect(textOf(PRISM.toolRow(row({ isRunning: true, input: { file_path: '/work/a.ts' } }), ctx()))).toContain('…')
    expect(textOf(PRISM.toolRow(row({ tool: 'Edit', input: {} }), ctx()))).toContain('EDIT')
    expect(textOf(PRISM.toolRow(row({ tool: 'mcp__github__create_pull_request', input: { title: 'x' } }), ctx()))).toContain('CREA…')
    expect(textOf(PRISM.toolRow(row({ tool: 'Task', input: { description: 'explore' } }), ctx()))).toContain('✦ AGENT')
  })

  test('long commands and CJK paths truncate, never wrap, and never throw', async () => {
    const trees = [
      PRISM.toolRow(row({ tool: 'Bash', input: { command: 'echo ' + 'x'.repeat(500) } }), ctx()),
      PRISM.toolRow(row({ input: { file_path: '/work/文档/' + '長'.repeat(200) + '.md' } }), ctx({ columns: 60 })),
      PRISM.toolRow(row({ tool: 'Edit', input: { file_path: '/work/a.min.js', old_string: 'a', new_string: 'b'.repeat(20_000) } }), ctx()),
    ]
    for (const tree of trees) {
      for (const n of nodes(tree)) if (n.props.wrap !== undefined) expect(String(n.props.wrap)).toMatch(/^truncate/)
      expect(Math.max(...JSON.stringify(tree).split('"').map(s => s.length))).toBeLessThan(1_000)
    }
  })

  test('escape codes never reach the drawing', async () => {
    const c = ctx()
    const trees = [
      PRISM.toolRow(row({ tool: 'Bash', input: { command: '\x1b[31mred' } }), c),
      PRISM.toolRow(row({ input: { file_path: '/work/\x1b[31mred.ts' } }), c),
      PRISM.toolResult({ tool: 'Bash', output: { stdout: '\x1b[31mred' }, isErrored: false }, c),
      PRISM.userMessage('\x1b[31mred', c),
      PRISM.headline({ turn: 1, title: '\x1b[31mred' }, c),
      PRISM.live({ mode: 'running', detail: '\x1b[31mred', activity: 'Running', elapsedMs: 0 }, 0, desktop()),
      PRISM.live({ mode: 'running', detail: '\x1b[31mred', activity: 'Running', elapsedMs: 0 }, 0, c),
    ]
    for (const tree of trees) expect(JSON.stringify(tree)).not.toContain('\\u001b')
  })

  test('escape and bell bytes from paths, commands and output never reach any tree', async () => {
    const bad = '\x1b[31m' + '\x07'
    const c = ctx()
    const trees = [
      PRISM.receipt({ ...RECEIPT, stats: { turn: 1, files: [`/work/${bad}a.ts`], add: 1, del: 0, byFile: [{ file: `/work/${bad}a.ts`, add: 1, del: 0 }] } }, c),
      PRISM.receipt({ ...RECEIPT, stats: { turn: 1, files: [`/work/${bad}b.ts`], add: 1, del: 0 } }, c),
      PRISM.toolRow(row({ input: { file_path: `/work/${bad}c.ts` } }), c),
      PRISM.toolGroup([row({ input: { file_path: `/work/${bad}d.ts` } }), row({ id: 'e', tool: 'Bash', input: { command: `${bad}ls` } })], c),
      PRISM.toolGroup([row({ tool: 'Bash', input: { command: `${bad}ls` } }), row({ id: 'e', tool: 'Bash', input: { command: `${bad}pwd` } })], c),
      PRISM.toolRow(row({ tool: 'Bash', input: { command: `${bad}ls` } }), c),
      PRISM.toolRow(row({ tool: `mcp__x__${bad}go`, input: { q: `${bad}x` } }), c),
      PRISM.toolResult({ tool: 'Bash', output: { stdout: `${bad}done`, stderr: '' }, isErrored: false }, c),
      PRISM.toolResult({ tool: 'Bash', output: `${bad}boom`, isErrored: true }, c),
      PRISM.live({ mode: 'running', detail: `${bad}a.ts`, activity: 'Reading', elapsedMs: 0 }, 0, desktop()),
    ]
    for (const tree of trees) {
      const json = JSON.stringify(tree)
      expect(json).not.toContain('\\u001b')
      expect(json).not.toContain('\\u0007')
    }
  })
})

describe('prism groups', () => {
  const reads = [0, 1, 2].map(i => row({ id: `r${i}`, input: { file_path: `/work/src/f${i}.ts` }, durationMs: 100 }))

  test('a run of reads is the READ chip, a file count in their folder, and a dot per file in its color', async () => {
    const tree = PRISM.toolGroup(reads, ctx())
    const text = textOf(tree)
    expect(pillOf(tree, ' ◇ READ ')).toBeTruthy()
    expect(text).toContain('3 files in src/')
    expect(text).toContain('0.3s')
    expect(text).not.toContain('×')
    expect(text).not.toContain('STEPS')
    const dots = nodes(tree).filter(n => textOf(n) === '●')
    expect(dots.length).toBe(3)
    expect(nodes(tree).find(n => n.props.width !== undefined)?.props.width, 'groups line up with rows').toBe(11)
  })

  test('a run of commands is the RUN chip and the commands, with no stray run marks', async () => {
    const tree = PRISM.toolGroup([row({ tool: 'Bash', input: { command: 'ls' } }), row({ id: 'b', tool: 'Bash', input: { command: 'pwd' } })], ctx())
    const text = textOf(tree)
    expect(pillOf(tree, ' › RUN  ')?.props.backgroundColor).toBe('#3d3022')
    expect(text).toContain('ls')
    expect(text).toContain('pwd')
    expect(text.match(/›/g)?.length).toBe(1)
  })

  test('a mixed group shows each kind\'s mark in the chip and in front of each step', async () => {
    const tree = PRISM.toolGroup([reads[0] as ToolRow, row({ id: 'x', tool: 'Bash', input: { command: 'ls' } })], ctx())
    const text = textOf(tree)
    expect(pillOf(tree, ' ◇ › ')).toBeTruthy()
    expect(text).toContain('f0.ts')
    expect(text).toContain('› ls')
    expect(text).toContain('2 steps')
  })

  test('a group of one draws as the row it is', async () => {
    const one = reads[0] as ToolRow
    expect(textOf(PRISM.toolGroup([one], ctx()))).toBe(textOf(PRISM.toolRow(one, ctx())))
  })

  test('a failed group wears the FAIL chip', async () => {
    const tree = PRISM.toolGroup([reads[0] as ToolRow, row({ id: 'z', input: { file_path: '/work/x.ts' }, isErrored: true })], ctx())
    expect(pillOf(tree, ' ✕ FAIL ')).toBeTruthy()
    expect(textOf(tree)).toContain('failed')
  })

  test('the quiet line folds steps with a gradient star', async () => {
    expect(textOf(PRISM.quietLine(3, ctx()))).toBe('✦ 3 steps folded')
  })

  test('results collapse to their telling line under the target, errors stay', async () => {
    const ok = PRISM.toolResult({ tool: 'Bash', output: { stdout: 'ok\nTests: 24 passed', stderr: '' }, isErrored: false }, ctx())
    expect(textOf(ok)).toBe('✓ Tests: 24 passed')
    expect(nodes(ok)[0]?.props.paddingLeft).toBe(12)
    expect(textOf(PRISM.toolResult({ tool: 'Bash', output: 'Error: exit 1', isErrored: true }, ctx()))).toBe('Error: exit 1')
    expect(textOf(PRISM.toolResult({ tool: 'Read', output: {}, isErrored: false }, ctx()))).toBe('')
    expect(PRISM.toolResult({ tool: 'Edit', output: {}, isErrored: false }, ctx({ settings: toggled(PRISM_SETTINGS, 'miniDiffs') }))).toBeNull()
    expect(PRISM.toolResult({ tool: 'mcp__x__y', output: {}, isErrored: false }, ctx())).toBeNull()
  })
})

describe('prism turn pieces', () => {
  test('the prompt row leads with a bold star in the gradient\'s heart and keeps line breaks', async () => {
    const tree = PRISM.userMessage('fix the refresh race', ctx())
    expect(textOf(tree)).toBe('✦fix the refresh race')
    expect(nodes(tree).find(n => textOf(n) === '✦' && n.props.color !== undefined)?.props.color).toBe('#ff6fa8')
    const text = textOf(PRISM.userMessage('first line\n' + 'x'.repeat(20_000), ctx()))
    expect(text).toContain('first line\n')
    expect(text.length).toBeLessThan(5_000)
  })

  test('the headline paints the turn in a gradient and rules off the rest in the full gradient', async () => {
    const tree = PRISM.headline({ turn: 7, title: 'The refresh race, fixed' }, ctx())
    const text = textOf(tree)
    expect(text).toContain('✦ Turn 7')
    expect(text).toContain('The refresh race, fixed')
    const rule = nodes(tree).filter(n => /^─+$/.test(textOf(n)) && typeof n.props.color === 'string')
    expect(rule.length).toBeGreaterThan(5)
    expect(rule[0]?.props.color, 'the rule starts at full strength').toBe('#7c6cff')
    expect(rule[rule.length - 1]?.props.color).toBe('#ffb86b')
    expect(JSON.stringify(tree)).toContain('"overflow":"hidden"')
  })

  test('the receipt reads ✦ turn 7, a ribbon split by file with a gap between files, time, counts and context', async () => {
    const tree = PRISM.receipt(RECEIPT, ctx())
    const text = textOf(tree)
    expect(text).toContain('✦ turn 7')
    expect(text).toContain('2m 14s · +103 −10 · 41%')
    expect(text).toMatch(/▰ ▰/)
    const ribbon = nodes(tree).filter(n => /^▰+$/.test(textOf(n)) && typeof n.props.color === 'string')
    expect(ribbon.length).toBe(2)
    const [a, b] = ribbon.map(n => textOf(n).length)
    expect((b ?? 0) > (a ?? 0), 'the bigger change gets more ribbon').toBe(true)
    const star = nodes(tree).find(n => textOf(n) === '✦' && typeof n.props.color === 'string')
    const seven = nodes(tree).find(n => textOf(n) === '7' && typeof n.props.color === 'string')
    expect(star?.props.color, '✦ turn 7 walks the gradient').not.toBe(seven?.props.color)
  })

  test('the legend lists each file as a dot in its color, the name and its lines, under the ribbon', async () => {
    const tree = PRISM.receipt(RECEIPT, ctx())
    const text = textOf(tree)
    expect(text).toContain('● session.ts 47 lines  ● refresh-lock.ts 66 lines')
    const legend = nodes(tree).find(n => n.props.paddingLeft !== undefined && textOf(n).startsWith('●'))
    expect(legend?.props.paddingLeft, 'starts where the ribbon does').toBe(9)
  })

  test('without byFile the ribbon splits evenly across the changed files, in their colors', async () => {
    const tree = PRISM.receipt({ ...RECEIPT, stats: { turn: 3, files: ['/work/a.ts', '/work/b.ts', '/work/c.ts'], add: 5, del: 1 } }, ctx())
    const ribbon = nodes(tree).filter(n => /^▰+$/.test(textOf(n)) && typeof n.props.color === 'string')
    expect(ribbon.map(n => textOf(n).length)).toEqual([8, 7, 7])
    const text = textOf(tree)
    expect(text).toContain('● a.ts  ● b.ts  ● c.ts')
  })

  test('with no files changed the ribbon falls back to a gradient', async () => {
    const tree = PRISM.receipt({ ...RECEIPT, stats: { turn: 2, files: [], add: 0, del: 0 } }, ctx())
    const cells = nodes(tree).filter(n => textOf(n).startsWith('▰') && typeof n.props.color === 'string')
    expect(new Set(cells.map(n => n.props.color)).size).toBeGreaterThan(3)
  })

  test('the receipt carries notes above, the time strip below, and survives null stats', async () => {
    const text = textOf(PRISM.receipt({ ...RECEIPT, notes: [{ n: 1, tool: 'Read', input: { file_path: '/work/a.ts' }, durationMs: 100 }], timeStrip: { thinkingMs: 6_000, toolsMs: 2_000, waitingMs: 1_000 } }, ctx()))
    expect(text.indexOf('¹')).toBeLessThan(text.indexOf('turn 7'))
    expect(text).toContain('Read a.ts · 0.1s')
    expect(text.indexOf('thinking 0:06')).toBeGreaterThan(text.indexOf('turn 7'))
    expect(text).toContain('■')
    const bare = textOf(PRISM.receipt({ durationMs: 9_000, stats: null, notes: [], timeStrip: null }, ctx()))
    expect(bare).toContain('9.0s')
    expect(bare).not.toContain('turn')
  })

  test('-inator mode adds a quip to the receipt and a scheme to the live line', async () => {
    expect(textOf(PRISM.receipt(RECEIPT, ctx({ settings: inator })))).toContain('another -inator completed')
    expect(textOf(PRISM.receipt(RECEIPT, ctx()))).not.toContain('inator')
    expect(textOf(PRISM.live(THINKING, 0, desktop({ settings: inator })))).toContain('Scheming')
  })
})

describe('prism live line', () => {
  test('thinking is ✦ Thinking flowing along the gradient, then a field of dots, then the clock', async () => {
    const tree = JSON.stringify(PRISM.live(THINKING, 3, ctx()))
    expect(tree).toContain('"type":"Raster"')
    const frames = PRISM.liveFrames(THINKING, 0)
    expect(frames.map(f => f.key)).toEqual(['cz-prism', 'cz-prism-clock'])
    for (const f of frames) expect(tree).toContain(`"key":"${f.key}"`)
    const chars = charsOf(frames[0]?.cells)
    expect(chars.slice(0, 11)).toBe('✦ Thinking ')
    expect(chars.length).toBe(11 + 24)
    expect(chars.slice(11)).toMatch(/^[ ·∙•]{24}$/)
    expect(chars.slice(11).replace(/ /g, '').length, 'the field is mostly dots').toBeGreaterThan(8)
    expect(charsOf(frames[1]?.cells)).toBe(' 0:42')
  })

  test('the word and the field flow: colors move every frame, the same frame draws the same', async () => {
    const at = (frame: number) => cellsOf(PRISM.liveFrames(THINKING, frame)[0]?.cells ?? '')
    expect(at(0).map(c => c.fg)).not.toEqual(at(1).map(c => c.fg))
    expect(at(7)).toEqual(at(7))
    const word = at(0).slice(2, 10).map(c => c.fg)
    expect(new Set(word).size, 'the word walks the gradient').toBeGreaterThan(3)
    const field = at(0).slice(11).map(c => c.fg)
    expect(new Set(field).size, 'the field walks the gradient').toBeGreaterThan(8)
  })

  test('liveFrames keep the same keys and columns across 30 frames for every mode', async () => {
    for (const mode of ['thinking', 'writing', 'running'] as LiveMode[]) {
      for (const inatorOn of [false, true]) {
        const state: LiveState = { mode, detail: 'src/a.ts', activity: mode === 'running' ? 'Reading' : undefined, elapsedMs: 0, inator: inatorOn }
        const first = PRISM.liveFrames(state, 0).map(f => `${f.key}:${f.columns}`)
        for (let frame = 1; frame < 30; frame++) {
          expect(PRISM.liveFrames({ ...state, elapsedMs: frame * 100_000 }, frame).map(f => `${f.key}:${f.columns}`)).toEqual(first)
        }
      }
    }
  })

  test('-inator thinking schemes and plots in the same width', async () => {
    const state: LiveState = { ...THINKING, inator: true }
    expect(charsOf(PRISM.liveFrames(state, 0)[0]?.cells).slice(0, 10)).toBe('✦ Scheming')
    expect(charsOf(PRISM.liveFrames(state, 22)[0]?.cells).slice(0, 10)).toBe('✦ Plotting')
  })

  test('running shows the step\'s chip and its target, then the flowing field and the clock', async () => {
    const tree = PRISM.live(READING, 0, ctx())
    const text = textOf(tree)
    expect(text).toContain('◇ READ')
    expect(text).toContain('src/a.ts')
    expect(text).not.toContain('Reading')
    const frames = PRISM.liveFrames(READING, 0)
    expect(frames.map(f => `${f.key}:${f.columns}`)).toEqual(['cz-prism-field:24', 'cz-prism-clock:5'])
    for (const f of frames) expect(JSON.stringify(tree)).toContain(`"key":"${f.key}"`)
    expect(charsOf(frames[0]?.cells)).toMatch(/^[ ·∙•]{24}$/)
  })

  test('a running command reads › RUN and the command once; other steps get their own chips', async () => {
    const text = textOf(PRISM.live(RUNNING, 0, desktop()))
    expect(text).toContain('› RUN')
    expect(text).toContain('pnpm test auth')
    expect(text.match(/›/g)?.length).toBe(1)
    expect(text).toContain('0:03')
    const chip = (activity: string) => textOf(PRISM.live({ ...RUNNING, activity }, 0, desktop()))
    expect(chip('Editing')).toContain('◆ EDIT')
    expect(chip('Writing')).toContain('✚ NEW')
    expect(chip('Searching')).toContain('⌕ FIND')
    expect(chip('Fetching')).toContain('◎ WEB')
    expect(chip('Delegating')).toContain('✦ AGENT')
    expect(textOf(PRISM.live({ mode: 'running', detail: 'Retrying in 8s', elapsedMs: 0 }, 0, desktop()))).toContain('› RUN')
  })

  test('a running file step wears its file color only when File colors is on', async () => {
    const pill = (settings = PRISM_SETTINGS) => pillOf(PRISM.live(READING, 0, ctx({ settings })), ' ◇ READ ')
    expect(pill()?.props.backgroundColor).not.toBe('#2b2550')
    expect(pill(noFileColors)?.props.backgroundColor).toBe('#2b2550')
  })

  test('the desktop live line is static text: the word, the field and the clock', async () => {
    const text = textOf(PRISM.live(THINKING, 3, desktop()))
    expect(text).toContain('✦ Thinking')
    expect(text).toMatch(/[·∙•]/)
    expect(text).toContain('0:42')
  })
})

describe('prism across surfaces and settings', () => {
  test('the desktop gets no Raster from any member, even when the table offers one', async () => {
    for (const c of [desktop(), ctx({ surface: 'desktop' })]) {
      for (const tree of everything(c)) expect(JSON.stringify(tree)).not.toContain('Raster')
    }
  })

  test('narrow terminals still draw every member on one line each', async () => {
    const c = ctx({ columns: 60 })
    for (const tree of everything(c)) expect(tree).toBeTruthy()
    const text = textOf(PRISM.toolRow(row({ input: { file_path: '/work/a.ts' }, durationMs: 4_000 }), c))
    expect(text).toContain('4.0s')
  })

  test('faded rows drop background colors and use the dim tokens', async () => {
    for (const tree of everything(ctx({ fade: 2 })).slice(0, 9)) {
      const json = JSON.stringify(tree)
      expect(json).not.toContain('backgroundColor')
      expect(json).not.toMatch(/"color":"#/)
      expect(json).not.toContain('"color":"text"')
    }
    expect(JSON.stringify(PRISM.toolRow(edit, ctx({ fade: 2 })))).toContain('"color":"subtle"')
  })

  test('every drawing stays a sane size', async () => {
    for (const c of [ctx(), ctx({ isDark: false }), ctx({ columns: 300 })]) {
      for (const tree of everything(c)) expect(JSON.stringify(tree).length).toBeLessThan(40_000)
    }
  })

  test('Prism leaves the band alone and dresses panes in its accent', async () => {
    expect(PRISM.band({ usage: null, waiting: null, isWorking: true }, ctx())).toBeNull()
    expect(PRISM.paneStyle).toEqual({ accent: 'suggestion', marker: '●', current: '✦' })
  })
})
