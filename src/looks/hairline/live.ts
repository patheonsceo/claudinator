import type { RenderElement } from 'claude-code'

import { clockLabel, splitPath } from '../../engine/format'
import { LIVE } from '../../engine/palette'
import { encodeCells } from '../../engine/raster'
import type { Cell } from '../../engine/raster'
import type { Running } from '../../engine/session-model'
import { factsOf } from '../../engine/tool-facts'
import type { Ctx, LiveFrame, LiveMode, LiveState } from '../look'
import { C, grow, txt } from './style'

export const LIVE_WORDS: Record<LiveMode, string> = { thinking: 'Thinking', writing: 'Writing', running: 'Running' }

const CLOCK_COLUMNS = 5

export function liveStateOf(spinnerMode: string, running: Running | undefined, elapsedMs: number, cwd: string): LiveState {
  const mode: LiveMode = spinnerMode === 'responding' ? 'writing' : spinnerMode === 'tool-use' || spinnerMode === 'tool-input' ? 'running' : 'thinking'
  let detail = ''
  if (mode === 'running' && running) {
    const facts = factsOf(running.tool, running.input)
    const { dir, base } = facts.isPath ? splitPath(facts.target, cwd) : { dir: '', base: facts.target }
    detail = `${facts.verb} ${dir}${base}`.trim()
  }
  return { mode, detail, elapsedMs }
}

/** Three breathing dots, a space, then the word with a highlight sweeping across it. */
export function pulseCells(word: string, frame: number): string {
  const lit = Math.floor(frame / 3) % 3
  const cells: Cell[] = [0, 1, 2].map(i => ({ char: '•', fg: i === lit ? LIVE.ACCENT : LIVE.ACCENT_DIM }))
  cells.push({ char: ' ', fg: LIVE.GRAY })
  const center = (frame % (word.length + 8)) - 4
  for (let i = 0; i < word.length; i++) {
    cells.push({ char: word[i] ?? ' ', fg: Math.abs(i - center) <= 1 ? LIVE.DEFAULT : LIVE.GRAY })
  }
  return encodeCells(cells)
}

export function clockCells(ms: number): string {
  return encodeCells([...clockLabel(ms).padStart(CLOCK_COLUMNS)].map(char => ({ char, fg: LIVE.GRAY })))
}

export function liveFrames(state: LiveState, frame: number): LiveFrame[] {
  const word = LIVE_WORDS[state.mode]
  return [
    { key: 'cz-pulse', columns: 4 + word.length, cells: pulseCells(word, frame) },
    { key: 'cz-clock', columns: CLOCK_COLUMNS, cells: clockCells(state.elapsedMs) },
  ]
}

export function live(state: LiveState, frame: number, ctx: Ctx): RenderElement {
  const flat = { ...ctx, fade: 0 as const }
  const detail = grow(flat, txt(flat, C.dim, state.detail, { wrap: 'truncate-end' }))
  const els = ctx.els
  if ('Raster' in els) {
    const [pulse, clock] = liveFrames(state, frame)
    return els.Box({
      flexDirection: 'row',
      columnGap: 1,
      children: [
        els.Raster({ key: 'cz-pulse', columns: pulse?.columns ?? 1, rows: 1, cells: pulse?.cells ?? '' }),
        detail,
        els.Raster({ key: 'cz-clock', columns: CLOCK_COLUMNS, rows: 1, cells: clock?.cells ?? '' }),
      ],
    })
  }
  return els.Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [txt(flat, C.accent, '•••'), txt(flat, C.text, LIVE_WORDS[state.mode]), detail, txt(flat, C.dim, clockLabel(state.elapsedMs))],
  })
}
