import type { RenderElement, TextProps } from 'claude-code'

import { formatDuration, splitPath } from '../../engine/format'
import { fileColor, tone } from '../../engine/palette'
import type { Glyph } from '../../engine/tool-facts'
import type { Ctx } from '../look'

/**
 * Mission Control draws with theme tokens: its palette's companion theme maps
 * `warning` and `claude` to amber and `suggestion` to teal, and stock themes
 * still read as an instrument.
 */
export const C = {
  amber: 'warning',
  teal: 'suggestion',
  text: 'text',
  dim: 'inactive',
  faint: 'subtle',
  ok: 'success',
  err: 'error',
} as const

/** Below this width, rows drop their meters and the receipt and band their bars. */
export const NARROW_COLUMNS = 100

/** Every channel's four-letter tag, by kind of call. */
export const TAGS: Record<Glyph, string> = {
  read: 'READ',
  search: 'SCAN',
  edit: 'EDIT',
  create: 'NEW',
  run: 'EXEC',
  web: 'WEB',
  agent: 'AGNT',
  plan: 'PLAN',
  other: 'TOOL',
}

export const TAG_WIDTH = 4
/** The readout column: right-aligned values with a dotted lead-in. */
export const READOUT_WIDTH = 9
/** `2m 14s` is the widest duration. */
export const DURATION_WIDTH = 6
/** Cells on a row's timeline, drawn one space apart like the lookbook's dotted track. */
export const GANTT_CELLS = 16
/** The timeline reads on a log scale from the turn's start out to ten minutes. */
const GANTT_SPAN_MS = 600_000
const GANTT_UNIT_MS = 500

export const LEADER = '·'.repeat(300)
export const RULE = '─'.repeat(400)

type Extra = Pick<TextProps, 'bold' | 'wrap'>

export function txt(ctx: Ctx, color: string, children: string, extra: Extra = {}): RenderElement {
  return ctx.els.Text({ color: tone(color, ctx.fade), ...extra, children })
}

/** A part of a row that keeps its width. */
export function fixed(ctx: Ctx, children: RenderElement[]): RenderElement {
  return ctx.els.Box({ flexDirection: 'row', flexShrink: 0, children })
}

/** A slot that shrinks and truncates inside when the row is tight, but never grows. */
export function shrinks(ctx: Ctx, child: RenderElement): RenderElement {
  return ctx.els.Box({ flexShrink: 1, minWidth: 0, children: child })
}

/** A slot that takes the row's spare width and truncates inside it. */
export function grow(ctx: Ctx, child: RenderElement): RenderElement {
  return ctx.els.Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, children: child })
}

/**
 * A long run of `glyph` that fills whatever width is left and is clipped
 * there, with no ellipsis. Its basis is zero, so the parts beside it keep
 * their natural width and only give it up when the row is tight.
 */
export function fill(ctx: Ctx, color: string, run: string): RenderElement {
  return ctx.els.Box({ flexGrow: 1, flexShrink: 1, width: 0, minWidth: 0, height: 1, overflow: 'hidden', children: txt(ctx, color, run) })
}

/** `T+00:42`: minutes and seconds since the turn began, always seven cells. */
export function tClock(ms: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000))
  const m = Math.floor(total / 60)
  if (m < 100) return `T+${String(m).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  const h = Math.min(99, Math.floor(m / 60))
  return `T+${String(h).padStart(2, '0')}h${String(m % 60).padStart(2, '0')}`
}

/** `9.0s` and `42s` under a minute, `2:14` past it: the receipt's time. */
export function turnTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  if (ms < 60_000) return formatDuration(ms)
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** `T07`. */
export function turnLabel(turn: number): string {
  return `T${String(Math.max(0, Math.floor(turn))).padStart(2, '0')}`
}

/** Where a moment in the turn falls on the timeline, in cells (fractional). */
function ganttAt(ms: number): number {
  const t = Number.isFinite(ms) ? Math.max(0, ms) : 0
  return (Math.log2(1 + t / GANTT_UNIT_MS) / Math.log2(1 + GANTT_SPAN_MS / GANTT_UNIT_MS)) * GANTT_CELLS
}

/**
 * The cells a call covers on its row's timeline. A row never learns how long
 * its turn will run, so the track is a fixed log scale: the first seconds of a
 * turn spread out, and ten minutes in reaches the right edge.
 */
export function ganttSpan(startMs: number, endMs: number): { start: number; width: number } {
  const start = Math.min(GANTT_CELLS - 1, Math.floor(ganttAt(startMs)))
  const end = Math.min(GANTT_CELLS, Math.ceil(ganttAt(Math.max(startMs, Number.isFinite(endMs) ? endMs : startMs))))
  return { start, width: Math.max(1, end - start) }
}

/** The timeline: `· · · ▮ ▮ · · ·`, the bar in `color`; dots alone when the span is unknown. */
export function gantt(ctx: Ctx, span: { start: number; width: number } | null, color: string): RenderElement {
  const cell = (i: number): boolean => span !== null && i >= span.start && i < span.start + span.width
  const runs: Array<{ lit: boolean; text: string }> = []
  for (let i = 0; i < GANTT_CELLS; i++) {
    const lit = cell(i)
    const ch = (i > 0 ? ' ' : '') + (lit ? '▮' : '·')
    const last = runs[runs.length - 1]
    // A gap between two lit cells belongs to the bar; a gap before one belongs to the track.
    if (last && last.lit === lit) last.text += ch
    else if (i > 0) {
      if (last) last.text += ' '
      runs.push({ lit, text: lit ? '▮' : '·' })
    } else runs.push({ lit, text: ch })
  }
  return ctx.els.Text({ children: runs.map(r => txt(ctx, r.lit ? color : C.faint, r.text)) })
}

/** A usage bar: `▰▰▰▰▱▱▱▱▱▱`, teal, amber past 70%, red past 90%. */
export function gauge(ctx: Ctx, percent: number, cells = 10): RenderElement {
  const p = Math.max(0, Math.min(100, percent))
  const lit = Math.round((p / 100) * cells)
  const color = p >= 90 ? C.err : p >= 70 ? C.amber : C.teal
  return ctx.els.Text({ children: [txt(ctx, color, '▰'.repeat(lit)), txt(ctx, C.faint, '▱'.repeat(cells - lit))] })
}

export function percentLabel(percent: number): string {
  return `${Math.round(percent)}%`
}

/** A path as folder (dim) and file name, truncated from the start when tight. */
export function pathLabel(ctx: Ctx, path: string): RenderElement {
  const { dir, base } = splitPath(path, ctx.cwd)
  const color = ctx.settings.ingredients.fileColors ? fileColor(dir + base) : C.text
  return ctx.els.Text({ wrap: 'truncate-start', children: [txt(ctx, C.dim, dir), txt(ctx, color, base)] })
}

/** A file name alone, in its color when File colors is on. */
export function fileName(ctx: Ctx, path: string): RenderElement {
  const { dir, base } = splitPath(path, ctx.cwd)
  return txt(ctx, ctx.settings.ingredients.fileColors ? fileColor(dir + base) : C.dim, base)
}
