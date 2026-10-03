import type { RenderElement, TextProps } from 'claude-code'

import { splitPath } from '../../engine/format'
import { fileColor, tone } from '../../engine/palette'
import type { Ctx } from '../look'

/**
 * Blueprint draws with Claude Code's theme tokens. Its companion theme turns
 * them into the drawing office: `text` is drafting white, `suggestion` the
 * cyan of dimensions, `inactive` the pale blue of construction lines and
 * `subtle` the faint grid.
 */
export const C = {
  ink: 'text',
  cyan: 'suggestion',
  dim: 'inactive',
  faint: 'subtle',
  ok: 'success',
  err: 'error',
  warn: 'warning',
} as const

/** Columns under a row's head where a failure's NOTE and a command's output start. */
export const NOTE_INDENT = 5

/** Columns under a row's head where mini diffs start, one inside the notes. */
export const DIFF_INDENT = 6

/** Below this width, secondary columns (the time strip) are dropped. */
export const NARROW_COLUMNS = 100

/** Long enough to fill any terminal; clipped by its box. */
export const RULE = '─'.repeat(400)

type Extra = Pick<TextProps, 'bold' | 'wrap' | 'italic'>

export function txt(ctx: Ctx, color: string, children: string | RenderElement[], extra: Extra = {}): RenderElement {
  return ctx.els.Text({ color: tone(color, ctx.fade), ...extra, children })
}

/** A part of a row that never shrinks. */
export function fixed(ctx: Ctx, children: RenderElement | RenderElement[]): RenderElement {
  return ctx.els.Box({ flexDirection: 'row', flexShrink: 0, children })
}

/** A part of a row that gives up its width first, truncating inside it. */
export function shrink(ctx: Ctx, child: RenderElement): RenderElement {
  return ctx.els.Box({ flexShrink: 1, minWidth: 0, children: child })
}

/**
 * A rule that takes the spare width and nothing more: zero basis, grows to
 * fill, clipped with no ellipsis. Text beside it keeps its width until the
 * rule has none left to give.
 */
export function rule(ctx: Ctx, color: string = C.faint): RenderElement {
  return ctx.els.Box({ flexGrow: 1, flexShrink: 1, width: 0, minWidth: 0, height: 1, overflow: 'hidden', children: txt(ctx, color, RULE) })
}

/** A path as folder (dim) and file name, truncated from the start when tight. */
export function pathLabel(ctx: Ctx, path: string): RenderElement {
  const { dir, base } = splitPath(path, ctx.cwd)
  const color = ctx.settings.ingredients.fileColors ? fileColor(dir + base) : C.ink
  return ctx.els.Text({ wrap: 'truncate-start', children: [txt(ctx, C.dim, dir), txt(ctx, color, base)] })
}

/** A file name alone, in its color when File colors is on. */
export function fileName(ctx: Ctx, path: string): RenderElement {
  const { dir, base } = splitPath(path, ctx.cwd)
  return txt(ctx, ctx.settings.ingredients.fileColors ? fileColor(dir + base) : C.ink, base)
}

/** `+12 −3` as colored parts, `±0` when nothing changed. */
export function delta(ctx: Ctx, add: number, del: number): RenderElement[] {
  const out: RenderElement[] = []
  if (add > 0) out.push(txt(ctx, C.ok, `+${add}`))
  if (add > 0 && del > 0) out.push(txt(ctx, C.dim, ' '))
  if (del > 0) out.push(txt(ctx, C.err, `−${del}`))
  if (out.length === 0) out.push(txt(ctx, C.dim, '±0'))
  return out
}

/** 1 → A, 2 → B, 26 → Z, 27 → AA: a drawing's callout letters. */
export function calloutLetter(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n) || n < 1) return '·'
  let k = Math.floor(n)
  let out = ''
  while (k > 0) {
    const r = (k - 1) % 26
    out = String.fromCharCode(65 + r) + out
    k = Math.floor((k - 1) / 26)
  }
  return out
}
