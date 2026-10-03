import type { RenderElement } from 'claude-code'

import { formatDuration, plural, printable } from '../../engine/format'
import { tone } from '../../engine/palette'
import type { FileChange, TurnStats } from '../../engine/session-model'
import { inatorQuip, notesBlock, runStatsLine, stripColors } from '../common'
import type { Ctx, HeadlineData, ReceiptData } from '../look'
import { C, NARROW_COLUMNS, clipped, delta, gradientRun, gradientText, grow, hex, hueOf, safePath, txt } from './style'

export function userMessage(text: string, ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  return Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [
      // A lone star sits at the gradient's heart, as the lookbook's gradient text paints one glyph.
      Box({ flexShrink: 0, children: txt(ctx, hex(ctx).g2, '✦', { bold: true }) }),
      grow(ctx, Text({ color: tone(C.text, ctx.fade), bold: ctx.fade === 0, wrap: 'wrap', children: printable(text, 4000, { keepNewlines: true }) })),
    ],
  })
}

export function headline(h: HeadlineData, ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  const p = hex(ctx)
  const head = `✦ Turn ${h.turn}`
  const title = printable(h.title, 120)
  // The rule is the whole sweep, a thin line so the title still leads.
  const ruleLen = Math.max(0, Math.min(400, ctx.columns - [...head].length - title.length - 2))
  return Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [
      Box({ flexShrink: 0, children: gradientText(ctx, head, [p.g1, p.g2, p.g3], { bold: true }) }),
      Box({ flexShrink: 1, minWidth: 0, children: Text({ color: tone(C.text, ctx.fade), bold: ctx.fade === 0, wrap: 'truncate-end', children: title }) }),
      clipped(ctx, gradientRun(ctx, '─', ruleLen, [p.g1, p.g2, p.g3])),
    ],
  })
}

/**
 * How many ribbon cells each file gets: at least one, the rest by lines
 * changed (largest remainder), in the order the files were first changed.
 */
export function ribbonSplit(files: readonly FileChange[], width: number): Array<{ file: string; cells: number }> {
  const shown = files.slice(0, Math.max(0, width))
  if (shown.length === 0) return []
  const weights = shown.map(f => Math.max(1, f.add + f.del))
  const total = weights.reduce((a, b) => a + b, 0)
  const spare = width - shown.length
  const exact = weights.map(w => (w / total) * spare)
  const cells = exact.map(x => 1 + Math.floor(x))
  let left = width - cells.reduce((a, b) => a + b, 0)
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    cells[i] = (cells[i] ?? 0) + 1
    left--
  }
  return shown.map((f, i) => ({ file: f.file, cells: cells[i] ?? 1 }))
}

/**
 * The files a turn changed, with line counts when Claudinator has them
 * (`byFile`); otherwise the bare list, each file weighing the same.
 */
function changesOf(stats: TurnStats | null): { files: FileChange[]; isCounted: boolean } {
  if (!stats) return { files: [], isCounted: false }
  if (stats.byFile && stats.byFile.length > 0) return { files: stats.byFile, isCounted: true }
  return { files: stats.files.map(file => ({ file, add: 0, del: 0 })), isCounted: false }
}

/**
 * The turn's fingerprint: a ribbon split by file in each file's hue, a
 * one-cell gap between files, or a gradient when no files changed.
 */
function ribbon(ctx: Ctx, files: readonly FileChange[], width: number): RenderElement {
  const p = hex(ctx)
  const shown = files.slice(0, Math.floor((width + 1) / 2))
  const split = ribbonSplit(shown, width - Math.max(0, shown.length - 1))
  const children: Array<RenderElement | string> = []
  if (split.length === 0) children.push(...gradientRun(ctx, '▰', width, [p.g1, p.g2, p.g3], width))
  split.forEach((s, i) => {
    if (i > 0) children.push(' ')
    children.push(ctx.els.Text({ color: tone(hueOf(ctx, s.file), ctx.fade), children: '▰'.repeat(s.cells) }))
  })
  return ctx.els.Box({ flexShrink: 0, children: ctx.els.Text({ children }) })
}

/** `✦ turn 7`, and the column the ribbon (and the legend under it) starts at. */
function turnLabel(turn: number): { label: string; ribbonColumn: number } {
  const label = `✦ turn ${turn}`
  return { label, ribbonColumn: [...label].length + 1 }
}

/** Each file as a dot in its hue, then its name and lines, starting under the ribbon. */
function legend(ctx: Ctx, byFile: readonly FileChange[], isCounted: boolean, indent: number): RenderElement {
  const { Box, Text } = ctx.els
  const parts: Array<RenderElement | string> = []
  byFile.forEach((f, i) => {
    if (i > 0) parts.push('  ')
    const name = safePath(ctx, f.file).base
    parts.push(txt(ctx, hueOf(ctx, f.file), '●'), ' ', txt(ctx, C.dim, isCounted ? `${name} ${plural(f.add + f.del, 'line')}` : name))
  })
  return Box({ paddingLeft: indent, children: Text({ wrap: 'truncate-end', children: parts }) })
}

function receiptLine(data: ReceiptData, ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  const p = hex(ctx)
  const s = data.stats
  const stops = [p.g1, p.g2, p.g3]
  const parts: RenderElement[] = [s ? gradientText(ctx, turnLabel(s.turn).label, stops, { bold: true }) : txt(ctx, p.g2, '✦', { bold: true })]
  if (s) parts.push(ribbon(ctx, changesOf(s).files, ctx.columns >= NARROW_COLUMNS ? 24 : 12))
  const tail: Array<RenderElement | string> = [txt(ctx, C.text, formatDuration(data.durationMs))]
  const sep = (): void => {
    tail.push(' ', txt(ctx, C.dim, '·'), ' ')
  }
  if (s && (s.add > 0 || s.del > 0)) {
    sep()
    delta(ctx, s.add, s.del).forEach((d, i) => tail.push(...(i > 0 ? [' ', d] : [d])))
  }
  if (s && s.contextPercent !== undefined) {
    sep()
    tail.push(txt(ctx, C.text, `${Math.round(s.contextPercent)}%`))
  }
  parts.push(Text({ children: tail }))
  const row: RenderElement[] = [Box({ flexDirection: 'row', columnGap: 1, flexShrink: 0, children: parts })]
  if (ctx.settings.ingredients.inator) row.push(clipped(ctx, [txt(ctx, C.dim, '· '), gradientText(ctx, inatorQuip(s), stops, { bold: true })]))
  return Box({ flexDirection: 'row', columnGap: 1, children: row })
}

export function receipt(data: ReceiptData, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  const p = hex(ctx)
  const { files, isCounted } = changesOf(data.stats)
  const indent = data.stats ? turnLabel(data.stats.turn).ribbonColumn : 2
  const blocks: Array<RenderElement | null> = [
    notesBlock(ctx, data.notes, { indent: 2, accent: p.g1 }),
    receiptLine(data, ctx),
    files.length > 0 ? legend(ctx, files, isCounted, indent) : null,
    data.timeStrip ? runStatsLine(ctx, data.timeStrip, { ...stripColors('prism', ctx.isDark), indent }) : null,
  ]
  const shown = blocks.filter((x): x is RenderElement => x !== null)
  return shown.length === 1 && shown[0] ? shown[0] : Box({ flexDirection: 'column', children: shown })
}
