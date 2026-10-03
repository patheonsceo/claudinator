import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_SETTINGS } from '../src/engine/settings'
import type { Settings } from '../src/engine/settings'
import type { Ctx, LiveMode, ReceiptData, ToolRow } from '../src/looks/look'
import { SUMI } from '../src/looks/sumi'
import { encodeCells } from '../src/engine/raster'
import { ENSO_STROKE, ensoAt } from '../src/looks/sumi/live'
import { LIVE_INK, spaced } from '../src/looks/sumi/style'
import { DESKTOP_ELS, ctxOf, textOf } from './fixtures'

type Node = { type: string; props: Record<string, unknown>; children: unknown[] }

function nodes(tree: unknown): Node[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  if (typeof tree !== 'object' || tree === null) return []
  const n = tree as Node
  return [n, ...nodes(n.children)]
}

function props(tree: unknown, key: string): unknown[] {
  return nodes(tree)
    .map(n => n.props[key])
    .filter(v => v !== undefined)
}

function rowOf(tool: string, input: unknown, over: Partial<ToolRow> = {}): ToolRow {
  return { id: 'toolu_1', tool, input, isRunning: false, isErrored: false, isInterrupted: false, ...over }
}

function withIngredients(over: Partial<Settings['ingredients']>): Settings {
  return { ...DEFAULT_SETTINGS, look: 'sumi', ingredients: { ...DEFAULT_SETTINGS.ingredients, ...over } }
}

const EDIT = { file_path: '/work/cart.js', old_string: '  return items.reduce((s, i) => s + i.price, 0)', new_string: '  return items.reduce((s, i) => s + i.price * i.qty, 0)' }
const FULL_RECEIPT: ReceiptData = {
  durationMs: 134_000,
  stats: { turn: 7, files: ['/work/a.ts', '/work/b.ts'], add: 103, del: 10, contextPercent: 41.2 },
  notes: [],
  timeStrip: null,
}
const MODES: LiveMode[] = ['thinking', 'writing', 'running']

/** Every member of the look drawn once, for checks that apply to all of them. */
function everything(ctx: Ctx, text = 'cart.js'): unknown[] {
  const path = `/work/${text}`
  return [
    SUMI.toolRow(rowOf('Read', { file_path: path }), ctx),
    SUMI.toolRow(rowOf('Bash', { command: text }), ctx),
    SUMI.toolRow(rowOf('Edit', { ...EDIT, file_path: path, new_string: text }), ctx),
    SUMI.toolRow(rowOf('Bash', { command: text }, { isErrored: true }), ctx),
    SUMI.toolRow(rowOf('mcp__x__query', { sql: text }), ctx),
    SUMI.toolGroup([rowOf('Read', { file_path: path }), rowOf('Grep', { pattern: text }, { isErrored: true })], ctx),
    SUMI.quietLine(3, ctx),
    SUMI.toolResult({ tool: 'Bash', output: { stdout: text, stderr: '' }, isErrored: false }, ctx),
    SUMI.toolResult({ tool: 'Bash', output: { stderr: text }, isErrored: true }, ctx),
    SUMI.userMessage(text, ctx),
    SUMI.headline({ turn: 3, title: text }, ctx),
    SUMI.receipt({ ...FULL_RECEIPT, title: text, notes: [{ n: 1, tool: 'Read', input: { file_path: path }, durationMs: 120 }], timeStrip: { thinkingMs: 6_000, toolsMs: 2_000, waitingMs: 1_000 } }, ctx),
    ...MODES.map(mode => SUMI.live({ mode, detail: text, elapsedMs: 42_000 }, 7, ctx)),
  ]
}

describe('sumi tool rows', () => {
  test('a read leaves a dot and a faint word three columns on, nothing else', async () => {
    const tree = SUMI.toolRow(rowOf('Read', { file_path: '/work/src/cart.js' }), ctxOf())
    expect(textOf(tree)).toBe('·read')
    expect(props(tree, 'paddingLeft')).toEqual([3, 2])
    expect(props(tree, 'columnGap')).toEqual([1])
  })

  test('an edit is `■ session.ts   +38 −9`: the seal, one space, the name, three spaces, the counts in their inks', async () => {
    const tree = SUMI.toolRow(rowOf('Edit', EDIT), ctxOf({ settings: withIngredients({ miniDiffs: false }) }))
    expect(textOf(tree)).toBe('■cart.js+1 −1')
    expect(props(tree, 'columnGap')).toEqual([1])
    expect(props(tree, 'paddingLeft')).toEqual([3, 2])
    const colored = nodes(tree).filter(n => n.type === 'Text' && n.props.color !== undefined).map(n => `${String(n.props.color)}:${textOf(n.children)}`)
    expect(colored).toContain('suggestion:■')
    expect(colored).toContain('success:+1')
    expect(colored).toContain('error: −1')
    expect(props(tree, 'backgroundColor'), 'no diff lines when mini diffs are off').toEqual([])
    const adds = SUMI.toolRow(rowOf('Write', { file_path: '/work/new.ts', content: 'a\nb' }), ctxOf({ settings: withIngredients({ miniDiffs: false }) }))
    expect(textOf(adds), 'a side with nothing to count stays out').toBe('■new.ts+2')
  })

  test('mini diffs sit on a padded wash under the name, the sign in its ink and the code in plain ink', async () => {
    const ctx = ctxOf({ settings: withIngredients({ miniDiffs: true }) })
    const tree = SUMI.toolRow(rowOf('Edit', EDIT), ctx)
    const text = textOf(tree)
    expect(text).toContain(' - return items.reduce((s, i) => s + i.price, 0) ')
    expect(text).toContain(' + return items.reduce((s, i) => s + i.price * i.qty, 0) ')
    expect(props(tree, 'paddingLeft')).toContain(6)
    expect(props(tree, 'backgroundColor')).toEqual(['diffRemoved', 'diffAdded'])
    const colored = nodes(tree).filter(n => n.type === 'Text' && n.props.color !== undefined).map(n => `${String(n.props.color)}:${textOf(n.children)}`)
    expect(colored).toContain('error:-')
    expect(colored).toContain('success:+')
    expect(colored).toContain('text: return items.reduce((s, i) => s + i.price, 0) ')
  })

  test('a failure is a red cross and a dim sentence', async () => {
    const tree = SUMI.toolRow(rowOf('Bash', { command: 'npm test auth' }, { isErrored: true, durationMs: 4_000 }), ctxOf())
    expect(textOf(tree)).toContain('✕')
    expect(textOf(tree)).toContain('npm test auth')
    expect(textOf(tree)).toContain('· failed')
    expect(props(tree, 'color')).toContain('error')
    expect(props(tree, 'columnGap'), '`✕ auth tests · failed`, a space apart').toEqual([1, 1])
    const stopped = SUMI.toolRow(rowOf('Edit', EDIT, { isInterrupted: true }), ctxOf())
    expect(textOf(stopped)).toBe('✕cart.js· interrupted')
    expect(textOf(SUMI.toolRow(rowOf('NotebookEdit', { notebook_path: '/work/n.ipynb' }), ctxOf()))).toBe('■n.ipynb')
  })

  test('a running call trails an ellipsis and a slow call shows its time on wide screens only', async () => {
    expect(textOf(SUMI.toolRow(rowOf('Read', { file_path: '/work/a.ts' }, { isRunning: true }), ctxOf()))).toBe('·read…')
    expect(textOf(SUMI.toolRow(rowOf('Bash', { command: 'make' }, { durationMs: 4_200 }), ctxOf()))).toContain('4.2s')
    expect(textOf(SUMI.toolRow(rowOf('Bash', { command: 'make' }, { durationMs: 400 }), ctxOf())), 'a quick call earns no time').not.toContain('0.4s')
    expect(textOf(SUMI.toolRow(rowOf('Bash', { command: 'make' }, { durationMs: 4_200 }), ctxOf({ columns: 60 })))).not.toContain('4.2s')
  })

  test('streaming input {} draws for every tool without throwing', async () => {
    for (const tool of ['Read', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'Task', 'TodoWrite', 'mcp__srv__thing']) {
      const tree = SUMI.toolRow(rowOf(tool, {}, { isRunning: true }), ctxOf({ settings: withIngredients({ miniDiffs: true }) }))
      expect(textOf(tree).length, tool).toBeGreaterThan(0)
    }
  })

  test('a 500-character command and a CJK path never wrap and never throw', async () => {
    const long = 'echo ' + 'x'.repeat(495)
    const cjk = '/work/資料/設定ファイル/日本語の長いファイル名.ts'
    const trees = [
      SUMI.toolRow(rowOf('Bash', { command: long }, { isErrored: true }), ctxOf({ columns: 60 })),
      SUMI.toolRow(rowOf('Edit', { ...EDIT, file_path: cjk }), ctxOf({ columns: 60, settings: withIngredients({ miniDiffs: true, fileColors: true }) })),
      SUMI.toolRow(rowOf('Task', { description: long }), ctxOf({ columns: 60 })),
      SUMI.toolGroup([rowOf('Bash', { command: long }), rowOf('Read', { file_path: cjk })], ctxOf({ columns: 60 })),
      SUMI.headline({ turn: 1, title: long }, ctxOf({ columns: 60 })),
    ]
    for (const tree of trees) {
      for (const wrap of props(tree, 'wrap')) expect(String(wrap)).toMatch(/^truncate/)
    }
  })

  test('agents and other tools keep a faint target so the word means something', async () => {
    expect(textOf(SUMI.toolRow(rowOf('Task', { description: 'map the auth flow' }), ctxOf()))).toBe('·agentmap the auth flow')
  })
})

describe('sumi groups, quiet and results', () => {
  test('a group is a trace of dots, one per call, and a faint count', async () => {
    const rows = [rowOf('Read', { file_path: '/w/a' }), rowOf('Read', { file_path: '/w/b' }), rowOf('Grep', { pattern: 'x' }), rowOf('Bash', { command: 'ls' })]
    const text = textOf(SUMI.toolGroup(rows, ctxOf()))
    expect(text).toBe('· · · ·4 steps')
    expect(props(SUMI.toolGroup(rows, ctxOf()), 'paddingLeft'), 'three columns between the trace and its count').toEqual([3, 2])
  })

  test('a group of one draws as its own row', async () => {
    expect(textOf(SUMI.toolGroup([rowOf('Read', { file_path: '/w/cart.js' })], ctxOf()))).toBe('·read')
  })

  test('a failed call in a group turns its dot into a cross', async () => {
    const rows = [rowOf('Read', { file_path: '/w/a' }), rowOf('Bash', { command: 'npm test' }, { isErrored: true })]
    const tree = SUMI.toolGroup(rows, ctxOf())
    expect(textOf(tree)).toContain('· ✕')
    expect(textOf(tree)).toContain('1 failed')
    expect(props(tree, 'color')).toContain('error')
  })

  test('a very long group caps its trace', async () => {
    const rows = Array.from({ length: 40 }, (_, i) => rowOf('Read', { file_path: `/w/${i}` }))
    const text = textOf(SUMI.toolGroup(rows, ctxOf({ columns: 60 })))
    expect(text).toContain('40 steps')
    expect(text.split('·').length - 1).toBeLessThan(13)
  })

  test('the quiet line is a faint dot and a count', async () => {
    expect(textOf(SUMI.quietLine(3, ctxOf()))).toBe('·3 steps')
    expect(textOf(SUMI.quietLine(1, ctxOf()))).toBe('·1 step')
    expect(props(SUMI.quietLine(3, ctxOf()), 'paddingLeft')).toEqual([3, 2])
  })

  test('results collapse, errors stay, unknown tools are left to Claude Code', async () => {
    const ctx = ctxOf()
    expect(SUMI.toolResult({ tool: 'Read', output: 'x', isErrored: false }, ctx)).toEqual(ctx.els.Box({}))
    expect(textOf(SUMI.toolResult({ tool: 'Bash', output: { stdout: 'a\ncart.js\n', stderr: '' }, isErrored: false }, ctx))).toBe('cart.js')
    const detail = SUMI.toolResult({ tool: 'Bash', output: { stderr: 'boom: no such file' }, isErrored: true }, ctx)
    expect(textOf(detail)).toBe('boom: no such file')
    expect(props(detail, 'paddingLeft'), 'the detail hangs under the words, in line with the diff code').toEqual([7])
    expect(props(detail, 'color')).toEqual(['inactive'])
    expect(SUMI.toolResult({ tool: 'Edit', output: {}, isErrored: false }, ctxOf({ settings: withIngredients({ miniDiffs: false }) }))).toBeNull()
    expect(SUMI.toolResult({ tool: 'Edit', output: {}, isErrored: false }, ctxOf({ settings: withIngredients({ miniDiffs: true }) }))).toEqual(ctx.els.Box({}))
    expect(SUMI.toolResult({ tool: 'mcp__x__y', output: {}, isErrored: false }, ctx)).toBeNull()
  })
})

describe('sumi turn pieces', () => {
  test('the prompt is the text alone, indented, in plain foreground', async () => {
    const tree = SUMI.userMessage('fix the race\nin refresh', ctxOf())
    expect(textOf(tree)).toBe('fix the race\nin refresh')
    expect(props(tree, 'paddingLeft')).toEqual([3])
    expect(props(tree, 'color')).toEqual(['text'])
    expect(props(tree, 'bold')).toEqual([])
    expect(textOf(SUMI.userMessage('x'.repeat(20_000), ctxOf())).length).toBeLessThan(5_000)
  })

  test('the headline is an indigo seal and a lowercase, letter-spaced title', async () => {
    const tree = SUMI.headline({ turn: 7, title: 'The refresh race, fixed' }, ctxOf())
    expect(textOf(tree)).toBe('■t h e   r e f r e s h   r a c e,   f i x e d')
    expect(props(tree, 'color')).toContain('suggestion')
  })

  test('a long headline keeps whole words within the width', async () => {
    const title = 'Rewrite the token refresh scheduler so concurrent requests share one in-flight refresh'
    const text = textOf(SUMI.headline({ turn: 1, title }, ctxOf({ columns: 60 })))
    expect(text.length).toBeLessThan(60 - 3)
    expect(text.endsWith('…')).toBe(true)
  })

  test('letter spacing keeps punctuation with its word', async () => {
    expect(spaced('fix (it), now')).toBe('f i x   (i t),   n o w')
  })

  test('the receipt is `■ ─── 2:14   +103 −10   41%`', async () => {
    const tree = SUMI.receipt(FULL_RECEIPT, ctxOf())
    expect(textOf(tree)).toBe('■───2:14+103 −1041%')
    expect(props(tree, 'paddingLeft')).toEqual([3, 2, 2])
    const colored = nodes(tree).filter(n => n.type === 'Text' && n.props.color !== undefined).map(n => `${String(n.props.color)}:${textOf(n.children)}`)
    expect(colored).toEqual(['suggestion:■', '#4c4a46:───', 'inactive:2:14', 'success:+103', 'error: −10', 'inactive:41%'])
    const stats = FULL_RECEIPT.stats ?? { turn: 1, files: [], add: 0, del: 0 }
    expect(textOf(SUMI.receipt({ ...FULL_RECEIPT, stats: { ...stats, add: 4, del: 0 } }, ctxOf())), 'no −0').toBe('■───2:14+441%')
  })

  test('the receipt carries notes above, the time strip below, and works without stats', async () => {
    const tree = SUMI.receipt(
      { durationMs: 9_000, stats: null, notes: [{ n: 1, tool: 'Read', input: { file_path: '/work/a.ts' }, durationMs: 100 }], timeStrip: { thinkingMs: 6_000, toolsMs: 2_000, waitingMs: 1_000 } },
      ctxOf(),
    )
    const text = textOf(tree)
    expect(text.indexOf('Read a.ts · 0.1s')).toBeLessThan(text.indexOf('0:09'))
    expect(text.indexOf('0:09')).toBeLessThan(text.indexOf('thinking 0:06'))
    expect(text).toContain('───')
    expect(text).not.toContain('+')
    expect(props(tree, 'italic')).toContain(true)
  })

  test('the time strip steps aside on a narrow screen', async () => {
    const text = textOf(SUMI.receipt({ ...FULL_RECEIPT, timeStrip: { thinkingMs: 6_000, toolsMs: 2_000, waitingMs: 0 } }, ctxOf({ columns: 60 })))
    expect(text).not.toContain('thinking')
    expect(text).toContain('2:14')
  })

  test('-inator mode schemes while thinking and is defeated at the end', async () => {
    const settings = withIngredients({ inator: true })
    expect(textOf(SUMI.live({ mode: 'thinking', detail: '', elapsedMs: 0, inator: true }, 0, ctxOf({ surface: 'desktop', els: DESKTOP_ELS, settings })))).toContain('s c h e m i n g')
    expect(textOf(SUMI.live({ mode: 'thinking', detail: '', elapsedMs: 0 }, 0, ctxOf({ settings })))).toContain('s c h e m i n g')
    const defeated = textOf(SUMI.receipt(FULL_RECEIPT, ctxOf({ settings })))
    expect(defeated).toContain('d e f e a t e d')
    expect(defeated, 'no dot: the word stands alone').not.toContain('·')
    expect(textOf(SUMI.receipt(FULL_RECEIPT, ctxOf()))).not.toContain('d e f e a t e d')
  })

  test('Sumi leaves the band alone and dresses panes in ink', async () => {
    expect(SUMI.band({ usage: null, waiting: null, isWorking: true }, ctxOf())).toBeNull()
    expect(SUMI.paneStyle).toEqual({ accent: 'suggestion', marker: '·', current: '■' })
  })
})

describe('sumi live line', () => {
  const thinking = { mode: 'thinking' as const, detail: '', elapsedMs: 42_000 }

  test('the terminal line is `○ t h i n k i n g`, an ensō raster a space from the word, the clock raster at the right', async () => {
    const tree = SUMI.live(thinking, 3, ctxOf())
    const rasters = nodes(tree).filter(n => n.type === 'Raster')
    expect(rasters.map(r => r.props.key)).toEqual(['cz-enso', 'cz-clock'])
    expect(rasters[0]?.props.columns).toBe(1)
    expect(textOf(tree)).toContain('t h i n k i n g')
    expect(props(tree, 'columnGap')).toEqual([1])
    expect(props(tree, 'paddingLeft')).toContain(3)
  })

  test('the ensō draws itself: a touch of the brush, a quarter, a half, the closed circle, held, then the ink dries away', async () => {
    const glyphs = ENSO_STROKE.map(s => s.char)
    const first = (c: string): number => glyphs.indexOf(c)
    expect(first('·')).toBe(0)
    expect(first('·')).toBeLessThan(first('◜'))
    expect(first('◜')).toBeLessThan(first('◠'))
    expect(first('◠')).toBeLessThan(first('○'))
    expect(first('○')).toBeLessThan(first('◯'))
    expect(glyphs[glyphs.length - 1]).toBe('◌')
    const held = ENSO_STROKE.filter(s => s.char === '◯' && s.ink === 'seal').length
    expect(held, 'the closed circle holds for about a second').toBeGreaterThanOrEqual(8)
    expect([...new Set(ENSO_STROKE.map(s => s.ink))].sort()).toEqual(['mid', 'seal', 'wash'])
    for (const g of glyphs) expect((g.codePointAt(0) ?? 0x10000) < 0x10000 && [...g].length === 1, g).toBe(true)
  })

  test('the stroke runs one step per tick and loops', async () => {
    const cell = (frame: number): string => SUMI.liveFrames(thinking, frame)[0]?.cells ?? ''
    expect(cell(0)).toBe(encodeCells([{ char: '·', fg: LIVE_INK.seal }]))
    expect(cell(0)).toBe(cell(ENSO_STROKE.length))
    expect(ensoAt(ENSO_STROKE.length + 3)).toEqual(ensoAt(3))
    expect(ensoAt(-4)).toEqual(ensoAt(0))
    const distinct = new Set(Array.from({ length: ENSO_STROKE.length }, (_, f) => cell(f)))
    expect(distinct.size).toBeGreaterThanOrEqual(7)
  })

  test('running draws the ensō too, beside the activity set wide and the target faint', async () => {
    const tree = SUMI.live({ mode: 'running', activity: 'Reading', detail: 'src/a.ts', elapsedMs: 3_000 }, 0, ctxOf())
    const text = textOf(tree)
    expect(text).toContain('r e a d i n g')
    expect(text).toContain('src/a.ts')
    expect(text, 'the verb is said once').not.toContain('r u n n i n g')
    expect(nodes(tree).filter(n => n.type === 'Raster').map(r => r.props.key)).toEqual(['cz-enso', 'cz-clock'])
    expect(SUMI.liveFrames({ mode: 'running', detail: '', elapsedMs: 0 }, 5)[0]?.cells).toBe(SUMI.liveFrames(thinking, 5)[0]?.cells)
    const quiet = nodes(tree).filter(n => n.type === 'Text' && textOf(n.children) === 'src/a.ts')
    expect(quiet.map(n => n.props.color)).toEqual(['#4c4a46'])
  })

  test('without an activity a running step says running; writing says writing', async () => {
    expect(textOf(SUMI.live({ mode: 'running', detail: 'ls', elapsedMs: 0 }, 0, ctxOf()))).toContain('r u n n i n g')
    expect(textOf(SUMI.live({ mode: 'writing', detail: '', elapsedMs: 0 }, 0, ctxOf()))).toContain('w r i t i n g')
  })

  test('every live raster keeps its columns across 30 frames in every mode', async () => {
    for (const mode of MODES) {
      for (const inator of [false, true]) {
        const first = SUMI.liveFrames({ mode, detail: '', elapsedMs: 0, inator }, 0).map(f => `${f.key}:${f.columns}`)
        for (let frame = 1; frame < 30; frame++) {
          const now = SUMI.liveFrames({ mode, detail: 'x'.repeat(frame), activity: frame % 2 ? 'Searching' : 'Reading', elapsedMs: frame * 61_000, inator }, frame).map(f => `${f.key}:${f.columns}`)
          expect(now, `${mode} frame ${frame}`).toEqual(first)
        }
      }
    }
  })

  test('the desktop line is plain, static text: `○ t h i n k i n g` and the clock', async () => {
    const ctx = ctxOf({ surface: 'desktop', els: DESKTOP_ELS })
    const tree = SUMI.live({ mode: 'thinking', detail: '', elapsedMs: 1_000 }, 0, ctx)
    expect(JSON.stringify(tree)).not.toContain('Raster')
    expect(textOf(tree)).toBe('○t h i n k i n g0:01')
    expect(JSON.stringify(SUMI.live({ mode: 'thinking', detail: '', elapsedMs: 1_000 }, 13, ctx))).toBe(JSON.stringify(tree))
    expect(textOf(SUMI.live({ mode: 'running', activity: 'Editing', detail: 'cart.js', elapsedMs: 1_000 }, 0, ctx))).toBe('○e d i t i n gcart.js0:01')
  })
})

describe('sumi on every surface', () => {
  test('the desktop gets no Raster from any member', async () => {
    for (const tree of everything(ctxOf({ els: DESKTOP_ELS, surface: 'desktop' }))) expect(JSON.stringify(tree)).not.toContain('Raster')
  })

  test('escape codes never reach the output', async () => {
    for (const tree of everything(ctxOf({ settings: withIngredients({ miniDiffs: true, inator: true }) }), '\x1b[31mred\x07')) {
      const json = JSON.stringify(tree)
      expect(json).not.toContain('\\u001b')
      expect(json).not.toContain('\\u0007')
    }
  })

  test('the oldest rows lose their backgrounds and settle into the faintest token', async () => {
    const ctx = ctxOf({ fade: 2, settings: withIngredients({ miniDiffs: true, inator: true }) })
    const trees = everything(ctx).slice(0, 12)
    for (const tree of trees) {
      expect(props(tree, 'backgroundColor')).toEqual([])
      for (const color of props(tree, 'color')) expect(color).toBe('subtle')
    }
  })

  test('a recent row never grows brighter as it fades', async () => {
    const tree = SUMI.quietLine(2, ctxOf({ fade: 1 }))
    expect(props(tree, 'color')).toEqual(['subtle', 'subtle'])
  })

  test('narrow screens draw every member', async () => {
    for (const tree of everything(ctxOf({ columns: 60 }))) expect(textOf(tree).length).toBeGreaterThan(0)
  })

  test('every tree stays small', async () => {
    for (const tree of everything(ctxOf({ settings: withIngredients({ miniDiffs: true }) }), 'y'.repeat(5_000))) {
      expect(JSON.stringify(tree).length).toBeLessThan(30_000)
    }
  })
})
