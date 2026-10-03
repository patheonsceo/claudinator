import type { RenderElement } from 'claude-code'

import { clockLabel, printable } from '../../engine/format'
import { LIVE } from '../../engine/palette'
import { encodeCells } from '../../engine/raster'
import type { Cell } from '../../engine/raster'
import type { Ctx, LiveFrame, LiveState } from '../look'
import { C, fixed, grow, it, txt } from './style'

/** Calm things a careful writer might be doing. */
export const THINKING = ['considering the shape of the problem', 'turning it over once more', 'weighing a cleaner approach', 'choosing the right words']

/** The same, for an evil genius. */
export const INATOR_THINKING = ['monologuing about the lock', 'scheming a cleaner retry', 'plotting the next move', 'sketching the master plan']

export const WRITING = 'setting the reply in type'

/**
 * The typewriter raster is this wide in every mode and every frame, so the
 * clock never moves: the longest phrase, its ellipsis and the caret, with
 * room for a running step's detail.
 */
export const TYPE_COLUMNS = 46
const CLOCK_COLUMNS = 5

/** Ink and brass that read on a dark page and a light one alike. */
const INK = 0x8c8374
const BRASS = 0xc9973c
const CARET = '▌'

/** Frames a finished phrase rests before it is taken back. */
const HOLD = 24
const BREATH = 4

/** A running step's detail in the narrator's voice: `Run npm test` → `running npm test`. */
const PROGRESSIVE: Record<string, string> = {
  Read: 'reading',
  Run: 'running',
  Edit: 'editing',
  Write: 'writing',
  Search: 'searching for',
  Find: 'looking for',
  Fetch: 'fetching',
  Agent: 'briefing an agent:',
  Todos: 'updating the plan:',
  Plan: 'presenting the plan',
}

export function runningText(detail: string): string {
  const clean = printable(detail, 200).trim()
  if (clean === '') return 'at work'
  const space = clean.indexOf(' ')
  const head = space < 0 ? clean : clean.slice(0, space)
  const rest = space < 0 ? '' : clean.slice(space)
  const verb = PROGRESSIVE[head]
  if (verb) return verb + rest
  // Claude Code's own status ("Retrying in 3s") is already a sentence; a tool name is not.
  if (/^[A-Z][a-z]/.test(clean)) return clean.charAt(0).toLowerCase() + clean.slice(1)
  return `running ${clean}`
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

/** A phrase with its ellipsis, cut to fit beside the caret. */
function fit(text: string): string {
  const full = rasterSafe(text) + '…'
  return full.length <= TYPE_COLUMNS - 1 ? full : full.slice(0, TYPE_COLUMNS - 2) + '…'
}

type Typed = { text: string; struck: boolean; caretOn: boolean }

/** Where the typewriter is at `frame` while it cycles through `phrases`. */
export function typewriter(phrases: string[], frame: number, hold = HOLD): Typed {
  const spans = phrases.map(p => {
    const text = fit(p)
    return { text, type: text.length, hold, erase: Math.ceil(text.length / 3), breath: BREATH }
  })
  const total = spans.reduce((sum, s) => sum + s.type + s.hold + s.erase + s.breath, 0)
  let t = ((frame % total) + total) % total
  const blink = Math.floor(frame / 5) % 2 === 0
  for (const s of spans) {
    if (t < s.type) return { text: s.text.slice(0, t + 1), struck: true, caretOn: true }
    t -= s.type
    if (t < s.hold) return { text: s.text, struck: false, caretOn: blink }
    t -= s.hold
    if (t < s.erase) return { text: s.text.slice(0, Math.max(0, s.text.length - (t + 1) * 3)), struck: false, caretOn: true }
    t -= s.erase
    if (t < s.breath) return { text: '', struck: false, caretOn: blink }
    t -= s.breath
  }
  return { text: '', struck: false, caretOn: blink }
}

/** What the typewriter shows for a state at a frame. */
export function typedOf(state: LiveState, frame: number): Typed {
  if (state.mode === 'running') return { text: fit(runningText(state.detail)), struck: false, caretOn: Math.floor(frame / 5) % 2 === 0 }
  if (state.mode === 'writing') return typewriter([WRITING], frame, 60)
  return typewriter(state.inator ? INATOR_THINKING : THINKING, frame)
}

export function typeCells(typed: Typed): string {
  const cells: Cell[] = [...typed.text].map((char, i, all) => ({ char, fg: typed.struck && i === all.length - 1 ? LIVE.DEFAULT : INK }))
  cells.push({ char: typed.caretOn ? CARET : ' ', fg: BRASS })
  while (cells.length < TYPE_COLUMNS) cells.push({ char: ' ', fg: INK })
  return encodeCells(cells.slice(0, TYPE_COLUMNS))
}

export function clockCells(ms: number): string {
  return encodeCells([...clockLabel(ms).padStart(CLOCK_COLUMNS).slice(-CLOCK_COLUMNS)].map(char => ({ char, fg: INK })))
}

export function liveFrames(state: LiveState, frame: number): LiveFrame[] {
  return [
    { key: 'cz-type', columns: TYPE_COLUMNS, cells: typeCells(typedOf(state, frame)) },
    { key: 'cz-clock', columns: CLOCK_COLUMNS, cells: clockCells(state.elapsedMs) },
  ]
}

/** The phrase for surfaces without rasters: whole, changing every few seconds. */
function plainPhrase(state: LiveState, isInator: boolean, frame: number): string {
  if (state.mode === 'running') return runningText(state.detail) + '…'
  if (state.mode === 'writing') return WRITING + '…'
  const list = isInator ? INATOR_THINKING : THINKING
  return (list[Math.floor(frame / 40) % list.length] ?? 'thinking') + '…'
}

export function live(state: LiveState, frame: number, ctx: Ctx): RenderElement {
  const flat = { ...ctx, fade: 0 as const }
  const els = ctx.els
  if (ctx.surface === 'terminal' && 'Raster' in els) {
    // The blits that follow draw from `state` alone, so the first frame does too.
    const [type, clock] = liveFrames(state, frame)
    return els.Box({
      flexDirection: 'row',
      columnGap: 1,
      children: [
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
    children: [grow(flat, it(flat, C.dim, plainPhrase(state, isInator, frame), { wrap: 'truncate-end' })), fixed(flat, txt(flat, C.dim, clockLabel(state.elapsedMs)))],
  })
}
