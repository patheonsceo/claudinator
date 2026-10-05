import { describe, expect, test } from 'claude-code/testing'

import { inatorQuip, inatorWord, noteText, runStatsLine, stripColors, superscript, timeStripSegments } from '../src/looks/common'
import { ctxOf, textOf } from './fixtures'

describe('common look helpers', () => {
  test('superscript writes any number with superscript digits', async () => {
    expect(superscript(1)).toBe('¹')
    expect(superscript(12)).toBe('¹²')
    expect(superscript(30)).toBe('³⁰')
  })

  test('a footnote reads as a short sentence about the call', async () => {
    expect(noteText({ n: 1, tool: 'Read', input: { file_path: '/work/src/a.ts' }, durationMs: 200 }, '/work')).toBe('Read src/a.ts · 0.2s')
    expect(noteText({ n: 2, tool: 'Bash', input: { command: 'npm test' } }, '/work')).toBe('Run npm test')
  })

  test('the time strip splits its width by share of the turn, never losing a nonzero part', async () => {
    expect(timeStripSegments({ thinkingMs: 6_000, toolsMs: 3_000, waitingMs: 1_000 }, 40)).toEqual({ thinking: 24, tools: 12, waiting: 4 })
    expect(timeStripSegments({ thinkingMs: 99_000, toolsMs: 1_000, waitingMs: 0 }, 20)).toEqual({ thinking: 19, tools: 1, waiting: 0 })
    expect(timeStripSegments({ thinkingMs: 0, toolsMs: 0, waitingMs: 0 }, 20)).toEqual({ thinking: 20, tools: 0, waiting: 0 })
  })

  test('-inator mode has a vocabulary', async () => {
    expect(inatorWord(0)).not.toBe(inatorWord(30))
    expect(inatorQuip({ turn: 3, files: ['a'], add: 1, del: 0 })).toMatch(/inator/)
  })
})

describe('time under each run, and live task progress', () => {
  const data = { thinkingMs: 78_000, toolsMs: 42_000, waitingMs: 14_000 }

  test('each run closes with one line of where its time went, and its tasks when it had a list', async () => {
    const line = textOf(runStatsLine(ctxOf({ columns: 120 }), { ...data, tasks: { done: 3, total: 5 } }, stripColors('hairline', true)))
    expect(line).toContain('thinking 1:18')
    expect(line).toContain('tools 0:42')
    expect(line).toContain('waiting on you 0:14')
    expect(line).toContain('3 of 5 tasks')
    expect(textOf(runStatsLine(ctxOf(), { thinkingMs: 5_000, toolsMs: 600, waitingMs: 0 }, stripColors('hairline', true)))).not.toContain('waiting')
  })

  test('every look has three distinct colors, in dark and in light', async () => {
    for (const look of ['hairline', 'broadsheet', 'mission', 'prism', 'sumi', 'blueprint'] as const) {
      for (const isDark of [true, false]) {
        const c = stripColors(look, isDark)
        expect(new Set([c.thinking, c.tools, c.waiting]).size, `${look} ${isDark}`).toBe(3)
      }
      expect(stripColors(look, true).thinking).not.toBe(stripColors(look, false).thinking)
    }
  })
})
