import type { RenderElement } from 'claude-code'

import { clockLabel, printable } from '../../engine/format'
import { LIVE } from '../../engine/palette'
import { encodeCells } from '../../engine/raster'
import type { Cell } from '../../engine/raster'
import type { Ctx, LiveFrame, LiveState } from '../look'
import { C, fixed, grow, it, txt } from './style'

/** What a careful writer might be weighing. Each types out after the pen, as in the lookbook. */
export const THINKING = ['considering the shape of the problem', 'considering a cleaner way through', 'considering what could go wrong', 'considering the next step']

/** The same, for an evil genius. */
export const INATOR_THINKING = ['considering a grander scheme', 'monologuing about the master plan', 'scheming a cleaner way in', 'plotting the next move']

export const WRITING = 'setting the reply in type'

/** The pen that leads the live line, in the accent: the writer at work. */
export const PEN = '✎'

/**
 * The typewriter raster is this wide in every mode and every frame, so the
 * clock never moves: the longest phrase and its caret, with room for a
 * running step's target.
 */
export const TYPE_COLUMNS = 46
const CLOCK_COLUMNS = 5

/** Ink, brass and a fainter ink for the clock, chosen to read on a dark page and a light one alike. */
const INK = 0x8c8374
const BRASS = 0xc9973c
const CLOCK_INK = 0x6b6458
const CARET = '▌'

/** Frames each phrase owns (about 7 s at the host's 100 ms tick) and letters typed per frame, as the lookbook paces it. */
const CYCLE = 70
const WRITING_CYCLE = 120
const LETTERS_PER_FRAME = 1.4

/** True on the lit half of the caret's blink (half a second on, half off). */
function blinkOn(frame: number): boolean {
  return Math.floor(frame / 5) % 2 === 0
}

/** A sentence from Claude Code itself ("Retrying in 3s") rather than a path or a command. */
function isSentence(text: string): boolean {
  return /^[A-Z][a-z]+ [a-z0-9]/.test(text)
}

/**
 * A running step in the narrator's voice, naming the step once:
 * `Reading` + `src/cart.js` → `reading src/cart.js`.
 */
export function runningText(state: Pick<LiveState, 'detail' | 'activity'>): string {
  const clean = printable(state.detail, 200).trim()
  // Claude Code's own status (a retry, a backoff) is already a sentence: it replaces the step's word.
  if (isSentence(clean)) return clean.charAt(0).toLowerCase() + clean.slice(1)
  const verb = printable(state.activity ?? '', 40).trim().toLowerCase()
  if (verb !== '') return clean === '' ? verb : `${verb} ${clean}`
  return clean === '' ? 'at work' : `running ${clean}`
}

/** Characters a raster can hold: single-width and in the BMP. Anything else becomes `?`. */
function rasterSafe(text: string): string {
  return [...text]
    .map(ch => {
      const cp = ch.codePointAt(0) ?? 63
      const ok = (cp >= 0x20 && cp < 0x7f) || (cp >= 0xa0 && cp < 0x0300) || (cp >= 0x0370 && cp < 0x1100) || (cp >= 0x1160 && cp < 0x2e80)
      return ok ? ch : '?'
    })
    .join('')
}

/** A phrase cut to fit beside the caret, with a trailing ellipsis when asked for or when cut. */
function fit(text: string, trailing: boolean): string {
  const full = rasterSafe(text) + (trailing ? '…' : '')
  return full.length <= TYPE_COLUMNS - 1 ? full : full.slice(0, TYPE_COLUMNS - 2) + '…'
}

export type Typed = { text: string; struck: boolean; caretOn: boolean }

/**
 * Where the typewriter is at `frame` while it cycles through `phrases`: each
 * phrase types out letter by letter behind a solid caret, rests with the caret
 * blinking, then gives way to the next, which starts over from its first letter.
 */
export function typewriter(phrases: string[], frame: number, cycle = CYCLE): Typed {
  const f = Math.max(0, Math.floor(frame))
  const phrase = fit(phrases[Math.floor(f / cycle) % phrases.length] ?? '', false)
  const typed = Math.min(phrase.length, Math.floor(((f % cycle) + 1) * LETTERS_PER_FRAME))
  const isTyping = typed < phrase.length
  return { text: phrase.slice(0, typed), struck: isTyping, caretOn: isTyping || blinkOn(f) }
}

/** What the typewriter shows for a state at a frame. A running step is set whole, with no caret. */
export function typedOf(state: LiveState, frame: number): Typed {
  if (state.mode === 'running') return { text: fit(runningText(state), true), struck: false, caretOn: false }
  if (state.mode === 'writing') return typewriter([WRITING], frame, WRITING_CYCLE)
  return typewriter(state.inator ? INATOR_THINKING : THINKING, frame)
}

export function typeCells(typed: Typed): string {
  // The letter just struck is in full ink, the rest in the dim ink of the narration.
  const cells: Cell[] = [...typed.text].map((char, i, all) => ({ char, fg: typed.struck && i === all.length - 1 ? LIVE.DEFAULT : INK }))
  cells.push({ char: typed.caretOn ? CARET : ' ', fg: BRASS })
  while (cells.length < TYPE_COLUMNS) cells.push({ char: ' ', fg: INK })
  return encodeCells(cells.slice(0, TYPE_COLUMNS))
}

export function clockCells(ms: number): string {
  return encodeCells([...clockLabel(ms).padStart(CLOCK_COLUMNS).slice(-CLOCK_COLUMNS)].map(char => ({ char, fg: CLOCK_INK })))
}

export function liveFrames(state: LiveState, frame: number): LiveFrame[] {
  return [
    { key: 'cz-type', columns: TYPE_COLUMNS, cells: typeCells(typedOf(state, frame)) },
    { key: 'cz-clock', columns: CLOCK_COLUMNS, cells: clockCells(state.elapsedMs) },
  ]
}

/** The phrase for surfaces without rasters: whole, changing with each cycle. */
function plainPhrase(state: LiveState, isInator: boolean, frame: number): string {
  if (state.mode === 'running') return runningText(state) + '…'
  if (state.mode === 'writing') return WRITING
  const list = isInator ? INATOR_THINKING : THINKING
  return list[Math.floor(Math.max(0, frame) / CYCLE) % list.length] ?? 'considering'
}

/** `✎ considering a cleaner way through ▌`, the clock at the right. */
export function live(state: LiveState, frame: number, ctx: Ctx): RenderElement {
  const flat = { ...ctx, fade: 0 as const }
  const els = ctx.els
  const pen = fixed(flat, txt(flat, C.accent, PEN))
  if (ctx.surface === 'terminal' && 'Raster' in els) {
    // The blits that follow draw from `state` alone, so the first frame does too.
    const [type, clock] = liveFrames(state, frame)
    return els.Box({
      flexDirection: 'row',
      columnGap: 1,
      children: [
        pen,
        els.Raster({ key: 'cz-type', columns: TYPE_COLUMNS, rows: 1, cells: type?.cells ?? '' }),
        els.Box({ flexGrow: 1, flexShrink: 1, minWidth: 0 }),
        els.Raster({ key: 'cz-clock', columns: CLOCK_COLUMNS, rows: 1, cells: clock?.cells ?? '' }),
      ],
    })
  }
  const isInator = state.inator ?? ctx.settings.ingredients.inator
  return els.Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [pen, grow(flat, it(flat, C.dim, plainPhrase(state, isInator, frame), { wrap: 'truncate-end' })), fixed(flat, txt(flat, C.dim, clockLabel(state.elapsedMs)))],
  })
}
