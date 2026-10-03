import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_SETTINGS, toggled } from '../src/engine/settings'
import { BROADSHEET } from '../src/looks/broadsheet'
import { typedOf } from '../src/looks/broadsheet/live'
import { roman, sentenceOf } from '../src/looks/broadsheet/prose'
import type { LiveMode, ReceiptData, ToolRow } from '../src/looks/look'
import { DESKTOP_ELS, ctxOf, textOf } from './fixtures'

const row = (over: Partial<ToolRow>): ToolRow => ({ id: 't1', tool: 'Read', input: {}, isRunning: false, isErrored: false, isInterrupted: false, ...over })
const inator = { ...DEFAULT_SETTINGS, ingredients: { ...DEFAULT_SETTINGS.ingredients, inator: true } }
const withDiffs = { ...DEFAULT_SETTINGS, ingredients: { ...DEFAULT_SETTINGS.ingredients, miniDiffs: true } }
const edit = row({ tool: 'Edit', input: { file_path: '/work/src/cart.js', old_string: 'return s + i.price', new_string: 'return s + i.price * i.qty' }, durationMs: 300 })
const fullReceipt: ReceiptData = {
  durationMs: 134_000,
  stats: { turn: 7, files: ['/work/a.ts', '/work/b.ts'], add: 103, del: 10, contextPercent: 41.2 },
  notes: [{ n: 1, tool: 'Read', input: { file_path: '/work/a.ts' }, durationMs: 100 }],
  timeStrip: { thinkingMs: 6_000, toolsMs: 2_000, waitingMs: 1_000 },
}

/** The props of the first Text whose own string child is `text`. */
function textNode(tree: unknown, text: string): Record<string, unknown> | undefined {
  if (Array.isArray(tree)) {
    for (const t of tree) {
      const hit = textNode(t, text)
      if (hit) return hit
    }
    return undefined
  }
  if (typeof tree !== 'object' || !tree) return undefined
  const node = tree as { type?: string; props?: Record<string, unknown>; children?: unknown[] }
  if (node.type === 'Text' && node.children?.length === 1 && node.children[0] === text) return node.props
  return textNode(node.children ?? [], text)
}

/** The characters a raster's cells hold. */
function rasterText(cells: string): string {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bytes: number[] = []
  for (let i = 0; i < cells.length; i += 4) {
    const n = [0, 1, 2, 3].map(k => Math.max(0, abc.indexOf(cells[i + k] ?? 'A')))
    const v = ((n[0] ?? 0) << 18) | ((n[1] ?? 0) << 12) | ((n[2] ?? 0) << 6) | (n[3] ?? 0)
    bytes.push((v >> 16) & 255, (v >> 8) & 255, v & 255)
  }
  let out = ''
  for (let i = 0; i + 11 < bytes.length; i += 12) out += String.fromCharCode((bytes[i] ?? 0) | ((bytes[i + 1] ?? 0) << 8))
  return out
}

/** Every member's tree for one context, for checks that hold everywhere. */
function everything(ctx: ReturnType<typeof ctxOf>): unknown[] {
  return [
    BROADSHEET.toolRow(edit, ctx),
    BROADSHEET.toolRow(row({ tool: 'Bash', input: { command: 'npm test' }, isErrored: true }), ctx),
    BROADSHEET.toolGroup([row({ input: { file_path: '/work/a.ts' } }), row({ tool: 'Bash', input: { command: 'ls' } })], ctx),
    BROADSHEET.quietLine(3, ctx),
    BROADSHEET.toolResult({ tool: 'Bash', output: 'Error: exit 1', isErrored: true }, ctx),
    BROADSHEET.userMessage('fix the cart', ctx),
    BROADSHEET.headline({ turn: 7, title: 'The cart, totalled' }, ctx),
    BROADSHEET.receipt(fullReceipt, ctx),
    ...(['thinking', 'writing', 'running'] as LiveMode[]).map(mode => BROADSHEET.live({ mode, detail: 'npm test', activity: 'Running', elapsedMs: 5_000 }, 12, ctx)),
  ]
}

describe('broadsheet prose', () => {
  test('a folded group reads as one sentence with an Oxford-free list', async () => {
    const rows = [
      row({ id: 'a', input: { file_path: '/work/src/cart.js' }, durationMs: 100 }),
      row({ id: 'b', tool: 'Grep', input: { pattern: 'refreshToken' }, durationMs: 100 }),
      row({ id: 'c', tool: 'Bash', input: { command: 'ls' }, durationMs: 300 }),
    ]
    const text = textOf(BROADSHEET.toolGroup(rows, ctxOf()))
    expect(text).toMatch(/^↳Read cart\.js, searched for “refreshToken” and ran 1 command\./)
    expect(text).toContain('0.5s')
  })

  test('counts replace names when a kind repeats', async () => {
    const calls = [row({ input: { file_path: '/work/a.ts' } }), row({ input: { file_path: '/work/b.ts' } })]
    expect(sentenceOf(calls, '/work')).toBe('Read 2 files')
  })

  test('a group of one call reads as that call', async () => {
    const text = textOf(BROADSHEET.toolGroup([row({ tool: 'Bash', input: { command: 'ls' }, durationMs: 400 })], ctxOf()))
    expect(text).toMatch(/^↳Ran ls\./)
  })

  test('roman numerals for chapter headings', async () => {
    expect(roman(7)).toBe('VII')
    expect(roman(14)).toBe('XIV')
    expect(roman(0)).toBe('0')
  })
})

describe('broadsheet rows', () => {
  test('a plain call is one italic sentence with its time at the right', async () => {
    const tree = BROADSHEET.toolRow(row({ input: { file_path: '/work/src/cart.js' }, durationMs: 200 }), ctxOf())
    expect(textOf(tree)).toMatch(/^↳Read cart\.js in src\/\./)
    expect(textOf(tree)).toContain('0.2s')
    expect(JSON.stringify(tree)).toContain('"italic":true')
  })

  test('an edit names the file upright, the folder in italic, and counts its lines', async () => {
    const text = textOf(BROADSHEET.toolRow(edit, ctxOf({ settings: withDiffs })))
    expect(text).toMatch(/^✎Edited cart\.js in src\//)
    expect(text).toContain('+1')
    expect(text).toContain('−1')
    expect(text).toContain('return s + i.price * i.qty')
  })

  test('mini diffs off leaves only the line', async () => {
    const off = { ...DEFAULT_SETTINGS, ingredients: { ...DEFAULT_SETTINGS.ingredients, miniDiffs: false } }
    const text = textOf(BROADSHEET.toolRow(edit, ctxOf({ settings: off })))
    expect(text).toContain('+1')
    expect(text).not.toContain('i.qty')
    expect(BROADSHEET.toolResult({ tool: 'Edit', output: {}, isErrored: false }, ctxOf({ settings: off }))).toBeNull()
  })

  test('a failure reads as a sentence in the error color', async () => {
    const tree = BROADSHEET.toolRow(row({ tool: 'Bash', input: { command: 'npm test' }, isErrored: true }), ctxOf())
    expect(textOf(tree)).toContain('✗')
    expect(textOf(tree), 'a colon hands over to the detail line below').toContain('Ran npm test. It failed:')
    expect(JSON.stringify(tree)).toContain('"color":"error"')
    expect(textOf(BROADSHEET.toolRow(row({ tool: 'Bash', input: { command: 'sleep 9' }, isInterrupted: true }), ctxOf()))).toContain('It was interrupted.')
  })

  test('an edit sets its verb upright and a new file reads as Created', async () => {
    const tree = BROADSHEET.toolRow(edit, ctxOf())
    expect(textNode(tree, 'Edited ')?.italic, 'the verb is roman, like the lookbook').toBeUndefined()
    expect(textNode(tree, ' in src/')?.italic).toBe(true)
    const created = textOf(BROADSHEET.toolRow(row({ tool: 'Write', input: { file_path: '/work/src/auth/refresh-lock.ts', content: 'a\nb' } }), ctxOf()))
    expect(created).toMatch(/^✎Created refresh-lock\.ts in src\/auth\//)
    expect(created).toContain('+2')
    expect(textOf(BROADSHEET.toolRow(row({ tool: 'Write', isRunning: true, input: { file_path: '/work/a.ts' } }), ctxOf()))).toContain('Creating a.ts')
  })

  test('a group names its reads by folder and sets each failure on its own line', async () => {
    const rows = [
      row({ id: 'a', input: { file_path: '/work/src/auth/session.ts' }, durationMs: 400 }),
      row({ id: 'b', input: { file_path: '/work/src/auth/token.ts' }, durationMs: 600 }),
      row({ id: 'c', tool: 'Bash', input: { command: 'npm test' }, isErrored: true, durationMs: 3_000 }),
      row({ id: 'd', tool: 'Grep', input: { pattern: 'refreshToken' }, durationMs: 100 }),
    ]
    const text = textOf(BROADSHEET.toolGroup(rows, ctxOf()))
    expect(text).toContain('↳Read 2 files in src/auth/.')
    expect(text).toContain('1.0s')
    expect(text).toContain('✗Ran npm test. It failed.')
    expect(text).toContain('↳Searched for “refreshToken”.')
    expect(text.indexOf('Read 2 files')).toBeLessThan(text.indexOf('npm test'))
    expect(text.indexOf('npm test')).toBeLessThan(text.indexOf('refreshToken'))
  })

  test('a running call speaks in the present and trails off', async () => {
    expect(textOf(BROADSHEET.toolRow(row({ isRunning: true, input: { file_path: '/work/a.ts' } }), ctxOf()))).toContain('Reading a.ts…')
    expect(textOf(BROADSHEET.toolRow(row({ isRunning: true, input: { file_path: '/work/src/a.ts' } }), ctxOf()))).toContain('Reading a.ts in src/…')
    expect(textOf(BROADSHEET.toolRow(row({ tool: 'Edit', isRunning: true, input: { file_path: '/work/a.ts' } }), ctxOf()))).toContain('…')
  })

  test('a streaming call with empty input still draws', async () => {
    for (const tool of ['Edit', 'Write', 'Bash', 'Read', 'Grep', 'mcp__x__y', 'TodoWrite']) {
      expect(textOf(BROADSHEET.toolRow(row({ tool, input: {}, isRunning: true }), ctxOf())).length).toBeGreaterThan(2)
    }
    expect(textOf(BROADSHEET.toolGroup([], ctxOf())).length).toBeGreaterThan(0)
  })

  test('a 500-character command and a CJK path never wrap and never throw', async () => {
    const trees = [
      BROADSHEET.toolRow(row({ tool: 'Bash', input: { command: 'echo ' + 'x'.repeat(500) } }), ctxOf()),
      BROADSHEET.toolRow(row({ input: { file_path: '/work/資料/長い名前のファイル.ts' } }), ctxOf()),
      BROADSHEET.toolRow(row({ tool: 'Write', input: { file_path: '/work/資料/長.ts', content: '長'.repeat(500) } }), ctxOf({ settings: withDiffs })),
      BROADSHEET.toolGroup([row({ tool: 'Bash', input: { command: 'y'.repeat(500) } }), row({ input: { file_path: '/work/資料/長.ts' } })], ctxOf()),
    ]
    for (const tree of trees) {
      const wraps = JSON.stringify(tree).match(/"wrap":"[^"]+"/g) ?? []
      for (const w of wraps) expect(w).toMatch(/"wrap":"truncate/)
    }
  })

  test('escape codes never reach the output', async () => {
    const red = '\x1b[31mred'
    const trees = [
      BROADSHEET.toolRow(row({ tool: 'Bash', input: { command: red } }), ctxOf()),
      BROADSHEET.toolRow(row({ input: { file_path: '/work/' + red } }), ctxOf()),
      BROADSHEET.toolRow(row({ tool: 'Edit', input: { file_path: '/work/a.ts', old_string: red, new_string: red + '2' } }), ctxOf({ settings: withDiffs })),
      BROADSHEET.toolGroup([row({ tool: 'Grep', input: { pattern: red } })], ctxOf()),
      BROADSHEET.toolResult({ tool: 'Bash', output: red, isErrored: true }, ctxOf()),
      BROADSHEET.userMessage(red, ctxOf()),
      BROADSHEET.headline({ turn: 1, title: red }, ctxOf()),
      BROADSHEET.live({ mode: 'running', detail: red, elapsedMs: 0 }, 0, ctxOf({ surface: 'desktop', els: DESKTOP_ELS })),
    ]
    for (const tree of trees) expect(JSON.stringify(tree)).not.toContain('\\u001b')
  })

  test('escape and bell bytes from every input and output are stripped', async () => {
    const bad = '\x1b[31mred\x07'
    const desktop = ctxOf({ surface: 'desktop', els: DESKTOP_ELS })
    const trees = [
      BROADSHEET.toolRow(row({ input: { file_path: '/work/' + bad } }), ctxOf()),
      BROADSHEET.toolRow(row({ tool: 'Bash', input: { command: bad } }), ctxOf()),
      BROADSHEET.toolRow(row({ tool: 'Grep', input: { pattern: bad } }), ctxOf()),
      BROADSHEET.toolRow(row({ tool: 'mcp__srv__' + bad, input: { arg: bad } }), ctxOf()),
      BROADSHEET.toolRow(row({ tool: 'Edit', input: { file_path: '/work/' + bad + '/' + bad, old_string: bad, new_string: bad + '2' } }), ctxOf({ settings: withDiffs })),
      BROADSHEET.toolRow(row({ tool: 'Write', input: { file_path: bad, content: bad }, isErrored: true }), ctxOf()),
      BROADSHEET.toolGroup([row({ input: { file_path: bad } }), row({ tool: 'Grep', input: { pattern: bad } }), row({ tool: 'mcp__x__' + bad, input: {} }), row({ tool: 'Edit', input: { file_path: bad } })], ctxOf()),
      BROADSHEET.toolResult({ tool: 'Bash', output: { stdout: bad, stderr: bad }, isErrored: false }, ctxOf()),
      BROADSHEET.toolResult({ tool: 'Bash', output: bad, isErrored: true }, ctxOf()),
      BROADSHEET.toolResult({ tool: 'Read', output: { error: bad }, isErrored: true }, ctxOf()),
      BROADSHEET.userMessage(bad, ctxOf()),
      BROADSHEET.headline({ turn: 2, title: bad }, ctxOf()),
      BROADSHEET.receipt({ durationMs: 1, title: bad, stats: { turn: 1, files: [bad], add: 1, del: 0 }, notes: [{ n: 1, tool: 'Bash', input: { command: bad } }], timeStrip: null }, ctxOf()),
      BROADSHEET.live({ mode: 'running', detail: bad, elapsedMs: 0 }, 0, desktop),
    ]
    for (const tree of trees) {
      const json = JSON.stringify(tree)
      expect(json).not.toContain('\\u001b')
      expect(json).not.toContain('\\u0007')
    }
  })

  test('a result is an indented italic detail line, like the lookbook', async () => {
    const tree = BROADSHEET.toolResult({ tool: 'Bash', output: 'expected “released”, got “held”', isErrored: true }, ctxOf())
    const json = JSON.stringify(tree)
    expect(json).toContain('"paddingLeft":4')
    expect(json).toContain('"italic":true')
    expect(json).toContain('"color":"inactive"')
    expect(textOf(tree)).not.toContain('— ')
  })

  test('the quiet line is a dim italic aside', async () => {
    expect(textOf(BROADSHEET.quietLine(3, ctxOf()))).toContain('(3 steps omitted)')
    expect(textOf(BROADSHEET.quietLine(1, ctxOf()))).toContain('(1 step omitted)')
  })

  test('results collapse to an aside, errors stay', async () => {
    expect(textOf(BROADSHEET.toolResult({ tool: 'Bash', output: { stdout: 'ok\nTests: 24 passed', stderr: '' }, isErrored: false }, ctxOf()))).toContain('Tests: 24 passed')
    expect(textOf(BROADSHEET.toolResult({ tool: 'Bash', output: 'Error: exit 1', isErrored: true }, ctxOf()))).toContain('Error: exit 1')
    expect(textOf(BROADSHEET.toolResult({ tool: 'Read', output: {}, isErrored: false }, ctxOf()))).toBe('')
    expect(textOf(BROADSHEET.toolResult({ tool: 'Bash', output: '', isErrored: true }, ctxOf())).length).toBeGreaterThan(0)
    expect(BROADSHEET.toolResult({ tool: 'mcp__x__y', output: {}, isErrored: false }, ctxOf())).toBeNull()
  })
})

describe('broadsheet turn', () => {
  test('the prompt is a pull quote', async () => {
    const tree = BROADSHEET.userMessage('fix the cart\nand test it', ctxOf())
    expect(textOf(tree)).toContain('❝')
    expect(textOf(tree)).toContain('fix the cart\nand test it')
    expect(JSON.stringify(tree)).toContain('"italic":true')
  })

  test('the pull quote is signed with a dim byline', async () => {
    const tree = BROADSHEET.userMessage('fix it', ctxOf())
    expect(textOf(tree)).toMatch(/^❝fix it— you$/)
    expect(textNode(tree, '— you')?.color).toBe('inactive')
  })

  test('the headline is a numbered chapter over a thin rule', async () => {
    const tree = BROADSHEET.headline({ turn: 7, title: 'The cart, totalled' }, ctxOf())
    const text = textOf(tree)
    expect(text).toContain('VII.')
    expect(text).toContain('The cart, totalled')
    expect(text).toContain('───')
    expect(JSON.stringify(tree)).toContain('"bold":true')
  })

  test('the receipt is a centered colophon with notes above and the time strip below', async () => {
    const tree = BROADSHEET.receipt(fullReceipt, ctxOf())
    const text = textOf(tree)
    expect(text).toContain('❦ set in 2 min 14 s · 2 files · +103 −10 · 41% of context ❦')
    expect(text.indexOf('¹')).toBeLessThan(text.indexOf('set in'))
    expect(text).toContain('Notes¹')
    expect(text.indexOf('Notes'), 'footnotes sit under a Notes head').toBeLessThan(text.indexOf('¹'))
    expect(text).toContain('Read a.ts · 0.1s')
    expect(text.indexOf('thinking 0:06')).toBeGreaterThan(text.indexOf('set in'))
    expect(JSON.stringify(tree)).toContain('"justifyContent":"center"')
    expect(JSON.stringify(tree), 'centered on the page, not on itself').toContain('"width":"100%"')
  })

  test('a receipt without stats shows its duration only', async () => {
    const text = textOf(BROADSHEET.receipt({ durationMs: 9_000, stats: null, notes: [], timeStrip: null }, ctxOf()))
    expect(text).toContain('❦ set in 9.0 s ❦')
    expect(text).not.toContain('files')
  })

  test('-inator mode adds a quip and scheming phrases', async () => {
    expect(textOf(BROADSHEET.receipt({ durationMs: 1_000, stats: null, notes: [], timeStrip: null }, ctxOf({ settings: inator })))).toContain('Thinkinator')
    const desktop = ctxOf({ surface: 'desktop', els: DESKTOP_ELS, settings: inator })
    const seen = new Set<string>()
    for (let f = 0; f < 400; f += 10) seen.add(textOf(BROADSHEET.live({ mode: 'thinking', detail: '', elapsedMs: 0 }, f, desktop)))
    expect([...seen].join(' ')).toMatch(/monologuing|scheming/)
  })

  test('leaves the band alone and dresses panes with a fleuron', async () => {
    expect(BROADSHEET.band({ usage: null, waiting: null, isWorking: true }, ctxOf())).toBeNull()
    expect(BROADSHEET.paneStyle).toEqual({ accent: 'suggestion', marker: '❧', current: '›' })
  })
})

describe('broadsheet live line', () => {
  test('the terminal live line is a typewriter raster and a clock', async () => {
    const tree = BROADSHEET.live({ mode: 'thinking', detail: '', elapsedMs: 65_000 }, 3, ctxOf())
    const json = JSON.stringify(tree)
    expect(json).toContain('"type":"Raster"')
    const keys = BROADSHEET.liveFrames({ mode: 'thinking', detail: '', elapsedMs: 65_000 }, 3).map(f => f.key)
    for (const key of keys) expect(json).toContain(`"key":"${key}"`)
  })

  test('frames keep their columns for every mode, every frame, with or without -inator', async () => {
    const modes: LiveMode[] = ['thinking', 'writing', 'running']
    const widths = new Set<string>()
    for (const mode of modes) {
      for (const isInator of [false, true]) {
        const state = { mode, detail: mode === 'running' ? 'z'.repeat(200) : '', activity: mode === 'running' ? 'Running' : undefined, elapsedMs: 1_000, inator: isInator }
        for (let f = 0; f < 30; f++) {
          const frames = BROADSHEET.liveFrames({ ...state, elapsedMs: f * 100_000 }, f * 7)
          widths.add(frames.map(fr => `${fr.key}:${fr.columns}`).join(','))
          for (const fr of frames) expect(fr.cells.length).toBe(Math.ceil((fr.columns * 12) / 3) * 4)
        }
      }
    }
    expect(widths.size).toBe(1)
  })

  test('a pen leads the live line in every mode and surface', async () => {
    const desktop = ctxOf({ surface: 'desktop', els: DESKTOP_ELS })
    for (const mode of ['thinking', 'writing', 'running'] as LiveMode[]) {
      for (const ctx of [ctxOf(), desktop]) {
        const tree = BROADSHEET.live({ mode, detail: 'npm test', activity: 'Running', elapsedMs: 0 }, 12, ctx)
        expect(textOf(tree).startsWith('✎'), `${mode} on ${ctx.surface}`).toBe(true)
        expect(textNode(tree, '✎')?.color).toBe('suggestion')
      }
    }
  })

  test('thinking types out what Claude is considering, then rests with a blinking caret', async () => {
    const state = { mode: 'thinking' as LiveMode, detail: '', elapsedMs: 0 }
    const early = typedOf(state, 3)
    const late = typedOf(state, 40)
    expect(early.text.length).toBeGreaterThan(0)
    expect(late.text.startsWith(early.text)).toBe(true)
    expect(late.text).toMatch(/^considering /)
    expect(late.text).not.toContain('…')
    expect(early.caretOn).toBe(true)
    const blinks = new Set([40, 45, 50, 55].map(f => typedOf(state, f).caretOn))
    expect(blinks.size).toBe(2)
    expect(typedOf(state, 75).text, 'the next phrase starts over').not.toBe(late.text)
    const cells = BROADSHEET.liveFrames(state, 40)[0]?.cells ?? ''
    expect(rasterText(cells)).toContain(late.text + '▌')
  })

  test('running narrates the step once, with no caret', async () => {
    const desktop = ctxOf({ surface: 'desktop', els: DESKTOP_ELS })
    const running = { mode: 'running' as LiveMode, detail: 'src/cart.js', activity: 'Reading', elapsedMs: 3_100 }
    expect(textOf(BROADSHEET.live(running, 0, desktop))).toContain('✎reading src/cart.js…')
    const typed = typedOf(running, 0)
    expect(typed.text).toBe('reading src/cart.js…')
    expect(typed.caretOn).toBe(false)
    expect(typedOf({ ...running, activity: 'Running', detail: 'npm test' }, 0).text).toBe('running npm test…')
    expect(typedOf({ mode: 'running', detail: '', elapsedMs: 0 }, 0).text).toBe('at work…')
    expect(typedOf({ mode: 'running', detail: 'Retrying in 3s', elapsedMs: 0 }, 0).text).toBe('retrying in 3s…')
  })

  test('the typewriter types a phrase letter by letter', async () => {
    const desktop = ctxOf({ surface: 'desktop', els: DESKTOP_ELS })
    expect(textOf(BROADSHEET.live({ mode: 'writing', detail: '', elapsedMs: 0 }, 0, desktop))).toContain('setting the reply in type')
    expect(textOf(BROADSHEET.live({ mode: 'running', detail: 'npm test', activity: 'Running', elapsedMs: 0 }, 0, desktop))).toContain('running npm test…')
    const a = BROADSHEET.liveFrames({ mode: 'thinking', detail: '', elapsedMs: 0 }, 2)[0]?.cells
    const b = BROADSHEET.liveFrames({ mode: 'thinking', detail: '', elapsedMs: 0 }, 9)[0]?.cells
    expect(a).not.toBe(b)
  })
})

describe('broadsheet everywhere', () => {
  test('the desktop gets no Raster in any member', async () => {
    for (const tree of everything(ctxOf({ surface: 'desktop', els: DESKTOP_ELS }))) expect(JSON.stringify(tree)).not.toContain('"type":"Raster"')
  })

  test('narrow terminals keep rows intact and drop the time strip', async () => {
    const ctx = ctxOf({ columns: 60 })
    for (const tree of everything(ctx).slice(0, 8)) expect(textOf(tree).length).toBeGreaterThan(0)
    expect(textOf(BROADSHEET.receipt(fullReceipt, ctx))).not.toContain('thinking 0:06')
  })

  test('faded rows drop backgrounds and use the dim tokens', async () => {
    const ctx = ctxOf({ fade: 2, settings: withDiffs })
    for (const tree of everything(ctx).slice(0, 8)) {
      const json = JSON.stringify(tree)
      expect(json).not.toContain('backgroundColor')
      expect(json).not.toContain('"color":"text"')
      expect(json).not.toContain('"color":"suggestion"')
    }
    expect(JSON.stringify(BROADSHEET.toolRow(edit, ctx))).toContain('"color":"subtle"')
  })

  test('every tree stays small and every string short', async () => {
    const big = toggled(withDiffs, 'fileColors')
    const trees = [
      ...everything(ctxOf({ settings: big })),
      BROADSHEET.userMessage('x'.repeat(20_000), ctxOf()),
      BROADSHEET.toolRow(row({ tool: 'Edit', input: { file_path: '/work/a.min.js', old_string: 'a', new_string: 'b'.repeat(20_000) } }), ctxOf({ settings: big })),
    ]
    for (const tree of trees) {
      const json = JSON.stringify(tree)
      expect(json.length).toBeLessThan(20_000)
      expect(Math.max(...json.split('"').map(s => s.length))).toBeLessThan(5_000)
    }
  })
})
