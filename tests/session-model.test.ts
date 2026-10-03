import { describe, expect, test } from 'claude-code/testing'

import * as Model from '../src/engine/session-model'

describe('session-model', () => {
  test('a turn collects its edits, durations and context', async () => {
    const m = Model.createModel()
    Model.promptSubmitted(m, 900)
    Model.startTurn(m, 1_000)
    Model.toolStarted(m, 't1', 'Edit', { file_path: '/w/a.ts', old_string: 'a', new_string: 'b\nc' }, 1_100)
    Model.toolFinished(m, 't1', 'Edit', { file_path: '/w/a.ts', old_string: 'a', new_string: 'b\nc' }, 1_500, false)
    Model.toolStarted(m, 't2', 'Write', { file_path: '/w/n.ts', content: 'x' }, 1_600)
    Model.toolFinished(m, 't2', 'Write', { file_path: '/w/n.ts', content: 'x' }, 1_700, true)
    Model.completeTurn(m, 2_000, 41)

    expect(Model.durationOf(m, 't1')).toBe(400)
    expect(m.lastCompleted).toMatchObject({ turn: 1, files: ['/w/a.ts'], add: 2, del: 1, contextPercent: 41 })
  })

  test('a receipt binds to the turn that just ended, once', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.completeTurn(m, 1_000)
    expect(Model.receiptFor(m, 'r1', 1_200)?.turn).toBe(1)
    Model.startTurn(m, 2_000)
    Model.completeTurn(m, 3_000)
    expect(Model.receiptFor(m, 'r1', 3_100)?.turn, 'r1 keeps its turn').toBe(1)
    expect(Model.receiptFor(m, 'r2', 3_100)?.turn).toBe(2)
  })

  test('a receipt first seen long after its turn gets no stats', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.completeTurn(m, 1_000)
    expect(Model.receiptFor(m, 'old', 60_000)).toBeNull()
  })

  test('a prompt row binds to the turn it starts, only right after a submit', async () => {
    const m = Model.createModel()
    Model.promptSubmitted(m, 1_000)
    expect(Model.turnOfRow(m, 'u1', 1_050), 'drawn before the turn starts').toBe(1)
    Model.startTurn(m, 1_100)
    expect(Model.turnOfRow(m, 'u1', 1_200)).toBe(1)
    expect(Model.turnOfRow(m, 'scrolled-in-old-row', 30_000)).toBeUndefined()
  })

  test('a fresh model knows nothing and stays safe', async () => {
    const m = Model.createModel()
    expect(Model.receiptFor(m, 'x', 0)).toBeNull()
    expect(Model.durationOf(m, 'x')).toBeUndefined()
    expect(Model.latestRunning(m)).toBeUndefined()
    Model.toolFinished(m, 'never-started', 'Read', {}, 10, false)
    expect(Model.durationOf(m, 'never-started')).toBeUndefined()
  })

  test('a call that waited on a permission prompt shows no duration', async () => {
    const m = Model.createModel()
    Model.toolStarted(m, 't', 'Edit', {}, 0)
    Model.toolPrompted(m, 't')
    Model.toolFinished(m, 't', 'Edit', {}, 40_000, false)
    expect(Model.durationOf(m, 't')).toBeUndefined()
  })

  test('a turn whose start was never seen gets no receipt stats', async () => {
    const m = Model.createModel()
    Model.toolStarted(m, 'e', 'Edit', { file_path: '/w/a.ts', old_string: 'a', new_string: 'b' }, 0)
    Model.toolFinished(m, 'e', 'Edit', { file_path: '/w/a.ts', old_string: 'a', new_string: 'b' }, 10, false)
    Model.completeTurn(m, 100)
    expect(m.lastCompleted).toBeNull()
  })

  test('latestRunning is the call that started last', async () => {
    const m = Model.createModel()
    Model.toolStarted(m, 'a', 'Read', { file_path: '/a' }, 1)
    Model.toolStarted(m, 'b', 'Bash', { command: 'ls' }, 2)
    expect(Model.latestRunning(m)?.tool).toBe('Bash')
    Model.toolFinished(m, 'b', 'Bash', {}, 3, false)
    expect(Model.latestRunning(m)?.tool).toBe('Read')
  })
})
