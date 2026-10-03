import { describe, expect, test } from 'claude-code/testing'

import { bashSummary, changeOf, errorSummary, factsOf, groupSummary, isChangeTool, isQuietable, lineDelta, pickDiffLines } from '../src/engine/tool-facts'

describe('tool-facts', () => {
  test('built-in tools get a verb, target and glyph', async () => {
    expect(factsOf('Read', { file_path: '/work/a.ts' })).toEqual({ glyph: 'read', verb: 'Read', target: '/work/a.ts', isPath: true })
    expect(factsOf('Edit', { file_path: '/work/a.ts' }).glyph).toBe('edit')
    expect(factsOf('Write', { file_path: '/work/b.ts' }).verb).toBe('Write')
    expect(factsOf('Bash', { command: 'pnpm test auth\n# second line' })).toEqual({ glyph: 'run', verb: 'Run', target: 'pnpm test auth', isPath: false })
    expect(factsOf('Grep', { pattern: 'refreshToken' }).target).toBe('refreshToken')
    expect(factsOf('WebFetch', { url: 'https://example.com' }).glyph).toBe('web')
  })

  test('MCP and unknown tools show their short name and first text field', async () => {
    expect(factsOf('mcp__github__create_issue', { title: 'Bug', n: 3 })).toEqual({ glyph: 'other', verb: 'create_issue', target: 'Bug', isPath: false })
  })

  test('streaming and malformed input never throws', async () => {
    expect(factsOf('Read', {}).target).toBe('')
    expect(factsOf('Bash', { command: 42 }).target).toBe('')
    expect(factsOf('Edit', null).target).toBe('')
    expect(changeOf('Edit', {})).toEqual({ file: '', add: 0, del: 0, lines: [] })
    expect(changeOf('MultiEdit', { file_path: '/a', edits: 'nope' })).toEqual({ file: '/a', add: 0, del: 0, lines: [] })
  })

  test('long and wide targets come through whole for the view to truncate', async () => {
    const command = 'echo ' + '長'.repeat(300)
    expect(factsOf('Bash', { command }).target.length).toBeLessThanOrEqual(200)
  })

  test('lineDelta counts only the lines that changed', async () => {
    const before = 'a\nb\nc\nd'
    const after = 'a\nB\nB2\nd'
    expect(lineDelta(before, after)).toEqual({
      add: 2,
      del: 2,
      lines: [{ kind: '-', text: 'b' }, { kind: '-', text: 'c' }, { kind: '+', text: 'B' }, { kind: '+', text: 'B2' }],
    })
    expect(lineDelta('', 'x\ny').add).toBe(2)
  })

  test('changeOf reads Edit, MultiEdit and Write', async () => {
    expect(changeOf('Edit', { file_path: '/w/a.ts', old_string: 'x = 1', new_string: 'x = 2' })).toMatchObject({ file: '/w/a.ts', add: 1, del: 1 })
    expect(changeOf('MultiEdit', { file_path: '/w/a.ts', edits: [{ old_string: 'a', new_string: 'b' }, { old_string: 'c', new_string: 'd\ne' }] })).toMatchObject({ add: 3, del: 2 })
    expect(changeOf('Write', { file_path: '/w/n.ts', content: 'one\ntwo\nthree' })).toMatchObject({ add: 3, del: 0 })
    expect(changeOf('Read', { file_path: '/w/a.ts' })).toBeNull()
    expect(isChangeTool('Edit') && isChangeTool('Write') && !isChangeTool('Bash')).toBe(true)
  })

  test('pickDiffLines skips blank lines and keeps the order', async () => {
    const lines = [{ kind: '-' as const, text: '  ' }, { kind: '-' as const, text: 'old' }, { kind: '+' as const, text: 'new' }, { kind: '+' as const, text: 'more' }]
    expect(pickDiffLines(lines, 2)).toEqual([{ kind: '-', text: 'old' }, { kind: '+', text: 'new' }])
  })

  test('groupSummary names each kind of step in order', async () => {
    expect(groupSummary([
      { tool: 'Read', input: {} },
      { tool: 'Read', input: {} },
      { tool: 'Bash', input: {} },
      { tool: 'Grep', input: {} },
    ])).toBe('Read 2 files, ran 1 command, searched 1 pattern')
    expect(groupSummary([])).toBe('')
  })

  test('colored output and escape codes never reach a drawing', async () => {
    expect(bashSummary({ stdout: '\x1b[32m✓\x1b[0m 24 passed\n', stderr: '' })).toBe('✓ 24 passed')
    expect(factsOf('Bash', { command: 'printf "\x1b[31mred"' }).target).toBe('printf "red"')
    expect(factsOf('Read', { file_path: '/w/a\x07.ts' }).target).toBe('/w/a.ts')
  })

  test('a change records a clean file path', async () => {
    expect(changeOf('Edit', { file_path: '/w/a\x1b]0;x\x07.ts', old_string: 'a', new_string: 'b' })?.file).toBe('/w/a.ts')
  })

  test('tools with long names get a short verb', async () => {
    expect(factsOf('TodoWrite', { todos: [{ content: 'Fix the cart', status: 'in_progress' }, { content: 'b', status: 'pending' }] })).toMatchObject({ verb: 'Todos', target: 'Fix the cart' })
    expect(factsOf('ExitPlanMode', {}).verb).toBe('Plan')
  })

  test('Quiet may hide reads, searches, commands and fetches, never agents or other tools', async () => {
    expect(isQuietable('Read') && isQuietable('Grep') && isQuietable('Bash') && isQuietable('WebFetch')).toBe(true)
    expect(isQuietable('Edit') || isQuietable('Task') || isQuietable('mcp__slack__send_message')).toBe(false)
  })

  test('result summaries take the telling line', async () => {
    expect(bashSummary({ stdout: 'PASS a\nTests: 24 passed\n', stderr: '' })).toBe('Tests: 24 passed')
    expect(bashSummary({ stdout: '', stderr: 'warning: x' })).toBe('warning: x')
    expect(bashSummary('weird')).toBe('')
    expect(errorSummary('Error: ENOENT\nat x')).toBe('Error: ENOENT')
    expect(errorSummary({ stderr: 'boom' })).toBe('boom')
  })
})
