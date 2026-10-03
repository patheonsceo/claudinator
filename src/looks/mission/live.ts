import type { RenderElement } from 'claude-code'

import { printable } from '../../engine/format'
import { encodeCells } from '../../engine/raster'
import type { Cell } from '../../engine/raster'
import type { Ctx, LiveFrame, LiveMode, LiveState } from '../look'
import { C, TAGS, grow, shrinks, tClock, txt } from './style'

export { tClock } from './style'

/** The word after the lamp while Claude thinks or writes; a running step takes its tag instead. */
export const LIVE_WORDS: Record<LiveMode, string> = { thinking: 'THINK', writing: 'XMIT', running: 'EXEC' }

/** A running step's tag, from the live state's activity: the same words the rows use. */
const STEP_TAGS: Record<string, string> = {
  Reading: TAGS.read,
  Searching: TAGS.search,
  Finding: TAGS.search,
  Listing: TAGS.search,
  Editing: TAGS.edit,
  Writing: TAGS.create,
  Running: TAGS.run,
  Fetching: TAGS.web,
  Delegating: TAGS.agent,
  Planning: 'PLAN',
}

/** Bars in the thinking sparkline and the writing trace. */
export const TRACE_COLUMNS = 22
/** Cells in the running progress bar. */
export const BAR_COLUMNS = 18
const CLOCK_COLUMNS = 7
/** Ticks (about 100 ms each) between two steps of the sparkline's scroll. */
const SPARK_STEP = 3
/** Ticks per cell of the progress bar's fill, and the steps it holds full before it starts again. */
const BAR_STEP = 2
const BAR_HOLD = 5

/**
 * Raster colors. Blits come without a theme, so these are mid-tones of the
 * palette's teal, amber and green that read on Mission Control's dark and
 * light grounds alike.
 */
const LIVE_HEX = {
  teal: 0x3fbfa9,
  amber: 0xf0a030,
  green: 0x6cb44c,
  track: 0x6b7268,
  clock: 0x8a9087,
} as const

const LEVELS = '▁▂▃▄▅▆▇█'

/** A deterministic number in [0, 1) for sample `k`. */
function noise(k: number): number {
  let h = Math.imul(k, 0x9e3779b1)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4_294_967_296
}

/** Sample `k` of the thinking signal, 0–7: two swells under a jagged jitter, like live telemetry. */
function sparkLevel(k: number): number {
  const v = 3.4 + 1.9 * Math.sin(k * 0.5) + 1.1 * Math.sin(k * 0.19 + 1.7) + (noise(k) - 0.5) * 3.6
  return Math.max(0, Math.min(LEVELS.length - 1, Math.round(v)))
}

/** The sparkline's bar heights for one frame, oldest left; it scrolls a bar every few ticks. */
export function sparkLevels(frame: number): number[] {
  const base = Math.floor(Math.max(0, frame) / SPARK_STEP)
  return Array.from({ length: TRACE_COLUMNS }, (_, x) => sparkLevel(base + x))
}

/** A deterministic bit for sample `k` of the transmission trace. */
function bit(k: number): boolean {
  return noise(k) >= 0.5
}

/** How many cells of the progress bar are filled: it fills, holds a moment, and starts again. */
export function barFill(frame: number): number {
  const step = Math.floor(Math.max(0, frame) / BAR_STEP) % (BAR_COLUMNS + BAR_HOLD)
  return Math.min(BAR_COLUMNS, step + 1)
}

type Mark = { char: string; tone: 'teal' | 'amber' | 'green' | 'track' }

/** The instrument for a mode and frame: sparkline, transmission trace, or progress bar. */
function marks(mode: LiveMode, frame: number): Mark[] {
  if (mode === 'running') {
    const w = barFill(frame)
    return Array.from({ length: BAR_COLUMNS }, (_, x) => (x < w ? { char: '█', tone: 'green' } : { char: '░', tone: 'track' }))
  }
  if (mode === 'writing') {
    // Two cells per bit, scrolling left a cell per tick; a half step marks each edge.
    return Array.from({ length: TRACE_COLUMNS }, (_, x) => {
      const k = Math.floor((x + frame) / 2)
      const high = bit(k)
      const edge = high !== bit(k - 1) && (x + frame) % 2 === 0
      return { char: edge ? '▄' : high ? '▆' : '▁', tone: 'teal' }
    })
  }
  const levels = sparkLevels(frame)
  const peak = Math.max(...levels)
  return levels.map(v => ({ char: LEVELS[v] ?? '▁', tone: v === peak ? 'amber' : 'teal' }))
}

/** The instrument's raster cells for one frame. */
export function traceCells(mode: LiveMode, frame: number): string {
  return encodeCells(marks(mode, frame).map((m): Cell => ({ char: m.char, fg: LIVE_HEX[m.tone] })))
}

export function clockCells(ms: number): string {
  return encodeCells([...tClock(ms)].map(char => ({ char, fg: LIVE_HEX.clock })))
}

function instrument(mode: LiveMode): { key: string; columns: number } {
  return mode === 'running' ? { key: 'cz-mission-bar', columns: BAR_COLUMNS } : { key: 'cz-mission-trace', columns: TRACE_COLUMNS }
}

/** The instrument and the mission clock. Words are plain text, so -inator words never change a raster's width. */
export function liveFrames(state: LiveState, frame: number): LiveFrame[] {
  return [
    { ...instrument(state.mode), cells: traceCells(state.mode, frame) },
    { key: 'cz-mission-clock', columns: CLOCK_COLUMNS, cells: clockCells(state.elapsedMs) },
  ]
}

function wordOf(state: LiveState, inator: boolean): string {
  if (state.mode === 'running') return (state.activity !== undefined ? STEP_TAGS[state.activity] : undefined) ?? LIVE_WORDS.running
  return inator && state.mode === 'thinking' ? 'SCHEME' : LIVE_WORDS[state.mode]
}

const TOKENS: Record<Mark['tone'], string> = { teal: C.teal, amber: C.amber, green: C.ok, track: C.faint }

/** The instrument as plain text, for the desktop. */
function instrumentText(ctx: Ctx, mode: LiveMode, frame: number): RenderElement {
  const runs: Mark[] = []
  for (const m of marks(mode, frame)) {
    const last = runs[runs.length - 1]
    if (last && last.tone === m.tone) last.char += m.char
    else runs.push({ ...m })
  }
  return ctx.els.Text({ children: runs.map(r => txt(ctx, TOKENS[r.tone], r.char)) })
}

/**
 * `◉ THINK ▂▃▅▆▇▅▃▂▁▂▃ … T+00:43` while thinking, `◉ EXEC npm test ████░░░ … T+00:43`
 * while a tool runs: lamp, word, instrument, and the mission clock at the right edge.
 */
export function live(state: LiveState, frame: number, ctx: Ctx): RenderElement {
  // The live line is always this turn's: it never fades.
  const flat = { ...ctx, fade: 0 as const }
  const els = ctx.els
  const inator = state.inator ?? ctx.settings.ingredients.inator
  const running = state.mode === 'running'
  const detail = printable(state.detail, 200)
  const lamp = txt(flat, C.teal, '◉')
  const word = txt(flat, C.teal, wordOf(state, inator))
  const terminal = ctx.surface === 'terminal' && 'Raster' in els
  const shape = instrument(state.mode)
  const scope = terminal ? els.Raster({ key: shape.key, columns: shape.columns, rows: 1, cells: traceCells(state.mode, frame) }) : instrumentText(flat, state.mode, frame)
  const clock = terminal ? els.Raster({ key: 'cz-mission-clock', columns: CLOCK_COLUMNS, rows: 1, cells: clockCells(state.elapsedMs) }) : txt(flat, C.dim, tClock(state.elapsedMs))
  // Running, the target sits before the bar; otherwise Claude Code's status (a retry, a backoff) fills the gap.
  const children = running
    ? [lamp, word, ...(detail === '' ? [] : [shrinks(flat, txt(flat, C.text, detail, { wrap: 'truncate-middle' }))]), scope, grow(flat, txt(flat, C.dim, '')), clock]
    : [lamp, word, scope, grow(flat, txt(flat, C.dim, detail, { wrap: 'truncate-end' })), clock]
  return els.Box({ flexDirection: 'row', columnGap: 1, children })
}
