import type { RenderElement, TextProps } from 'claude-code'

import { formatDuration } from '../../engine/format'
import { tone } from '../../engine/palette'
import type { Ctx } from '../look'

/**
 * Thermal prints in one ink: the theme's text color, with inactive and subtle
 * as the lighter and lightest impressions. Only outcomes get a color.
 */
export const C = {
  ink: 'text',
  dim: 'inactive',
  faint: 'subtle',
  ok: 'success',
  err: 'error',
  warn: 'warning',
} as const

/** Receipt paper is this many columns wide at most. */
export const PAPER = 54

/** The slip's width for this terminal: receipt paper, or narrower when the window is. */
export function paperOf(ctx: Ctx): number {
  return Math.max(16, Math.min(PAPER, ctx.columns - 4))
}

/** Text as the printer prints it. */
export function upper(text: string): string {
  return text.toUpperCase()
}

function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    cp >= 0x20000
  )
}

/** Terminal cells a string takes, counting East Asian wide characters as two. */
export function cellsOf(text: string): number {
  let n = 0
  for (const ch of text) n += isWide(ch.codePointAt(0) ?? 0) ? 2 : 1
  return n
}

/** A time as a price: one decimal under a minute (`10.3S`), then `2M 14S`. */
export function priceOf(ms: number): string {
  if (Number.isFinite(ms) && ms >= 0 && ms < 59_950) return (Math.round(ms / 100) / 10).toFixed(1) + 'S'
  return upper(formatDuration(ms))
}

/** `m:ss`, rounded to the nearest second: how a till prints a time. */
export function clockOf(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function txt(ctx: Ctx, color: string, children: string | RenderElement[], extra: Pick<TextProps, 'bold' | 'wrap'> = {}): RenderElement {
  return ctx.els.Text({ color: tone(color, ctx.fade), ...extra, ...(extra.bold && ctx.fade > 0 ? { bold: false } : {}), children })
}

/** A slot that never shrinks. */
export function fixed(ctx: Ctx, child: RenderElement, extra: { marginLeft?: number } = {}): RenderElement {
  return ctx.els.Box({ flexShrink: 0, ...extra, children: child })
}

/** A slot that gives way first and truncates inside itself. */
export function give(ctx: Ctx, child: RenderElement): RenderElement {
  return ctx.els.Box({ flexShrink: 1, minWidth: 0, children: child })
}

/** One printed line `width` wide. */
export function line(ctx: Ctx, width: number, children: RenderElement[], extra: { paddingLeft?: number; justifyContent?: 'center' } = {}): RenderElement {
  return ctx.els.Box({ flexDirection: 'row', width, ...extra, children })
}

/** A repeated pattern exactly as wide as the slip, clipped rather than wrapped. */
export function rule(ctx: Ctx, width: number, pattern: string, color: string = C.faint, lead = ''): RenderElement {
  const body = (lead + pattern.repeat(Math.ceil(width / pattern.length) + 1)).slice(0, width).trimEnd()
  return ctx.els.Box({ width, height: 1, overflow: 'hidden', children: txt(ctx, color, body) })
}

/**
 * The receipt's line item: what was bought, a dotted leader, and the price at
 * the right edge of the paper. `labelCells` is the label's printed width, so
 * the leader starts at its true length; the label still gives way when tight.
 */
export function item(
  ctx: Ctx,
  width: number,
  label: RenderElement[],
  labelCells: number,
  price: RenderElement | null,
  priceCells: number,
  options: { paddingLeft?: number } = {},
): RenderElement {
  const { Box } = ctx.els
  const pad = options.paddingLeft ?? 0
  const children: RenderElement[] = [...label]
  if (price) {
    const dots = Math.max(2, width - pad - labelCells - priceCells - 2)
    children.push(
      Box({ flexGrow: 1, flexShrink: 1, minWidth: 2, height: 1, overflow: 'hidden', marginLeft: 1, marginRight: 1, children: txt(ctx, C.dim, '.'.repeat(dots)) }),
      fixed(ctx, price),
    )
  }
  return line(ctx, width, children, pad > 0 ? { paddingLeft: pad } : {})
}
