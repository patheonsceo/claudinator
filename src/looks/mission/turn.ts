import type { RenderElement } from 'claude-code'

import { printable } from '../../engine/format'
import { tone } from '../../engine/palette'
import { factsOf } from '../../engine/tool-facts'
import { inatorQuip, superscript, stripColors, timeStripRow } from '../common'
import type { Ctx, FootnoteData, HeadlineData, ReceiptData } from '../look'
import { channel, tagCell, targetOf } from './rows'
import { C, DOUBLE_RULE, NARROW_COLUMNS, RULE, fill, fixed, gauge, grow, percentLabel, shrinks, turnLabel, turnTime, txt } from './style'

export function userMessage(text: string, ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  return Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [
      fixed(ctx, [txt(ctx, C.amber, '▶', { bold: true })]),
      fixed(ctx, [txt(ctx, C.amber, 'INPUT', { bold: true })]),
      grow(ctx, Text({ color: tone(C.text, ctx.fade), bold: ctx.fade === 0, wrap: 'wrap', children: printable(text, 4000, { keepNewlines: true }) })),
    ],
  })
}

export function headline(h: HeadlineData, ctx: Ctx): RenderElement {
  return ctx.els.Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [
      fixed(ctx, [txt(ctx, C.amber, '◇')]),
      fixed(ctx, [txt(ctx, C.dim, turnLabel(h.turn))]),
      shrinks(ctx, txt(ctx, C.text, printable(h.title, 120).toUpperCase(), { bold: true, wrap: 'truncate-end' })),
      fill(ctx, C.faint, RULE),
    ],
  })
}

/** A footnote as a channel line: `│ ¹ READ src/a.ts ····· 0.2s`. */
function noteLine(ctx: Ctx, note: FootnoteData): RenderElement {
  return channel(ctx, {
    rail: '│',
    railColor: C.faint,
    lead: [txt(ctx, C.amber, superscript(note.n).padEnd(2) + ' '), tagCell(ctx, factsOf(note.tool, note.input).glyph)],
    target: targetOf(ctx, note.tool, note.input),
    meter: null,
    value: null,
    ...(note.durationMs === undefined ? {} : { durationMs: note.durationMs }),
    isRunning: false,
  })
}

export function receipt(data: ReceiptData, ctx: Ctx): RenderElement {
  const line = receiptLine(data, ctx)
  const notes = data.notes.map(n => noteLine(ctx, n))
  const strip = data.timeStrip ? timeStripRow(ctx, data.timeStrip, { ...stripColors('mission', ctx.isDark), indent: 3 }) : null
  if (notes.length === 0 && !strip) return line
  return ctx.els.Box({ flexDirection: 'column', children: [...notes, line, ...(strip ? [strip] : [])] })
}

/** `╞═ T07 ═ 2:14 ═ FILES 2 ═ Δ +103 −10 ═ CTX ▰▰▰▰▱▱▱▱▱▱ 41% ═══╡`. */
function receiptLine(data: ReceiptData, ctx: Ctx): RenderElement {
  const sep = (): RenderElement => txt(ctx, C.faint, ' ═ ')
  const sp = (): RenderElement => txt(ctx, C.faint, ' ')
  const wide = ctx.columns >= NARROW_COLUMNS
  const s = data.stats
  const core: RenderElement[] = [txt(ctx, C.amber, '╞═'), sp()]
  if (s) core.push(txt(ctx, C.amber, turnLabel(s.turn), { bold: true }), sep())
  core.push(txt(ctx, C.text, turnTime(data.durationMs)))
  if (s && s.files.length > 0) {
    core.push(sep(), txt(ctx, C.teal, 'FILES'), sp(), txt(ctx, C.text, String(s.files.length)))
    core.push(sep(), txt(ctx, C.teal, 'Δ'), sp(), txt(ctx, s.add > 0 ? C.ok : C.faint, `+${s.add}`), sp(), txt(ctx, s.del > 0 ? C.err : C.faint, `−${s.del}`))
  }
  if (s && s.contextPercent !== undefined) {
    core.push(sep(), txt(ctx, C.teal, 'CTX'), sp())
    if (wide) core.push(gauge(ctx, s.contextPercent), sp())
    core.push(txt(ctx, C.text, percentLabel(s.contextPercent)))
  }
  core.push(sp())

  const parts: RenderElement[] = [fixed(ctx, core)]
  if (ctx.settings.ingredients.inator) {
    parts.push(
      shrinks(
        ctx,
        ctx.els.Text({
          wrap: 'truncate-end',
          children: [txt(ctx, C.faint, '═ '), txt(ctx, C.amber, 'STATUS: VICTORY', { bold: true }), txt(ctx, C.faint, ' · '), txt(ctx, C.dim, inatorQuip(s).toUpperCase()), txt(ctx, C.faint, ' ')],
        }),
      ),
    )
  }
  // The double rule fills what is left and is clipped there; the cap closes the bracket.
  parts.push(fill(ctx, C.faint, DOUBLE_RULE), fixed(ctx, [txt(ctx, C.amber, '╡')]))
  return ctx.els.Box({ flexDirection: 'row', children: parts })
}
