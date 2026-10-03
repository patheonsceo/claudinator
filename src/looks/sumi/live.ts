import type { RenderElement } from 'claude-code'

import { clockLabel, printable } from '../../engine/format'
import { encodeCells } from '../../engine/raster'
import type { Ctx, LiveFrame, LiveMode, LiveState } from '../look'
import { C, ENSO, ENSO_STEP, GAP, INDENT, LIVE_INK, grow, spaced, txt, wash } from './style'

const WORDS: Record<LiveMode, string> = { thinking: 'thinking', writing: 'writing', running: 'running' }
const CLOCK_COLUMNS = 5
/** The running dot breathes from wash to indigo and back. */
const BREATH = [LIVE_INK.wash, LIVE_INK.mid, LIVE_INK.seal, LIVE_INK.mid] as const

function phase(frame: number, length: number): number {
  return Math.floor(Math.max(0, frame) / ENSO_STEP) % length
}

/** The live word, letter-spaced; -inator mode schemes instead of thinking (the same width). */
function wordOf(state: LiveState, ctx: Ctx | null): string {
  const inator = state.inator === true || (ctx?.settings.ingredients.inator ?? false)
  return spaced(inator && state.mode === 'thinking' ? 'scheming' : WORDS[state.mode])
}

/** One cell: the ensō while Claude thinks or writes, a breathing dot while a tool runs. */
export function markCells(mode: LiveMode, frame: number): string {
  if (mode === 'running') return encodeCells([{ char: '·', fg: BREATH[phase(frame, BREATH.length)] ?? LIVE_INK.wash }])
  return encodeCells([{ char: ENSO[phase(frame, ENSO.length)] ?? '◌', fg: LIVE_INK.seal }])
}

function clockCells(ms: number): string {
  return encodeCells([...clockLabel(ms).padStart(CLOCK_COLUMNS).slice(-CLOCK_COLUMNS)].map(char => ({ char, fg: LIVE_INK.wash })))
}

export function liveFrames(state: LiveState, frame: number): LiveFrame[] {
  return [
    { key: 'cz-enso', columns: 1, cells: markCells(state.mode, frame) },
    { key: 'cz-clock', columns: CLOCK_COLUMNS, cells: clockCells(state.elapsedMs) },
  ]
}

/** `◯  t h i n k i n g   detail   0:42`, indented, almost colorless. */
export function live(state: LiveState, frame: number, ctx: Ctx): RenderElement {
  const flat = { ...ctx, fade: 0 as const }
  const els = ctx.els
  const word = txt(flat, C.dim, wordOf(state, ctx))
  const detail = grow(flat, txt(flat, wash(flat), printable(state.detail, 200), { wrap: 'truncate-end' }))
  const row = (children: RenderElement[]): RenderElement => els.Box({ flexDirection: 'row', paddingLeft: INDENT, columnGap: GAP, children })
  if (ctx.surface === 'terminal' && 'Raster' in els) {
    const [mark, clock] = liveFrames(state, frame)
    return row([
      els.Raster({ key: 'cz-enso', columns: 1, rows: 1, cells: mark?.cells ?? '' }),
      els.Box({ flexShrink: 0, children: word }),
      detail,
      els.Raster({ key: 'cz-clock', columns: CLOCK_COLUMNS, rows: 1, cells: clock?.cells ?? '' }),
    ])
  }
  const mark = state.mode === 'running' ? txt(flat, C.dim, '·') : txt(flat, C.seal, ENSO[phase(frame, ENSO.length)] ?? '◌')
  return row([mark, els.Box({ flexShrink: 0, children: word }), detail, txt(flat, wash(flat), clockLabel(state.elapsedMs))])
}
