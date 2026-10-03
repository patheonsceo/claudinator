import type { RenderElement } from 'claude-code'

import { plural, printable } from '../../engine/format'
import { tone } from '../../engine/palette'
import { inatorQuip, notesBlock, timeStripRow } from '../common'
import type { Ctx, HeadlineData, ReceiptData } from '../look'
import { roman, spelledDuration } from './prose'
import { C, NARROW_COLUMNS, delta, fixed, grow, it, rule, txt } from './style'

/** The prompt as a pull quote: an accent mark, then the words in italic. */
export function userMessage(text: string, ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  return Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [
      fixed(ctx, txt(ctx, C.accent, '❝')),
      grow(ctx, Text({ color: tone(C.text, ctx.fade), italic: true, wrap: 'wrap', children: printable(text, 4000, { keepNewlines: true }) })),
    ],
  })
}

/** A chapter heading: `VII.` and the title in bold, over a thin rule. */
export function headline(h: HeadlineData, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  return Box({
    flexDirection: 'column',
    children: [
      Box({
        flexDirection: 'row',
        columnGap: 1,
        children: [fixed(ctx, it(ctx, C.accent, `${roman(h.turn)}.`)), grow(ctx, txt(ctx, C.text, printable(h.title, 120), { bold: true, wrap: 'truncate-end' }))],
      }),
      Box({ flexDirection: 'row', children: rule(ctx) }),
    ],
  })
}

/** A line set in the middle of the page. */
function centered(ctx: Ctx, child: RenderElement): RenderElement {
  return ctx.els.Box({ flexDirection: 'row', width: '100%', justifyContent: 'center', children: ctx.els.Box({ flexShrink: 1, minWidth: 0, children: child }) })
}

/** `❦ set in 2 min 14 s · 2 files · +103 −10 · 41% of context ❦`. */
function colophon(data: ReceiptData, ctx: Ctx): RenderElement {
  const s = data.stats
  const runs: RenderElement[] = [txt(ctx, C.accent, '❦'), it(ctx, C.dim, ` set in ${spelledDuration(data.durationMs)}`)]
  const counts = s ? delta(ctx, s.add, s.del) : []
  if (s && s.files.length > 0) {
    runs.push(it(ctx, C.dim, ` · ${plural(s.files.length, 'file')}`))
    counts.forEach((c, i) => runs.push(it(ctx, C.dim, i === 0 ? ' · ' : ' '), c))
  }
  if (s && s.contextPercent !== undefined) runs.push(it(ctx, C.dim, ` · ${Math.round(s.contextPercent)}% of context`))
  runs.push(txt(ctx, C.accent, ' ❦'))
  return ctx.els.Text({ wrap: 'truncate-end', children: runs })
}

/** The close of a turn: footnotes under a short rule, the colophon, then the time strip. */
export function receipt(data: ReceiptData, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  const parts: RenderElement[] = []
  const notes = notesBlock(ctx, data.notes, { indent: 0, accent: C.accent, italic: true })
  if (notes) parts.push(Box({ flexDirection: 'column', paddingLeft: 2, children: [txt(ctx, C.faint, '─'.repeat(12)), notes] }))
  parts.push(centered(ctx, colophon(data, ctx)))
  if (ctx.settings.ingredients.inator) parts.push(centered(ctx, it(ctx, C.accent, `${inatorQuip(data.stats)}.`, { wrap: 'truncate-end' })))
  if (data.timeStrip && ctx.columns >= NARROW_COLUMNS) {
    parts.push(centered(ctx, timeStripRow(ctx, data.timeStrip, { glyph: '━', indent: 0, thinking: C.accent, tools: C.dim, waiting: C.err })))
  }
  // Full width, so the colophon centers on the page and not on itself.
  return Box({ flexDirection: 'column', width: '100%', children: parts })
}
