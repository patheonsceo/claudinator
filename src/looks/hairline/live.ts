import type { RenderElement } from 'claude-code'

import { clockLabel, printable, splitPath } from '../../engine/format'
import { LIVE } from '../../engine/palette'
import { encodeCells } from '../../engine/raster'
import type { Cell } from '../../engine/raster'
import type { Running } from '../../engine/session-model'
import { factsOf } from '../../engine/tool-facts'
import type { Ctx, LiveFrame, LiveMode, LiveState } from '../look'
import { INATOR_WORDS, inatorWord } from '../common'
import { C, txt } from './style'

export const LIVE_WORDS: Record<LiveMode, string> = { thinking: 'Thinking', writing: 'Writing', running: 'Running' }

const CLOCK_COLUMNS = 5

/** Cells in the dashed trace that runs beside the live line. */
export const TRACE_COLUMNS = 16
/** Cells in the accent segment sliding along the trace. */
const SEGMENT = 5
/** The trace's resting dashes: a mid gray that stays quiet on dark and light terminals. */
/** Resting dashes: faint against a dark background, and against a light one. */
const TRACE_FAINT = { dark: 0x4a4d5a, light: 0xc9ccd6 }

export function liveStateOf(spinnerMode: string, running: Running | undefined, elapsedMs: number, cwd: string, message: string | null = null): LiveState {
  const mode: LiveMode = spinnerMode === 'responding' ? 'writing' : spinnerMode === 'tool-use' || spinnerMode === 'tool-input' ? 'running' : 'thinking'
  let detail = ''
  let activity: string | undefined
  if (mode === 'running' && running) {
    const facts = factsOf(running.tool, running.input)
    const { dir, base } = facts.isPath ? splitPath(facts.target, cwd) : { dir: '', base: facts.target }
    // Ticking off a task is planning: the working bar below already names the task.
    detail = facts.glyph === 'plan' ? '' : `${dir}${base}`.trim()
    activity = facts.glyph === 'plan' ? 'Planning' : (ACTIVITIES[facts.verb] ?? 'Running')
  }
  // Claude Code's own status (a retry, a backoff, compacting) always wins over our detail.
  if (message) detail = printable(message, 200)
  return activity === undefined ? { mode, detail, elapsedMs } : { mode, detail, activity, elapsedMs }
}

/** The word for a running step, from its row's verb. */
const ACTIVITIES: Record<string, string> = {
  Read: 'Reading',
  Search: 'Searching',
  Find: 'Finding',
  List: 'Listing',
  Edit: 'Editing',
  Create: 'Writing',
  Write: 'Writing',
  Run: 'Running',
  Fetch: 'Fetching',
  Agent: 'Delegating',
  Todos: 'Planning',
}

function mix(a: number, b: number, t: number): number {
  const ch = (c: number, s: number): number => (c >> s) & 0xff
  return [16, 8, 0].reduce((out, s) => out | (Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s), 0)
}

/** Breath period of the dots, in frames (100 ms each). */
const BREATH = 14

/** Three dots breathing in a wave, a space, then the word with a highlight sweeping across it. */
export function pulseCells(word: string, frame: number): string {
  const cells: Cell[] = [0, 1, 2].map(i => {
    const level = 0.5 - 0.5 * Math.cos((2 * Math.PI * (frame - 2 * i)) / BREATH)
    return { char: '•', fg: mix(LIVE.ACCENT_DIM, LIVE.ACCENT, level) }
  })
  cells.push({ char: ' ', fg: LIVE.GRAY })
  const center = (frame % (word.length + 8)) - 4
  for (let i = 0; i < word.length; i++) {
    cells.push({ char: word[i] ?? ' ', fg: Math.abs(i - center) <= 1 ? LIVE.DEFAULT : LIVE.GRAY })
  }
  return encodeCells(cells)
}

/** Sixteen faint en dashes with a five-cell accent segment sliding left to right, then a short rest. */
export function traceCells(frame: number, isDark = true): Cell[] {
  const pos = ((frame % (TRACE_COLUMNS + SEGMENT + 1)) + TRACE_COLUMNS + SEGMENT + 1) % (TRACE_COLUMNS + SEGMENT + 1)
  const faint = isDark ? TRACE_FAINT.dark : TRACE_FAINT.light
  return Array.from({ length: TRACE_COLUMNS }, (_, i) => ({ char: '–', fg: i <= pos && i > pos - SEGMENT ? LIVE.ACCENT : faint }))
}

export function clockCells(ms: number): string {
  return encodeCells([...clockLabel(ms).padStart(CLOCK_COLUMNS).slice(-CLOCK_COLUMNS)].map(char => ({ char, fg: LIVE.GRAY })))
}

/** -inator words as wide as `Thinking`, so the terminal raster keeps its size while they change. */
const EIGHT_WIDE = INATOR_WORDS.filter(w => w.length === 'Thinking'.length)

function rasterWord(state: LiveState, frame: number): string {
  if (state.inator && state.mode === 'thinking') return EIGHT_WIDE[Math.floor(frame / 30) % EIGHT_WIDE.length] ?? 'Scheming'
  return LIVE_WORDS[state.mode]
}

/**
 * The live frames to blit. Thinking and writing animate their dots and word;
 * every state slides the trace and ticks the clock.
 */
export function liveFrames(state: LiveState, frame: number): LiveFrame[] {
  const trace = { key: 'cz-trace', columns: TRACE_COLUMNS, cells: encodeCells(traceCells(frame, state.isDark !== false)) }
  const clock = { key: 'cz-clock', columns: CLOCK_COLUMNS, cells: clockCells(state.elapsedMs) }
  if (state.mode === 'running') return [trace, clock]
  const word = rasterWord(state, frame)
  return [{ key: 'cz-pulse', columns: 4 + word.length, cells: pulseCells(word, frame) }, trace, clock]
}

/** Where the step is: `› Reading src/a.ts`, the verb said once. */
function stepParts(state: LiveState, ctx: Ctx): RenderElement[] {
  const flat = { ...ctx, fade: 0 as const }
  return [txt(flat, C.accent, '›'), txt(flat, C.dim, state.activity ?? LIVE_WORDS.running)]
}

/** The detail, shrinking first: `· tracing the lock…` while thinking, the bare target while running. */
function detailPart(state: LiveState, ctx: Ctx): RenderElement | null {
  if (state.detail === '') return null
  const flat = { ...ctx, fade: 0 as const }
  const text = state.mode === 'running' ? txt(flat, C.text, state.detail, { wrap: 'truncate-end' }) : txt(flat, C.dim, `· ${state.detail}`, { wrap: 'truncate-end' })
  return ctx.els.Box({ flexShrink: 1, minWidth: 0, children: text })
}

export function live(state: LiveState, frame: number, ctx: Ctx): RenderElement {
  const flat = { ...ctx, fade: 0 as const }
  const els = ctx.els
  const detail = detailPart(state, ctx)
  const spacer = els.Box({ flexGrow: 1 })
  if (ctx.surface === 'terminal' && 'Raster' in els) {
    const frames = liveFrames(state, frame)
    const raster = (f: LiveFrame): RenderElement => els.Box({ flexShrink: 0, children: els.Raster({ key: f.key, columns: f.columns, rows: 1, cells: f.cells }) })
    const [trace, clock] = frames.slice(-2)
    const pulse = state.mode === 'running' ? null : frames[0]
    const lead = pulse ? [raster(pulse)] : stepParts(state, ctx)
    return els.Box({
      flexDirection: 'row',
      columnGap: 1,
      children: [...lead, ...(detail ? [detail] : []), ...(trace ? [raster(trace)] : []), spacer, ...(clock ? [raster(clock)] : [])],
    })
  }
  const word = state.mode === 'running' ? null : ctx.settings.ingredients.inator && state.mode === 'thinking' ? inatorWord(frame) : LIVE_WORDS[state.mode]
  const lead = word === null ? stepParts(state, ctx) : [txt(flat, C.accent, '•••'), txt(flat, C.text, word)]
  return els.Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [...lead, ...(detail ? [detail] : []), spacer, txt(flat, C.dim, clockLabel(state.elapsedMs))],
  })
}
