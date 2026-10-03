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
  other: 'TOOL',
}

export const TAG_WIDTH = 4
export const METER_WIDTH = 10
/** A meter fills completely at this many changed lines. */
export const METER_CAP = 60
/** The readout column: right-aligned values with a dotted lead-in. */
export const READOUT_WIDTH = 9
/** `2m 14s` is the widest duration. */
export const DURATION_WIDTH = 6

export const LEADER = '·'.repeat(300)
export const RULE = '─'.repeat(400)
export const DOUBLE_RULE = '═'.repeat(400)

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

/** How a ten-cell meter splits for an edit: added lines, removed lines, empty. */
export function meterCells(add: number, del: number): { ok: number; err: number; empty: number } {
  const total = Math.max(0, add) + Math.max(0, del)
  if (total === 0) return { ok: 0, err: 0, empty: METER_WIDTH }
  const lit = Math.max(1, Math.round((Math.min(total, METER_CAP) / METER_CAP) * METER_WIDTH))
  const ok = Math.round((lit * Math.max(0, add)) / total)
  return { ok, err: lit - ok, empty: METER_WIDTH - lit }
}

/** The edit meter: `▮▮▮▯▯▯▯▯▯▯`. */
export function meter(ctx: Ctx, add: number, del: number): RenderElement[] {
  const m = meterCells(add, del)
  const out: RenderElement[] = []
  if (m.ok > 0) out.push(txt(ctx, C.ok, '▮'.repeat(m.ok)))
  if (m.err > 0) out.push(txt(ctx, C.err, '▮'.repeat(m.err)))
  if (m.empty > 0) out.push(txt(ctx, C.faint, '▯'.repeat(m.empty)))
  return out
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
