import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_SETTINGS } from '../src/engine/settings'
import type { Settings } from '../src/engine/settings'
import type { Ctx, LiveState, ReceiptData, ToolRow } from '../src/looks/look'
import { MISSION } from '../src/looks/mission'
import { BAR_COLUMNS, TRACE_COLUMNS, barFill, sparkLevels, tClock, traceCells } from '../src/looks/mission/live'
import { GANTT_CELLS, ganttSpan } from '../src/looks/mission/style'
import { DESKTOP_ELS, ctxOf, textOf } from './fixtures'

const EDIT = { file_path: '/work/src/cart.js', old_string: 'a\nb\nc', new_string: 'a\nB\nC\nD\nc' }

function row(tool: string, input: unknown, over: Partial<ToolRow> = {}): ToolRow {
  return { id: 'toolu_1', tool, input, isRunning: false, isErrored: false, isInterrupted: false, ...over }
}

function withIngredients(over: Partial<Settings['ingredients']>): Settings {
  return { ...DEFAULT_SETTINGS, ingredients: { ...DEFAULT_SETTINGS.ingredients, ...over } }
}

const STATS = { turn: 7, files: ['/work/a.ts', '/work/b.ts'], add: 103, del: 10, contextPercent: 41.2 }
const FULL_RECEIPT: ReceiptData = {
  durationMs: 134_000,
  stats: STATS,
  notes: [{ n: 1, tool: 'Read', input: { file_path: '/work/src/a.ts' }, durationMs: 200 }],
  timeStrip: { thinkingMs: 6_000, toolsMs: 2_000, waitingMs: 1_000 },
}
const USAGE = { contextPercent: 41, rateLimits: [{ kind: 'five_hour', percentUsed: 62, resetsAt: Date.UTC(2026, 9, 3, 16, 40) }], costUsd: 1.84 }

/** Every member's output for one context, for the sweeping checks. */
function everything(ctx: Ctx): unknown[] {
  const live = (mode: LiveState['mode']): unknown => MISSION.live({ mode, detail: 'Run npm test', elapsedMs: 42_000 }, 5, ctx)
  return [
    MISSION.toolRow(row('Edit', EDIT, { durationMs: 4_200, turnOffsetMs: 42_000 }), ctx),
    MISSION.toolRow(row('Bash', { command: 'npm test' }, { isErrored: true, durationMs: 900 }), ctx),
    MISSION.toolRow(row('Read', { file_path: '/work/src/a.ts' }, { isRunning: true }), ctx),
    MISSION.toolGroup([row('Read', { file_path: '/work/a.ts' }, { durationMs: 100 }), row('Bash', { command: 'ls' }, { durationMs: 200 })], ctx),
    MISSION.quietLine(3, ctx),
    MISSION.toolResult({ tool: 'Bash', output: { stdout: 'ok\n3 passed' }, isErrored: false }, ctx),
    MISSION.toolResult({ tool: 'Bash', output: { stderr: 'boom' }, isErrored: true }, ctx),
    MISSION.userMessage('fix the refresh race', ctx),
    MISSION.headline({ turn: 7, title: 'The refresh race, fixed' }, ctx),
    MISSION.receipt(FULL_RECEIPT, ctx),
    MISSION.receipt({ durationMs: 9_000, stats: null, notes: [], timeStrip: null }, ctx),
    live('thinking'),
    live('writing'),
    live('running'),
    MISSION.band({ usage: USAGE, waiting: null, isWorking: false }, ctx),
    MISSION.band({ usage: null, waiting: { tool: 'Bash', input: { command: 'rm -rf build' }, waitedMs: 14_000 }, isWorking: true }, ctx),
  ]
}

describe('mission control look', () => {
  test('a tool row reads as a channel: rail, clock, tag, target, reading, duration', async () => {
    const text = textOf(MISSION.toolRow(row('Read', { file_path: '/work/src/cart.js' }, { durationMs: 200, turnOffsetMs: 42_000 }), ctxOf()))
    expect(text.startsWith('│')).toBe(true)
    expect(text).toContain('T+00:42')
    expect(text).toContain('READ')
    expect(text).toContain('src/cart.js')
    expect(text).toContain('·')
    expect(text).toContain('0.2s')
  })

  test('the clock is left out when the turn offset is unknown', async () => {
    expect(textOf(MISSION.toolRow(row('Read', { file_path: '/work/a.ts' }), ctxOf()))).not.toContain('T+')
  })

  test('every kind of call has a four-letter tag', async () => {
    const tag = (tool: string, input: unknown): string => textOf(MISSION.toolRow(row(tool, input), ctxOf()))
    expect(tag('Grep', { pattern: 'x' })).toContain('SCAN')
    expect(tag('Write', { file_path: '/work/n.ts', content: 'a' })).toContain('NEW')
    expect(tag('Bash', { command: 'ls' })).toContain('EXEC')
    expect(tag('WebFetch', { url: 'https://x.dev' })).toContain('WEB')
    expect(tag('Task', { description: 'look around' })).toContain('AGNT')
    expect(tag('mcp__srv__thing', { q: 'hello' })).toContain('TOOL')
  })

  test('an edit marks the rail and counts its lines in the reading column', async () => {
    const wide = textOf(MISSION.toolRow(row('Edit', EDIT, { durationMs: 300 }), ctxOf({ columns: 120 })))
    expect(wide.startsWith('├')).toBe(true)
    expect(wide).toContain('EDIT')
    expect(wide).toContain('+3 −1')
    expect(wide, 'no edit meter: the lookbook draws a timeline instead').not.toMatch(/[▯▰]/)
    const narrow = textOf(MISSION.toolRow(row('Edit', EDIT, { durationMs: 300 }), ctxOf({ columns: 60 })))
    expect(narrow).toContain('+3 −1')
  })

  test('every row carries a dotted timeline with a bar where the call ran, on wide terminals', async () => {
    const at = (offsetMs: number, columns = 120): string =>
      textOf(MISSION.toolRow(row('Read', { file_path: '/work/a.ts' }, { durationMs: 200, turnOffsetMs: offsetMs }), ctxOf({ columns })))
    const track = (text: string): string => text.match(/[·▮](?: [·▮]){15}/)?.[0] ?? ''
    expect(track(at(1_000)), 'sixteen cells, spaced like the lookbook').not.toBe('')
    expect(track(at(1_000)).indexOf('▮')).toBeLessThan(track(at(90_000)).indexOf('▮'))
    expect(at(1_000, 99), 'no timeline below 100 columns').not.toContain('▮')
    expect(textOf(MISSION.toolRow(row('Read', { file_path: '/work/a.ts' }, { durationMs: 200 }), ctxOf())), 'no bar when the offset is unknown').not.toContain('▮')
    const colorOf = (tree: unknown): string | undefined => JSON.stringify(tree).match(/"color":"([^"]+)"\},"children":\["[^"]*▮/)?.[1]
    expect(colorOf(MISSION.toolRow(row('Read', { file_path: '/work/a.ts' }, { durationMs: 200, turnOffsetMs: 5_000 }), ctxOf()))).toBe('suggestion')
    expect(colorOf(MISSION.toolRow(row('Edit', EDIT, { durationMs: 200, turnOffsetMs: 5_000 }), ctxOf()))).toBe('warning')
    expect(colorOf(MISSION.toolRow(row('Bash', { command: 'x' }, { isErrored: true, durationMs: 200, turnOffsetMs: 5_000 }), ctxOf()))).toBe('error')
  })

  test('the timeline span starts where the call did and is at least one cell wide', async () => {
    expect(ganttSpan(0, 100)).toEqual({ start: 0, width: 1 })
    let last = -1
    for (const s of [500, 2_000, 10_000, 60_000, 300_000]) {
      const span = ganttSpan(s, s + 200)
      expect(span.start).toBeGreaterThanOrEqual(last)
      expect(span.width).toBe(1)
      last = span.start
    }
    expect(last).toBeGreaterThan(8)
    expect(ganttSpan(5_000, 120_000).width).toBeGreaterThan(3)
    const huge = ganttSpan(10 * 3_600_000, 20 * 3_600_000)
    expect(huge.start + huge.width).toBeLessThanOrEqual(GANTT_CELLS)
    expect(huge.width).toBeGreaterThanOrEqual(1)
    expect(ganttSpan(Number.NaN, Number.NaN)).toEqual({ start: 0, width: 1 })
  })

  test('mini diffs show up to three changed lines, and only when on', async () => {
    const on = textOf(MISSION.toolRow(row('Edit', EDIT), ctxOf({ settings: withIngredients({ miniDiffs: true }) })))
    expect(on).toContain('- b')
    expect(on).toContain('+ B')
    expect(on).toContain('+ C')
    expect(on).not.toContain('+ D')
    const off = textOf(MISSION.toolRow(row('Edit', EDIT), ctxOf({ settings: withIngredients({ miniDiffs: false }) })))
    expect(off).not.toContain('+ B')
    const json = JSON.stringify(MISSION.toolRow(row('Edit', EDIT), ctxOf({ settings: withIngredients({ miniDiffs: true }) })))
    expect(json, 'changed lines are tinted like the lookbook').toContain('"backgroundColor":"diffAdded"')
    expect(json).toContain('"backgroundColor":"diffRemoved"')
  })

  test('a failure breaks the rail and reads FAIL; an interruption reads ABORT', async () => {
    const failed = textOf(MISSION.toolRow(row('Bash', { command: 'npm test' }, { isErrored: true, durationMs: 900 }), ctxOf()))
    expect(failed.startsWith('┿')).toBe(true)
    expect(failed).toContain('FAIL')
    expect(JSON.stringify(MISSION.toolRow(row('Bash', { command: 'npm test' }, { isErrored: true }), ctxOf())), 'the tag turns red').toContain('{"color":"error"},"children":["EXEC "]')
    expect(JSON.stringify(MISSION.toolRow(row('Bash', { command: 'npm test' }), ctxOf()))).toContain('{"color":"suggestion"},"children":["EXEC "]')
    expect(textOf(MISSION.toolRow(row('Bash', { command: 'npm test' }, { isInterrupted: true }), ctxOf()))).toContain('ABORT')
    expect(textOf(MISSION.toolRow(row('Bash', { command: 'npm test' }, { durationMs: 900 }), ctxOf()))).toContain('PASS')
  })

  test('a slow call reads its duration in bold amber', async () => {
    const tree = JSON.stringify(MISSION.toolRow(row('Bash', { command: 'sleep 4' }, { durationMs: 4_000 }), ctxOf()))
    expect(tree).toMatch(/"color":"warning","bold":true[^}]*\},"children":\["\s*4\.0s"\]/)
  })

  test('a running call shows an ellipsis and an empty streaming input never throws', async () => {
    expect(textOf(MISSION.toolRow(row('Bash', {}, { isRunning: true }), ctxOf()))).toContain('…')
    for (const tool of ['Read', 'Edit', 'Write', 'MultiEdit', 'Bash', 'Grep', 'Task', 'mcp__x__y']) {
      expect(() => MISSION.toolRow(row(tool, {}, { isRunning: true }), ctxOf())).not.toThrow()
      expect(() => MISSION.toolRow(row(tool, undefined, { isRunning: true }), ctxOf())).not.toThrow()
    }
  })

  test('long commands and CJK paths truncate instead of wrapping', async () => {
    const trees = [
      MISSION.toolRow(row('Bash', { command: 'echo ' + 'x'.repeat(500) }, { durationMs: 100 }), ctxOf({ columns: 60 })),
      MISSION.toolRow(row('Read', { file_path: '/work/資料/設計/とても長いファイル名の例.ts' }, { durationMs: 100 }), ctxOf({ columns: 60 })),
    ]
    for (const tree of trees) {
      const wraps = [...JSON.stringify(tree).matchAll(/"wrap":"([^"]+)"/g)].map(m => m[1])
      expect(wraps.length).toBeGreaterThan(0)
      for (const w of wraps) expect(w?.startsWith('truncate')).toBe(true)
    }
  })

  test('escape codes from tools and users never reach the drawing', async () => {
    const ctx = ctxOf()
    const evil = '\x1b[31mred\x1b]0;title\x07'
    const trees = [
      MISSION.toolRow(row('Bash', { command: evil }, { durationMs: 1 }), ctx),
      MISSION.toolRow(row('Read', { file_path: '/work/' + evil }), ctx),
      MISSION.toolResult({ tool: 'Bash', output: { stdout: evil }, isErrored: false }, ctx),
      MISSION.toolResult({ tool: 'Bash', output: evil, isErrored: true }, ctx),
      MISSION.userMessage(evil, ctx),
      MISSION.headline({ turn: 1, title: evil }, ctx),
      MISSION.live({ mode: 'running', detail: evil, elapsedMs: 0 }, 0, ctx),
      MISSION.band({ usage: null, waiting: { tool: 'Bash', input: { command: evil }, waitedMs: 0 }, isWorking: true }, ctx),
    ]
    for (const tree of trees) {
      expect(JSON.stringify(tree)).not.toContain('\\u001b')
      expect(textOf(tree).toLowerCase()).toContain('red')
    }
  })

  test('a folded group sums its channels and lists its files', async () => {
    const rows = [
      row('Read', { file_path: '/work/src/a.ts' }, { durationMs: 100 }),
      row('Read', { file_path: '/work/src/b.ts' }, { durationMs: 100 }),
      row('Read', { file_path: '/work/src/c.ts' }, { durationMs: 100 }),
      row('Bash', { command: 'ls' }, { durationMs: 300 }),
    ]
    const text = textOf(MISSION.toolGroup(rows, ctxOf()))
    expect(text.startsWith('│')).toBe(true)
    expect(text).toContain('READ ×3')
    expect(text).toContain('EXEC ×1')
    expect(text).toContain('0.6s')
    expect(text).toContain('a.ts · b.ts · c.ts')
    const failed = textOf(MISSION.toolGroup([row('Bash', { command: 'x' }, { isErrored: true })], ctxOf()))
    expect(failed).toContain('FAIL')
  })

  test('a group of one kind reads like a row: tag, folder, count and files', async () => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map(n => row('Read', { file_path: `/work/src/auth/${n}.ts` }, { durationMs: 200, turnOffsetMs: 3_000 }))
    const text = textOf(MISSION.toolGroup(rows, ctxOf()))
    expect(text).toMatch(/^│ T\+00:03 READ src\/auth\/ ×5 ·+ 5 FILES /)
    expect(text).toContain('▮')
    expect(text).toContain('1.0s')
    expect(text).toContain('a.ts · b.ts')
  })

  test('quiet leaves a suppression trace', async () => {
    expect(textOf(MISSION.quietLine(3, ctxOf()))).toBe('┆ ░░ 3 EVENTS SUPPRESSED')
    expect(textOf(MISSION.quietLine(1, ctxOf()))).toBe('┆ ░░ 1 EVENT SUPPRESSED')
  })

  test('results collapse to their telling line, errors stay, unknown tools pass through', async () => {
    const ctx = ctxOf()
    expect(textOf(MISSION.toolResult({ tool: 'Bash', output: { stdout: 'a\n3 passed\n' }, isErrored: false }, ctx))).toContain('3 passed')
    expect(textOf(MISSION.toolResult({ tool: 'Read', output: 'x', isErrored: true }, ctx))).toContain('x')
    expect(textOf(MISSION.toolResult({ tool: 'Bash', output: 'boom', isErrored: true }, ctx)), 'the elbow sits under the tag').toBe('│' + ' '.repeat(9) + '└ boom')
    expect(JSON.stringify(MISSION.toolResult({ tool: 'Read', output: 'body', isErrored: false }, ctx))).toBe('{"type":"Box","props":{},"children":[]}')
    expect(MISSION.toolResult({ tool: 'mcp__x__y', output: 'body', isErrored: false }, ctx)).toBeNull()
    expect(MISSION.toolResult({ tool: 'Edit', output: '', isErrored: false }, ctxOf({ settings: withIngredients({ miniDiffs: false }) }))).toBeNull()
    expect(MISSION.toolResult({ tool: 'Edit', output: '', isErrored: false }, ctxOf({ settings: withIngredients({ miniDiffs: true }) }))).not.toBeNull()
  })

  test('the prompt is tagged INPUT and keeps its line breaks', async () => {
    const text = textOf(MISSION.userMessage('first line\nsecond', ctxOf()))
    expect(text).toBe('▶INPUTfirst line\nsecond')
    expect(JSON.stringify(MISSION.userMessage('hello', ctxOf())), 'the prompt reads as prose, not bold').toContain('{"color":"text","wrap":"wrap"},"children":["hello"]')
    expect(textOf(MISSION.userMessage('x'.repeat(20_000), ctxOf())).length).toBeLessThan(5_000)
  })

  test('the headline is the turn and its title in capitals, over a clipped rule', async () => {
    const tree = MISSION.headline({ turn: 7, title: 'The refresh race, fixed' }, ctxOf())
    expect(textOf(tree)).toMatch(/^◇T07THE REFRESH RACE, FIXED─+$/)
    expect(JSON.stringify(tree), 'the turn number is amber and bold').toContain('{"color":"warning","bold":true},"children":["T07"]')
    expect(JSON.stringify(tree)).toContain('"overflow":"hidden"')
  })

  test('the receipt is one bracketed reading with notes above and the time strip below', async () => {
    const text = textOf(MISSION.receipt(FULL_RECEIPT, ctxOf()))
    expect(text).toContain('╞═ T07 ═ 2:14 ═ FILES 2 ═ Δ +103 −10 ═ CTX ▰▰▰▰▱▱▱▱▱▱ 41% ═╡')
    expect(text.indexOf('¹')).toBeLessThan(text.indexOf('╞'))
    expect(text).toContain('READ')
    expect(text).toContain('src/a.ts')
    expect(text.indexOf('thinking 0:06')).toBeGreaterThan(text.indexOf('╡'))
    expect(text).toContain('waiting on you 0:01')
    expect(textOf(MISSION.receipt({ durationMs: 9_000, stats: null, notes: [], timeStrip: null }, ctxOf()))).toBe('╞═ 9.0s ═╡')
  })

  test('the receipt brackets in amber and labels its readings in gray', async () => {
    const json = JSON.stringify(MISSION.receipt({ ...FULL_RECEIPT, notes: [], timeStrip: null }, ctxOf()))
    expect(json).toContain('{"color":"warning"},"children":[" ═ "]')
    expect(json).toContain('{"color":"inactive"},"children":["FILES"]')
    expect(json).toContain('{"color":"inactive"},"children":["Δ"]')
    expect(json).toContain('{"color":"inactive"},"children":["CTX"]')
    expect(json, 'the bracket closes right after the last reading').not.toContain('═══')
  })

  test('the receipt drops its meter below 100 columns and never shrinks its stats', async () => {
    const tree = MISSION.receipt({ ...FULL_RECEIPT, notes: [], timeStrip: null }, ctxOf({ columns: 60 }))
    expect(textOf(tree)).toContain('CTX 41%')
    expect(textOf(tree)).not.toContain('▰')
    expect(JSON.stringify(tree)).toContain('"flexShrink":0')
  })

  test('-inator mode declares victory and schemes in the live line', async () => {
    const inator = ctxOf({ settings: withIngredients({ inator: true }) })
    const text = textOf(MISSION.receipt({ ...FULL_RECEIPT, notes: [], timeStrip: null }, inator))
    expect(text).toContain('═ VICTORY · ')
    expect(text.endsWith(' ═╡')).toBe(true)
    expect(text.toLowerCase()).toContain('inator')
    expect(textOf(MISSION.receipt({ ...FULL_RECEIPT, notes: [], timeStrip: null }, ctxOf()))).not.toContain('VICTORY')
    expect(textOf(MISSION.live({ mode: 'thinking', detail: '', elapsedMs: 0 }, 0, { ...inator, surface: 'desktop', els: DESKTOP_ELS }))).toMatch(/^◉SCHEME/)
  })

  test('thinking: a lamp, THINK, a scrolling teal sparkline with its peak in amber, and the clock at the right', async () => {
    const ctx = ctxOf()
    const think = MISSION.live({ mode: 'thinking', detail: '', elapsedMs: 43_000 }, 3, ctx)
    expect(textOf(think)).toMatch(/^◉THINK/)
    const json = JSON.stringify(think)
    expect(json).toContain('{"color":"suggestion"},"children":["◉"]')
    expect(json).toContain(`"key":"cz-mission-trace","columns":${TRACE_COLUMNS}`)
    expect(json).toContain('"key":"cz-mission-clock","columns":7')
    expect(json, 'a spacer pushes the clock to the right edge').toContain('"flexGrow":1')
    expect(textOf(think), 'no invented tokens per second').not.toContain('tok/s')
    for (let f = 0; f < 60; f++) {
      const levels = sparkLevels(f)
      expect(levels.length).toBe(TRACE_COLUMNS)
      for (const v of levels) expect(v >= 0 && v <= 7).toBe(true)
    }
    expect(new Set(sparkLevels(0)).size, 'the trace moves up and down').toBeGreaterThan(3)
    expect(sparkLevels(6).slice(0, -1), 'it scrolls left a bar at a time').toEqual(sparkLevels(3).slice(1))
    expect(traceCells('thinking', 7), 'deterministic').toBe(traceCells('thinking', 7))
    expect(traceCells('thinking', 0)).not.toBe(traceCells('thinking', 30))
    expect(textOf(MISSION.live({ mode: 'writing', detail: '', elapsedMs: 0 }, 0, ctx))).toMatch(/^◉XMIT/)
  })

  test('running: the step as the look tags it, the target, a filling green bar and the clock', async () => {
    const ctx = ctxOf()
    const run = MISSION.live({ mode: 'running', detail: 'npm test', activity: 'Running', elapsedMs: 0 }, 0, ctx)
    expect(textOf(run)).toMatch(/^◉EXECnpm test/)
    expect(textOf(run), 'the verb is never printed twice').not.toContain('Running')
    expect(JSON.stringify(run)).toContain(`"key":"cz-mission-bar","columns":${BAR_COLUMNS}`)
    expect(textOf(MISSION.live({ mode: 'running', detail: 'src/a.ts', activity: 'Reading', elapsedMs: 0 }, 0, ctx))).toMatch(/^◉READsrc\/a\.ts/)
    expect(textOf(MISSION.live({ mode: 'running', detail: 'src/a.ts', activity: 'Editing', elapsedMs: 0 }, 0, ctx))).toMatch(/^◉EDIT/)
    expect(textOf(MISSION.live({ mode: 'running', detail: 'x', elapsedMs: 0 }, 0, ctx)), 'EXEC without a step').toMatch(/^◉EXEC/)
    let grew = false
    for (let f = 0; f < 60; f++) {
      const w = barFill(f)
      expect(w >= 0 && w <= BAR_COLUMNS).toBe(true)
      if (barFill(f + 1) > w) grew = true
    }
    expect(grew).toBe(true)
    expect(traceCells('running', 0)).not.toBe(traceCells('running', 10))
  })

  test('the mission clock is T+mm:ss and always seven cells', async () => {
    expect(tClock(42_000)).toBe('T+00:42')
    expect(tClock(754_000)).toBe('T+12:34')
    expect(tClock(99 * 60_000 + 59_000)).toBe('T+99:59')
    for (const ms of [0, 59_999, 6_000_000, 36_000_000, 400_000_000]) expect(tClock(ms).length).toBe(7)
  })

  test('live frames keep the same keys and columns across 30 frames in every mode', async () => {
    for (const mode of ['thinking', 'writing', 'running'] as const) {
      for (const inator of [false, true]) {
        const shape = JSON.stringify(MISSION.liveFrames({ mode, detail: 'x', elapsedMs: 0, inator }, 0).map(f => [f.key, f.columns]))
        for (let frame = 1; frame <= 30; frame++) {
          const frames = MISSION.liveFrames({ mode, detail: 'x', elapsedMs: frame * 997_000, inator }, frame)
          expect(JSON.stringify(frames.map(f => [f.key, f.columns]))).toBe(shape)
          for (const f of frames) expect(f.cells.length).toBe(Math.ceil((f.columns * 12) / 3) * 4)
        }
      }
    }
  })

  test('the desktop gets plain text: no raster in any member', async () => {
    const ctx = ctxOf({ els: DESKTOP_ELS, surface: 'desktop' })
    for (const tree of everything(ctx)) expect(JSON.stringify(tree) ?? '').not.toContain('Raster')
    const text = textOf(MISSION.live({ mode: 'running', detail: 'npm test', activity: 'Running', elapsedMs: 3_000 }, 0, ctx))
    expect(text).toMatch(/^◉EXECnpm test[█░]+T\+00:03$/)
    expect(textOf(MISSION.live({ mode: 'thinking', detail: '', elapsedMs: 3_000 }, 0, ctx))).toMatch(/^◉THINK[▁▂▃▄▅▆▇█]+T\+00:03$/)
    // A desktop table that still offers a Raster gets text too.
    expect(JSON.stringify(MISSION.live({ mode: 'thinking', detail: '', elapsedMs: 0 }, 0, ctxOf({ surface: 'desktop' })))).not.toContain('Raster')
  })

  test('the band is one line of telemetry from usage', async () => {
    const tree = MISSION.band({ usage: USAGE, waiting: null, isWorking: false }, ctxOf())
    const text = textOf(tree)
    const reset = new Date(USAGE.rateLimits[0]?.resetsAt ?? 0)
    const hhmm = `${String(reset.getHours()).padStart(2, '0')}:${String(reset.getMinutes()).padStart(2, '0')}`
    expect(text).toBe(`CTX▰▰▰▰▱▱▱▱▱▱41%│5H▰▰▰▰▰▰▱▱▱▱62%↻ ${hhmm}│SPEND$1.84`)
    const partial = textOf(MISSION.band({ usage: { rateLimits: [] , costUsd: 0.5 }, waiting: null, isWorking: false }, ctxOf({ columns: 60 })))
    expect(partial).toBe('SPEND$0.50')
    expect(textOf(MISSION.band({ usage: { contextPercent: 41, rateLimits: [] }, waiting: null, isWorking: false }, ctxOf({ columns: 60 })))).toBe('CTX41%')
  })

  test('the band holds for the operator while a call waits, and is absent with nothing to say', async () => {
    const text = textOf(MISSION.band({ usage: USAGE, waiting: { tool: 'Bash', input: { command: 'rm -rf build' }, waitedMs: 14_000 }, isWorking: true }, ctxOf()))
    expect(text).toContain('◉')
    expect(text).toContain('HOLD')
    expect(text).toContain('AWAITING OPERATOR')
    expect(text).toContain('EXEC rm -rf build')
    expect(text).toContain('0:14')
    expect(text).not.toContain('CTX')
    expect(MISSION.band({ usage: null, waiting: null, isWorking: false }, ctxOf())).toBeNull()
    expect(MISSION.band({ usage: { rateLimits: [] }, waiting: null, isWorking: false }, ctxOf())).toBeNull()
  })

  test('panes dress in amber with square markers', async () => {
    expect(MISSION.paneStyle).toEqual({ accent: 'warning', marker: '▪', current: '▶' })
  })

  test('faded rows use only the dim tokens and no backgrounds', async () => {
    const ctx = ctxOf({ fade: 2, settings: withIngredients({ miniDiffs: true, fileColors: true }) })
    for (const tree of everything(ctx).slice(0, 11)) {
      const json = JSON.stringify(tree) ?? ''
      expect(json).not.toContain('backgroundColor')
      const colors = [...json.matchAll(/"color":"([^"]+)"/g)].map(m => m[1])
      for (const c of colors) expect(c).toBe('subtle')
    }
  })

  test('narrow terminals and long input stay one line per row and every tree stays small', async () => {
    for (const columns of [40, 60, 99, 100, 200]) {
      const ctx = ctxOf({ columns, settings: withIngredients({ miniDiffs: true, fileColors: true, inator: true }) })
      for (const tree of everything(ctx)) {
        const json = JSON.stringify(tree) ?? ''
        expect(json.length).toBeLessThan(20_000)
        for (const m of json.matchAll(/"wrap":"([^"]+)"/g)) expect(['truncate', 'truncate-start', 'truncate-end', 'truncate-middle', 'wrap']).toContain(m[1])
      }
    }
    const longest = JSON.stringify(MISSION.userMessage('y'.repeat(50_000), ctxOf()))
    expect(longest.length).toBeLessThan(12_000)
  })
})
