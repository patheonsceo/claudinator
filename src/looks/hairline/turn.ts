import type { RenderElement } from 'claude-code'

import { formatDuration, plural } from '../../engine/format'
import { tone } from '../../engine/palette'
import type { Ctx, ReceiptData } from '../look'
import { C, delta, grow, txt } from './style'

export function userMessage(text: string, ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  return Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [txt(ctx, C.accent, '❯', { bold: true }), grow(ctx, Text({ color: tone(C.text, ctx.fade), bold: ctx.fade === 0, wrap: 'wrap', children: text }))],
  })
}

export function receipt(data: ReceiptData, ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  const sep = (): RenderElement => txt(ctx, C.faint, '·')
  const parts: RenderElement[] = [txt(ctx, C.faint, '──'), txt(ctx, C.accent, '◆')]
  const s = data.stats
  if (s) parts.push(txt(ctx, C.text, `Turn ${s.turn}`), sep())
  parts.push(txt(ctx, C.dim, formatDuration(data.durationMs)))
  if (s && s.files.length > 0) parts.push(sep(), txt(ctx, C.dim, plural(s.files.length, 'file')), sep(), ...delta(ctx, s.add, s.del))
  if (s && s.contextPercent !== undefined) parts.push(sep(), txt(ctx, C.dim, `${Math.round(s.contextPercent)}% ctx`))
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
