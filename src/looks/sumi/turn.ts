import type { RenderElement } from 'claude-code'

import { clockLabel, printable } from '../../engine/format'
import { notesBlock, stripColors, timeStripRow } from '../common'
import type { Ctx, HeadlineData, ReceiptData } from '../look'
import { APART, C, GAP, INDENT, apart, delta, fitWords, grow, ink, line, spaced, spacedWords, txt, wash } from './style'

/** The time strip needs about this many columns for its bar and legend. */
const STRIP_COLUMNS = 80

/** The prompt alone, indented, in plain ink: no glyph. */
export function userMessage(text: string, ctx: Ctx): RenderElement {
  return ctx.els.Box({
    paddingLeft: INDENT,
    children: grow(ctx, ctx.els.Text({ color: ink(ctx, C.text), wrap: 'wrap', children: printable(text, 4000, { keepNewlines: true }) })),
  })
}

/** `■ t h e   r e f r e s h   r a c e,   f i x e d`: whole words that fit, lowercase, spaced. */
export function headline(h: HeadlineData, ctx: Ctx): RenderElement {
  const width = Math.max(8, ctx.columns - INDENT - 1 - GAP - 1)
  const title = fitWords(spacedWords(printable(h.title, 120).toLowerCase()), width)
  return line(ctx, [txt(ctx, C.seal, '■'), grow(ctx, txt(ctx, C.dim, title, { wrap: 'truncate-end' }))])
}

/** `■ ─── 2:14   +103 −10   41%`, with notes above in faint italics and the time strip below. */
export function receipt(data: ReceiptData, ctx: Ctx): RenderElement {
  const notes = notesBlock(ctx, data.notes, { indent: INDENT, accent: C.dim, italic: true })
  const strip =
    data.timeStrip && ctx.columns >= STRIP_COLUMNS ? timeStripRow(ctx, data.timeStrip, { ...stripColors('sumi', ctx.isDark), indent: INDENT }) : null
  const main = receiptLine(data, ctx)
  if (!notes && !strip) return main
  return ctx.els.Box({ flexDirection: 'column', children: [notes, main, strip].filter((x): x is RenderElement => x !== null) })
}

function receiptLine(data: ReceiptData, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  const s = data.stats
  const parts: RenderElement[] = [
    Box({ flexDirection: 'row', columnGap: 1, flexShrink: 0, children: [txt(ctx, C.seal, '■'), txt(ctx, wash(ctx), '───'), txt(ctx, C.dim, clockLabel(data.durationMs))] }),
  ]
  if (s && (s.add > 0 || s.del > 0)) parts.push(apart(ctx, ctx.els.Text({ children: delta(ctx, s.add, s.del) })))
  if (s && s.contextPercent !== undefined) parts.push(apart(ctx, txt(ctx, C.dim, `${Math.round(s.contextPercent)}%`)))
  // -inator mode signs off, the word set wide like the headline.
  if (ctx.settings.ingredients.inator) {
    parts.push(grow(ctx, Box({ paddingLeft: APART, children: txt(ctx, C.dim, spaced('defeated'), { wrap: 'truncate-end' }) })))
  }
  return line(ctx, parts)
}
