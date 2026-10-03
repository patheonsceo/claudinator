import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_SETTINGS, toggled } from '../src/engine/settings'
import { quietLine, toolGroup, toolResult, toolRow } from '../src/looks/hairline/rows'
import type { ToolRow } from '../src/looks/look'
import { ctxOf, textOf } from './fixtures'

const row = (over: Partial<ToolRow>): ToolRow => ({ id: 't1', tool: 'Read', input: {}, isRunning: false, isErrored: false, isInterrupted: false, ...over })

describe('hairline rows', () => {
  test('a read shows its glyph, verb, relative path and time', async () => {
    const text = textOf(toolRow(row({ input: { file_path: '/work/src/auth/session.ts' }, durationMs: 200 }), ctxOf()))
    expect(text).toContain('◇')
    expect(text).toContain('Read')
    expect(text).toContain('src/auth/session.ts')
    expect(text).toContain('0.2s')
  })

  test('an edit shows its line counts and, with mini diffs, its changed lines', async () => {
    const edit = row({ tool: 'Edit', input: { file_path: '/work/a.ts', old_string: 'const x = 1', new_string: 'const x = 2' } })
    const text = textOf(toolRow(edit, ctxOf()))
    expect(text).toContain('+1')
    expect(text).toContain('−1')
    expect(text).toContain('- const x = 1')
    expect(text).toContain('+ const x = 2')
    const plain = textOf(toolRow(edit, ctxOf({ settings: toggled(DEFAULT_SETTINGS, 'miniDiffs') })))
    expect(plain).not.toContain('- const x = 1')
  })

  test('a failed call says so in place of its counts', async () => {
    const text = textOf(toolRow(row({ tool: 'Bash', input: { command: 'pnpm test' }, isErrored: true }), ctxOf()))
    expect(text).toContain('✕')
    expect(text).toContain('failed')
  })

  test('a running call without a time shows an ellipsis', async () => {
    expect(textOf(toolRow(row({ isRunning: true, input: { file_path: '/work/a.ts' } }), ctxOf()))).toContain('…')
  })

  test('a streaming call with empty input still draws', async () => {
    expect(textOf(toolRow(row({ tool: 'Edit', input: {} }), ctxOf()))).toContain('Edit')
  })

  test('narrow terminals drop the duration bar and keep the time', async () => {
    const wide = textOf(toolRow(row({ input: { file_path: '/work/a.ts' }, durationMs: 4_000 }), ctxOf({ columns: 120 })))
    const narrow = textOf(toolRow(row({ input: { file_path: '/work/a.ts' }, durationMs: 4_000 }), ctxOf({ columns: 60 })))
    expect(wide).toContain('─')
    expect(narrow).not.toContain('─')
    expect(narrow).toContain('4.0s')
  })

  test('long targets are left for the terminal to truncate, never wrapped', async () => {
    const tree = toolRow(row({ tool: 'Bash', input: { command: 'echo ' + '長'.repeat(300) } }), ctxOf())
    expect(JSON.stringify(tree)).toContain('"wrap":"truncate-end"')
  })

  test('file colors paint the file name', async () => {
    const tree = toolRow(row({ input: { file_path: '/work/a.ts' } }), ctxOf({ settings: toggled(DEFAULT_SETTINGS, 'fileColors') }))
    expect(JSON.stringify(tree)).toMatch(/"color":"#[0-9a-f]{6}"/)
  })

  test('faded rows use the dim theme tokens', async () => {
    const tree = JSON.stringify(toolRow(row({ input: { file_path: '/work/a.ts' } }), ctxOf({ fade: 2 })))
    expect(tree).toContain('"color":"subtle"')
    expect(tree).not.toContain('"color":"text"')
  })

  test('a group reads as one phrase with its files underneath', async () => {
    const rows = [
      row({ id: 'a', input: { file_path: '/work/a.ts' }, durationMs: 100 }),
      row({ id: 'b', input: { file_path: '/work/b.ts' }, durationMs: 100 }),
      row({ id: 'c', tool: 'Bash', input: { command: 'ls' }, durationMs: 300 }),
    ]
    const text = textOf(toolGroup(rows, ctxOf()))
    expect(text).toContain('Read 2 files, ran 1 command')
    expect(text).toContain('a.ts')
    expect(text).toContain('0.5s')
  })

  test('a long tool name ends in an ellipsis instead of being cut', async () => {
    expect(textOf(toolRow(row({ tool: 'mcp__github__create_pull_request', input: { title: 'x' } }), ctxOf()))).toContain('creat…')
  })

  test('a diff line from a minified file is clipped well under the text limit', async () => {
    const edit = row({ tool: 'Edit', input: { file_path: '/work/a.min.js', old_string: 'a', new_string: 'b'.repeat(20_000) } })
    const longest = Math.max(...JSON.stringify(toolRow(edit, ctxOf())).split('"').map(s => s.length))
    expect(longest).toBeLessThan(1_000)
  })

  test('the quiet line counts what it hides', async () => {
    expect(textOf(quietLine(4, ctxOf()))).toContain('4 steps hidden')
  })

  test('results collapse to their telling line, errors stay', async () => {
    expect(textOf(toolResult({ tool: 'Bash', output: { stdout: 'ok\nTests: 24 passed', stderr: '' }, isErrored: false }, ctxOf()))).toContain('Tests: 24 passed')
    expect(textOf(toolResult({ tool: 'Bash', output: 'Error: exit 1', isErrored: true }, ctxOf()))).toContain('Error: exit 1')
    expect(textOf(toolResult({ tool: 'Read', output: {}, isErrored: false }, ctxOf()))).toBe('')
    expect(toolResult({ tool: 'Edit', output: {}, isErrored: false }, ctxOf({ settings: toggled(DEFAULT_SETTINGS, 'miniDiffs') })), 'Claude Code draws the full diff when mini diffs are off').toBeNull()
    expect(toolResult({ tool: 'mcp__x__y', output: {}, isErrored: false }, ctxOf())).toBeNull()
  })
})
