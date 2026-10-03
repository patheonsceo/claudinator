import type { RenderElement } from 'claude-code'

import { formatDuration, plural, printable } from '../../engine/format'
import { tone } from '../../engine/palette'
import { inatorQuip, notesBlock, timeStripRow } from '../common'
import type { Ctx, HeadlineData, ReceiptData } from '../look'
import { C, delta, grow, txt } from './style'

export function userMessage(text: string, ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  return Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [txt(ctx, C.accent, '❯', { bold: true }), grow(ctx, Text({ color: tone(C.text, ctx.fade), bold: ctx.fade === 0, wrap: 'wrap', children: printable(text, 4000, { keepNewlines: true }) }))],
  })
}

export function headline(h: HeadlineData, ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  return Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [
      Box({ flexDirection: 'row', columnGap: 1, flexShrink: 0, children: [txt(ctx, C.dim, `Turn ${h.turn}`), txt(ctx, C.text, printable(h.title, 120), { bold: true })] }),
      Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, height: 1, overflow: 'hidden', children: Text({ color: tone(C.faint, ctx.fade), children: '─'.repeat(400) }) }),
    ],
  })
}

export function receipt(data: ReceiptData, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  const line = receiptLine(data, ctx)
  const notes = notesBlock(ctx, data.notes)
  const strip = data.timeStrip ? timeStripRow(ctx, data.timeStrip) : null
  if (!notes && !strip) return line
  return Box({ flexDirection: 'column', children: [notes, line, strip].filter((x): x is RenderElement => x !== null) })
}

function receiptLine(data: ReceiptData, ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  const sep = (): RenderElement => txt(ctx, C.faint, '·')
  const parts: RenderElement[] = [txt(ctx, C.faint, '──'), txt(ctx, C.accent, '◆')]
  const s = data.stats
  if (s) parts.push(txt(ctx, C.text, `Turn ${s.turn}`), sep())
  parts.push(txt(ctx, C.dim, formatDuration(data.durationMs)))
  if (s && s.files.length > 0) parts.push(sep(), txt(ctx, C.dim, plural(s.files.length, 'file')), sep(), ...delta(ctx, s.add, s.del))
  if (s && s.contextPercent !== undefined) parts.push(sep(), txt(ctx, C.dim, `${Math.round(s.contextPercent)}% ctx`))
  if (ctx.settings.ingredients.inator) parts.push(sep(), txt(ctx, C.accent, inatorQuip(s)))
  return Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [
      // The stats never shrink, so they stay on one line.
      Box({ flexDirection: 'row', columnGap: 1, flexShrink: 0, children: parts }),
      // The rule fills what is left and is clipped there, with no ellipsis.
      Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, height: 1, overflow: 'hidden', children: Text({ color: tone(C.faint, ctx.fade), children: '─'.repeat(400) }) }),
    ],
  })
}
