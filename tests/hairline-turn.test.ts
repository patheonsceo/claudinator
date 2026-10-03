import { describe, expect, test } from 'claude-code/testing'

import { live, liveFrames, liveStateOf, pulseCells } from '../src/looks/hairline/live'
import { receipt, userMessage } from '../src/looks/hairline/turn'
import { LOOKS } from '../src/looks'
import { HAIRLINE } from '../src/looks/hairline'
import { DEFAULT_SETTINGS } from '../src/engine/settings'
import { DESKTOP_ELS, ctxOf, textOf } from './fixtures'

describe('hairline turn pieces', () => {
  test('the prompt row leads with an accent chevron', async () => {
    expect(textOf(userMessage('fix the refresh race', ctxOf()))).toBe('❯fix the refresh race')
  })

  test('a very long prompt is clipped and keeps its line breaks', async () => {
    const text = textOf(userMessage('first line\n' + 'x'.repeat(20_000), ctxOf()))
    expect(text.length).toBeLessThan(5_000)
    expect(text).toContain('first line\n')
  })

  test('the receipt sums up the turn', async () => {
    const text = textOf(receipt({ durationMs: 134_000, stats: { turn: 7, files: ['/w/a.ts', '/w/b.ts'], add: 103, del: 10, contextPercent: 41.2 }, notes: [], timeStrip: null }, ctxOf()))
    expect(text).toContain('Turn 7')
    expect(text).toContain('2m 14s')
    expect(text).toContain('2 files')
    expect(text).toContain('+103')
    expect(text).toContain('−10')
    expect(text).toContain('41% ctx')
  })

  test('the receipt keeps its stats on one line and clips the rule instead of an ellipsis', async () => {
    const tree = JSON.stringify(receipt({ durationMs: 24_000, stats: { turn: 1, files: ['/w/a.ts'], add: 1, del: 1, contextPercent: 22 }, notes: [], timeStrip: null }, ctxOf({ columns: 94 })))
    expect(tree, 'the stats never shrink').toContain('"flexShrink":0')
    expect(tree, 'the rule is clipped').toContain('"overflow":"hidden"')
    expect(tree, 'no ellipsis at the end of the rule').not.toContain('"wrap":"truncate"')
  })

  test('the headline names the turn above its prompt', async () => {
    const text = textOf(HAIRLINE.headline({ turn: 7, title: 'The refresh race, fixed' }, ctxOf()))
    expect(text).toContain('Turn 7')
    expect(text).toContain('The refresh race, fixed')
  })

  test('the receipt carries the turn footnotes above and the time strip below', async () => {
    const text = textOf(HAIRLINE.receipt({
      durationMs: 9_000,
      stats: { turn: 2, files: [], add: 0, del: 0 },
      notes: [{ n: 1, tool: 'Read', input: { file_path: '/work/a.ts' }, durationMs: 100 }],
      timeStrip: { thinkingMs: 6_000, toolsMs: 2_000, waitingMs: 1_000 },
    }, ctxOf()))
    expect(text.indexOf('¹')).toBeLessThan(text.indexOf('Turn 2'))
    expect(text).toContain('Read a.ts · 0.1s')
    expect(text).toContain('thinking 0:06')
    expect(text).toContain('waiting on you 0:01')
  })

  test('-inator mode changes the live word and the receipt', async () => {
    const inator = { ...DEFAULT_SETTINGS, ingredients: { ...DEFAULT_SETTINGS.ingredients, inator: true } }
    expect(textOf(live({ mode: 'thinking', detail: '', elapsedMs: 0 }, 0, ctxOf({ surface: 'desktop', settings: inator })))).toContain('Scheming')
    expect(textOf(HAIRLINE.receipt({ durationMs: 1_000, stats: { turn: 1, files: [], add: 0, del: 0 }, notes: [], timeStrip: null }, ctxOf({ settings: inator })))).toContain('inator')
  })

  test('Hairline leaves the band to others and dresses panes in its accent', async () => {
    expect(HAIRLINE.band({ usage: null, waiting: null, isWorking: false }, ctxOf())).toBeNull()
    expect(HAIRLINE.paneStyle.accent).toBe('suggestion')
  })

  test('a receipt without stats shows its duration only', async () => {
    const text = textOf(receipt({ durationMs: 9_000, stats: null, notes: [], timeStrip: null }, ctxOf()))
    expect(text).toContain('9.0s')
    expect(text).not.toContain('Turn')
  })

  test('the live state names what Claude is doing', async () => {
    expect(liveStateOf('thinking', undefined, 1_000, '/work')).toEqual({ mode: 'thinking', detail: '', elapsedMs: 1_000 })
    expect(liveStateOf('responding', undefined, 0, '/work').mode).toBe('writing')
    expect(liveStateOf('tool-use', { tool: 'Read', input: { file_path: '/work/src/a.ts' }, startedAt: 0 }, 0, '/work')).toEqual({ mode: 'running', detail: 'src/a.ts', activity: 'Reading', elapsedMs: 0 })
    // The word names the step once: never "Running Run npm test".
    expect(liveStateOf('tool-use', { tool: 'Bash', input: { command: 'npm test' }, startedAt: 0 }, 0, '/work')).toEqual({ mode: 'running', detail: 'npm test', activity: 'Running', elapsedMs: 0 })
    expect(liveStateOf('tool-use', { tool: 'Edit', input: { file_path: '/work/a.ts' }, startedAt: 0 }, 0, '/work').activity).toBe('Editing')
  })

  test('a status message from Claude Code replaces the detail', async () => {
    expect(liveStateOf('requesting', undefined, 0, '/work', 'Retrying in 8s (attempt 2/10)').detail).toBe('Retrying in 8s (attempt 2/10)')
  })

  test('the terminal live line animates through rasters', async () => {
    const state = { mode: 'thinking' as const, detail: '', elapsedMs: 42_000 }
    const tree = JSON.stringify(live(state, 3, ctxOf()))
    expect(tree).toContain('"key":"cz-pulse"')
    expect(tree).toContain('"key":"cz-clock"')
    const frames = liveFrames(state, 4)
    expect(frames.map(f => f.key)).toEqual(['cz-pulse', 'cz-clock'])
    expect(frames[0]?.columns).toBe(4 + 'Thinking'.length)
    expect(pulseCells('Thinking', 0), 'the dots step every third frame').not.toBe(pulseCells('Thinking', 3))
    expect(pulseCells('Thinking', 5), 'the sweep crosses the word').not.toBe(pulseCells('Thinking', 4))
  })

  test('the desktop live line is plain text with no raster', async () => {
    const tree = live({ mode: 'running', detail: 'Read a.ts', elapsedMs: 3_000 }, 0, ctxOf({ els: DESKTOP_ELS, surface: 'desktop' }))
    expect(JSON.stringify(tree)).not.toContain('Raster')
    expect(textOf(tree)).toContain('Running')
    expect(textOf(tree)).toContain('0:03')
  })

  test('the desktop live line uses text even when the table offers a Raster', async () => {
    const tree = live({ mode: 'thinking', detail: '', elapsedMs: 1_000 }, 0, ctxOf({ surface: 'desktop' }))
    expect(JSON.stringify(tree)).not.toContain('Raster')
    expect(textOf(tree)).toContain('Thinking')
  })

  test('the registry has Hairline and Off', async () => {
    expect(LOOKS.hairline).not.toBeNull()
    expect(LOOKS.off).toBeNull()
  })
})
