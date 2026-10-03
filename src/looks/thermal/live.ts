import type { RenderElement } from 'claude-code'

import { clockLabel, printable } from '../../engine/format'
import { LIVE } from '../../engine/palette'
import { encodeCells } from '../../engine/raster'
import type { Ctx, LiveFrame, LiveState } from '../look'
import { C, fixed, give, line, paperOf, txt, upper } from './style'

/** Columns of paper feeding out of the printer. */
const FEED_COLUMNS = 8
const CLOCK_COLUMNS = 5

/** What the printer says it is doing. -inator mode schemes instead of printing. */
export function wordOf(state: LiveState, isInator: boolean): string {
  if (state.mode === 'running') return 'RUNNING'
  if (state.mode === 'writing') return 'PRINTING REPLY'
  return isInator ? 'SCHEMING' : 'PRINTING'
}

/**
 * Paper feeding past the print head: bands of `▒` and `░` marching right, one
 * cell a frame. The heavier band is the terminal's own ink, the lighter a
 * mid gray, so it reads on dark and light paper alike.
 */
export function feedCells(frame: number): string {
  const cells = []
  for (let i = 0; i < FEED_COLUMNS; i++) {
    const heavy = (((i - frame) % 4) + 4) % 4 < 2
    cells.push({ char: heavy ? '▒' : '░', fg: heavy ? LIVE.DEFAULT : LIVE.GRAY })
  }
  return encodeCells(cells)
}

export function clockCells(ms: number): string {
  return encodeCells([...clockLabel(ms).padStart(CLOCK_COLUMNS)].map(char => ({ char, fg: LIVE.GRAY })))
}

export function liveFrames(state: LiveState, frame: number): LiveFrame[] {
  return [
    { key: 'cz-thermal-feed', columns: FEED_COLUMNS, cells: feedCells(frame) },
    { key: 'cz-thermal-clock', columns: CLOCK_COLUMNS, cells: clockCells(state.elapsedMs) },
  ]
}

export function live(state: LiveState, frame: number, ctx: Ctx): RenderElement {
  const els = ctx.els
  const word = wordOf(state, state.inator === true || ctx.settings.ingredients.inator)
  const detail = state.detail === '' ? '' : ' ' + upper(printable(state.detail, 200))
  const status = give(ctx, els.Text({ wrap: 'truncate-end', children: [txt(ctx, C.ink, word, { bold: true }), txt(ctx, C.dim, detail)] }))
  const spacer = els.Box({ flexGrow: 1, flexShrink: 1, minWidth: 0 })
  if (ctx.surface === 'terminal' && 'Raster' in els) {
    const [feed, clock] = liveFrames(state, frame)
    return line(ctx, paperOf(ctx), [
      fixed(ctx, els.Raster({ key: 'cz-thermal-feed', columns: FEED_COLUMNS, rows: 1, cells: feed?.cells ?? '' })),
      els.Box({ flexShrink: 1, minWidth: 0, marginLeft: 1, children: status }),
      spacer,
      fixed(ctx, els.Raster({ key: 'cz-thermal-clock', columns: CLOCK_COLUMNS, rows: 1, cells: clock?.cells ?? '' }), { marginLeft: 1 }),
    ])
  }
  return line(ctx, paperOf(ctx), [
    fixed(ctx, txt(ctx, C.dim, '▒▒░░▒▒░░')),
    els.Box({ flexShrink: 1, minWidth: 0, marginLeft: 1, children: status }),
    spacer,
    fixed(ctx, txt(ctx, C.dim, clockLabel(state.elapsedMs)), { marginLeft: 1 }),
  ])
}
