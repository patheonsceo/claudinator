import type { RenderElement } from 'claude-code'

import { clockLabel, printable } from '../../engine/format'
import { encodeCells } from '../../engine/raster'
import type { Cell } from '../../engine/raster'
import { GLYPHS } from '../../engine/tool-facts'
import type { Glyph } from '../../engine/tool-facts'
import { inatorWord } from '../common'
import type { Ctx, LiveFrame, LiveMode, LiveState } from '../look'
import { C, chip, gradientChip, gradientText, grow, hex, hueOf, txt } from './style'

export const LIVE_WORDS: Record<LiveMode, string> = { thinking: 'Thinking', writing: 'Writing', running: 'Running' }

/** As wide as 'Thinking', so the raster keeps its size in -inator mode. */
const INATOR_WORD = 'Scheming'
const PARTICLES = 10
const CLOCK_COLUMNS = 5

/**
 * The flowing gradient's stops as 24-bit colors. liveFrames has no theme, so
 * these sit between Prism's dark and light stops and read on both.
 */
const FLOW = [0x7060ff, 0xf05a94, 0xf09a48] as const
const GRAY = 0x8a8799
const DOTS = [' ', '·', '∙', '•'] as const

function lerp(a: number, b: number, t: number): number {
  const ch = (shift: number): number => Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t)
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

/** The color at `t` along the loop g1 → g2 → g3 → g1, so the flow never seams. */
export function flowAt(t: number): number {
  const x = (((t % 1) + 1) % 1) * FLOW.length
  const i = Math.floor(x) % FLOW.length
  return lerp(FLOW[i] ?? FLOW[0], FLOW[(i + 1) % FLOW.length] ?? FLOW[0], x - Math.floor(x))
}

const SPEED = 0.035

function wordOf(state: LiveState): string {
  return state.inator && state.mode === 'thinking' ? INATOR_WORD : (state.activity ?? LIVE_WORDS[state.mode])
}

/** `✦ Thinking` with light flowing through it, then a drifting band of particles. Deterministic per frame. */
export function prismCells(word: string, frame: number): string {
  const shift = frame * SPEED
  const cells: Cell[] = [{ char: '✦', fg: flowAt(-shift) }, { char: ' ', fg: GRAY }]
  const span = Math.max(1, word.length)
  for (let i = 0; i < word.length; i++) cells.push({ char: word[i] ?? ' ', fg: flowAt((i + 2) / span * 0.6 - shift) })
  cells.push({ char: ' ', fg: GRAY })
  for (let j = 0; j < PARTICLES; j++) {
    const a = Math.sin(j * 0.8 - frame * 0.45) * 0.5 + 0.5
    const b = Math.sin(j * 0.37 + frame * 0.21) * 0.5 + 0.5
    const amp = a * 0.65 + b * 0.35
    const level = Math.min(DOTS.length - 1, Math.floor(amp * DOTS.length))
    cells.push({ char: DOTS[level] ?? ' ', fg: lerp(GRAY, flowAt(0.3 + (j / PARTICLES) * 0.5 - shift), 0.4 + amp * 0.6) })
  }
  return encodeCells(cells)
}

export function clockCells(ms: number): string {
  return encodeCells([...clockLabel(ms).padStart(CLOCK_COLUMNS).slice(-CLOCK_COLUMNS)].map(char => ({ char, fg: GRAY })))
}

export function liveFrames(state: LiveState, frame: number): LiveFrame[] {
  const word = wordOf(state)
  return [
    { key: 'cz-prism', columns: 2 + word.length + 1 + PARTICLES, cells: prismCells(word, frame) },
    { key: 'cz-prism-clock', columns: CLOCK_COLUMNS, cells: clockCells(state.elapsedMs) },
  ]
}

const DETAIL_VERBS: Record<string, Glyph> = { Read: 'read', Edit: 'edit', Write: 'create', Run: 'run', Search: 'search', Find: 'search', Fetch: 'web', Agent: 'agent', Todos: 'other' }

/** The running call as a pill and what it touches, read back from the live detail. */
function runningParts(ctx: Ctx, detail: string): RenderElement[] {
  const space = detail.indexOf(' ')
  const verb = space < 0 ? detail : detail.slice(0, space)
  const rest = space < 0 ? '' : detail.slice(space + 1)
  const glyph = DETAIL_VERBS[verb]
  const tail = grow(ctx, txt(ctx, C.dim, glyph ? rest : detail, { wrap: 'truncate-end' }))
  if (!glyph) return [chip(ctx, ` ${GLYPHS.run} RUN `, hex(ctx).neutralBg, hex(ctx).neutralFg), tail]
  const label = ` ${GLYPHS[glyph]} ${verb.toUpperCase()} `
  if (glyph === 'agent') return [gradientChip(ctx, label), tail]
  const isFile = (glyph === 'read' || glyph === 'edit' || glyph === 'create') && rest !== ''
  return [isFile ? chip(ctx, label, hueOf(ctx, rest)) : chip(ctx, label, hex(ctx).neutralBg, hex(ctx).neutralFg), tail]
}

export function live(state: LiveState, frame: number, ctx: Ctx): RenderElement {
  const flat: Ctx = { ...ctx, fade: 0 }
  const els = ctx.els
  const isInator = state.inator ?? ctx.settings.ingredients.inator
  const detail = printable(state.detail, 200)
  const middle = state.mode === 'running' ? runningParts(flat, detail) : [grow(flat, txt(flat, C.dim, detail, { wrap: 'truncate-end' }))]
  if (ctx.surface === 'terminal' && 'Raster' in els) {
    const [flow, clock] = liveFrames({ ...state, inator: isInator }, frame)
    return els.Box({
      flexDirection: 'row',
      columnGap: 1,
      children: [
        els.Raster({ key: 'cz-prism', columns: flow?.columns ?? 1, rows: 1, cells: flow?.cells ?? '' }),
        ...middle,
        els.Raster({ key: 'cz-prism-clock', columns: CLOCK_COLUMNS, rows: 1, cells: clock?.cells ?? '' }),
      ],
    })
  }
  const p = hex(flat)
  const word = isInator && state.mode === 'thinking' ? inatorWord(frame) : (state.activity ?? LIVE_WORDS[state.mode])
  return els.Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [fixed(flat, gradientText(flat, `✦ ${word}`, [p.g1, p.g2, p.g3], { bold: true })), ...middle, txt(flat, C.dim, clockLabel(state.elapsedMs))],
  })
}

function fixed(ctx: Ctx, child: RenderElement): RenderElement {
  return ctx.els.Box({ flexShrink: 0, children: child })
}
