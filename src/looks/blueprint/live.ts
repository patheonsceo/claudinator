import type { RenderElement } from 'claude-code'

import { clockLabel, printable } from '../../engine/format'
import { LIVE } from '../../engine/palette'
import { encodeCells } from '../../engine/raster'
import type { Cell } from '../../engine/raster'
import type { Ctx, LiveFrame, LiveMode, LiveState } from '../look'
import { C, txt } from './style'

/**
 * Raster colors. Blits carry no theme, so each reads on the dark blueprint
 * and on paper alike: the pen tip and jaws take the terminal's own
 * foreground, the drawn line a mid cyan, the clock a mid blue-gray.
 */
export const INK = {
  TIP: LIVE.DEFAULT,
  LINE: 0x3d9fd8,
  GUIDE: 0x5f86b8,
  CLOCK: 0x7d95b5,
} as const

/** The pen's sheet: a fixed width it draws across, then starts over. */
export const PEN_COLUMNS = 28
/** Frames the finished line holds, end mark on, before the next stroke. */
const PEN_HOLD = 6
/** The calipers' slot, and how wide their jaws open. */
export const CALIPER_COLUMNS = 12
const CALIPER_OPEN = CALIPER_COLUMNS - 2
const CLOCK_COLUMNS = 5

const WORDS: Record<LiveMode, string> = { thinking: 'DRAFTING', writing: 'ANNOTATING', running: 'MEASURING' }
const INATOR_WORDS: Record<LiveMode, string> = { thinking: 'SCHEMING', writing: 'MONOLOGUING', running: 'MEASURING' }

export function wordOf(mode: LiveMode, inator: boolean): string {
  return (inator ? INATOR_WORDS : WORDS)[mode]
}

/**
 * A pen drawing a dimension line: `├───────╴`, the tip leading, then the
 * finished line `├──────────┤` held a moment. Writing draws a dashed leader.
 */
export function penCells(frame: number, stroke: '─' | '┄'): string {
  const step = ((frame % (PEN_COLUMNS + PEN_HOLD)) + PEN_COLUMNS + PEN_HOLD) % (PEN_COLUMNS + PEN_HOLD)
  const cells: Cell[] = []
  for (let i = 0; i < PEN_COLUMNS; i++) {
    if (step >= PEN_COLUMNS) {
      // Done: the whole line with both ends marked.
      const char = i === 0 ? '├' : i === PEN_COLUMNS - 1 ? '┤' : stroke
      cells.push({ char, fg: i === 0 || i === PEN_COLUMNS - 1 ? INK.TIP : INK.LINE })
    } else if (i === 0) cells.push({ char: '├', fg: INK.TIP })
    else if (i < step) cells.push({ char: stroke, fg: INK.LINE })
    else if (i === step) cells.push({ char: '╴', fg: INK.TIP })
    else cells.push({ char: ' ', fg: INK.GUIDE })
  }
  return encodeCells(cells)
}

/** Calipers `├────┤` opening and closing in a fixed slot. */
export function caliperCells(frame: number): string {
  const period = CALIPER_OPEN * 2
  const t = ((frame % period) + period) % period
  const inner = t <= CALIPER_OPEN ? t : period - t
  const span = inner + 2
  const left = Math.floor((CALIPER_COLUMNS - span) / 2)
  const cells: Cell[] = []
  for (let i = 0; i < CALIPER_COLUMNS; i++) {
    if (i === left) cells.push({ char: '├', fg: INK.TIP })
    else if (i === left + span - 1) cells.push({ char: '┤', fg: INK.TIP })
    else if (i > left && i < left + span - 1) cells.push({ char: '─', fg: INK.LINE })
    else cells.push({ char: ' ', fg: INK.GUIDE })
  }
  return encodeCells(cells)
}

export function clockCells(ms: number): string {
  return encodeCells([...clockLabel(ms).padStart(CLOCK_COLUMNS).slice(-CLOCK_COLUMNS)].map(char => ({ char, fg: INK.CLOCK })))
}

export function liveFrames(state: LiveState, frame: number): LiveFrame[] {
  const instrument: LiveFrame =
    state.mode === 'running'
      ? { key: 'bp-calipers', columns: CALIPER_COLUMNS, cells: caliperCells(frame) }
      : { key: 'bp-pen', columns: PEN_COLUMNS, cells: penCells(frame, state.mode === 'writing' ? '┄' : '─') }
  return [instrument, { key: 'bp-clock', columns: CLOCK_COLUMNS, cells: clockCells(state.elapsedMs) }]
}

/**
 * `◎ DRAFTING ├──────────╴           0:12`: the mode in capitals, the pen or
 * the calipers, what is being measured, and the clock on the right.
 */
export function live(state: LiveState, frame: number, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  const flat = { ...ctx, fade: 0 as const }
  const inator = state.inator === true || ctx.settings.ingredients.inator
  const word = wordOf(state.mode, inator)
  const label = Box({ flexDirection: 'row', flexShrink: 0, children: [txt(flat, C.cyan, '◎ ', { bold: true }), txt(flat, C.ink, word, { bold: true })] })
  const detail = Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, children: txt(flat, C.dim, printable(state.detail, 200), { wrap: 'truncate-end' }) })
  const els = ctx.els
  if (ctx.surface === 'terminal' && 'Raster' in els) {
    const raster = (f: LiveFrame): RenderElement => els.Raster({ key: f.key, columns: f.columns, rows: 1, cells: f.cells })
    const [instrument, clock] = liveFrames(state, frame)
    return Box({
      flexDirection: 'row',
      columnGap: 1,
      children: [label, ...(instrument ? [raster(instrument)] : []), detail, ...(clock ? [raster(clock)] : [])],
    })
  }
  return Box({ flexDirection: 'row', columnGap: 1, children: [label, detail, txt(flat, C.dim, clockLabel(state.elapsedMs))] })
}
