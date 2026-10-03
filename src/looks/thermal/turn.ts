import type { RenderElement } from 'claude-code'

import { plural, printable } from '../../engine/format'
import { inatorQuip, noteText, superscript, timeStripSegments } from '../common'
import type { Ctx, FootnoteData, HeadlineData, ReceiptData, TimeStripData } from '../look'
import { C, cellsOf, clockOf, fixed, give, item, line, paperOf, priceOf, rule, txt, upper } from './style'

const BARS = '▌▍▎▏█▐'
const BARCODE_CELLS = 30

/** A small seeded generator (mulberry32), so a turn always prints the same code. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The turn's barcode: thirty bars of varying weight, the same every time for a turn. */
export function barcode(turn: number): string {
  const next = seeded(Math.imul(turn + 1, 0x9e3779b1))
  let out = ''
  for (let i = 0; i < BARCODE_CELLS; i++) out += BARS[Math.floor(next() * BARS.length)] ?? '█'
  return out
}

/** Six hex digits that serialise the slip, the same every time for a turn. */
export function serial(turn: number): string {
  const next = seeded(Math.imul(turn + 7, 0x85ebca6b) ^ 0x5eed)
  return Math.floor(next() * 0x1000000).toString(16).toUpperCase().padStart(6, '0')
}

export function userMessage(text: string, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  return Box({
    flexDirection: 'row',
    columnGap: 1,
    width: paperOf(ctx),
    children: [
      fixed(ctx, txt(ctx, C.dim, 'ORDER ▸')),
      Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, children: txt(ctx, C.ink, printable(text, 4000, { keepNewlines: true }), { bold: true, wrap: 'wrap' }) }),
    ],
  })
}

export function headline(h: HeadlineData, ctx: Ctx): RenderElement {
  return line(ctx, paperOf(ctx), [give(ctx, txt(ctx, C.ink, `** ${upper(printable(h.title, 120))} **`, { bold: true, wrap: 'truncate-end' }))])
}

function noteLine(ctx: Ctx, width: number, note: FootnoteData): RenderElement {
  const what = upper(noteText({ ...note, durationMs: undefined }, ctx.cwd))
  const time = note.durationMs === undefined ? '' : ' ' + priceOf(note.durationMs)
  return line(ctx, width, [give(ctx, ctx.els.Text({ wrap: 'truncate-end', children: [txt(ctx, C.ink, superscript(note.n)), txt(ctx, C.dim, ` ${what}${time}`)] }))], { paddingLeft: 2 })
}

function stripLines(ctx: Ctx, width: number, data: TimeStripData): RenderElement[] {
  const { Text } = ctx.els
  const seg = timeStripSegments(data, width)
  const parts: Array<[string, string, number, number]> = [
    [C.ink, 'THINKING', seg.thinking, data.thinkingMs],
    [C.dim, 'TOOLS', seg.tools, data.toolsMs],
    [C.warn, 'WAITING', seg.waiting, data.waitingMs],
  ]
  const bar = Text({ children: parts.filter(p => p[2] > 0).map(([color, , n]) => txt(ctx, color, '▒'.repeat(n))) })
  const legend: RenderElement[] = []
  parts
    .filter(([, label, , ms]) => ms > 0 || label === 'THINKING')
    .forEach(([color, label, , ms], i) => {
      legend.push(txt(ctx, color, (i > 0 ? '  ' : '') + '▒'), txt(ctx, C.dim, ` ${label} ${priceOf(ms)}`))
    })
  return [
    ctx.els.Box({ width, height: 1, overflow: 'hidden', children: bar }),
    line(ctx, width, [give(ctx, Text({ wrap: 'truncate-end', children: legend }))]),
  ]
}

/** A centered line on the slip. */
function centered(ctx: Ctx, width: number, child: RenderElement): RenderElement {
  return line(ctx, width, [give(ctx, child)], { justifyContent: 'center' })
}

/** A priced line on the slip: `LABEL ........ VALUE`. */
function entry(ctx: Ctx, width: number, label: string, value: RenderElement, valueCells: number, bold = false): RenderElement {
  return item(ctx, width, [give(ctx, txt(ctx, C.ink, label, { bold, wrap: 'truncate-end' }))], cellsOf(label), value, valueCells)
}

/**
 * The turn's receipt: a slip with the line totals, a thank-you, a barcode and
 * serial for the turn, and a tear-off edge. Footnotes print above it, the time
 * strip under the totals.
 */
export function receipt(data: ReceiptData, ctx: Ctx): RenderElement {
  const width = paperOf(ctx)
  const s = data.stats
  const out: RenderElement[] = data.notes.map(n => noteLine(ctx, width, n))
  const dashes = (): RenderElement => rule(ctx, width, '- ')
  out.push(dashes())
  if (data.title) out.push(line(ctx, width, [give(ctx, txt(ctx, C.dim, `RE: ${upper(printable(data.title, 120))}`, { wrap: 'truncate-end' }))]))
  if (s && s.toolCount !== undefined) {
    const price = s.toolsMs !== undefined ? priceOf(s.toolsMs) : ''
    out.push(entry(ctx, width, `ITEMS (${s.toolCount})`, txt(ctx, C.ink, price), price.length))
  }
  if (s && s.toolsMs !== undefined) {
    const thinking = clockOf(Math.max(0, data.durationMs - s.toolsMs - (s.waitingMs ?? 0)))
    out.push(entry(ctx, width, 'THINKING', txt(ctx, C.ink, thinking), thinking.length))
  }
  const total = clockOf(data.durationMs)
  out.push(entry(ctx, width, 'TOTAL', txt(ctx, C.ink, total, { bold: true }), total.length, true))
  if (s && s.files.length > 0) {
    const add = `+${s.add}`
    const del = `-${s.del}`
    const counts = ctx.els.Text({ children: [txt(ctx, C.ok, add), txt(ctx, C.dim, ' '), txt(ctx, C.err, del)] })
    out.push(entry(ctx, width, upper(`changed ${plural(s.files.length, 'file')}`), counts, add.length + 1 + del.length))
  }
  if (s && s.contextPercent !== undefined) {
    const pct = `${Math.round(s.contextPercent)}%`
    out.push(entry(ctx, width, 'CONTEXT USED', txt(ctx, C.ink, pct), pct.length))
  }
  if (data.timeStrip) out.push(...stripLines(ctx, width, data.timeStrip))
  const inator = ctx.settings.ingredients.inator
  if (s) {
    out.push(dashes())
    out.push(centered(ctx, width, txt(ctx, C.ink, inator ? `${upper(inatorQuip(s))}, CURSES` : 'THANK YOU FOR CODING WITH US', { bold: true, wrap: 'truncate-end' })))
    out.push(centered(ctx, width, txt(ctx, C.ink, barcode(s.turn).slice(0, width), { wrap: 'truncate-end' })))
    out.push(centered(ctx, width, txt(ctx, C.dim, `T${s.turn} · ${serial(s.turn)}`, { wrap: 'truncate-end' })))
  } else if (inator) {
    out.push(centered(ctx, width, txt(ctx, C.ink, `${upper(inatorQuip(null))}, CURSES`, { bold: true, wrap: 'truncate-end' })))
  }
  out.push(rule(ctx, width, ' -', C.faint, '✂'))
  return ctx.els.Box({ flexDirection: 'column', children: out })
}
