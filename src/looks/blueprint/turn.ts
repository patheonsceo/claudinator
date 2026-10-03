import type { RenderElement } from 'claude-code'

import { clockLabel, printable } from '../../engine/format'
import { tone } from '../../engine/palette'
import { inatorQuip, noteText, superscript, timeStripRow } from '../common'
import type { Ctx, FootnoteData, HeadlineData, ReceiptData } from '../look'
import { C, NARROW_COLUMNS, fixed, rule, shrink, txt } from './style'

/** `SPEC ▸ fix the refresh race`, line breaks kept. */
export function userMessage(text: string, ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  return Box({
    flexDirection: 'row',
    children: [
      fixed(ctx, txt(ctx, C.cyan, 'SPEC ▸ ', { bold: true })),
      Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, children: Text({ color: tone(C.ink, ctx.fade), bold: ctx.fade === 0, wrap: 'wrap', children: printable(text, 4000, { keepNewlines: true }) }) }),
    ],
  })
}

/** `SHEET 7 ─ THE REFRESH RACE, FIXED ─────────`. */
export function headline(h: HeadlineData, ctx: Ctx): RenderElement {
  return ctx.els.Box({
    flexDirection: 'row',
    children: [
      fixed(ctx, [txt(ctx, C.dim, `SHEET ${h.turn}`), txt(ctx, C.faint, ' ─ ')]),
      shrink(ctx, txt(ctx, C.ink, printable(h.title, 120).toUpperCase(), { bold: true, wrap: 'truncate-end' })),
      fixed(ctx, txt(ctx, C.faint, ' ')),
      rule(ctx),
    ],
  })
}

// ── Title block ────────────────────────────────────────────────────────────

/** Terminal cells a character takes: two for East Asian wide and emoji, else one. */
function cellsOf(cp: number): number {
  const wide =
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  return wide ? 2 : 1
}

export function widthOf(text: string): number {
  let w = 0
  for (const ch of text) w += cellsOf(ch.codePointAt(0) ?? 32)
  return w
}

/** Cut to at most `max` cells, with an ellipsis when cut. */
export function clipCells(text: string, max: number): string {
  if (widthOf(text) <= max) return text
  let out = ''
  let w = 0
  for (const ch of text) {
    const c = cellsOf(ch.codePointAt(0) ?? 32)
    if (w + c > max - 1) break
    out += ch
    w += c
  }
  return out + '…'
}

/** A cell: its parts, colored, and the plain text they read as (for widths). */
type Cell = { plain: string; parts: Array<{ color: string; text: string; bold?: boolean }> }

const cell = (color: string, text: string, bold = false): Cell => ({ plain: text, parts: [{ color, text, bold }] })
const join = (...cells: Cell[]): Cell => ({ plain: cells.map(c => c.plain).join(''), parts: cells.flatMap(c => c.parts) })

function rowLine(ctx: Ctx, cells: Cell[], widths: number[]): RenderElement {
  const kids: RenderElement[] = [txt(ctx, C.dim, '│')]
  cells.forEach((c, i) => {
    kids.push(txt(ctx, C.dim, ' '))
    for (const p of c.parts) kids.push(txt(ctx, p.color, p.text, p.bold ? { bold: true } : {}))
    kids.push(txt(ctx, C.dim, ' '.repeat(Math.max(0, (widths[i] ?? 0) - widthOf(c.plain)) + 1) + '│'))
  })
  return ctx.els.Text({ wrap: 'truncate-end', children: kids })
}

function ruleLine(ctx: Ctx, widths: number[], [l, m, r]: [string, string, string]): RenderElement {
  return ctx.els.Text({ color: tone(C.dim, ctx.fade), wrap: 'truncate-end', children: l + widths.map(w => '─'.repeat(w + 2)).join(m) + r })
}

/** A drawing's title block: boxed rows of cells, every column as wide as its widest cell. */
function titleBlock(ctx: Ctx, rows: Cell[][]): RenderElement[] {
  const n = rows[0]?.length ?? 0
  const widths = Array.from({ length: n }, (_, i) => Math.max(...rows.map(r => widthOf(r[i]?.plain ?? ''))))
  const lines: RenderElement[] = [ruleLine(ctx, widths, ['┌', '┬', '┐'])]
  rows.forEach((r, i) => {
    if (i > 0) lines.push(ruleLine(ctx, widths, ['├', '┼', '┤']))
    lines.push(rowLine(ctx, r, widths))
  })
  lines.push(ruleLine(ctx, widths, ['└', '┴', '┘']))
  return lines
}

/** Room the first column may take so the whole block fits `columns`. */
function titleRoom(columns: number, others: string[]): number {
  const fixedWidth = 1 + 3 * (others.length + 1) + others.reduce((sum, s) => sum + widthOf(s), 0)
  return Math.max(8, columns - fixedWidth)
}

function noteLine(ctx: Ctx, note: FootnoteData): RenderElement {
  const text = noteText(note, ctx.cwd)
  const cut = note.durationMs === undefined ? -1 : text.lastIndexOf(' · ')
  const what = cut < 0 ? text : text.slice(0, cut)
  const time = cut < 0 ? '' : ' ' + text.slice(cut + 3).toUpperCase()
  const space = what.indexOf(' ')
  const verb = (space < 0 ? what : what.slice(0, space)).toUpperCase()
  const rest = space < 0 ? '' : what.slice(space)
  return ctx.els.Text({
    wrap: 'truncate-end',
    children: [txt(ctx, C.dim, 'NOTE '), txt(ctx, C.cyan, superscript(note.n)), txt(ctx, C.dim, ` ${verb === 'RUN' ? 'EXEC' : verb}${rest}${time}`)],
  })
}

/**
 * A finished turn as a drawing's title block, footnotes above, the time strip
 * below:
 *
 *   ┌─────────────────────────┬──────────┬─────────┐
 *   │ THE REFRESH RACE, FIXED │ DWG T-07 │ REV A   │
 *   ├─────────────────────────┼──────────┼─────────┤
 *   │ 2 FILES  +103 −10       │ 2:14     │ CTX 41% │
 *   └─────────────────────────┴──────────┴─────────┘
 *   DRAWN: CLAUDE   CHECKED: YOU   SCALE 1:1
 */
export function receipt(data: ReceiptData, ctx: Ctx): RenderElement {
  const inator = ctx.settings.ingredients.inator
  const s = data.stats
  const named = data.title !== undefined && data.title.trim() !== '' ? printable(data.title, 160).toUpperCase() : s ? `TURN ${s.turn}` : 'UNTITLED'
  const fullTitle = inator ? `${named}-INATOR` : named
  const clock = clockLabel(data.durationMs)

  let rows: Cell[][]
  if (s) {
    const dwg = join(cell(C.dim, 'DWG '), cell(C.ink, `T-${String(s.turn).padStart(2, '0')}`))
    const rev = join(cell(C.dim, 'REV '), cell(C.ink, 'A'))
    const filesWord = s.files.length === 1 ? 'FILE' : 'FILES'
    const files = [cell(C.ink, `${s.files.length} ${filesWord}`)]
    if (s.files.length > 0) {
      files.push(cell(C.dim, '  '))
      if (s.add > 0) files.push(cell(C.ok, `+${s.add}`))
      if (s.add > 0 && s.del > 0) files.push(cell(C.dim, ' '))
      if (s.del > 0) files.push(cell(C.err, `−${s.del}`))
      if (s.add === 0 && s.del === 0) files.push(cell(C.dim, '±0'))
    }
    const ctxCell = join(cell(C.dim, 'CTX '), cell(C.ink, s.contextPercent === undefined ? '—' : `${Math.round(s.contextPercent)}%`))
    const filesCell = join(...files)
    const col2 = Math.max(widthOf(dwg.plain), widthOf(clock))
    const col3 = Math.max(widthOf(rev.plain), widthOf(ctxCell.plain))
    const room = titleRoom(ctx.columns, ['x'.repeat(col2), 'x'.repeat(col3)])
    rows = [
      [cell(C.ink, clipCells(fullTitle, room), true), dwg, rev],
      [filesCell, cell(C.ink, clock), ctxCell],
    ]
  } else {
    const room = titleRoom(ctx.columns, [clock])
    rows = [[cell(C.ink, clipCells(fullTitle, room), true), cell(C.ink, clock)]]
  }

  const sig = inator ? 'DRAWN: DR. CLAUDE   CHECKED: YOU   SCALE 1:1   EVIL INC.' : 'DRAWN: CLAUDE   CHECKED: YOU   SCALE 1:1'
  const signature = ctx.els.Text({
    wrap: 'truncate-end',
    children: [txt(ctx, C.dim, sig), ...(inator ? [txt(ctx, C.faint, ' · '), txt(ctx, C.cyan, inatorQuip(s).toUpperCase())] : [])],
  })

  const children: RenderElement[] = [
    ...data.notes.map(n => noteLine(ctx, n)),
    ...titleBlock(ctx, rows),
    signature,
  ]
  if (data.timeStrip && ctx.columns >= NARROW_COLUMNS) {
    children.push(timeStripRow(ctx, data.timeStrip, { glyph: '▆', indent: 0, thinking: C.cyan, tools: C.ink, waiting: C.err }))
  }
  return ctx.els.Box({ flexDirection: 'column', children })
}
