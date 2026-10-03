import type { RenderElement } from 'claude-code'

import { printable } from '../../engine/format'
import { encodeCells } from '../../engine/raster'
import type { Cell } from '../../engine/raster'
import { inatorWord } from '../common'
import type { Ctx, LiveFrame, LiveMode, LiveState } from '../look'
import { C, grow, tClock, txt } from './style'

export { tClock } from './style'

export const LIVE_WORDS: Record<LiveMode, string> = { thinking: 'THINK', writing: 'XMIT', running: 'EXEC' }

/** Width of the oscilloscope, the transmission trace and the progress sweep. */
export const SCOPE_COLUMNS = 22
const CLOCK_COLUMNS = 7

/**
 * Raster colors. Blits come without a theme, so these are mid-tones that read
 * on Mission Control's dark and light grounds alike.
 */
const LIVE_HEX = {
  amber: 0xf0a030,
  amberTail: [0xf0a030, 0xd28a2a, 0xae7428, 0x8a6030],
  teal: 0x3fbfa9,
  tealOld: 0x4f7d75,
  track: 0x5e655c,
  clock: 0x8a9087,
} as const

const LEVELS = '▁▂▃▄▅▆▇█'

function mix(a: number, b: number, t: number): number {
  const ch = (shift: number): number => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t)
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

/** Phosphor: the oldest samples (left) glow less than the newest (right). */
function phosphor(x: number): number {
  return mix(LIVE_HEX.tealOld, LIVE_HEX.teal, x / (SCOPE_COLUMNS - 1))
}

function level(v: number): string {
  const i = Math.max(0, Math.min(LEVELS.length - 1, Math.round(((v + 1) / 2) * (LEVELS.length - 1))))
  return LEVELS[i] ?? '▁'
}

/** A deterministic bit for sample `k` of the transmission trace. */
function bit(k: number): boolean {
  let h = Math.imul(k ^ 0x5bd1e995, 0x27d4eb2d) >>> 0
  h ^= h >>> 15
  return (h & 4) !== 0
}

/** One cell of the instrument: an analog trace, a data stream, or a sweep. */
function sample(mode: LiveMode, x: number, frame: number): Cell {
  if (mode === 'thinking') {
    // A sum of three sines, scrolling left half a cell per frame.
    const t = x + frame * 0.5
    const v = 0.55 * Math.sin(t * 0.52) + 0.3 * Math.sin(t * 0.21 + 1.3) + 0.15 * Math.sin(t * 1.7 + 0.4)
    return { char: level(v), fg: phosphor(x) }
  }
  if (mode === 'writing') {
    // Two cells per bit, scrolling left a cell per frame; a half step marks each edge.
    const k = Math.floor((x + frame) / 2)
    const high = bit(k)
    const edge = high !== bit(k - 1) && (x + frame) % 2 === 0
    return { char: edge ? '▄' : high ? '▆' : '▁', fg: phosphor(x) }
  }
  // A head and a three-cell tail sweeping across a faint track.
  const d = (frame % (SCOPE_COLUMNS + 6)) - 2 - x
  const tail = LIVE_HEX.amberTail[d]
  return d >= 0 && tail !== undefined ? { char: '▰', fg: tail } : { char: '▱', fg: LIVE_HEX.track }
}

function samples(mode: LiveMode, frame: number): Cell[] {
  return Array.from({ length: SCOPE_COLUMNS }, (_, x) => sample(mode, x, frame))
}

/** The instrument's cells for one frame. */
export function scopeCells(mode: LiveMode, frame: number): string {
  return encodeCells(samples(mode, frame))
}

/** The record lamp, blinking about once a second. */
export function lampCells(frame: number): string {
  return encodeCells([{ char: Math.floor(frame / 5) % 2 === 0 ? '◉' : '○', fg: LIVE_HEX.amber }])
}

export function clockCells(ms: number): string {
  return encodeCells([...tClock(ms)].map(char => ({ char, fg: LIVE_HEX.clock })))
}

/** Lamp, instrument and mission clock. The word is plain text, so -inator words never change a raster's width. */
export function liveFrames(state: LiveState, frame: number): LiveFrame[] {
  return [
    { key: 'cz-mission-lamp', columns: 1, cells: lampCells(frame) },
    { key: 'cz-mission-scope', columns: SCOPE_COLUMNS, cells: scopeCells(state.mode, frame) },
    { key: 'cz-mission-clock', columns: CLOCK_COLUMNS, cells: clockCells(state.elapsedMs) },
  ]
}

function wordOf(state: LiveState, frame: number, inator: boolean): string {
  return inator && state.mode === 'thinking' ? inatorWord(frame).toUpperCase() : LIVE_WORDS[state.mode].padEnd(5)
}

export function live(state: LiveState, frame: number, ctx: Ctx): RenderElement {
  // The live line is always this turn's: it never fades.
  const flat = { ...ctx, fade: 0 as const }
  const els = ctx.els
  const inator = state.inator ?? ctx.settings.ingredients.inator
  const word = txt(flat, C.amber, wordOf(state, frame, inator), { bold: true })
  const detail = grow(flat, txt(flat, C.dim, printable(state.detail, 200), { wrap: 'truncate-end' }))
  if (ctx.surface === 'terminal' && 'Raster' in els) {
    const [lamp, scope, clock] = liveFrames(state, frame)
    const raster = (f: LiveFrame | undefined, key: string, columns: number): RenderElement => els.Raster({ key, columns, rows: 1, cells: f?.cells ?? '' })
    return els.Box({
      flexDirection: 'row',
      columnGap: 1,
      children: [
        raster(lamp, 'cz-mission-lamp', 1),
        word,
        raster(scope, 'cz-mission-scope', SCOPE_COLUMNS),
        detail,
        raster(clock, 'cz-mission-clock', CLOCK_COLUMNS),
      ],
    })
  }
  return els.Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [txt(flat, C.amber, '◉'), word, txt(flat, state.mode === 'running' ? C.amber : C.teal, samples(state.mode, frame).map(c => c.char).join('')), detail, txt(flat, C.dim, tClock(state.elapsedMs))],
  })
}
