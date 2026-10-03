import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_SETTINGS } from '../src/engine/settings'
import type { Settings } from '../src/engine/settings'
import { BLUEPRINT } from '../src/looks/blueprint'
import { CALIPER_COLUMNS, caliperChars, penChars } from '../src/looks/blueprint/live'
import type { Ctx, LiveMode, ReceiptData, ToolRow } from '../src/looks/look'
import { DESKTOP_ELS, ctxOf, textOf } from './fixtures'

function withIngredients(over: Partial<Settings['ingredients']>): Settings {
  return { ...DEFAULT_SETTINGS, ingredients: { ...DEFAULT_SETTINGS.ingredients, ...over } }
}

const DIFFS_ON = withIngredients({ miniDiffs: true })
const DIFFS_OFF = withIngredients({ miniDiffs: false })
const INATOR = withIngredients({ inator: true })

function row(tool: string, input: unknown, over: Partial<ToolRow> = {}): ToolRow {
  return { id: 'toolu_1', tool, input, isRunning: false, isErrored: false, isInterrupted: false, ...over }
}

const EDIT = row('Edit', { file_path: '/work/src/cart.js', old_string: 'return a\n', new_string: 'const t = 1\nreturn a * t\n' }, { durationMs: 200, changeIndex: 1 })
const RECEIPT: ReceiptData = {
  durationMs: 134_000,
  title: 'The refresh race, fixed',
  stats: { turn: 7, files: ['/work/a.ts', '/work/b.ts'], add: 103, del: 10, contextPercent: 41.2 },
  notes: [],
  timeStrip: null,
}

/** Every node of a tree, depth first. */
function nodes(tree: unknown): Array<{ type: string; props: Record<string, unknown> }> {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(nodes)
  const t = tree as { type: string; props: Record<string, unknown>; children: unknown[] }
  return [t, ...nodes(t.children)]
}

/** One of everything the look draws, for checks that apply to all of it. */
function everything(ctx: Ctx): unknown[] {
  const s = BLUEPRINT
  return [
    s.toolRow(row('Read', { file_path: '/work/src/cart.js' }, { durationMs: 200 }), ctx),
    s.toolRow(EDIT, ctx),
    s.toolRow(row('Bash', { command: 'ls' }, { isErrored: true, durationMs: 100 }), ctx),
    s.toolRow(row('Bash', { command: 'npm test' }, { isRunning: true }), ctx),
    s.toolGroup([row('Read', { file_path: '/work/a.ts' }, { durationMs: 100 }), row('Bash', { command: 'ls' }, { durationMs: 50 })], ctx),
    s.quietLine(3, ctx),
    s.toolResult({ tool: 'Bash', output: { stdout: 'ok\n', stderr: '' }, isErrored: false }, ctx),
    s.toolResult({ tool: 'Bash', output: 'boom', isErrored: true }, ctx),
    s.userMessage('fix the refresh race', ctx),
    s.headline({ turn: 7, title: 'The refresh race, fixed' }, ctx),
    s.receipt({ ...RECEIPT, notes: [{ n: 1, tool: 'Read', input: { file_path: '/work/a.ts' }, durationMs: 200 }], timeStrip: { thinkingMs: 5_000, toolsMs: 2_000, waitingMs: 1_000 } }, ctx),
    s.receipt({ durationMs: 9_000, stats: null, notes: [], timeStrip: null }, ctx),
    s.live({ mode: 'thinking', detail: '', elapsedMs: 4_000 }, 3, ctx),
    s.live({ mode: 'running', detail: 'Read src/cart.js', elapsedMs: 4_000 }, 3, ctx),
    s.live({ mode: 'writing', detail: '', elapsedMs: 4_000 }, 3, ctx),
  ]
}

describe('blueprint tool rows', () => {
  test('a read is a dimension line with a cyan uppercase tag', async () => {
    const tree = BLUEPRINT.toolRow(row('Read', { file_path: '/work/src/cart.js' }, { durationMs: 200 }), ctxOf())
    const text = textOf(tree)
    expect(text.startsWith('├──')).toBe(true)
    expect(text).toContain('READ')
    expect(text).toContain('src/')
    expect(text).toContain('cart.js')
    expect(text).toContain('─┤')
    expect(text).toContain('0.2s')
    const tag = nodes(tree).find(n => n.type === 'Text' && n.props.color === 'suggestion')
    expect(tag, 'the tag is cyan').toBeTruthy()
  })

  test('the rule between target and meta is clipped, not wrapped', async () => {
    const json = JSON.stringify(BLUEPRINT.toolRow(row('Read', { file_path: '/work/a.ts' }), ctxOf()))
    expect(json).toContain('"overflow":"hidden"')
    expect(json).toContain('"height":1')
  })

  test('an edit carries its callout letter and line counts', async () => {
    const text = textOf(BLUEPRINT.toolRow(EDIT, ctxOf({ settings: DIFFS_OFF })))
    expect(text.startsWith('(A)')).toBe(true)
    expect(text).toContain('EDIT')
    expect(text).toContain('+2')
    expect(text).toContain('−1')
    expect(textOf(BLUEPRINT.toolRow({ ...EDIT, changeIndex: 2 }, ctxOf()))).toContain('(B)')
    expect(textOf(BLUEPRINT.toolRow({ ...EDIT, changeIndex: 27 }, ctxOf()))).toContain('(AA)')
    expect(textOf(BLUEPRINT.toolRow({ ...EDIT, changeIndex: undefined }, ctxOf()))).toContain('(·)')
  })

  test('mini diffs show up to three changed lines, indented, only when on', async () => {
    const on = BLUEPRINT.toolRow(EDIT, ctxOf({ settings: DIFFS_ON }))
    expect(textOf(on)).toContain('+ const t = 1')
    expect(textOf(on)).toContain('- return a')
    expect(JSON.stringify(on), 'diffs sit one column inside the tag').toContain('"paddingLeft":6')
    const signs = nodes(on).filter(n => n.type === 'Text' && (textOf(n) === '+' || textOf(n) === '-'))
    expect([...new Set(signs.map(n => n.props.color))].sort(), 'the sign carries the diff color').toEqual(['error', 'success'])
    const off = textOf(BLUEPRINT.toolRow(EDIT, ctxOf({ settings: DIFFS_OFF })))
    expect(off).not.toContain('const t = 1')
  })

  test('a failed call is marked with a cross and FAIL in the error color', async () => {
    const tree = BLUEPRINT.toolRow(row('Bash', { command: 'npm test' }, { isErrored: true, durationMs: 1_200 }), ctxOf())
    const text = textOf(tree)
    expect(text.startsWith(' ╳  EXEC')).toBe(true)
    expect(text).toContain('FAIL')
    expect(nodes(tree).some(n => n.props.color === 'error')).toBe(true)
    expect(textOf(BLUEPRINT.toolRow(row('Bash', { command: 'npm test' }, { isInterrupted: true }), ctxOf()))).toContain('╳')
  })

  test('a running call shows an ellipsis for its time', async () => {
    expect(textOf(BLUEPRINT.toolRow(row('Bash', { command: 'npm test' }, { isRunning: true }), ctxOf()))).toContain('…')
  })

  test('empty streaming input draws without throwing', async () => {
    for (const tool of ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'mcp__srv__do_thing']) {
      const text = textOf(BLUEPRINT.toolRow(row(tool, {}, { isRunning: true }), ctxOf()))
      expect(text.length).toBeGreaterThan(0)
    }
  })

  test('a 500-character command and a CJK path never wrap', async () => {
    const trees = [
      BLUEPRINT.toolRow(row('Bash', { command: 'echo ' + 'x'.repeat(500) }, { durationMs: 100 }), ctxOf({ columns: 60 })),
      BLUEPRINT.toolRow(row('Read', { file_path: '/work/文档/设计/图纸说明书.md' }, { durationMs: 100 }), ctxOf({ columns: 60 })),
      BLUEPRINT.toolGroup([row('Read', { file_path: '/work/文档/图纸.md' }), row('Bash', { command: 'y'.repeat(500) })], ctxOf({ columns: 60 })),
    ]
    for (const tree of trees) {
      for (const n of nodes(tree)) {
        if (n.props.wrap !== undefined) expect(String(n.props.wrap).startsWith('truncate')).toBe(true)
      }
    }
  })

  test('a mixed group is one dimension line: counts as the tag, files as the target', async () => {
    const rows = [row('Read', { file_path: '/work/a.ts' }), row('Read', { file_path: '/work/b.ts' }), row('Read', { file_path: '/work/c.ts' }), row('Bash', { command: 'ls' })]
    const tree = BLUEPRINT.toolGroup(rows, ctxOf())
    const text = textOf(tree)
    expect(text.startsWith('├── READ ×3 · EXEC ×1 ── a.ts · b.ts · c.ts')).toBe(true)
    expect(text).toContain('4 STEPS ─┤')
    expect((tree as unknown as { props: Record<string, unknown> }).props.flexDirection, 'one line, no file list under it').toBe('row')
  })

  test('a group of one kind reads like the lookbook: folder ×n, then the count', async () => {
    const rows = [row('Read', { file_path: '/work/src/auth/a.ts' }, { durationMs: 300 }), row('Read', { file_path: '/work/src/auth/b.ts' }, { durationMs: 400 }), row('Read', { file_path: '/work/src/auth/c.ts' }, { durationMs: 400 })]
    const text = textOf(BLUEPRINT.toolGroup(rows, ctxOf()))
    expect(text.startsWith('├── READ ── src/auth/ ×3')).toBe(true)
    expect(text).toContain('3 FILES ─┤')
    expect(text).toContain('1.1s')
  })

  test('a group of one is drawn as its row', async () => {
    const one = row('Read', { file_path: '/work/src/cart.js' }, { durationMs: 100 })
    expect(textOf(BLUEPRINT.toolGroup([one], ctxOf()))).toBe(textOf(BLUEPRINT.toolRow(one, ctxOf())))
  })

  test('a failed group is crossed and says FAIL', async () => {
    const text = textOf(BLUEPRINT.toolGroup([row('Bash', { command: 'ls' }, { durationMs: 10 }), row('Bash', { command: 'npm test' }, { isErrored: true, durationMs: 10 })], ctxOf()))
    expect(text.startsWith(' ╳  EXEC')).toBe(true)
    expect(text).toContain('FAIL ─┤')
  })

  test('tags share one 4-cell column, so every target starts at the same place', async () => {
    const rows = [
      row('Read', { file_path: '/work/a.ts' }),
      row('Grep', { pattern: 'refreshToken' }),
      row('Glob', { pattern: '**/*.ts' }),
      row('Bash', { command: 'ls' }),
      row('WebFetch', { url: 'https://x.dev' }),
      row('Task', { description: 'map the auth module' }),
      row('TodoWrite', { todos: [{ content: 'one', status: 'in_progress' }] }),
      row('mcp__srv__do_thing', { arg: 'x' }),
    ]
    const at = rows.map(r => textOf(BLUEPRINT.toolRow(r, ctxOf())).indexOf(' ── '))
    expect(new Set(at)).toEqual(new Set([8]))
    expect(textOf(BLUEPRINT.toolRow(row('Grep', { pattern: 'refreshToken' }), ctxOf()))).toContain('├── SCAN ── "refreshToken"')
    expect(textOf(BLUEPRINT.toolRow(row('Bash', { command: 'ls' }), ctxOf()))).toContain('├── EXEC ── ls')
    expect(textOf(BLUEPRINT.toolRow(row('mcp__srv__do_thing', { arg: 'x' }), ctxOf()))).toContain('├── TOOL ── do_thing')
  })

  test('a new file is callout NEW, padded to the tag column', async () => {
    const text = textOf(BLUEPRINT.toolRow(row('Write', { file_path: '/work/src/lock.ts', content: 'a\nb\n' }, { changeIndex: 2, durationMs: 200 }), ctxOf({ settings: DIFFS_OFF })))
    expect(text.startsWith('(B) NEW  ── src/lock.ts')).toBe(true)
    expect(text).toMatch(/\+\d+ ─┤/)
  })

  test('a read measures its lines; a passing command says PASS', async () => {
    expect(textOf(BLUEPRINT.toolRow(row('Read', { file_path: '/work/a.ts', limit: 142 }, { durationMs: 200 }), ctxOf()))).toContain('142 LINES ─┤')
    const pass = BLUEPRINT.toolRow(row('Bash', { command: 'pnpm test' }, { durationMs: 4_200 }), ctxOf())
    expect(textOf(pass)).toContain('PASS ─┤')
    expect(nodes(pass).some(n => textOf(n) === 'PASS' && n.props.color === 'success')).toBe(true)
    expect(textOf(BLUEPRINT.toolRow(row('Bash', { command: 'pnpm test' }, { isRunning: true }), ctxOf()))).not.toContain('PASS')
  })

  test('the quiet line counts omitted measurements', async () => {
    expect(textOf(BLUEPRINT.quietLine(3, ctxOf()))).toBe('┆ 3 MEASUREMENTS OMITTED')
    expect(textOf(BLUEPRINT.quietLine(1, ctxOf()))).toBe('┆ 1 MEASUREMENT OMITTED')
  })
})

describe('blueprint results', () => {
  test('errors stay visible as a note', async () => {
    const tree = BLUEPRINT.toolResult({ tool: 'Bash', output: { stderr: 'command not found: nmp' }, isErrored: true }, ctxOf())
    expect(textOf(tree)).toBe('NOTE command not found: nmp')
    expect(nodes(tree).some(n => textOf(n) === 'NOTE' && n.props.color === 'error')).toBe(true)
    expect(nodes(tree).some(n => textOf(n) === ' command not found: nmp' && n.props.color === 'inactive'), 'the message itself is dim').toBe(true)
    expect(JSON.stringify(tree)).toContain('"paddingLeft":5')
  })

  test('Bash collapses to its last line; reads hide; unknown tools and diff-less edits fall back', async () => {
    expect(textOf(BLUEPRINT.toolResult({ tool: 'Bash', output: { stdout: 'a\nb\ncart.js\n', stderr: '' }, isErrored: false }, ctxOf()))).toContain('cart.js')
    expect(textOf(BLUEPRINT.toolResult({ tool: 'Read', output: 'x', isErrored: false }, ctxOf()))).toBe('')
    expect(BLUEPRINT.toolResult({ tool: 'mcp__x__y', output: 'x', isErrored: false }, ctxOf())).toBeNull()
    expect(BLUEPRINT.toolResult({ tool: 'Edit', output: 'x', isErrored: false }, ctxOf({ settings: DIFFS_OFF }))).toBeNull()
    expect(BLUEPRINT.toolResult({ tool: 'Edit', output: 'x', isErrored: false }, ctxOf({ settings: DIFFS_ON }))).not.toBeNull()
  })
})

describe('blueprint turn pieces', () => {
  test('the prompt is a SPEC and keeps its line breaks', async () => {
    const tree = BLUEPRINT.userMessage('first line\nsecond line', ctxOf())
    expect(textOf(tree)).toBe('SPEC ▸ first line\nsecond line')
    expect(nodes(tree).some(n => textOf(n) === 'SPEC' && n.props.color === 'suggestion' && n.props.bold === true)).toBe(true)
    expect(nodes(tree).some(n => textOf(n) === ' ▸ ' && n.props.color === 'subtle'), 'a faint pointer').toBe(true)
    expect(nodes(tree).some(n => textOf(n) === 'first line\nsecond line' && n.props.bold !== true), 'the spec reads as prose').toBe(true)
  })

  test('the headline is a numbered sheet with a clipped rule', async () => {
    const tree = BLUEPRINT.headline({ turn: 7, title: 'The refresh race, fixed' }, ctxOf())
    expect(textOf(tree)).toContain('SHEET 7 ─ THE REFRESH RACE, FIXED')
    expect(JSON.stringify(tree)).toContain('"overflow":"hidden"')
    expect(nodes(tree).some(n => textOf(n) === 'SHEET 7' && n.props.color === 'suggestion'), 'the sheet number is cyan').toBe(true)
  })

  test('the receipt is a title block whose rows line up', async () => {
    const tree = BLUEPRINT.receipt(RECEIPT, ctxOf())
    const text = textOf(tree)
    for (const s of ['THE REFRESH RACE, FIXED', 'DWG T-07', 'REV A', '2 FILES', '+103', '−10', '2:14', 'CTX 41%', 'DRAWN: CLAUDE', 'CHECKED: YOU', 'SCALE 1:1']) expect(text).toContain(s)
    // The block's lines are the column Box's children; every box line has the same width.
    const col = tree as unknown as { children: unknown[] }
    const lines = col.children.map(textOf).filter(l => /^[┌│├└]/.test(l))
    expect(lines.length).toBe(5)
    const widths = new Set(lines.map(l => [...l].length))
    expect(widths.size).toBe(1)
    expect(lines[0]?.startsWith('┌')).toBe(true)
    expect(lines[0]).toContain('┬')
    expect(lines[2]).toContain('┼')
    expect(lines[4]).toContain('┴')
    expect(nodes(tree).some(n => textOf(n) === '2 FILES' && n.props.color === 'inactive'), 'the file count is dim').toBe(true)
    const frame = nodes(tree).filter(n => n.type === 'Text' && /^[┌├└]/.test(textOf(n)))
    expect(frame.length).toBe(3)
    for (const n of frame) expect(n.props.color, 'the frame is drawn in cyan').toBe('suggestion')
    expect(col.children.map(textOf).find(l => l.includes('DRAWN'))?.startsWith(' DRAWN: CLAUDE')).toBe(true)
  })

  test('without a title the block names the turn', async () => {
    const text = textOf(BLUEPRINT.receipt({ ...RECEIPT, title: undefined }, ctxOf()))
    expect(text).toContain('TURN 7')
  })

  test('a receipt with notes, a time strip and no stats', async () => {
    const tree = BLUEPRINT.receipt({
      durationMs: 9_000,
      stats: null,
      notes: [{ n: 1, tool: 'Read', input: { file_path: '/work/src/a.ts' }, durationMs: 200 }],
      timeStrip: { thinkingMs: 6_000, toolsMs: 2_000, waitingMs: 1_000 },
    }, ctxOf())
    const text = textOf(tree)
    expect(text).toContain('NOTE ¹ READ src/a.ts 0.2S')
    expect(text.indexOf('NOTE ¹')).toBeLessThan(text.indexOf('┌'))
    expect(text).toContain('0:09')
    expect(text).toContain('■')
    expect(text.indexOf('■')).toBeGreaterThan(text.indexOf('└'))
    const col = tree as unknown as { children: unknown[] }
    const boxLines = col.children.map(textOf).filter(l => /^[┌│├└]/.test(l))
    expect(boxLines.length, 'a compact one-row block').toBe(3)
  })

  test('-inator mode: the title, the signature, the quip and the live word', async () => {
    const text = textOf(BLUEPRINT.receipt(RECEIPT, ctxOf({ settings: INATOR })))
    expect(text).toContain('THE REFRESH RACE, FIXED-INATOR')
    expect(text).toContain('DR. CLAUDE')
    expect(text).toContain('EVIL INC.')
    expect(text.toLowerCase()).toContain('another -inator completed')
    expect(textOf(BLUEPRINT.live({ mode: 'thinking', detail: '', elapsedMs: 0 }, 0, ctxOf({ settings: INATOR })))).toContain('SCHEMING')
    expect(textOf(BLUEPRINT.live({ mode: 'thinking', detail: '', elapsedMs: 0 }, 0, ctxOf({ surface: 'desktop', els: DESKTOP_ELS, settings: INATOR })))).toContain('SCHEMING')
  })

  test('the band belongs to others; panes wear the cyan accent', async () => {
    expect(BLUEPRINT.band({ usage: null, waiting: null, isWorking: false }, ctxOf())).toBeNull()
    expect(BLUEPRINT.paneStyle).toEqual({ accent: 'suggestion', marker: '├', current: '◎' })
  })
})

describe('blueprint live line', () => {
  test('terminal: drafting, measuring and annotating draw with rasters and a clock', async () => {
    const thinking = BLUEPRINT.live({ mode: 'thinking', detail: '', elapsedMs: 65_000 }, 5, ctxOf())
    expect(textOf(thinking)).toContain('◎')
    expect(textOf(thinking)).toContain('DRAFTING')
    expect(nodes(thinking).filter(n => n.type === 'Raster').length).toBe(2)
    expect(textOf(BLUEPRINT.live({ mode: 'writing', detail: '', elapsedMs: 0 }, 5, ctxOf()))).toContain('ANNOTATING')
  })

  test('running: MEASURING, the target in dim, then the calipers, then the clock', async () => {
    const tree = BLUEPRINT.live({ mode: 'running', detail: 'pnpm test auth', activity: 'Running', elapsedMs: 3_000 }, 5, ctxOf())
    const text = textOf(tree)
    expect(text.startsWith('◎ MEASURING pnpm test auth')).toBe(true)
    expect(text, 'the verb is said once').not.toContain('Running')
    expect(nodes(tree).some(n => textOf(n) === 'pnpm test auth' && n.props.color === 'inactive')).toBe(true)
    expect(nodes(tree).some(n => textOf(n) === '◎ ' && n.props.color === 'suggestion')).toBe(true)
    expect(nodes(tree).some(n => textOf(n) === 'MEASURING' && n.props.color === 'suggestion')).toBe(true)
    const kids = (tree as unknown as { children: Array<{ type: string; props: Record<string, unknown> }> }).children
    const keys = kids.map(k => (k.type === 'Raster' ? String(k.props.key) : k.type))
    expect(keys.indexOf('bp-calipers')).toBeGreaterThan(1)
    expect(keys.indexOf('bp-clock')).toBe(keys.length - 1)
    const desk = textOf(BLUEPRINT.live({ mode: 'running', detail: 'pnpm test auth', elapsedMs: 3_000 }, 5, ctxOf({ surface: 'desktop', els: DESKTOP_ELS })))
    expect(desk).toContain('◎ MEASURING pnpm test auth ├')
    expect(desk).toContain('┤')
    expect(desk).toContain('0:03')
  })

  test('the calipers hold their left tick while the dimension grows and shrinks', async () => {
    const frames = Array.from({ length: 40 }, (_, f) => caliperChars(f))
    for (const f of frames) {
      expect([...f].length).toBe(CALIPER_COLUMNS)
      expect(f.startsWith('├')).toBe(true)
    }
    const spans = frames.map(f => f.indexOf('┤'))
    expect(spans[0]).toBe(1)
    expect(Math.max(...spans)).toBe(CALIPER_COLUMNS - 1)
    for (let i = 1; i < spans.length; i++) expect(Math.abs((spans[i] ?? 0) - (spans[i - 1] ?? 0))).toBe(1)
    expect(frames[2]).toBe('├──┤' + ' '.repeat(CALIPER_COLUMNS - 4))
  })

  test('the pen traces solid while drafting and en dashes while annotating', async () => {
    expect(penChars(6, 'thinking').startsWith('├─────╴')).toBe(true)
    expect(penChars(6, 'writing').startsWith('├–––––╴')).toBe(true)
  })

  test('the rasters live draws match the frames it blits', async () => {
    const state = { mode: 'thinking' as const, detail: '', elapsedMs: 3_000 }
    const rasters = nodes(BLUEPRINT.live(state, 4, ctxOf())).filter(n => n.type === 'Raster')
    const frames = BLUEPRINT.liveFrames(state, 4)
    expect(rasters.map(r => r.props.key)).toEqual(frames.map(f => f.key))
    expect(rasters.map(r => r.props.columns)).toEqual(frames.map(f => f.columns))
  })

  test('every frame of a state keeps the same keys and columns', async () => {
    const modes: LiveMode[] = ['thinking', 'writing', 'running']
    for (const mode of modes) {
      for (const inator of [false, true]) {
        const first = BLUEPRINT.liveFrames({ mode, detail: 'x', elapsedMs: 0, inator }, 0)
        for (let f = 1; f < 30; f++) {
          const frames = BLUEPRINT.liveFrames({ mode, detail: 'x', elapsedMs: f * 100_000, inator }, f)
          expect(frames.map(x => `${x.key}:${x.columns}`)).toEqual(first.map(x => `${x.key}:${x.columns}`))
          for (const x of frames) expect(x.cells.length).toBe(Math.ceil((x.columns * 12) / 3) * 4)
        }
      }
    }
  })

  test('the pen moves from frame to frame', async () => {
    const state = { mode: 'thinking' as const, detail: '', elapsedMs: 0 }
    expect(BLUEPRINT.liveFrames(state, 3)[0]?.cells).not.toBe(BLUEPRINT.liveFrames(state, 4)[0]?.cells)
    const run = { mode: 'running' as const, detail: '', elapsedMs: 0 }
    expect(BLUEPRINT.liveFrames(run, 3)[0]?.cells).not.toBe(BLUEPRINT.liveFrames(run, 4)[0]?.cells)
  })
})

describe('blueprint on every surface', () => {
  test('desktop draws no Raster anywhere', async () => {
    const ctx = ctxOf({ surface: 'desktop', els: DESKTOP_ELS })
    for (const tree of everything(ctx)) expect(nodes(tree).some(n => n.type === 'Raster')).toBe(false)
    expect(textOf(BLUEPRINT.live({ mode: 'thinking', detail: '', elapsedMs: 4_000 }, 0, ctx))).toContain('DRAFTING')
  })

  test('escape codes never reach the output', async () => {
    const red = '\x1b[31mred'
    const ctx = ctxOf()
    const trees = [
      BLUEPRINT.toolRow(row('Bash', { command: red }), ctx),
      BLUEPRINT.toolRow(row('Read', { file_path: '/work/' + red }), ctx),
      BLUEPRINT.toolRow(row('Edit', { file_path: '/work/a.ts', old_string: red, new_string: red + '2' }, { changeIndex: 1 }), ctxOf({ settings: DIFFS_ON })),
      BLUEPRINT.toolGroup([row('Read', { file_path: '/work/' + red })], ctx),
      BLUEPRINT.toolResult({ tool: 'Bash', output: { stdout: red }, isErrored: false }, ctx),
      BLUEPRINT.toolResult({ tool: 'Bash', output: red, isErrored: true }, ctx),
      BLUEPRINT.userMessage(red, ctx),
      BLUEPRINT.headline({ turn: 1, title: red }, ctx),
      BLUEPRINT.receipt({ ...RECEIPT, title: red, notes: [{ n: 1, tool: 'Bash', input: { command: red } }] }, ctx),
      BLUEPRINT.live({ mode: 'running', detail: red, elapsedMs: 0 }, 0, ctx),
    ]
    for (const tree of trees) {
      expect(JSON.stringify(tree)).not.toContain('\\u001b')
      expect(textOf(tree).toLowerCase()).toContain('red')
    }
  })

  test('narrow columns keep the title block within the width and drop the time strip', async () => {
    const ctx = ctxOf({ columns: 60 })
    const tree = BLUEPRINT.receipt({ ...RECEIPT, title: 'A very long title that would never fit inside a sixty column terminal at all', timeStrip: { thinkingMs: 1, toolsMs: 1, waitingMs: 0 } }, ctx)
    const col = tree as unknown as { children: unknown[] }
    for (const line of col.children.map(textOf)) expect([...line].length).toBeLessThanOrEqual(60)
    expect(textOf(tree)).not.toContain('■■')
    for (const t of everything(ctx)) expect(textOf(t).length).toBeGreaterThan(0)
  })

  test('fade 2 drops background colors and dims every color', async () => {
    const ctx = ctxOf({ fade: 2, settings: DIFFS_ON })
    // The live line is always the current moment, so it never fades: the last three trees.
    for (const tree of everything(ctx).slice(0, -3)) {
      for (const n of nodes(tree)) {
        expect(n.props.backgroundColor).toBeUndefined()
        if (n.props.color !== undefined) expect(n.props.color).toBe('subtle')
      }
    }
  })

  test('every tree stays a sane size', async () => {
    for (const ctx of [ctxOf(), ctxOf({ columns: 60 }), ctxOf({ surface: 'desktop', els: DESKTOP_ELS }), ctxOf({ settings: INATOR, isDark: false })]) {
      for (const tree of everything(ctx)) {
        const json = JSON.stringify(tree)
        expect(json.length).toBeLessThan(20_000)
        for (const n of nodes(tree)) {
          const kids = (n as unknown as { children: unknown[] }).children
          for (const k of kids) if (typeof k === 'string') expect(k.length).toBeLessThan(10_000)
        }
      }
    }
  })
})
