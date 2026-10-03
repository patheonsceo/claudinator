import type { RenderElement, TextProps } from 'claude-code'

import { SLOW_MS, durationBarWidth, formatDuration, splitPath } from '../../engine/format'
import { fileColor, tone } from '../../engine/palette'
import type { Ctx } from '../look'

/** Hairline draws with Claude Code's theme tokens, so it follows every theme. */
export const C = {
  accent: 'suggestion',
  text: 'text',
  dim: 'inactive',
  faint: 'subtle',
  ok: 'success',
  err: 'error',
  warn: 'warning',
} as const

/** Columns before a row's target: glyph, gap, six-wide verb, gap. */
export const INDENT = 9

/** Below this width, rows drop the duration bar. */
export const NARROW_COLUMNS = 100

export function txt(ctx: Ctx, color: string, children: string, extra: Pick<TextProps, 'bold' | 'wrap'> = {}): RenderElement {
  return ctx.els.Text({ color: tone(color, ctx.fade), ...extra, children })
}

export function delta(ctx: Ctx, add: number, del: number): RenderElement[] {
  const out: RenderElement[] = []
  if (add > 0) out.push(txt(ctx, C.ok, `+${add}`))
  if (del > 0) out.push(txt(ctx, C.err, `−${del}`))
  return out
}

/** The duration hairline and the time, right-aligned. */
export function timing(ctx: Ctx, ms: number): RenderElement {
  const children: RenderElement[] = []
  if (ctx.columns >= NARROW_COLUMNS) {
    const w = durationBarWidth(ms)
    children.push(txt(ctx, ms >= SLOW_MS ? C.warn : C.faint, ' '.repeat(8 - w) + '─'.repeat(w)))
  }
  children.push(txt(ctx, C.dim, formatDuration(ms).padStart(5)))
  return ctx.els.Box({ flexDirection: 'row', columnGap: 1, flexShrink: 0, children })
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

/** A flexible slot that takes the row's spare width and truncates inside it. */
export function grow(ctx: Ctx, child: RenderElement): RenderElement {
  return ctx.els.Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, children: child })
}
