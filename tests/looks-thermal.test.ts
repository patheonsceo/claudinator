import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_SETTINGS } from '../src/engine/settings'
import type { Settings } from '../src/engine/settings'
import { THERMAL } from '../src/looks/thermal'
import { barcode, serial } from '../src/looks/thermal/turn'
import type { Ctx, LiveMode, ReceiptData, ToolRow } from '../src/looks/look'
import { DESKTOP_ELS, ctxOf, textOf } from './fixtures'

const row = (over: Partial<ToolRow>): ToolRow => ({ id: 't1', tool: 'Read', input: {}, isRunning: false, isErrored: false, isInterrupted: false, ...over })

function withIngredients(over: Partial<Settings['ingredients']>): Settings {
  return { ...DEFAULT_SETTINGS, look: 'thermal', ingredients: { ...DEFAULT_SETTINGS.ingredients, ...over } }
}

const DIFFS = withIngredients({ miniDiffs: true })
const NO_DIFFS = withIngredients({ miniDiffs: false })
const INATOR = withIngredients({ inator: true })

const EDIT = row({ tool: 'Edit', input: { file_path: '/work/cart.js', old_string: '  return items.reduce((s, i) => s + i.price, 0)', new_string: '  return items.reduce((s, i) => s + i.price * i.qty, 0)' }, durationMs: 300 })

const FULL: ReceiptData = {
  durationMs: 134_000,
  stats: { turn: 7, files: ['/work/a.ts', '/work/b.ts'], add: 103, del: 10, contextPercent: 41.2, toolCount: 4, toolsMs: 10_300 },
  notes: [],
  timeStrip: null,
}

/** Every element node of a tree, depth first. */
function nodesOf(tree: unknown): Array<{ type: string; props: Record<string, unknown> }> {
  if (typeof tree !== 'object' || tree === null) return []
  if (Array.isArray(tree)) return tree.flatMap(nodesOf)
  const node = tree as { type: string; props: Record<string, unknown>; children: unknown }
  return [node, ...nodesOf(node.children)]
}

/** Every member's output for one context, for checks that hold everywhere. */
function everything(ctx: Ctx): unknown[] {
  return [
    THERMAL.toolRow(row({ input: { file_path: '/work/cart.js' }, durationMs: 200 }), ctx),
    THERMAL.toolRow(EDIT, ctx),
    THERMAL.toolRow(row({ tool: 'Bash', input: { command: 'npm test' }, isErrored: true, durationMs: 3_800 }), ctx),
    THERMAL.toolRow(row({ isRunning: true, input: { file_path: '/work/a.ts' } }), ctx),
    THERMAL.toolGroup([row({ input: { file_path: '/work/a.ts' }, durationMs: 100 }), row({ tool: 'Grep', input: { pattern: 'total' }, durationMs: 50 })], ctx),
    THERMAL.quietLine(3, ctx),
    THERMAL.toolResult({ tool: 'Bash', output: { stdout: 'cart.js\n' }, isErrored: false }, ctx),
    THERMAL.toolResult({ tool: 'Bash', output: { stderr: 'boom' }, isErrored: true }, ctx),
    THERMAL.userMessage('fix the refresh race', ctx),
    THERMAL.headline({ turn: 7, title: 'The refresh race, fixed' }, ctx),
    THERMAL.receipt({ ...FULL, notes: [{ n: 1, tool: 'Read', input: { file_path: '/work/src/a.ts' }, durationMs: 200 }], timeStrip: { thinkingMs: 6_000, toolsMs: 2_000, waitingMs: 1_000 } }, ctx),
    THERMAL.receipt({ durationMs: 9_000, stats: null, notes: [], timeStrip: null }, ctx),
    ...(['thinking', 'writing', 'running'] as LiveMode[]).map(mode => THERMAL.live({ mode, detail: 'Run npm test', elapsedMs: 12_000 }, 4, ctx)),
  ].filter(x => x !== null)
}

describe('thermal look', () => {
  test('a read prints as an uppercase line item with a dotted leader and a price', async () => {
    const tree = THERMAL.toolRow(row({ input: { file_path: '/work/cart.js' }, durationMs: 200 }), ctxOf({ settings: NO_DIFFS }))
    const text = textOf(tree)
    expect(text).toContain('READ')
    expect(text).toContain('CART.JS')
    expect(text).toContain('....')
    expect(text).toContain('0.2S')
    expect(text).not.toContain('cart.js')
  })

  test('an edit shows its counts, and its changed lines only with mini diffs on', async () => {
    const text = textOf(THERMAL.toolRow(EDIT, ctxOf({ settings: DIFFS })))
    expect(text).toContain('EDIT')
    expect(text).toContain('+1')
    expect(text).toContain('-1')
    expect(text).toContain('0.3S')
    expect(text).toContain('- ' + '  return items.reduce((s, i) => s + i.price, 0)'.trim())
    expect(text).toContain('+ ' + 'return items.reduce((s, i) => s + i.price * i.qty, 0)')
    const plain = textOf(THERMAL.toolRow(EDIT, ctxOf({ settings: NO_DIFFS })))
    expect(plain).toContain('+1')
    expect(plain).not.toContain('i.qty')
  })

  test('a failed call prints FAILED in the error color, an interrupted one VOID', async () => {
    const tree = THERMAL.toolRow(row({ tool: 'Bash', input: { command: 'npm test' }, isErrored: true, durationMs: 3_800 }), ctxOf())
    expect(textOf(tree)).toContain('FAILED')
    expect(textOf(tree)).toContain('3.8S')
    expect(JSON.stringify(tree)).toContain('"color":"error"')
    expect(textOf(THERMAL.toolRow(row({ tool: 'Bash', input: { command: 'sleep 9' }, isInterrupted: true }), ctxOf()))).toContain('VOID')
  })

  test('the error result prints under the item with two stars', async () => {
    const text = textOf(THERMAL.toolResult({ tool: 'Bash', output: { stderr: 'Error: 1 test failed\nat foo' }, isErrored: true }, ctxOf()))
    expect(text).toContain('** ERROR: 1 TEST FAILED')
  })

  test('results: bash collapses to its last line, reads hide, unknown tools and plain edits fall through', async () => {
    expect(textOf(THERMAL.toolResult({ tool: 'Bash', output: { stdout: 'a\ncart.js\n' }, isErrored: false }, ctxOf()))).toContain('CART.JS')
    expect(textOf(THERMAL.toolResult({ tool: 'Read', output: 'x', isErrored: false }, ctxOf()))).toBe('')
    expect(THERMAL.toolResult({ tool: 'mcp__x__y', output: 'x', isErrored: false }, ctxOf())).toBe(null)
    expect(THERMAL.toolResult({ tool: 'Edit', output: 'x', isErrored: false }, ctxOf({ settings: NO_DIFFS }))).toBe(null)
    expect(THERMAL.toolResult({ tool: 'Edit', output: 'x', isErrored: false }, ctxOf({ settings: DIFFS }))).not.toBe(null)
  })

  test('a running call prices itself as ...', async () => {
    const text = textOf(THERMAL.toolRow(row({ isRunning: true, input: { file_path: '/work/a.ts' } }), ctxOf()))
    expect(text.trimEnd().endsWith('...')).toBe(true)
  })

  test('a streaming call with empty input still draws', async () => {
    for (const tool of ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'mcp__srv__do']) {
      expect(textOf(THERMAL.toolRow(row({ tool, input: {}, isRunning: true }), ctxOf()))).toContain('...')
    }
  })

  test('a 500-character command and a CJK path never wrap and never throw', async () => {
    for (const input of [{ command: 'echo ' + 'x'.repeat(500) }, { file_path: '/work/資料/日本語のファイル名.ts' }]) {
      const tool = 'command' in input ? 'Bash' : 'Read'
      const tree = THERMAL.toolRow(row({ tool, input, durationMs: 100 }), ctxOf())
      for (const n of nodesOf(tree)) {
        const wrap = n.props.wrap
        if (wrap !== undefined) expect(String(wrap).startsWith('truncate')).toBe(true)
      }
    }
  })

  test('escape codes never reach the output', async () => {
    const ctx = ctxOf()
    const trees = [
      THERMAL.toolRow(row({ tool: 'Bash', input: { command: '\x1b[31mred' }, durationMs: 1 }), ctx),
      THERMAL.toolResult({ tool: 'Bash', output: { stdout: '\x1b[31mred' }, isErrored: false }, ctx),
      THERMAL.toolResult({ tool: 'Bash', output: '\x1b[31mred', isErrored: true }, ctx),
      THERMAL.userMessage('\x1b[31mred', ctx),
      THERMAL.headline({ turn: 1, title: '\x1b[31mred' }, ctx),
      THERMAL.live({ mode: 'running', detail: '\x1b[31mred', elapsedMs: 0 }, 0, ctx),
    ]
    for (const t of trees) expect(JSON.stringify(t)).not.toContain('\\u001b')
  })

  test('a group prints one line item per call', async () => {
    const text = textOf(THERMAL.toolGroup([row({ input: { file_path: '/work/a.ts' }, durationMs: 100 }), row({ tool: 'Grep', input: { pattern: 'total' }, durationMs: 50 })], ctxOf()))
    expect(text).toContain('READ A.TS')
    expect(text).toContain('SEARCH TOTAL')
    expect(text).toContain('0.1S')
  })

  test('quiet, prompt and headline lines', async () => {
    expect(textOf(THERMAL.quietLine(3, ctxOf()))).toBe('(3 ITEMS NOT PRINTED)')
    expect(textOf(THERMAL.quietLine(1, ctxOf()))).toBe('(1 ITEM NOT PRINTED)')
    const prompt = textOf(THERMAL.userMessage('fix the Refresh race\nplease', ctxOf()))
    expect(prompt).toContain('ORDER ▸')
    expect(prompt).toContain('fix the Refresh race\nplease')
    const head = THERMAL.headline({ turn: 7, title: 'The refresh race, fixed' }, ctxOf())
    expect(textOf(head)).toContain('** THE REFRESH RACE, FIXED **')
    expect(JSON.stringify(head)).toContain('"bold":true')
  })

  test('the receipt prints the full slip: items, thinking, total, changes, context, thanks, barcode, serial, tear-off', async () => {
    const tree = THERMAL.receipt(FULL, ctxOf())
    const text = textOf(tree)
    for (const part of ['- - -', 'ITEMS (4)', '10.3S', 'THINKING', '2:04', 'TOTAL', '2:14', 'CHANGED 2 FILES', '+103 -10', 'CONTEXT USED', '41%', 'THANK YOU FOR CODING WITH US', 'T7 · ', '✂']) {
      expect(text).toContain(part)
    }
    expect(text.indexOf('ITEMS')).toBeLessThan(text.indexOf('TOTAL'))
    expect(text.indexOf('TOTAL')).toBeLessThan(text.indexOf('THANK YOU'))
    expect(text.indexOf('THANK YOU')).toBeLessThan(text.indexOf('✂'))
    expect(text).toContain(barcode(7))
    expect(text).toContain(serial(7))
  })

  test('the barcode and serial are deterministic per turn and differ between turns', async () => {
    expect(barcode(7)).toBe(barcode(7))
    expect(barcode(7)).not.toBe(barcode(8))
    expect(barcode(7).length).toBe(30)
    expect(/^[▌▍▎▏█▐]+$/.test(barcode(7))).toBe(true)
    expect(/^[0-9A-F]{6}$/.test(serial(7))).toBe(true)
    expect(serial(7)).not.toBe(serial(8))
  })

  test('null stats print a short receipt with only the total', async () => {
    const text = textOf(THERMAL.receipt({ durationMs: 9_000, stats: null, notes: [], timeStrip: null }, ctxOf()))
    expect(text).toContain('TOTAL')
    expect(text).toContain('0:09')
    expect(text).not.toContain('ITEMS')
    expect(text).not.toContain('CHANGED')
  })

  test('notes print above the slip and the time strip below the total', async () => {
    const text = textOf(THERMAL.receipt({
      durationMs: 9_000,
      stats: { turn: 2, files: [], add: 0, del: 0 },
      notes: [{ n: 1, tool: 'Read', input: { file_path: '/work/src/a.ts' }, durationMs: 200 }],
      timeStrip: { thinkingMs: 6_000, toolsMs: 2_000, waitingMs: 1_000 },
    }, ctxOf()))
    expect(text).toContain('¹ READ SRC/A.TS 0.2S')
    expect(text.indexOf('¹')).toBeLessThan(text.indexOf('TOTAL'))
    expect(text).toContain('▒')
    expect(text.indexOf('TOTAL')).toBeLessThan(text.indexOf('▒'))
    expect(text).toContain('THINKING 6.0S')
    expect(text).toContain('WAITING 1.0S')
  })

  test('-inator mode schemes and curses', async () => {
    const text = textOf(THERMAL.receipt(FULL, ctxOf({ settings: INATOR })))
    expect(text).toContain('ANOTHER -INATOR COMPLETED, CURSES')
    expect(text).not.toContain('THANK YOU')
    expect(textOf(THERMAL.live({ mode: 'thinking', detail: '', elapsedMs: 0, inator: true }, 0, ctxOf({ surface: 'desktop', els: DESKTOP_ELS, settings: INATOR })))).toContain('SCHEMING')
  })

  test('the live line names the mode and keeps time', async () => {
    const desk = ctxOf({ surface: 'desktop', els: DESKTOP_ELS })
    expect(textOf(THERMAL.live({ mode: 'thinking', detail: '', elapsedMs: 12_000 }, 0, desk))).toContain('PRINTING')
    expect(textOf(THERMAL.live({ mode: 'thinking', detail: '', elapsedMs: 12_000 }, 0, desk))).toContain('0:12')
    expect(textOf(THERMAL.live({ mode: 'writing', detail: '', elapsedMs: 0 }, 0, desk))).toContain('PRINTING REPLY')
    expect(textOf(THERMAL.live({ mode: 'running', detail: 'Run npm test', elapsedMs: 0 }, 0, desk))).toContain('RUNNING RUN NPM TEST')
    const term = JSON.stringify(THERMAL.live({ mode: 'thinking', detail: '', elapsedMs: 0 }, 0, ctxOf()))
    expect(term).toContain('"type":"Raster"')
  })

  test('liveFrames keep the same keys and columns across 30 frames in every mode', async () => {
    for (const mode of ['thinking', 'writing', 'running'] as LiveMode[]) {
      for (const inator of [false, true]) {
        const shape = (f: number): string => THERMAL.liveFrames({ mode, detail: 'x', elapsedMs: f * 100, inator }, f).map(x => `${x.key}:${x.columns}`).join(',')
        const first = shape(0)
        for (let f = 1; f < 30; f++) expect(shape(f)).toBe(first)
      }
    }
    const a = THERMAL.liveFrames({ mode: 'thinking', detail: '', elapsedMs: 0 }, 0)
    const b = THERMAL.liveFrames({ mode: 'thinking', detail: '', elapsedMs: 0 }, 1)
    expect(a[0]?.cells).not.toBe(b[0]?.cells)
  })

  test('desktop output never holds a Raster', async () => {
    for (const tree of everything(ctxOf({ surface: 'desktop', els: DESKTOP_ELS }))) {
      expect(JSON.stringify(tree)).not.toContain('"type":"Raster"')
    }
  })

  test('narrow columns: the slip shrinks and everything still draws', async () => {
    const ctx = ctxOf({ columns: 60 })
    for (const tree of everything(ctx)) {
      for (const n of nodesOf(tree)) {
        if (typeof n.props.width === 'number') expect(n.props.width).toBeLessThanOrEqual(54)
      }
    }
    const tiny = ctxOf({ columns: 30 })
    for (const tree of everything(tiny)) {
      for (const n of nodesOf(tree)) {
        if (typeof n.props.width === 'number') expect(n.props.width).toBeLessThanOrEqual(30)
      }
    }
  })

  test('fade 2 drops backgrounds and dims every color', async () => {
    for (const tree of everything(ctxOf({ fade: 2 }))) {
      for (const n of nodesOf(tree)) {
        if (n.type === 'Raster') continue
        expect(n.props.backgroundColor).toBe(undefined)
        if (n.props.color !== undefined) expect(n.props.color).toBe('subtle')
      }
    }
  })

  test('every tree stays small, and band and pane style are set', async () => {
    for (const tree of everything(ctxOf())) expect(JSON.stringify(tree).length).toBeLessThan(20_000)
    const long = THERMAL.userMessage('x'.repeat(50_000), ctxOf())
    expect(JSON.stringify(long).length).toBeLessThan(10_000)
    expect(THERMAL.band({ usage: null, waiting: null, isWorking: false }, ctxOf())).toBe(null)
    expect(THERMAL.paneStyle).toEqual({ accent: 'text', marker: '*', current: '>' })
  })
})
