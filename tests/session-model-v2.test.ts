import { describe, expect, test } from 'claude-code/testing'

import * as Model from '../src/engine/session-model'

const edit = (file: string, a: string, b: string) => ({ file_path: file, old_string: a, new_string: b })

describe('session model for the full suite', () => {
  test('a turn records its prompt, title, per-file changes and where the time went', async () => {
    const m = Model.createModel()
    Model.promptSubmitted(m, 0, 'fix the cart total')
    Model.startTurn(m, 100)
    Model.toolStarted(m, 'r1', 'Read', { file_path: '/w/a.ts' }, 200, false)
    Model.toolFinished(m, 'r1', 'Read', { file_path: '/w/a.ts' }, 700, false)
    Model.toolStarted(m, 'e1', 'Edit', edit('/w/a.ts', 'x', 'y\nz'), 800, false)
    Model.toolPrompted(m, 'e1')
    Model.toolFinished(m, 'e1', 'Edit', edit('/w/a.ts', 'x', 'y\nz'), 5_800, false)
    Model.toolStarted(m, 'e2', 'Edit', edit('/w/b.ts', 'p', 'q'), 6_000, false)
    Model.toolFinished(m, 'e2', 'Edit', edit('/w/b.ts', 'p', 'q'), 6_100, false)
    Model.completeTurn(m, 10_100, 30, 'Fixed the total. It now multiplies by quantity.')

    const s = m.lastCompleted
    expect(s?.byFile).toEqual([{ file: '/w/a.ts', add: 2, del: 1 }, { file: '/w/b.ts', add: 1, del: 1 }])
    expect(s?.toolCount).toBe(3)
    expect(s?.toolsMs).toBe(600)
    expect(s?.waitingMs).toBe(5_000)
    expect(s?.title).toBe('Fixed the total')
    expect(m.turns[0]).toMatchObject({ turn: 1, prompt: 'fix the cart total', title: 'Fixed the total', durationMs: 10_000 })
  })

  test('edits are numbered within their turn', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.toolStarted(m, 'a', 'Edit', edit('/w/a.ts', 'x', 'y'), 1, false)
    Model.toolStarted(m, 'r', 'Read', {}, 2, false)
    Model.toolStarted(m, 'b', 'Write', { file_path: '/w/n.ts', content: 'x' }, 3, false)
    expect(Model.changeIndexOf(m, 'a')).toBe(1)
    expect(Model.changeIndexOf(m, 'b')).toBe(2)
    expect(Model.changeIndexOf(m, 'r')).toBeUndefined()
  })

  test('footnoted calls are numbered after the reply block they follow', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.assistantSeen(m, 'msg-a', 1)
    Model.toolStarted(m, 'r1', 'Read', { file_path: '/w/a.ts' }, 1, true)
    Model.toolStarted(m, 'g1', 'Grep', { pattern: 'x' }, 2, true)
    Model.assistantSeen(m, 'msg-b', 3)
    Model.toolStarted(m, 'b1', 'Bash', { command: 'ls' }, 3, true)
    Model.toolFinished(m, 'b1', 'Bash', { command: 'ls' }, 13, false)
    expect(Model.marksOf(m, 'msg-a')).toEqual([1, 2])
    expect(Model.marksOf(m, 'msg-b')).toEqual([3])
    expect(Model.noteOf(m, 'g1')).toBe(2)
    Model.completeTurn(m, 20)
    expect(m.lastCompleted?.notes?.map(n => [n.n, n.tool, n.durationMs])).toEqual([[1, 'Read', undefined], [2, 'Grep', undefined], [3, 'Bash', 10]])
  })

  test('calls made before any reply text attach to the first reply block that follows', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.toolStarted(m, 'r1', 'Read', { file_path: '/w/a.ts' }, 1, true)
    Model.toolStarted(m, 'r2', 'Read', { file_path: '/w/b.ts' }, 2, true)
    Model.assistantSeen(m, 'msg-final', 3)
    expect(Model.marksOf(m, 'msg-final')).toEqual([1, 2])
  })

  test('an old reply drawn again during a later turn never takes its footnotes', async () => {
    const m = Model.createModel()
    Model.assistantSeen(m, 'old-reply', 0)
    Model.startTurn(m, 100)
    Model.toolStarted(m, 'r1', 'Read', { file_path: '/w/a.ts' }, 110, true)
    Model.assistantSeen(m, 'old-reply', 120)
    expect(Model.marksOf(m, 'old-reply')).toEqual([])
    Model.assistantSeen(m, 'scrolled-into-view', 60_000)
    expect(Model.marksOf(m, 'scrolled-into-view'), 'first seen long after any activity').toEqual([])
    Model.assistantSeen(m, 'new-reply', 130)
    expect(Model.marksOf(m, 'new-reply')).toEqual([1])
  })

  test('the ledger collects every file changed in the session', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.toolStarted(m, 'e1', 'Edit', edit('/w/a.ts', 'x', 'y'), 1, false)
    Model.toolFinished(m, 'e1', 'Edit', edit('/w/a.ts', 'x', 'y'), 2, false)
    Model.completeTurn(m, 3)
    Model.startTurn(m, 4)
    Model.toolStarted(m, 'e2', 'Edit', edit('/w/a.ts', 'y', 'z\nw'), 5, false)
    Model.toolFinished(m, 'e2', 'Edit', edit('/w/a.ts', 'y', 'z\nw'), 6, false)
    expect(Model.ledgerOf(m)).toEqual([{ file: '/w/a.ts', add: 3, del: 2, turns: [1, 2], lastToolId: 'e2' }])
  })

  test('waiting on the user starts at the prompt and ends with the call', async () => {
    const m = Model.createModel()
    Model.waitingStarted(m, 'e1', 'Edit', { file_path: '/w/a.ts' }, 1_000)
    expect(Model.waitingOf(m, 4_000)).toEqual({ tool: 'Edit', input: { file_path: '/w/a.ts' }, waitedMs: 3_000 })
    Model.waitingEnded(m, 'e1')
    expect(Model.waitingOf(m, 5_000)).toBeNull()
  })

  test('a prompt row remembers its turn, for Chapters to jump to', async () => {
    const m = Model.createModel()
    Model.promptSubmitted(m, 0, 'hello')
    Model.turnOfRow(m, 'row-1', 10)
    Model.startTurn(m, 20)
    expect(m.turns[0]?.userRowId).toBe('row-1')
  })

  test('titles come from the first sentence of the answer, or the prompt', async () => {
    expect(Model.headlineOf('**Done.** Fixed the race in `refresh()`, and added tests.', 'x')).toBe('Done')
    expect(Model.headlineOf('Fixed the race in refresh() so only one tab rotates the token at a time across every window', 'x')).toBe('Fixed the race in refresh() so only one tab rotates the…')
    expect(Model.headlineOf('', 'add a dark mode toggle to settings')).toBe('Add a dark mode toggle to settings')
    expect(Model.headlineOf(undefined, '')).toBe('')
  })
})
