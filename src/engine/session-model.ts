import { printable } from './format'
import { changeOf, isChangeTool } from './tool-facts'

export type FileChange = { file: string; add: number; del: number }

export type TurnStats = {
  turn: number
  files: string[]
  add: number
  del: number
  contextPercent?: number
  /** Lines changed per file, in the order the files were first changed. */
  byFile?: FileChange[]
  /** Tool calls in the turn, and the time their tools ran (overlaps counted once; a call that asked counts only its run). */
  toolCount?: number
  toolsMs?: number
  /** The turn's own wall-clock time, from its start to its end. */
  wallMs?: number
  /** Time spent on calls that waited for the user's permission. */
  waitingMs?: number
  /** The turn's footnotes, when Footnotes was on. */
  notes?: Note[]
  /** A short title derived from the answer, for Headlines. */
  title?: string
}

export type Note = { n: number; tool: string; input: unknown; durationMs?: number }

/** One turn, for the Chapters pane. */
export type TurnRecord = { turn: number; prompt: string; title?: string; userRowId?: string; startedAt: number; durationMs?: number; add: number; del: number; files: number }

/** One file changed this session, for the Ledger pane. */
export type LedgerEntry = { file: string; add: number; del: number; turns: number[]; lastToolId: string }
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
  prompted: Set<string>
  receipts: Map<string, TurnStats | null>
  rowTurn: Map<string, number | undefined>
  pendingPrompt: string
  pendingRowId: string | undefined
  turns: TurnRecord[]
  ledger: Map<string, LedgerEntry>
  changeIndex: Map<string, number>
  lastAssistantId: string | null
  marks: Map<string, number[]>
  /** Reply blocks already drawn: an old one drawn again never takes new footnotes. */
  seenReplies: Set<string>
  /** Last start or end of a turn or tool call, to tell a reply that is streaming now from an old one. */
  lastActivityAt: number
  noteOfTool: Map<string, number>
  waiting: { id: string; tool: string; input: unknown; since: number } | null
  /** Calls made inside a subagent's loop: they reach the ledger, never the main turn's notes or time. */
  subagentCalls: Set<string>
  /** The turn each footnoted call belongs to. */
  noteTurn: Map<string, number>
  /** Turns whose receipt was drawn with their notes, so their footnoted rows may hide. */
  shownTurns: Set<number>
  /** The turn just finished and its receipt not drawn yet. */
  isReceiptPending: boolean
  /** The last call started this turn, for the live line between calls. */
  lastStep: Running | null
  /** The current turn's calls as spans of time, to measure tools and waiting without counting overlaps twice. */
  spans: Span[]
}

type Span = { start: number; end: number; isWaiting: boolean }

/** How long after a permission prompt appears the working line's return means the user answered. */
export const ANSWER_GAP_MS = 1000

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
    prompted: new Set(),
    receipts: new Map(),
    rowTurn: new Map(),
    pendingPrompt: '',
    pendingRowId: undefined,
    turns: [],
    ledger: new Map(),
    changeIndex: new Map(),
    lastAssistantId: null,
    marks: new Map(),
    seenReplies: new Set(),
    lastActivityAt: Number.NEGATIVE_INFINITY,
    noteOfTool: new Map(),
    waiting: null,
    subagentCalls: new Set(),
    noteTurn: new Map(),
    shownTurns: new Set(),
    isReceiptPending: false,
    spans: [],
    lastStep: null,
  }
}

export function promptSubmitted(m: SessionModel, now: number, text = ''): void {
  m.lastSubmitAt = now
  m.pendingPrompt = printable(text, 300)
  m.pendingRowId = undefined
}

export function startTurn(m: SessionModel, now: number): void {
  m.turn += 1
  m.isWorking = true
  m.turnStartedAt = now
  m.current = { ...emptyStats(m.turn), byFile: [], toolCount: 0, toolsMs: 0, waitingMs: 0, notes: [] }
  m.lastAssistantId = null
  m.marks.delete('')
  m.lastActivityAt = now
  m.spans = []
  m.lastStep = null
  const record: TurnRecord = { turn: m.turn, prompt: m.pendingPrompt, startedAt: now, add: 0, del: 0, files: 0 }
  if (m.pendingRowId !== undefined) record.userRowId = m.pendingRowId
  m.turns.push(record)
  m.pendingPrompt = ''
  m.pendingRowId = undefined
}

/** A reply block drawn while the turn runs; footnotes that follow attach to it. */
export function assistantSeen(m: SessionModel, requestId: string, now: number): void {
  if (m.seenReplies.has(requestId)) return
  m.seenReplies.add(requestId)
  // Only a block that appears during a turn, right after activity, is this turn's reply.
  if (!m.isWorking || now - m.lastActivityAt > BIND_WINDOW_MS) return
  m.lastAssistantId = requestId
  // Calls made before any reply text this turn belong to the first block that follows.
  const early = m.marks.get('') ?? []
  m.marks.delete('')
  m.marks.set(requestId, early)
}

/**
 * A prompt sent while Claude works: its row never takes the running turn's place.
 * If it goes on to start the next turn, that turn keeps its text.
 */
export function promptQueued(m: SessionModel, text = ''): void {
  m.lastSubmitAt = Number.NEGATIVE_INFINITY
  m.pendingPrompt = printable(text, 300)
  m.pendingRowId = undefined
}

/**
 * Claude Code drew its working line. That counts as activity, so a reply after
 * long thinking still binds; and as it is hidden while a permission prompt is
 * open, its return a moment later means the user has answered.
 */
export function workingLineDrawn(m: SessionModel, now: number): void {
  if (!m.isWorking) return
  m.lastActivityAt = now
  if (m.waiting && now - m.waiting.since >= ANSWER_GAP_MS) m.waiting = null
}

export function toolStarted(m: SessionModel, id: string, tool: string, input: unknown, now: number, isFootnoted = false, isSubagent = false): void {
  m.toolTurn.set(id, m.turn)
  m.toolStart.set(id, now)
  m.lastActivityAt = now
  m.running.set(id, { tool, input, startedAt: now })
  if (!isSubagent) m.lastStep = { tool, input, startedAt: now }
  if (isSubagent) {
    m.subagentCalls.add(id)
    return
  }
  if (isChangeTool(tool)) {
    let count = 0
    for (const [otherId, turn] of m.toolTurn) if (turn === m.turn && m.changeIndex.has(otherId)) count += 1
    m.changeIndex.set(id, count + 1)
  }
  if (isFootnoted && m.isWorking) {
    const n = (m.current.notes?.length ?? 0) + 1
    m.current.notes = [...(m.current.notes ?? []), { n, tool, input }]
    m.noteOfTool.set(id, n)
    m.noteTurn.set(id, m.turn)
    const owner = m.lastAssistantId ?? ''
    m.marks.set(owner, [...(m.marks.get(owner) ?? []), n])
  }
}

/** A call that waited on a permission prompt: its time is the user's, so no duration is shown. */
export function toolPrompted(m: SessionModel, id: string): void {
  m.prompted.add(id)
}

/**
 * A call ended. `execMs`, when Claude Code reports it, is how long the tool
 * itself ran; for a call that asked, the rest of its time was the user's.
 */
export function toolFinished(m: SessionModel, id: string, tool: string, input: unknown, now: number, isError: boolean, execMs?: number): void {
  const start = m.toolStart.get(id)
  const ms = start === undefined ? undefined : Math.max(0, now - start)
  const isPrompted = m.prompted.has(id)
  const ranMs = ms === undefined ? undefined : isPrompted ? (execMs === undefined ? undefined : Math.min(ms, Math.max(0, execMs))) : ms
  m.lastActivityAt = now
  if (ranMs !== undefined) m.toolMs.set(id, ranMs)
  m.running.delete(id)
  if (m.waiting?.id === id) m.waiting = null
  const isMain = !m.subagentCalls.has(id)
  if (isMain && m.isWorking && m.toolTurn.get(id) === m.turn && start !== undefined && ms !== undefined) {
    m.current.toolCount = (m.current.toolCount ?? 0) + 1
    const ranFrom = now - (ranMs ?? 0)
    if (isPrompted) m.spans.push({ start, end: ranFrom, isWaiting: true })
    if (ranMs !== undefined && ranMs > 0) m.spans.push({ start: ranFrom, end: now, isWaiting: false })
    const n = m.noteOfTool.get(id)
    if (n !== undefined && ranMs !== undefined) m.current.notes = (m.current.notes ?? []).map(note => (note.n === n ? { ...note, durationMs: ranMs } : note))
  }
  if (isError || !isChangeTool(tool)) return
  if (!isMain) {
    const change = changeOf(tool, input)
    if (change && change.file !== '') addToLedger(m, id, change)
    return
  }
  const change = changeOf(tool, input)
  if (!change || change.file === '') return
  if (!m.current.files.includes(change.file)) m.current.files.push(change.file)
  m.current.add += change.add
  m.current.del += change.del
  const byFile = m.current.byFile ?? []
  const entry = byFile.find(f => f.file === change.file)
  if (entry) {
    entry.add += change.add
    entry.del += change.del
  } else byFile.push({ file: change.file, add: change.add, del: change.del })
  m.current.byFile = byFile
  addToLedger(m, id, change)
}

function addToLedger(m: SessionModel, id: string, change: { file: string; add: number; del: number }): void {
  const ledger = m.ledger.get(change.file) ?? { file: change.file, add: 0, del: 0, turns: [], lastToolId: id }
  ledger.add += change.add
  ledger.del += change.del
  if (!ledger.turns.includes(m.turn)) ledger.turns.push(m.turn)
  ledger.lastToolId = id
  m.ledger.set(change.file, ledger)
}

/** The length of time covered by a set of spans, overlaps counted once. */
function coveredMs(spans: Span[]): number {
  const sorted = spans.filter(s => s.end > s.start).sort((a, b) => a.start - b.start)
  let total = 0
  let from = Number.NEGATIVE_INFINITY
  let to = Number.NEGATIVE_INFINITY
  for (const s of sorted) {
    if (s.start > to) {
      if (to > from) total += to - from
      from = s.start
      to = s.end
    } else to = Math.max(to, s.end)
  }
  if (to > from) total += to - from
  return total
}

export function completeTurn(m: SessionModel, now: number, contextPercent?: number, answer?: string): void {
  const sawStart = m.isWorking
  m.isWorking = false
  m.completedAt = now
  m.running.clear()
  // A turn that began before Claudinator loaded has partial stats; show none rather than wrong ones.
  if (!sawStart) {
    m.lastCompleted = null
    return
  }
  const busyMs = coveredMs(m.spans)
  const waitingMs = coveredMs(m.spans.filter(s => s.isWaiting))
  m.current.waitingMs = waitingMs
  m.current.toolsMs = busyMs - waitingMs
  m.current.wallMs = Math.max(0, now - m.turnStartedAt)
  m.isReceiptPending = true
  const record = m.turns[m.turns.length - 1]
  const title = headlineOf(answer, record?.prompt ?? '')
  m.lastCompleted = {
    ...m.current,
    files: [...m.current.files],
    byFile: (m.current.byFile ?? []).map(f => ({ ...f })),
    ...(title === '' ? {} : { title }),
    ...(contextPercent === undefined ? {} : { contextPercent }),
  }
  if (record && record.turn === m.turn) {
    record.durationMs = Math.max(0, now - record.startedAt)
    record.add = m.current.add
    record.del = m.current.del
    record.files = m.current.files.length
    if (title !== '') record.title = title
  }
}

/** A short title: the answer's first sentence, else the prompt's, at most about 60 characters. */
export function headlineOf(answer: string | undefined, prompt: string): string {
  // The first sentence that says something: a bare opener ("Done.", "Perfect!") is skipped.
  const firstSentence = (text: string): string => {
    let rest = printable(text, 2000).replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim()
    while (rest !== '') {
      const match = rest.match(/^(.+?)[.!?:](?:\s|$)/)
      const sentence = (match?.[1] ?? rest).trim()
      if (sentence.split(' ').length > 2 || !match) return sentence.split(' ').length > 2 ? sentence : ''
      rest = rest.slice(match[0].length).trim()
    }
    return ''
  }
  let title = firstSentence(answer ?? '') || firstSentence(prompt)
  if (title.length > 60) {
    const cut = title.slice(0, 60)
    const space = cut.lastIndexOf(' ')
    title = (space > 20 ? cut.slice(0, space) : cut) + '…'
  }
  return title.charAt(0).toUpperCase() + title.slice(1)
}

export function changeIndexOf(m: SessionModel, id: string): number | undefined {
  return m.changeIndex.get(id)
}

export function marksOf(m: SessionModel, assistantId: string): number[] {
  return m.marks.get(assistantId) ?? []
}

export function noteOf(m: SessionModel, toolId: string): number | undefined {
  return m.noteOfTool.get(toolId)
}

/**
 * Whether a footnoted call is accounted for elsewhere, so its row may hide:
 * while its turn runs or waits for its receipt, and once a receipt shows its note.
 */
export function isNoteShown(m: SessionModel, toolId: string): boolean {
  const turn = m.noteTurn.get(toolId)
  if (turn === undefined) return false
  if (turn === m.turn && (m.isWorking || m.isReceiptPending)) return true
  return m.shownTurns.has(turn)
}

export function ledgerOf(m: SessionModel): LedgerEntry[] {
  return [...m.ledger.values()].map(e => ({ ...e, turns: [...e.turns] }))
}

export function waitingStarted(m: SessionModel, id: string, tool: string, input: unknown, now: number): void {
  m.waiting = { id, tool, input, since: now }
}

export function waitingEnded(m: SessionModel, id: string): void {
  if (m.waiting?.id === id) m.waiting = null
}

export function waitingOf(m: SessionModel, now: number): { tool: string; input: unknown; waitedMs: number } | null {
  return m.waiting ? { tool: m.waiting.tool, input: m.waiting.input, waitedMs: Math.max(0, now - m.waiting.since) } : null
}

/** The stats a turn's closing line shows; bound the first time that line is drawn. */
export function receiptFor(m: SessionModel, requestId: string, now: number): TurnStats | null {
  if (!m.receipts.has(requestId)) {
    const stats = now - m.completedAt <= BIND_WINDOW_MS ? m.lastCompleted : null
    m.receipts.set(requestId, stats)
    if (stats) m.shownTurns.add(stats.turn)
    m.isReceiptPending = false
  }
  return m.receipts.get(requestId) ?? null
}

/** The turn a prompt row starts; undefined for rows drawn long after any submit. */
export function turnOfRow(m: SessionModel, requestId: string, now: number): number | undefined {
  if (!m.rowTurn.has(requestId)) {
    const isFresh = now - m.lastSubmitAt <= BIND_WINDOW_MS
    const turn = isFresh ? (m.isWorking ? m.turn : m.turn + 1) : undefined
    m.rowTurn.set(requestId, turn)
    if (turn !== undefined && requestId !== 'placeholder') {
      const record = m.turns.find(t => t.turn === turn)
      if (record) record.userRowId ??= requestId
      else m.pendingRowId = requestId
    }
  }
  return m.rowTurn.get(requestId)
}

export function durationOf(m: SessionModel, id: string): number | undefined {
  return m.toolMs.get(id)
}

/** The step running now, else the last one started this turn: what the live line names between calls. */
export function latestStep(m: SessionModel): Running | undefined {
  return latestRunning(m) ?? m.lastStep ?? undefined
}

export function latestRunning(m: SessionModel): Running | undefined {
  let last: Running | undefined
  for (const r of m.running.values()) if (!last || r.startedAt >= last.startedAt) last = r
  return last
}
