import { describe, expect, test } from 'claude-code/testing'

import { live, liveFrames, liveStateOf, pulseCells } from '../src/looks/hairline/live'
import { receipt, userMessage } from '../src/looks/hairline/turn'
import { LOOKS } from '../src/looks'
import { DESKTOP_ELS, ctxOf, textOf } from './fixtures'

describe('hairline turn pieces', () => {
  test('the prompt row leads with an accent chevron', async () => {
    expect(textOf(userMessage('fix the refresh race', ctxOf()))).toBe('❯fix the refresh race')
  })

  test('the receipt sums up the turn', async () => {
    const text = textOf(receipt({ durationMs: 134_000, stats: { turn: 7, files: ['/w/a.ts', '/w/b.ts'], add: 103, del: 10, contextPercent: 41.2 } }, ctxOf()))
    expect(text).toContain('Turn 7')
    expect(text).toContain('2m 14s')
    expect(text).toContain('2 files')
    expect(text).toContain('+103')
    expect(text).toContain('−10')
    expect(text).toContain('41% ctx')
  })

  test('a receipt without stats shows its duration only', async () => {
    const text = textOf(receipt({ durationMs: 9_000, stats: null }, ctxOf()))
    expect(text).toContain('9.0s')
    expect(text).not.toContain('Turn')
  })

  test('the live state names what Claude is doing', async () => {
    expect(liveStateOf('thinking', undefined, 1_000, '/work')).toEqual({ mode: 'thinking', detail: '', elapsedMs: 1_000 })
    expect(liveStateOf('responding', undefined, 0, '/work').mode).toBe('writing')
    expect(liveStateOf('tool-use', { tool: 'Read', input: { file_path: '/work/src/a.ts' }, startedAt: 0 }, 0, '/work')).toEqual({ mode: 'running', detail: 'Read src/a.ts', elapsedMs: 0 })
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

  test('the registry has Hairline and Off', async () => {
    expect(LOOKS.hairline).not.toBeNull()
    expect(LOOKS.off).toBeNull()
  })
})
