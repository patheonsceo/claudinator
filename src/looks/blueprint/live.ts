import type { RenderElement } from 'claude-code'

import { clockLabel, printable } from '../../engine/format'
import { LIVE } from '../../engine/palette'
import { encodeCells } from '../../engine/raster'
import type { Cell } from '../../engine/raster'
import type { Ctx, LiveFrame, LiveMode, LiveState } from '../look'
import { C, txt } from './style'

/**
 * Raster colors. Blits carry no theme, so each reads on the dark blueprint
 * and on paper alike: the pen tip takes the terminal's own foreground, the
 * drawn line and the calipers a mid cyan, the clock a mid blue-gray.
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
/** The calipers' slot: the left tick, up to 14 cells of dimension, the right tick. */
export const CALIPER_COLUMNS = 16
const CALIPER_SPAN = CALIPER_COLUMNS - 2
const CLOCK_COLUMNS = 5

const WORDS: Record<LiveMode, string> = { thinking: 'DRAFTING', writing: 'ANNOTATING', running: 'MEASURING' }
const INATOR_WORDS: Record<LiveMode, string> = { thinking: 'SCHEMING', writing: 'MONOLOGUING', running: 'MEASURING' }

export function wordOf(mode: LiveMode, inator: boolean): string {
  return (inator ? INATOR_WORDS : WORDS)[mode]
}

/** Drafting draws a solid line; annotating a dashed leader of en dashes. */
function strokeOf(mode: LiveMode): string {
  return mode === 'writing' ? '–' : '─'
}

function wrap(frame: number, period: number): number {
  return ((frame % period) + period) % period
}

/**
 * A pen drawing a dimension line: `├───────╴`, the tip leading, then the
 * finished line `├──────────┤` held a moment before the next stroke.
 */
export function penChars(frame: number, mode: LiveMode): string {
  const step = wrap(frame, PEN_COLUMNS + PEN_HOLD)
  const stroke = strokeOf(mode)
  let out = ''
  for (let i = 0; i < PEN_COLUMNS; i++) {
    if (i === 0) out += '├'
    else if (step >= PEN_COLUMNS) out += i === PEN_COLUMNS - 1 ? '┤' : stroke
    else if (i < step) out += stroke
    else if (i === step) out += '╴'
    else out += ' '
  }
  return out
}

function penCells(frame: number, mode: LiveMode): string {
  const chars = [...penChars(frame, mode)]
  return encodeCells(chars.map((char, i) => ({ char, fg: i === 0 || char === '╴' || char === '┤' ? INK.TIP : INK.LINE })))
}

/**
 * Calipers measuring: the left tick holds while the dimension between the
 * ticks grows to the full slot and shrinks back, one cell a frame.
 * `├┤`, `├─┤`, `├──┤` … `├──────────────┤` … `├┤`.
 */
export function caliperChars(frame: number): string {
  const t = wrap(frame, CALIPER_SPAN * 2)
  const inner = t <= CALIPER_SPAN ? t : CALIPER_SPAN * 2 - t
  return ('├' + '─'.repeat(inner) + '┤').padEnd(CALIPER_COLUMNS, ' ')
}

function caliperCells(frame: number): string {
  return encodeCells([...caliperChars(frame)].map((char): Cell => ({ char, fg: char === ' ' ? INK.GUIDE : INK.LINE })))
}

function clockCells(ms: number): string {
  return encodeCells([...clockLabel(ms).padStart(CLOCK_COLUMNS).slice(-CLOCK_COLUMNS)].map(char => ({ char, fg: INK.CLOCK })))
}

export function liveFrames(state: LiveState, frame: number): LiveFrame[] {
  const instrument: LiveFrame =
    state.mode === 'running'
      ? { key: 'bp-calipers', columns: CALIPER_COLUMNS, cells: caliperCells(frame) }
      : { key: 'bp-pen', columns: PEN_COLUMNS, cells: penCells(frame, state.mode) }
  return [instrument, { key: 'bp-clock', columns: CLOCK_COLUMNS, cells: clockCells(state.elapsedMs) }]
}

/** What the desktop shows in the instrument's place: one still drawing. */
function stillInstrument(mode: LiveMode): string {
  return mode === 'running' ? '├────┤' : '├' + strokeOf(mode).repeat(8) + '╴'
}

/**
 * The step being drawn, the lookbook's way:
 *
 *   ◎ DRAFTING ├──────────╴                                   0:12
 *   ◎ MEASURING pnpm test auth ├─────┤                        0:14
 *
 * Running names what is measured (dim) before the calipers; the clock sits
 * on the right.
 */
export function live(state: LiveState, frame: number, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  const flat = { ...ctx, fade: 0 as const }
  const inator = state.inator === true || ctx.settings.ingredients.inator
  const word = wordOf(state.mode, inator)
  const fixed = (children: RenderElement | RenderElement[]): RenderElement => Box({ flexDirection: 'row', flexShrink: 0, children })
  const space = (): RenderElement => fixed(txt(flat, C.faint, ' '))

  const label = fixed([txt(flat, C.cyan, '◎ '), txt(flat, C.cyan, word)])
  const detailText = printable(state.detail, 200)
  const detail =
    detailText === '' ? [] : [space(), Box({ flexShrink: 1, minWidth: 0, children: txt(flat, C.dim, detailText, { wrap: 'truncate-end' }) })]
  const spacer = Box({ flexGrow: 1, flexShrink: 1, minWidth: 1 })
  const running = state.mode === 'running'

  const els = ctx.els
  let instrument: RenderElement
  let clock: RenderElement
  if (ctx.surface === 'terminal' && 'Raster' in els) {
    const raster = (f: LiveFrame): RenderElement => els.Raster({ key: f.key, columns: f.columns, rows: 1, cells: f.cells })
    const [tool, time] = liveFrames(state, frame)
    instrument = tool ? raster(tool) : txt(flat, C.cyan, stillInstrument(state.mode))
    clock = time ? raster(time) : txt(flat, C.dim, clockLabel(state.elapsedMs))
  } else {
    instrument = txt(flat, C.cyan, stillInstrument(state.mode))
    clock = txt(flat, C.dim, clockLabel(state.elapsedMs))
  }

  // Running reads target-then-calipers; the pen draws first and any note follows it.
  const middle = running ? [...detail, space(), instrument] : [space(), instrument, ...detail]
  return Box({ flexDirection: 'row', children: [label, ...middle, spacer, clock] })
}
