import { changeOf, isChangeTool } from './tool-facts'

export type TurnStats = { turn: number; files: string[]; add: number; del: number; contextPercent?: number }
export type Running = { tool: string; input: unknown; startedAt: number }

/**
 * What Claudinator knows about this session, built only from live events and
 * kept in memory. Nothing here is read from history or written to disk.
 */
export type SessionModel = {
  turn: number
  isWorking: boolean
  turnStartedAt: number
  lastSubmitAt: number
  completedAt: number
  current: TurnStats
  lastCompleted: TurnStats | null
  toolTurn: Map<string, number>
  toolStart: Map<string, number>
  toolMs: Map<string, number>
  running: Map<string, Running>
  receipts: Map<string, TurnStats | null>
  rowTurn: Map<string, number | undefined>
}

/** How soon after a submit or a turn's end a newly drawn row is taken to belong to it. */
export const BIND_WINDOW_MS = 5000

const emptyStats = (turn: number): TurnStats => ({ turn, files: [], add: 0, del: 0 })

export function createModel(): SessionModel {
  return {
    turn: 0,
    isWorking: false,
    turnStartedAt: 0,
    lastSubmitAt: Number.NEGATIVE_INFINITY,
    completedAt: Number.NEGATIVE_INFINITY,
    current: emptyStats(0),
    lastCompleted: null,
    toolTurn: new Map(),
    toolStart: new Map(),
    toolMs: new Map(),
    running: new Map(),
    receipts: new Map(),
    rowTurn: new Map(),
  }
}

export function promptSubmitted(m: SessionModel, now: number): void {
  m.lastSubmitAt = now
}

export function startTurn(m: SessionModel, now: number): void {
  m.turn += 1
  m.isWorking = true
  m.turnStartedAt = now
  m.current = emptyStats(m.turn)
}

export function toolStarted(m: SessionModel, id: string, tool: string, input: unknown, now: number): void {
  m.toolTurn.set(id, m.turn)
  m.toolStart.set(id, now)
  m.running.set(id, { tool, input, startedAt: now })
}

export function toolFinished(m: SessionModel, id: string, tool: string, input: unknown, now: number, isError: boolean): void {
  const start = m.toolStart.get(id)
  if (start !== undefined) m.toolMs.set(id, Math.max(0, now - start))
  m.running.delete(id)
  if (isError || !isChangeTool(tool)) return
  const change = changeOf(tool, input)
  if (!change || change.file === '') return
  if (!m.current.files.includes(change.file)) m.current.files.push(change.file)
  m.current.add += change.add
  m.current.del += change.del
}

export function completeTurn(m: SessionModel, now: number, contextPercent?: number): void {
  m.isWorking = false
  m.completedAt = now
  m.running.clear()
  m.lastCompleted = {
    ...m.current,
    files: [...m.current.files],
    ...(contextPercent === undefined ? {} : { contextPercent }),
  }
}

/** The stats a turn's closing line shows; bound the first time that line is drawn. */
export function receiptFor(m: SessionModel, requestId: string, now: number): TurnStats | null {
  if (!m.receipts.has(requestId)) {
    m.receipts.set(requestId, now - m.completedAt <= BIND_WINDOW_MS ? m.lastCompleted : null)
  }
  return m.receipts.get(requestId) ?? null
}

/** The turn a prompt row starts; undefined for rows drawn long after any submit. */
export function turnOfRow(m: SessionModel, requestId: string, now: number): number | undefined {
  if (!m.rowTurn.has(requestId)) {
    const isFresh = now - m.lastSubmitAt <= BIND_WINDOW_MS
    m.rowTurn.set(requestId, isFresh ? (m.isWorking ? m.turn : m.turn + 1) : undefined)
  }
  return m.rowTurn.get(requestId)
}

export function durationOf(m: SessionModel, id: string): number | undefined {
  return m.toolMs.get(id)
}

export function latestRunning(m: SessionModel): Running | undefined {
  let last: Running | undefined
  for (const r of m.running.values()) if (!last || r.startedAt >= last.startedAt) last = r
  return last
}
