import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_SETTINGS, toggled } from '../src/engine/settings'
import { quietLine, toolGroup, toolResult, toolRow } from '../src/looks/hairline/rows'
import { INDENT } from '../src/looks/hairline/style'
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

  test('a mixed group reads as one phrase under its first verb, its files underneath', async () => {
    const rows = [
      row({ id: 'a', input: { file_path: '/work/a.ts' }, durationMs: 100 }),
      row({ id: 'b', input: { file_path: '/work/b.ts' }, durationMs: 100 }),
      row({ id: 'c', tool: 'Bash', input: { command: 'ls' }, durationMs: 300 }),
    ]
    const text = textOf(toolGroup(rows, ctxOf()))
    expect(text).toContain('Read  ▾ 2 files, ran 1 command')
    expect(text).toContain('a.ts')
    expect(text).toContain('0.5s')
  })

  test('a folded run of reads names its folder and lists its files at the target column', async () => {
    const files = ['middleware.ts', 'token-store.ts', 'api-client.ts']
    const rows = files.map((f, i) => row({ id: `r${i}`, input: { file_path: `/work/src/auth/${f}` }, durationMs: 300 }))
    const tree = toolGroup(rows, ctxOf())
    const text = textOf(tree)
    expect(text).toContain('◇')
    expect(text).toContain('Read  ')
    expect(text).toContain('▾ 3 files in src/auth/')
    expect(text).toContain('middleware.ts · token-store.ts · api-client.ts')
    expect(JSON.stringify(tree), 'the list starts under the target').toContain(`"paddingLeft":${INDENT}`)
  })

  test('a group of one draws as the row itself', async () => {
    const text = textOf(toolGroup([row({ tool: 'Bash', input: { command: 'node --test' }, durationMs: 600 })], ctxOf()))
    expect(text).toContain('›')
    expect(text).toContain('Run   ')
    expect(text).toContain('node --test')
    expect(text).not.toContain('Ran 1 command')
  })

  test('a write reads as Create with an accent diamond, and a search shows its pattern quoted', async () => {
    const write = toolRow(row({ tool: 'Write', input: { file_path: '/work/src/auth/refresh-lock.ts', content: 'a\nb' } }), ctxOf())
    expect(textOf(write)).toContain('◆Create')
    expect(JSON.stringify(write)).toContain('"color":"suggestion"},"children":["◆"]')
    expect(textOf(toolRow(row({ tool: 'Grep', input: { pattern: 'refreshToken' } }), ctxOf()))).toContain('⌕Search"refreshToken"')
  })

  test('a slow call draws its duration hairline in amber', async () => {
    const slow = JSON.stringify(toolRow(row({ tool: 'Bash', input: { command: 'pnpm test' }, durationMs: 3_800 }), ctxOf()))
    const quick = JSON.stringify(toolRow(row({ tool: 'Bash', input: { command: 'ls' }, durationMs: 200 }), ctxOf()))
    expect(slow).toContain(`"color":"warning"},"children":[" ${'─'.repeat(7)}"]`)
    expect(quick).not.toContain('"color":"warning"')
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

  test('a passing command shows a check and its telling line under the target', async () => {
    const tree = toolResult({ tool: 'Bash', output: { stdout: 'running 24 tests\n✓ 24 passed', stderr: '' }, isErrored: false }, ctxOf())
    expect(textOf(tree)).toBe('✓ 24 passed')
    expect(JSON.stringify(tree)).toContain('"color":"success"},"children":["✓ "]')
    expect(JSON.stringify(tree)).toContain(`"paddingLeft":${INDENT}`)
  })

  test('a failure hangs its first error line under the row and the next one dim beneath', async () => {
    const output = { stdout: '> app test\n✕ refresh-lock › releases the lock after a timeout\nexpected "released", received "held"\nmore', stderr: '' }
    const tree = toolResult({ tool: 'Bash', output, isErrored: true }, ctxOf())
    const json = JSON.stringify(tree)
    expect(textOf(tree)).toBe('╰ refresh-lock › releases the lock after a timeoutexpected "released", received "held"')
    expect(json).toContain('"color":"error"},"children":["╰ "]')
    expect(json).toContain('"color":"inactive","wrap":"truncate-end"},"children":["expected \\"released\\", received \\"held\\""]')
    expect(json).toContain(`"paddingLeft":${INDENT + 2}`)
    expect(textOf(toolResult({ tool: 'Read', output: 'File does not exist.', isErrored: true }, ctxOf()))).toBe('╰ File does not exist.')
  })
})
