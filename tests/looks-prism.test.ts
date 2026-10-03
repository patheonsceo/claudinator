import { describe, expect, test } from 'claude-code/testing'

import { resolveSettings, toggled } from '../src/engine/settings'
import type { Ctx, LiveMode, ReceiptData, ToolRow } from '../src/looks/look'
import { PRISM } from '../src/looks/prism'
import { DESKTOP_ELS, ctxOf, textOf } from './fixtures'

const PRISM_SETTINGS = resolveSettings([{ look: 'prism' }])
const ctx = (over: Partial<Ctx> = {}): Ctx => ctxOf({ settings: PRISM_SETTINGS, ...over })
const row = (over: Partial<ToolRow>): ToolRow => ({ id: 't1', tool: 'Read', input: {}, isRunning: false, isErrored: false, isInterrupted: false, ...over })
const edit = row({ tool: 'Edit', input: { file_path: '/work/src/cart.js', old_string: 'return a', new_string: 'return a * qty' }, durationMs: 2_100 })
const inator = { ...PRISM_SETTINGS, ingredients: { ...PRISM_SETTINGS.ingredients, inator: true } }

type Node = { type: string; props: Record<string, unknown>; children: unknown[] }

/** Every element in a drawn tree, depth first. */
function nodes(tree: unknown): Node[] {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  const n = tree as Node
  return [n, ...nodes(n.children)]
}

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
    ...(['thinking', 'writing', 'running'] as LiveMode[]).map(mode => PRISM.live({ mode, detail: 'Read src/a.ts', elapsedMs: 3_000 }, 5, c)),
  ]
}

describe('prism tool rows', () => {
  test('a read is a pill in its file color, then folder, file name and time', async () => {
    const tree = PRISM.toolRow(row({ input: { file_path: '/work/src/auth/session.ts' }, durationMs: 200 }), ctx())
    const text = textOf(tree)
    expect(text).toContain('▐ ◇ READ ▌')
    expect(text).toContain('src/auth/session.ts')
    expect(text).toContain('0.2s')
    const pill = nodes(tree).find(n => textOf(n) === ' ◇ READ ')
    const name = nodes(tree).find(n => textOf(n) === 'session.ts' && typeof n.props.color === 'string')
    expect(pill?.props.backgroundColor, 'the pill is filled').toMatch(/^#[0-9a-f]{6}$/)
    expect(pill?.props.backgroundColor, 'the pill wears the file color').toBe(name?.props.color)
  })

  test('an edit shows its counts and, with mini diffs, its changed lines', async () => {
    const text = textOf(PRISM.toolRow(edit, ctx()))
    expect(text).toContain('◆ EDIT')
    expect(text).toContain('+1')
    expect(text).toContain('−1')
    expect(text).toContain('- return a')
    expect(text).toContain('+ return a * qty')
    expect(text).toContain('2.1s')
    const plain = textOf(PRISM.toolRow(edit, ctx({ settings: toggled(PRISM_SETTINGS, 'miniDiffs') })))
    expect(plain).toContain('+1')
    expect(plain).not.toContain('- return a')
  })

  test('chips are colored by file even when File colors is off', async () => {
    const off = toggled(PRISM_SETTINGS, 'fileColors')
    expect(off.ingredients.fileColors).toBe(false)
    const a = nodes(PRISM.toolRow(row({ input: { file_path: '/work/a.ts' } }), ctx({ settings: off }))).find(n => textOf(n) === ' ◇ READ ')
    const b = nodes(PRISM.toolRow(row({ input: { file_path: '/work/a.ts' } }), ctx())).find(n => textOf(n) === ' ◇ READ ')
    expect(a?.props.backgroundColor).toBe(b?.props.backgroundColor)
  })

  test('chip text stays readable: dark ink on light chips, white on saturated light-mode chips', async () => {
    const pill = (isDark: boolean) => nodes(PRISM.toolRow(row({ input: { file_path: '/work/a.ts' } }), ctx({ isDark }))).find(n => textOf(n) === ' ◇ READ ')
    expect(pill(true)?.props.color).toBe('#0f0d16')
    expect(pill(false)?.props.color).toBe('#ffffff')
  })

  test('a failed call wears an error chip and says so', async () => {
    const tree = PRISM.toolRow(row({ tool: 'Bash', input: { command: 'pnpm test' }, isErrored: true }), ctx())
    const text = textOf(tree)
    expect(text).toContain('✕ RUN')
    expect(text).toContain('failed')
    expect(textOf(PRISM.toolRow(row({ tool: 'Edit', input: { file_path: '/work/a.ts' }, isInterrupted: true }), ctx()))).toContain('interrupted')
    const pill = nodes(tree).find(n => textOf(n) === ' ✕ RUN ')
    expect(pill?.props.backgroundColor).toBe('#ff7088')
  })

  test('a running call shows an ellipsis; a streaming call with empty input still draws', async () => {
    expect(textOf(PRISM.toolRow(row({ isRunning: true, input: { file_path: '/work/a.ts' } }), ctx()))).toContain('…')
    expect(textOf(PRISM.toolRow(row({ tool: 'Edit', input: {} }), ctx()))).toContain('EDIT')
    expect(textOf(PRISM.toolRow(row({ tool: 'mcp__github__create_pull_request', input: { title: 'x' } }), ctx()))).toContain('CREAT…')
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
      PRISM.live({ mode: 'running', detail: '\x1b[31mred', elapsedMs: 0 }, 0, ctx({ els: DESKTOP_ELS, surface: 'desktop' })),
    ]
    for (const tree of trees) expect(JSON.stringify(tree)).not.toContain('\\u001b')
  })

  test('a group is a neutral counted chip with a dot per file in its color', async () => {
    const rows = [0, 1, 2].map(i => row({ id: `r${i}`, input: { file_path: `/work/src/f${i}.ts` }, durationMs: 100 }))
    const tree = PRISM.toolGroup(rows, ctx())
    const text = textOf(tree)
    expect(text).toContain('◇ READ ×3')
    expect(text).toContain('f0.ts')
    expect(text).toContain('f2.ts')
    expect(text).toContain('0.3s')
    const dots = nodes(tree).filter(n => textOf(n) === '●')
    expect(dots.length).toBe(3)
    const mixed = textOf(PRISM.toolGroup([rows[0] as ToolRow, row({ id: 'x', tool: 'Bash', input: { command: 'ls' } })], ctx()))
    expect(mixed).toContain('STEPS ×2')
    expect(mixed).toContain('› ls')
    expect(textOf(PRISM.toolGroup([rows[0] as ToolRow], ctx())), 'one call has no count').not.toContain('×')
  })

  test('the quiet line folds steps with a gradient star', async () => {
    expect(textOf(PRISM.quietLine(3, ctx()))).toBe('✦ 3 steps folded')
  })

  test('results collapse to their telling line, errors stay', async () => {
    expect(textOf(PRISM.toolResult({ tool: 'Bash', output: { stdout: 'ok\nTests: 24 passed', stderr: '' }, isErrored: false }, ctx()))).toContain('Tests: 24 passed')
    expect(textOf(PRISM.toolResult({ tool: 'Bash', output: 'Error: exit 1', isErrored: true }, ctx()))).toContain('Error: exit 1')
    expect(textOf(PRISM.toolResult({ tool: 'Read', output: {}, isErrored: false }, ctx()))).toBe('')
    expect(PRISM.toolResult({ tool: 'Edit', output: {}, isErrored: false }, ctx({ settings: toggled(PRISM_SETTINGS, 'miniDiffs') }))).toBeNull()
    expect(PRISM.toolResult({ tool: 'mcp__x__y', output: {}, isErrored: false }, ctx())).toBeNull()
  })
})

describe('prism turn pieces', () => {
  test('the prompt row leads with a bold star and keeps line breaks', async () => {
    expect(textOf(PRISM.userMessage('fix the refresh race', ctx()))).toBe('✦fix the refresh race')
    const text = textOf(PRISM.userMessage('first line\n' + 'x'.repeat(20_000), ctx()))
    expect(text).toContain('first line\n')
    expect(text.length).toBeLessThan(5_000)
  })

  test('the headline paints the turn in a gradient and rules off the rest', async () => {
    const tree = PRISM.headline({ turn: 7, title: 'The refresh race, fixed' }, ctx())
    const text = textOf(tree)
    expect(text).toContain('✦ Turn 7')
    expect(text).toContain('The refresh race, fixed')
    expect(text).toContain('─')
    const colors = new Set(nodes(tree).map(n => n.props.color).filter(c => typeof c === 'string' && c.startsWith('#')))
    expect(colors.size, 'many gradient steps').toBeGreaterThan(5)
    expect(JSON.stringify(tree)).toContain('"overflow":"hidden"')
  })

  test('the receipt draws a fingerprint ribbon split by file, in file colors, with a legend', async () => {
    const tree = PRISM.receipt(RECEIPT, ctx())
    const text = textOf(tree)
    expect(text).toContain('✦ turn 7')
    expect(text).toContain('2m 14s')
    expect(text).toContain('+103')
    expect(text).toContain('−10')
    expect(text).toContain('41%')
    expect(text).toContain('session.ts 47')
    expect(text).toContain('refresh-lock.ts 66')
    const ribbon = nodes(tree).filter(n => /^▰+$/.test(textOf(n)) && typeof n.props.color === 'string')
    expect(ribbon.length).toBe(2)
    const [a, b] = ribbon.map(n => textOf(n).length)
    expect((b ?? 0) > (a ?? 0), 'the bigger change gets more ribbon').toBe(true)
  })

  test('without byFile the ribbon splits evenly across the changed files, in their colors', async () => {
    const tree = PRISM.receipt({ ...RECEIPT, stats: { turn: 3, files: ['/work/a.ts', '/work/b.ts', '/work/c.ts'], add: 5, del: 1 } }, ctx())
    const ribbon = nodes(tree).filter(n => /^▰+$/.test(textOf(n)) && typeof n.props.color === 'string')
    expect(ribbon.map(n => textOf(n).length)).toEqual([8, 8, 8])
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
    expect(text.indexOf('thinking 6.0s')).toBeGreaterThan(text.indexOf('turn 7'))
    expect(text).toContain('▬')
    const bare = textOf(PRISM.receipt({ durationMs: 9_000, stats: null, notes: [], timeStrip: null }, ctx()))
    expect(bare).toContain('9.0s')
    expect(bare).not.toContain('turn')
  })

  test('-inator mode adds a quip to the receipt and a scheme to the live line', async () => {
    expect(textOf(PRISM.receipt(RECEIPT, ctx({ settings: inator })))).toContain('another -inator completed')
    expect(textOf(PRISM.receipt(RECEIPT, ctx()))).not.toContain('inator')
    expect(textOf(PRISM.live({ mode: 'thinking', detail: '', elapsedMs: 0 }, 0, ctx({ els: DESKTOP_ELS, surface: 'desktop', settings: inator })))).toContain('Scheming')
  })
})

describe('prism live line', () => {
  test('the terminal live line animates through rasters with a flowing gradient', async () => {
    const state = { mode: 'thinking' as const, detail: '', elapsedMs: 42_000 }
    const tree = JSON.stringify(PRISM.live(state, 3, ctx()))
    expect(tree).toContain('"type":"Raster"')
    const keys = PRISM.liveFrames(state, 0).map(f => f.key)
    expect(keys.length).toBe(2)
    for (const key of keys) expect(tree).toContain(`"key":"${key}"`)
    expect(PRISM.liveFrames(state, 0)[0]?.cells, 'the gradient moves').not.toBe(PRISM.liveFrames(state, 1)[0]?.cells)
    expect(PRISM.liveFrames(state, 7)[0]?.cells, 'deterministic').toBe(PRISM.liveFrames(state, 7)[0]?.cells)
  })

  test('liveFrames keep the same columns across 30 frames for every mode', async () => {
    for (const mode of ['thinking', 'writing', 'running'] as LiveMode[]) {
      for (const inatorOn of [false, true]) {
        const state = { mode, detail: 'Read a.ts', elapsedMs: 0, inator: inatorOn }
        const first = PRISM.liveFrames(state, 0).map(f => `${f.key}:${f.columns}`)
        for (let frame = 1; frame < 30; frame++) {
          expect(PRISM.liveFrames({ ...state, elapsedMs: frame * 100_000 }, frame).map(f => `${f.key}:${f.columns}`)).toEqual(first)
        }
      }
    }
  })

  test('running shows a chip and the detail; the clock reads right', async () => {
    const tree = PRISM.live({ mode: 'running', detail: 'Read src/a.ts', elapsedMs: 3_000 }, 0, ctx({ els: DESKTOP_ELS, surface: 'desktop' }))
    const text = textOf(tree)
    expect(text).toContain('READ')
    expect(text).toContain('src/a.ts')
    expect(text).toContain('0:03')
    expect(textOf(PRISM.live({ mode: 'running', detail: 'Retrying in 8s', elapsedMs: 0 }, 0, ctx({ els: DESKTOP_ELS, surface: 'desktop' })))).toContain('RUN')
  })
})

describe('prism across surfaces and settings', () => {
  test('the desktop gets no Raster from any member, even when the table offers one', async () => {
    for (const c of [ctx({ els: DESKTOP_ELS, surface: 'desktop' }), ctx({ surface: 'desktop' })]) {
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
