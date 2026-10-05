import { describe, expect, test } from 'claude-code/testing'

import { waitsOnUser } from '../src/engine/attention'
import { printable, splitPath } from '../src/engine/format'
import * as Model from '../src/engine/session-model'
import { decodeShareCode, encodeShareCode } from '../src/engine/share-code'
import { DEFAULT_SETTINGS, projectLayerOf, resolveSettings } from '../src/engine/settings'
import { MISSION } from '../src/looks/mission'
import { PRISM } from '../src/looks/prism'
import { clockCells as hairlineClock } from '../src/looks/hairline/live'
import { clockCells as prismClock } from '../src/looks/prism/live'
import { factsOf, groupSummary, isFootnotable, otherPhrase } from '../src/engine/tool-facts'
import { runStatsLine, stripColors, withMarks, workingBarCells, workingBarText } from '../src/looks/common'
import { SESSION, assistantInput, bandInput, ctxOf, spinnerInput, startsSession, textOf, toolGroupInput, toolUseInput, turnDurationInput } from './fixtures'

const read = (file: string) => ({ file_path: file })
const edit = (file: string) => ({ file_path: file, old_string: 'a', new_string: 'b' })

describe('footnotes never hide a call without a trace', () => {
  test('commands stay visible: only reads, searches and fetches become notes', async () => {
    expect(isFootnotable('Read')).toBe(true)
    expect(isFootnotable('Grep')).toBe(true)
    expect(isFootnotable('WebFetch')).toBe(true)
    expect(isFootnotable('Bash')).toBe(false)
    expect(isFootnotable('Edit')).toBe(false)
  })

  test('a note shows while its turn runs and after a receipt carries it, not when the receipt came too late', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.toolStarted(m, 'r1', 'Read', read('/w/a.ts'), 100, true)
    expect(Model.isNoteShown(m, 'r1')).toBe(true)
    Model.toolFinished(m, 'r1', 'Read', read('/w/a.ts'), 200, false)
    Model.completeTurn(m, 1_000)
    // The receipt line is first drawn long after the turn: it binds no stats, so its notes never show.
    expect(Model.receiptFor(m, 'late', 60_000)).toBeNull()
    expect(Model.isNoteShown(m, 'r1')).toBe(false)

    Model.startTurn(m, 70_000)
    Model.toolStarted(m, 'r2', 'Read', read('/w/b.ts'), 70_100, true)
    Model.toolFinished(m, 'r2', 'Read', read('/w/b.ts'), 70_200, false)
    Model.completeTurn(m, 71_000)
    expect(Model.receiptFor(m, 'on-time', 71_100)).not.toBeNull()
    expect(Model.isNoteShown(m, 'r2')).toBe(true)
  })

  test('on the desktop, where there is no receipt, a footnoted read keeps its row', async ($, on) => {
    const { saved } = startsSession(on)
    saved.set('settings', { ingredients: { footnotes: true } })
    let id = ''
    on('tool.call', ($, e) => {
      id = e.tool_use_id
      return { result: 'ok' }
    })
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    await $.session.start(SESSION)
    await $.turn.start({ turnId: 't1', text: 'look' })
    await $.tool.call({ tool: 'Read', file_path: '/work/src/cart.js' })
    expect(textOf(await $.ui.render(toolUseInput('Read', read('/work/src/cart.js'), { tool_use_id: id })))).toBe('')
    expect(textOf(await $.ui.render(toolUseInput('Read', read('/work/src/cart.js'), { tool_use_id: id }, 'desktop')))).toContain('cart.js')
  })

  test('an interrupted footnoted read keeps its row', async ($, on) => {
    const { saved } = startsSession(on)
    saved.set('settings', { ingredients: { footnotes: true } })
    let id = ''
    on('tool.call', ($, e) => {
      id = e.tool_use_id
      return { result: 'ok' }
    })
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    await $.session.start(SESSION)
    await $.turn.start({ turnId: 't1', text: 'look' })
    await $.tool.call({ tool: 'Read', file_path: '/work/src/cart.js' })
    expect(textOf(await $.ui.render(toolUseInput('Read', read('/work/src/cart.js'), { tool_use_id: id, isInterrupted: true })))).toContain('cart.js')
  })

  test('a footnoted turn whose receipt binds no stats shows its rows again', async ($, on) => {
    const { saved, clock } = startsSession(on)
    saved.set('settings', { ingredients: { footnotes: true } })
    let id = ''
    on('tool.call', ($, e) => {
      id = e.tool_use_id
      return { result: 'ok' }
    })
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: '' }))
    await $.session.start(SESSION)
    await $.turn.start({ turnId: 't1', text: 'look' })
    await $.tool.call({ tool: 'Read', file_path: '/work/src/cart.js' })
    await $.turn.complete({ turnId: 't1', durationMs: 4_000, answer: 'Done.', isAborted: false, reason: 'answer' })
    await clock.advance(60_000)
    await $.ui.render(turnDurationInput(4_000))
    expect(textOf(await $.ui.render(toolUseInput('Read', read('/work/src/cart.js'), { tool_use_id: id })))).toContain('cart.js')
  })
})

describe('where a turn’s time went', () => {
  test('parallel calls count once', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.toolStarted(m, 'a', 'Read', read('/w/a.ts'), 0)
    Model.toolStarted(m, 'b', 'Read', read('/w/b.ts'), 200)
    Model.toolFinished(m, 'a', 'Read', read('/w/a.ts'), 1_000, false)
    Model.toolFinished(m, 'b', 'Read', read('/w/b.ts'), 1_200, false)
    Model.completeTurn(m, 3_000)
    expect(m.lastCompleted?.toolsMs).toBe(1_200)
    expect(m.lastCompleted?.toolCount).toBe(2)
  })

  test('a call that asked splits into waiting on you, then running', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.toolStarted(m, 'b', 'Bash', { command: 'npm test' }, 0)
    Model.toolPrompted(m, 'b')
    Model.toolFinished(m, 'b', 'Bash', { command: 'npm test' }, 10_000, false, 2_000)
    Model.completeTurn(m, 12_000)
    expect(m.lastCompleted?.waitingMs).toBe(8_000)
    expect(m.lastCompleted?.toolsMs).toBe(2_000)
  })

  test('a subagent’s calls change the ledger only', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.toolStarted(m, 's1', 'Read', read('/w/a.ts'), 0, true, true)
    Model.toolFinished(m, 's1', 'Read', read('/w/a.ts'), 5_000, false)
    Model.toolStarted(m, 's2', 'Edit', edit('/w/a.ts'), 5_000, false, true)
    Model.toolFinished(m, 's2', 'Edit', edit('/w/a.ts'), 6_000, false)
    Model.completeTurn(m, 8_000)
    expect(Model.noteOf(m, 's1')).toBeUndefined()
    expect(Model.marksOf(m, '')).toEqual([])
    expect(Model.changeIndexOf(m, 's2')).toBeUndefined()
    expect(m.lastCompleted?.toolsMs).toBe(0)
    expect(m.lastCompleted?.toolCount).toBe(0)
    expect(Model.ledgerOf(m).map(e => e.file)).toEqual(['/w/a.ts'])
  })
})

describe('waiting on the user', () => {
  test('the wait ends when Claude Code draws its working line again after the answer', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.waitingStarted(m, 'b', 'Bash', { command: 'npm test' }, 1_000)
    Model.workingLineDrawn(m, 1_300)
    expect(Model.waitingOf(m, 1_300)).not.toBeNull()
    Model.workingLineDrawn(m, 9_000)
    expect(Model.waitingOf(m, 9_000)).toBeNull()
  })

  test('modes where nobody is asked never start the ladder', async () => {
    expect(waitsOnUser('default')).toBe(true)
    expect(waitsOnUser(undefined)).toBe(true)
    expect(waitsOnUser('acceptEdits')).toBe(true)
    expect(waitsOnUser('auto')).toBe(false)
    expect(waitsOnUser('dontAsk')).toBe(false)
    expect(waitsOnUser('bypassPermissions')).toBe(false)
  })
})

describe('replies and prompts bind to the right turn', () => {
  test('a reply that starts after long thinking still takes its footnotes', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.workingLineDrawn(m, 20_000)
    Model.assistantSeen(m, 'reply', 21_000)
    Model.toolStarted(m, 'r1', 'Read', read('/w/a.ts'), 21_500, true)
    expect(Model.marksOf(m, 'reply')).toEqual([1])
  })

  test('a prompt typed while Claude works never takes the running turn’s row', async () => {
    const m = Model.createModel()
    Model.promptSubmitted(m, 0, 'fix the cart')
    expect(Model.turnOfRow(m, 'row-1', 100)).toBe(1)
    Model.startTurn(m, 200)
    Model.promptQueued(m)
    expect(Model.turnOfRow(m, 'row-2', 1_000)).toBeUndefined()
    expect(m.turns[0]?.userRowId).toBe('row-1')
    expect(m.turns[0]?.prompt).toBe('fix the cart')
  })
})

describe('markdown and text safety', () => {
  test('marks after a code block, table or list go on their own line', async () => {
    expect(withMarks('Looked at the cart.', [1, 2])).toBe('Looked at the cart. ¹²')
    expect(withMarks('Here:\n```js\nx()\n```', [1])).toBe('Here:\n```js\nx()\n```\n\n¹')
    expect(withMarks('| a | b |\n|---|---|\n| 1 | 2 |', [3])).toBe('| a | b |\n|---|---|\n| 1 | 2 |\n\n³')
    expect(withMarks('Steps:\n- one\n- two', [1])).toBe('Steps:\n- one\n- two\n\n¹')
    expect(withMarks('Steps:\n1. one', [1])).toBe('Steps:\n1. one\n\n¹')
  })

  test('C1 control characters never reach a drawing', async () => {
    expect(printable('a\x9b31mb\x85c', 80)).toBe('abc')
    expect(factsOf('mcp__x__\x9bevil\x07', {}).verb).not.toMatch(/[\x00-\x1f\x7f-\x9f]/)
  })

  test('share codes catch every single typo and swapped neighbors', async () => {
    const code = encodeShareCode(DEFAULT_SETTINGS)
    expect(decodeShareCode(code).ok).toBe(true)
    const DIGITS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    for (const at of [3, 4, 5]) {
      for (const d of DIGITS) {
        if (d === code[at]) continue
        const typo = code.slice(0, at) + d + code.slice(at + 1)
        expect(decodeShareCode(typo).ok).toBe(false)
      }
    }
    const swapped = code.slice(0, 3) + code[4] + code[3] + code.slice(5)
    if (swapped !== code) expect(decodeShareCode(swapped).ok).toBe(false)
  })
})

describe('the reply text keeps its markdown', () => {
  test('a reply ending in a list gets its marks on a new paragraph', async ($, on) => {
    const { saved } = startsSession(on)
    saved.set('settings', { ingredients: { footnotes: true } })
    on('tool.call', () => ({ result: 'ok' }))
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    await $.session.start(SESSION)
    await $.turn.start({ turnId: 't1', text: 'look' })
    await $.ui.render(assistantInput('msg-a', 'Plan:\n- read'))
    await $.tool.call({ tool: 'Read', file_path: '/work/src/cart.js' })
    expect(textOf(await $.ui.render(assistantInput('msg-a', 'Plan:\n- read')))).toBe('Plan:\n- read\n\n¹')
  })
})

describe('long turns and project files', () => {
  test('the live clock keeps its width past 100 minutes', async () => {
    const width = (b64: string) => b64.length
    for (const cells of [hairlineClock, prismClock]) expect(width(cells(101 * 60_000))).toBe(width(cells(5_000)))
  })

  test('a project file cannot turn the attention ladder off', async () => {
    const layer = projectLayerOf({ look: 'sumi', ingredients: { attention: false, recency: true } })
    expect(layer.ingredients).toEqual({ recency: true })
  })
})

describe('thinking time', () => {
  test('thinking is the turn’s own time less its tools and waiting, whatever duration Claude Code reports', async ($, on) => {
    const { saved, clock } = startsSession(on)
    saved.set('settings', { ingredients: { timeStrip: true } })
    on('tool.call', async () => {
      await clock.advance(2_000)
      return { result: 'ok' }
    })
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: '' }))
    await $.session.start(SESSION)
    await $.turn.start({ turnId: 't1', text: 'x' })
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    await clock.advance(3_000)
    // Claude Code leaves permission waits out of its duration; the strip measures the turn itself.
    await $.turn.complete({ turnId: 't1', durationMs: 1_000, answer: 'ok', isAborted: false, reason: 'answer' })
    expect(textOf(await $.ui.render(turnDurationInput(1_000)))).toContain('thinking 0:03')
  })
})

describe('narrow terminals and switched-off ingredients', () => {
  test('the time line stays off below 60 columns', async ($, on) => {
    const { saved, clock } = startsSession(on)
    saved.set('settings', { ingredients: { timeStrip: true } })
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: '' }))
    await $.session.start(SESSION)
    await $.turn.start({ turnId: 't1', text: 'x' })
    await clock.advance(3_000)
    await $.turn.complete({ turnId: 't1', durationMs: 3_000, answer: 'ok', isAborted: false, reason: 'answer' })
    const narrow = { ...turnDurationInput(3_000), viewport: { columns: 50, rows: 40, isFullscreen: true } }
    expect(textOf(await $.ui.render(narrow))).not.toContain('thinking')
  })

  test('Mission’s telemetry stays on one line', async () => {
    const usage = { contextPercent: 41, rateLimits: [{ kind: 'five_hour', percentUsed: 62, resetsAt: Date.UTC(2026, 9, 3, 16, 40) }], costUsd: 1.84 }
    const band = MISSION.band({ usage, waiting: null, isWorking: false }, ctxOf({ columns: 60 })) as { props: Record<string, unknown> } | null
    expect(band?.props.height).toBe(1)
    expect(band?.props.overflow).toBe('hidden')
  })

  test('Prism colors its chips by file only with File colors on', async () => {
    const row = (file: string) => ({ id: file, tool: 'Read', input: { file_path: `/work/${file}` }, isRunning: false, isErrored: false, isInterrupted: false })
    const colors = (tree: unknown) => [...JSON.stringify(tree).matchAll(/#[0-9a-fA-F]{6}/g)].map(m => m[0]).sort().join()
    const on = ctxOf({ settings: resolveSettings([{ look: 'prism' }]) })
    const off = ctxOf({ settings: resolveSettings([{ look: 'prism', ingredients: { fileColors: false } }]) })
    expect(colors(PRISM.toolRow(row('a.ts'), on))).not.toBe(colors(PRISM.toolRow(row('zebra.py'), on)))
    expect(colors(PRISM.toolRow(row('a.ts'), off))).toBe(colors(PRISM.toolRow(row('zebra.py'), off)))
  })
})

describe('time under every run, progress above the prompt', () => {
  test('every receipt keeps its own time line, even after later turns and while Claude works', async ($, on) => {
    const { saved, clock } = startsSession(on)
    saved.set('settings', { ingredients: { timeStrip: true } })
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: '' }))
    await $.session.start(SESSION)
    const receiptOf = (id: string) => ({ ...turnDurationInput(3_000), requestId: id })
    for (const [turn, id] of [['t1', 'r1'], ['t2', 'r2']] as const) {
      await $.turn.start({ turnId: turn, text: 'x' })
      await clock.advance(3_000)
      await $.turn.complete({ turnId: turn, durationMs: 3_000, answer: 'ok', isAborted: false, reason: 'answer' })
      await $.ui.render(receiptOf(id))
    }
    await $.turn.start({ turnId: 't3', text: 'x' })
    expect(textOf(await $.ui.render(receiptOf('r1')))).toContain('thinking 0:03')
    expect(textOf(await $.ui.render(receiptOf('r2')))).toContain('thinking 0:03')
  })

  test('while Claude works through a todo list, the working bar shows how far it is', async ($, on) => {
    const { saved } = startsSession(on)
    saved.set('settings', { ingredients: { timeStrip: true } })
    on('tool.call', () => ({ result: 'ok' }))
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    await $.session.start(SESSION)
    await $.turn.start({ turnId: 't1', text: 'x' })
    expect(textOf(await $.ui.render(spinnerInput('thinking', 'desktop')))).not.toContain(' of ')
    await $.tool.call({ tool: 'TodoWrite', todos: [
      { content: 'Read the cart', activeForm: 'Reading the cart', status: 'completed' },
      { content: 'Fix total', activeForm: 'Fixing total', status: 'in_progress' },
      { content: 'Run tests', activeForm: 'Running tests', status: 'pending' },
    ] } as never)
    const bar = textOf(await $.ui.render(spinnerInput('thinking', 'desktop')))
    expect(bar).toContain('1 of 3 · Fixing total')
    expect(textOf(await $.ui.render(bandInput())), 'the band no longer repeats it').not.toContain('1 of 3')
  })
})

describe('room to breathe', () => {
  test('each tool row and group stands apart, receipts have air on both sides, hidden rows take no space', async ($, on) => {
    const { saved } = startsSession(on)
    saved.set('settings', { ingredients: { footnotes: true } })
    let id = ''
    on('tool.call', ($, e) => {
      id = e.tool_use_id
      return { result: 'ok' }
    })
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: '' }))
    await $.session.start(SESSION)
    const props = (tree: unknown) => (tree as { props?: Record<string, unknown> }).props ?? {}
    expect(props(await $.ui.render(toolUseInput('Edit', { file_path: '/work/a.ts', old_string: 'a', new_string: 'b' }))).marginTop).toBe(1)
    expect(props(await $.ui.render(toolGroupInput([{ tool: 'Read', input: { file_path: '/work/a.ts' } }, { tool: 'Read', input: { file_path: '/work/b.ts' } }]))).marginTop).toBe(1)
    await $.turn.start({ turnId: 't1', text: 'look' })
    await $.tool.call({ tool: 'Read', file_path: '/work/src/cart.js' })
    expect(props(await $.ui.render(toolUseInput('Read', { file_path: '/work/src/cart.js' }, { tool_use_id: id }))).marginTop).toBeUndefined()
    await $.turn.complete({ turnId: 't1', durationMs: 4_000, answer: 'Done.', isAborted: false, reason: 'answer' })
    const receipt = props(await $.ui.render(turnDurationInput(4_000)))
    expect(receipt.marginTop).toBe(1)
    expect(receipt.marginBottom).toBe(1)
  })
})

describe('paths that are the project itself', () => {
  test('the working directory reads as ./, never as a file named after the folder', async () => {
    expect(splitPath('/work', '/work')).toEqual({ dir: '', base: './' })
    expect(splitPath('/work/', '/work')).toEqual({ dir: '', base: './' })
    expect(splitPath('/work/src/a.ts', '/work')).toEqual({ dir: 'src/', base: 'a.ts' })
  })
})

describe('second-round screenshot fixes', () => {
  test('a headline skips a bare opener such as "Done." for the sentence that says what happened', async () => {
    expect(Model.headlineOf('Done. Fixed the total() function to multiply price by qty.', 'fix it')).toBe('Fixed the total() function to multiply price by qty')
    expect(Model.headlineOf('Perfect! All three tests pass now.', 'x')).toBe('All three tests pass now')
    expect(Model.headlineOf('Done.', 'fix the cart total')).toBe('Fix the cart total')
    expect(Model.headlineOf('Fixed the refresh race. It works.', 'x')).toBe('Fixed the refresh race')
  })

  test('between calls the live line still names the last step', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.toolStarted(m, 'b', 'Bash', { command: 'npm test' }, 100)
    Model.toolFinished(m, 'b', 'Bash', { command: 'npm test' }, 200, false)
    expect(Model.latestRunning(m)).toBeUndefined()
    expect(Model.latestStep(m)?.tool).toBe('Bash')
    Model.completeTurn(m, 300)
    Model.startTurn(m, 400)
    expect(Model.latestStep(m)).toBeUndefined()
  })

  test('short times in the strip legend read in seconds, longer ones in minutes', async () => {
    const legend = textOf(runStatsLine(ctxOf({ columns: 120 }), { thinkingMs: 78_000, toolsMs: 600, waitingMs: 0 }, stripColors('hairline', true)))
    expect(legend).toContain('thinking 1:18')
    expect(legend).toContain('tools 0.6s')
  })
})

describe('live task progress from Claude’s todo list', () => {
  const todos = (statuses: string[]) => ({
    todos: statuses.map((status, i) => ({ content: `Task ${i + 1}`, activeForm: `Doing task ${i + 1}`, status })),
  })

  test('progress counts finished tasks and names the active one, only for a list written this turn', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    expect(Model.progressOf(m)).toBeNull()
    Model.toolStarted(m, 't1', 'TodoWrite', todos(['completed', 'in_progress', 'pending']), 100)
    expect(Model.progressOf(m)).toEqual({ done: 1, total: 3, active: 'Doing task 2' })
    Model.toolStarted(m, 't2', 'TodoWrite', todos(['completed', 'completed', 'in_progress']), 200)
    expect(Model.progressOf(m)).toEqual({ done: 2, total: 3, active: 'Doing task 3' })
    Model.completeTurn(m, 300)
    expect(m.lastCompleted?.tasks).toEqual({ done: 2, total: 3 })
    expect(Model.progressOf(m), 'nothing live once the turn ends').toBeNull()
    Model.startTurn(m, 400)
    expect(Model.progressOf(m), 'last turn’s list is not this turn’s progress').toBeNull()
  })

  test('a subagent’s list and a malformed list never count', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.toolStarted(m, 's', 'TodoWrite', todos(['in_progress']), 10, false, true)
    expect(Model.progressOf(m)).toBeNull()
    Model.toolStarted(m, 'x', 'TodoWrite', { todos: 'nonsense' }, 20)
    expect(Model.progressOf(m)).toBeNull()
  })
})

describe('live progress from Claude Code’s task tools', () => {
  test('tasks created and updated this turn count, as TaskCreate and TaskUpdate report them', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.taskToolDone(m, 'TaskCreate', { subject: 'Read the cart', activeForm: 'Reading the cart' }, { task: { id: '1', subject: 'Read the cart' } })
    Model.taskToolDone(m, 'TaskCreate', { subject: 'Fix total', activeForm: 'Fixing total' }, { task: { id: '2', subject: 'Fix total' } })
    Model.taskToolDone(m, 'TaskCreate', { subject: 'Run tests' }, { task: { id: '3', subject: 'Run tests' } })
    expect(Model.progressOf(m)).toEqual({ done: 0, total: 3, active: 'Reading the cart' })
    Model.taskToolDone(m, 'TaskUpdate', { taskId: '1', status: 'completed' }, { success: true, taskId: '1', updatedFields: ['status'] })
    Model.taskToolDone(m, 'TaskUpdate', { taskId: '2', status: 'in_progress' }, { success: true, taskId: '2', updatedFields: ['status'] })
    expect(Model.progressOf(m)).toEqual({ done: 1, total: 3, active: 'Fixing total' })
    Model.taskToolDone(m, 'TaskUpdate', { taskId: '3', status: 'deleted' }, { success: true, taskId: '3', updatedFields: ['status'] })
    expect(Model.progressOf(m)?.total).toBe(2)
  })

  test('a task list read back replaces what we knew, and junk results change nothing', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.taskToolDone(m, 'TaskList', {}, { tasks: [{ id: 'a', subject: 'One', status: 'completed', blockedBy: [] }, { id: 'b', subject: 'Two', status: 'pending', blockedBy: [] }] })
    expect(Model.progressOf(m)).toEqual({ done: 1, total: 2, active: 'Two' })
    Model.taskToolDone(m, 'TaskCreate', { subject: 'x' }, 'not a record')
    expect(Model.progressOf(m)?.total).toBe(2)
  })

  test('task tool rows say what they do', async () => {
    expect(factsOf('TaskCreate', { subject: 'Fix total' })).toMatchObject({ verb: 'Plan', target: 'Fix total' })
    expect(factsOf('TaskUpdate', { taskId: '2', status: 'completed' })).toMatchObject({ verb: 'Task', target: 'completed #2' })
  })
})

describe('the live line keeps its distance', () => {
  test('the working line above the prompt has a blank line above it, so it never touches the last row', async ($, on) => {
    startsSession(on)
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    await $.session.start(SESSION)
    await $.turn.start({ turnId: 't1', text: 'x' })
    const drawn = (await $.ui.render(spinnerInput('thinking'))) as { props?: Record<string, unknown> }
    expect(drawn.props?.marginTop).toBe(1)
  })
})

describe('a working bar, always, while Claude works', () => {
  test('the turn so far splits into thinking, tools and waiting, counting a running call and an open wait', async () => {
    const m = Model.createModel()
    Model.startTurn(m, 0)
    Model.toolStarted(m, 'a', 'Read', read('/w/a.ts'), 1_000)
    Model.toolFinished(m, 'a', 'Read', read('/w/a.ts'), 3_000, false)
    Model.toolStarted(m, 'b', 'Bash', { command: 'npm test' }, 5_000)
    expect(Model.liveTimes(m, 8_000)).toEqual({ thinkingMs: 3_000, toolsMs: 5_000, waitingMs: 0 })
    Model.waitingStarted(m, 'c', 'Bash', { command: 'rm x' }, 8_000)
    expect(Model.liveTimes(m, 10_000)).toEqual({ thinkingMs: 3_000, toolsMs: 5_000, waitingMs: 2_000 })
  })

  test('without a task list the bar reads the clock and where the time went', async () => {
    const text = workingBarText({ thinkingMs: 30_000, toolsMs: 12_000, waitingMs: 0, progress: null })
    expect(text).toBe('thinking 0:30 · tools 0:12')
    const cells = workingBarCells({ thinkingMs: 30_000, toolsMs: 12_000, waitingMs: 0, progress: null }, stripColors('hairline', true), true, 80, 3)
    expect(cells.length).toBe(80)
    expect(cells.map(c => c.char).join('')).toContain('thinking 0:30 · tools 0:12')
  })

  test('with a task list the bar counts tasks and names the one in hand', async () => {
    const work = { thinkingMs: 1_000, toolsMs: 0, waitingMs: 0, progress: { done: 2, total: 4, active: 'Fixing total' } }
    expect(workingBarText(work)).toBe('2 of 4 · Fixing total')
    const chars = workingBarCells(work, stripColors('hairline', true), true, 80, 0).map(c => c.char).join('')
    expect(chars).toMatch(/■+ ■+ ■+ □+/)
    expect(chars).toContain('2 of 4 · Fixing total')
  })

  test('the live line draws the bar under itself, on the terminal as cells it can animate', async ($, on) => {
    startsSession(on)
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    await $.session.start(SESSION)
    await $.turn.start({ turnId: 't1', text: 'x' })
    const drawn = JSON.stringify(await $.ui.render(spinnerInput('thinking')))
    expect(drawn).toContain('"key":"cz-work"')
    expect(textOf(await $.ui.render(spinnerInput('thinking', 'desktop')))).toContain('thinking')
  })
})

describe('polish round 2', () => {
  test('task planning and tool loading are named, not "used 5 tools"', async () => {
    const create = (s: string) => ({ tool: 'TaskCreate', input: { subject: s } })
    expect(otherPhrase([create('a'), create('b'), create('c'), create('d')])).toBe('planned 4 tasks')
    expect(otherPhrase([create('a'), { tool: 'TaskUpdate', input: { taskId: '1', status: 'completed' } }])).toBe('updated the task list')
    expect(otherPhrase([{ tool: 'ToolSearch', input: { query: 'select:TaskCreate' } }])).toBe('loaded a tool')
    expect(otherPhrase([{ tool: 'mcp__x__y', input: {} }, { tool: 'TaskCreate', input: {} }])).toBe('used 2 tools')
    expect(groupSummary([create('a'), create('b'), { tool: 'Read', input: { file_path: '/w/a.ts' } }])).toBe('Planned 2 tasks, read 1 file')
    expect(factsOf('ToolSearch', { query: 'select:TaskCreate' })).toMatchObject({ verb: 'Load', target: 'select:TaskCreate' })
  })

  test('the working bar leaves the clock to the line above it', async () => {
    expect(workingBarText({ thinkingMs: 30_000, toolsMs: 12_000, waitingMs: 0, progress: null })).toBe('thinking 0:30 · tools 0:12')
  })

  test('a headline keeps the * of code and drops only markdown emphasis', async () => {
    expect(Model.headlineOf('Changed it to **item.price * item.qty** in `total()`. Done.', 'x')).toBe('Changed it to item.price * item.qty in total()')
  })
})
