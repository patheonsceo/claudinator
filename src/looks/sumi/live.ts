import type { RenderElement } from 'claude-code'

import { clockLabel, printable } from '../../engine/format'
import { encodeCells } from '../../engine/raster'
import type { Cell } from '../../engine/raster'
import type { Ctx, LiveFrame, LiveMode, LiveState } from '../look'
import { APART, C, GAP, INDENT, LIVE_INK, grow, spaced, txt, wash } from './style'

const WORDS: Record<LiveMode, string> = { thinking: 'thinking', writing: 'writing', running: 'running' }
const CLOCK_COLUMNS = 5

type Ink = keyof typeof LIVE_INK
type Stroke = { char: string; ink: Ink }

function hold(char: string, ink: Ink, ticks: number): Stroke[] {
  return Array.from({ length: ticks }, () => ({ char, ink }))
}

/**
 * The ensō drawing itself, one entry per tick of the live line (100 ms): the
 * brush touches down, sweeps a quarter and a half, closes the circle and holds
 * it, then the ink dries back to paper and the stroke begins again. Three
 * seconds a circle.
 */
export const ENSO_STROKE: readonly Stroke[] = [
  ...hold('·', 'seal', 2),
  ...hold('◜', 'seal', 2),
  ...hold('◠', 'seal', 2),
  ...hold('○', 'seal', 2),
  ...hold('◯', 'seal', 10),
  ...hold('◯', 'mid', 4),
  ...hold('○', 'wash', 4),
  ...hold('◌', 'wash', 4),
]

/** The ensō's cell at a frame, looping. */
export function ensoAt(frame: number): Cell {
  const step = ENSO_STROKE[Math.max(0, Math.floor(frame)) % ENSO_STROKE.length] ?? { char: '○', ink: 'seal' }
  return { char: step.char, fg: LIVE_INK[step.ink] }
}

/** The one word, letter-spaced: the step's activity while a tool runs (`r e a d i n g`), -inator mode schemes instead of thinking. */
function wordOf(state: LiveState, ctx: Ctx | null): string {
  const inator = state.inator === true || (ctx?.settings.ingredients.inator ?? false)
  if (inator && state.mode === 'thinking') return spaced('scheming')
  const activity = state.mode === 'running' && state.activity ? printable(state.activity, 24).toLowerCase() : ''
  return spaced(activity === '' ? WORDS[state.mode] : activity)
}

function clockCells(ms: number): string {
  return encodeCells([...clockLabel(ms).padStart(CLOCK_COLUMNS).slice(-CLOCK_COLUMNS)].map(char => ({ char, fg: LIVE_INK.wash })))
}

export function liveFrames(state: LiveState, frame: number): LiveFrame[] {
  return [
    { key: 'cz-enso', columns: 1, cells: encodeCells([ensoAt(frame)]) },
    { key: 'cz-clock', columns: CLOCK_COLUMNS, cells: clockCells(state.elapsedMs) },
  ]
}

/**
 * `○ t h i n k i n g                 0:42` on the row's indent: the ensō a space
 * from one word set wide, the step's target faint after it, the clock at the
 * right. The desktop gets the closed circle, still.
 */
export function live(state: LiveState, frame: number, ctx: Ctx): RenderElement {
  const flat = { ...ctx, fade: 0 as const }
  const els = ctx.els
  const word = els.Box({ flexShrink: 0, children: txt(flat, C.dim, wordOf(state, ctx)) })
  const target = printable(state.detail, 200)
  const detail = grow(flat, els.Box({ paddingLeft: APART, children: txt(flat, wash(flat), target, { wrap: 'truncate-end' }) }))
  const row = (children: RenderElement[]): RenderElement => els.Box({ flexDirection: 'row', paddingLeft: INDENT, columnGap: GAP, children })
  if (ctx.surface === 'terminal' && 'Raster' in els) {
    const [mark, clock] = liveFrames(state, frame)
    return row([
      els.Raster({ key: 'cz-enso', columns: 1, rows: 1, cells: mark?.cells ?? '' }),
      word,
      detail,
      els.Raster({ key: 'cz-clock', columns: CLOCK_COLUMNS, rows: 1, cells: clock?.cells ?? '' }),
    ])
  }
  return row([txt(flat, C.seal, '○'), word, detail, els.Box({ flexShrink: 0, children: txt(flat, wash(flat), clockLabel(state.elapsedMs)) })])
}
