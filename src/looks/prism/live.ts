import type { RenderElement } from 'claude-code'

import { clockLabel, printable } from '../../engine/format'
import { encodeCells } from '../../engine/raster'
import type { Cell } from '../../engine/raster'
import type { Glyph } from '../../engine/tool-facts'
import { inatorWord } from '../common'
import type { Ctx, LiveFrame, LiveMode, LiveState } from '../look'
import { C, MARKS, gradientAt, gradientText, grow, hex, pathLabel, stepChip, txt } from './style'
import type { Mark } from './style'

export const LIVE_WORDS: Record<LiveMode, string> = { thinking: 'Thinking', writing: 'Writing', running: 'Running' }

/** -inator words as wide as 'Thinking', so the raster keeps its size while they take turns. */
const INATOR_WORDS = ['Scheming', 'Plotting'] as const
/** Frames each -inator word holds, the lookbook's pace. */
const INATOR_HOLD = 22
/** Cells in the field of dots. */
const FIELD = 24
const CLOCK_COLUMNS = 5
/** How far the field's colors move along their gradient each frame. */
const FIELD_SPEED = 0.012
/** Frames for one full pass of light through the word (3 s at the host's 100 ms tick). */
const WORD_PERIOD = 30

/**
 * Prism's gradient stops as 24-bit colors. liveFrames has no theme, so these
 * sit between Prism's dark and light stops and read on both.
 */
const FLOW = [0x6b5bff, 0xf05a94, 0xf0a14c] as const

function lerp(a: number, b: number, t: number): number {
  const ch = (shift: number): number => Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t)
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

const unit = (t: number): number => ((t % 1) + 1) % 1

/** The color at `t` along the loop g1 → g2 → g3 → g1, so the field's flow never seams. */
export function flowAt(t: number): number {
  const x = unit(t) * FLOW.length
  const i = Math.floor(x) % FLOW.length
  return lerp(FLOW[i] ?? FLOW[0], FLOW[(i + 1) % FLOW.length] ?? FLOW[0], x - Math.floor(x))
}

/** The color at `t` along g1 → g2 → g3 → g2 → g1: the word's sweep, which turns back instead of wrapping. */
function sweepAt(t: number): number {
  const u = unit(t)
  const x = (u < 0.5 ? u * 2 : 2 - u * 2) * (FLOW.length - 1)
  const i = Math.min(FLOW.length - 2, Math.floor(x))
  return lerp(FLOW[i] ?? FLOW[0], FLOW[i + 1] ?? FLOW[0], x - i)
}

/**
 * The field's characters at a frame: the lookbook's two slow waves summed,
 * read as dots. A terminal draws '•' far heavier than a browser does, so the
 * crests are '∙' and the rest '·', which keeps the field as fine as the lookbook's.
 */
export function fieldChars(frame: number): string[] {
  const out: string[] = []
  for (let i = 0; i < FIELD; i++) {
    const v = Math.sin(i * 0.8 + frame * 0.35) + Math.sin(i * 0.31 - frame * 0.2)
    out.push(v > 1.2 ? '∙' : v > -0.4 ? '·' : ' ')
  }
  return out
}

/** The field of dots, its colors flowing along the gradient. */
function fieldCells(frame: number): Cell[] {
  return fieldChars(frame).map((char, i) => ({ char, fg: flowAt(i / FIELD + frame * FIELD_SPEED) }))
}

/** `✦ Thinking ` with light sweeping through it, the way the lookbook's flowing gradient text moves. */
function wordCells(word: string, frame: number): Cell[] {
  const chars = [...`✦ ${word} `]
  const span = Math.max(1, chars.length - 2)
  return chars.map((char, i) => ({ char, fg: sweepAt((i / span) * 0.5 - frame / WORD_PERIOD) }))
}

export function clockCells(ms: number): string {
  return encodeCells([...clockLabel(ms).padStart(CLOCK_COLUMNS).slice(-CLOCK_COLUMNS)].map(char => ({ char, fg: 0x8a8799 })))
}

function wordOf(state: LiveState, frame: number): string {
  if (state.inator && state.mode === 'thinking') return INATOR_WORDS[Math.floor(frame / INATOR_HOLD) % INATOR_WORDS.length] ?? INATOR_WORDS[0]
  return LIVE_WORDS[state.mode]
}

export function liveFrames(state: LiveState, frame: number): LiveFrame[] {
  const clock = { key: 'cz-prism-clock', columns: CLOCK_COLUMNS, cells: clockCells(state.elapsedMs) }
  if (state.mode === 'running') return [{ key: 'cz-prism-field', columns: FIELD, cells: encodeCells(fieldCells(frame)) }, clock]
  const word = wordOf(state, frame)
  return [{ key: 'cz-prism', columns: [...word].length + 3 + FIELD, cells: encodeCells([...wordCells(word, frame), ...fieldCells(frame)]) }, clock]
}

/** The running step's kind, from the activity the host names it by. */
const ACTIVITY: Record<string, { glyph: Glyph; mark: Mark }> = {
  Reading: { glyph: 'read', mark: MARKS.read },
  Listing: { glyph: 'read', mark: { mark: MARKS.read.mark, word: 'LIST' } },
  Searching: { glyph: 'search', mark: MARKS.search },
  Finding: { glyph: 'search', mark: MARKS.search },
  Editing: { glyph: 'edit', mark: MARKS.edit },
  Writing: { glyph: 'create', mark: MARKS.create },
  Running: { glyph: 'run', mark: MARKS.run },
  Fetching: { glyph: 'web', mark: MARKS.web },
  Delegating: { glyph: 'agent', mark: MARKS.agent },
  Planning: { glyph: 'other', mark: { mark: MARKS.other.mark, word: 'PLAN' } },
}

/** The running step as its row would read: the kind's chip, then the target once. */
function runningParts(ctx: Ctx, state: LiveState, detail: string): RenderElement[] {
  const { glyph, mark } = ACTIVITY[state.activity ?? ''] ?? { glyph: 'run' as const, mark: MARKS.run }
  const isFile = (glyph === 'read' || glyph === 'edit' || glyph === 'create') && detail !== ''
  const parts: RenderElement[] = [ctx.els.Box({ flexShrink: 0, children: stepChip(ctx, glyph, mark, isFile ? detail : '') })]
  if (detail !== '') parts.push(ctx.els.Box({ flexShrink: 1, minWidth: 0, children: isFile ? pathLabel(ctx, detail) : txt(ctx, C.text, detail, { wrap: 'truncate-end' }) }))
  return parts
}

/** The field as plain text for surfaces without rasters: one still frame in the theme's own gradient. */
function fieldText(ctx: Ctx, frame: number): RenderElement {
  const p = hex(ctx)
  const stops = [p.g1, p.g2, p.g3, p.g1]
  const chars = fieldChars(frame)
  return ctx.els.Text({ children: chars.map((char, i) => (char === ' ' ? ' ' : ctx.els.Text({ color: gradientAt(stops, unit(i / FIELD + frame * FIELD_SPEED)), children: char }))) })
}

function fixed(ctx: Ctx, child: RenderElement): RenderElement {
  return ctx.els.Box({ flexShrink: 0, children: child })
}

export function live(state: LiveState, frame: number, ctx: Ctx): RenderElement {
  const flat: Ctx = { ...ctx, fade: 0 }
  const els = ctx.els
  const isInator = state.inator ?? ctx.settings.ingredients.inator
  const detail = printable(state.detail, 200)
  const isRunning = state.mode === 'running'
  const lead = isRunning ? runningParts(flat, state, detail) : []
  const after = isRunning ? grow(flat, txt(flat, C.dim, '')) : grow(flat, txt(flat, C.dim, detail, { wrap: 'truncate-end' }))
  if (ctx.surface === 'terminal' && 'Raster' in els) {
    const [flow, clock] = liveFrames({ ...state, inator: isInator }, frame)
    return els.Box({
      flexDirection: 'row',
      columnGap: 1,
      children: [
        ...lead,
        fixed(flat, els.Raster({ key: flow?.key ?? 'cz-prism', columns: flow?.columns ?? 1, rows: 1, cells: flow?.cells ?? '' })),
        after,
        fixed(flat, els.Raster({ key: 'cz-prism-clock', columns: CLOCK_COLUMNS, rows: 1, cells: clock?.cells ?? '' })),
      ],
    })
  }
  const p = hex(flat)
  const word = isInator && state.mode === 'thinking' ? inatorWord(frame) : LIVE_WORDS[state.mode]
  const head = isRunning ? lead : [fixed(flat, gradientText(flat, `✦ ${word}`, [p.g1, p.g2, p.g3], { bold: true }))]
  return els.Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [...head, fixed(flat, fieldText(flat, frame)), after, fixed(flat, txt(flat, C.dim, clockLabel(state.elapsedMs)))],
  })
}
