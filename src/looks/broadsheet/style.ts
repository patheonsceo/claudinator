import type { RenderElement, TextProps } from 'claude-code'

import { fileColor, tone } from '../../engine/palette'
import type { Ctx } from '../look'

/**
 * Broadsheet sets type with Claude Code's theme tokens, so its companion theme
 * (palettes/broadsheet.json) makes it exact and any stock theme still reads.
 */
export const C = {
  accent: 'suggestion',
  text: 'text',
  dim: 'inactive',
  faint: 'subtle',
  ok: 'success',
  err: 'error',
  warn: 'warning',
} as const

/** Below this width, secondary parts (the time strip) are dropped. */
export const NARROW_COLUMNS = 100

/** Columns from a row's glyph to its sentence: glyph, space. */
export const INDENT = 2

type Style = Pick<TextProps, 'bold' | 'italic' | 'wrap'>

/** One run of type in a color, toned for the row's age. */
export function txt(ctx: Ctx, color: string, children: string | RenderElement[], style: Style = {}): RenderElement {
  return ctx.els.Text({ color: tone(color, ctx.fade), ...style, children })
}

/** Italic type: the voice of the narration. */
export function it(ctx: Ctx, color: string, children: string, style: Omit<Style, 'italic'> = {}): RenderElement {
  return txt(ctx, color, children, { ...style, italic: true })
}

/** A part that keeps its width. */
export function fixed(ctx: Ctx, child: RenderElement): RenderElement {
  return ctx.els.Box({ flexShrink: 0, children: child })
}

/** A flexible slot that takes the row's spare width and truncates inside it. */
export function grow(ctx: Ctx, child: RenderElement): RenderElement {
  return ctx.els.Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, children: child })
}

/** A thin full-width rule, clipped at the edge with no ellipsis. */
export function rule(ctx: Ctx, color: string = C.faint): RenderElement {
  return ctx.els.Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, height: 1, overflow: 'hidden', children: txt(ctx, color, '─'.repeat(400)) })
}

/** `+12 −3`, counts in the success and error colors. */
export function delta(ctx: Ctx, add: number, del: number): RenderElement[] {
  const out: RenderElement[] = []
  if (add > 0) out.push(txt(ctx, C.ok, `+${add}`))
  if (del > 0) out.push(txt(ctx, C.err, `−${del}`))
  return out
}

/** The color of a file name: its own with File colors on, else `fallback`. */
export function nameColor(ctx: Ctx, path: string, fallback: string): string {
  return ctx.settings.ingredients.fileColors && path !== '' ? fileColor(path) : fallback
}
