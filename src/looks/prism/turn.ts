import type { RenderElement } from 'claude-code'

import { formatDuration, printable } from '../../engine/format'
import { tone } from '../../engine/palette'
import type { FileChange, TurnStats } from '../../engine/session-model'
import { inatorQuip, notesBlock, timeStripRow } from '../common'
import type { Ctx, HeadlineData, ReceiptData } from '../look'
import { C, NARROW_COLUMNS, clipped, delta, gradientRun, gradientText, grow, hex, hueOf, mix, safePath, txt } from './style'

export function userMessage(text: string, ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  return Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [
      Box({ flexShrink: 0, children: txt(ctx, hex(ctx).g1, '✦', { bold: true }) }),
      grow(ctx, Text({ color: tone(C.text, ctx.fade), bold: ctx.fade === 0, wrap: 'wrap', children: printable(text, 4000, { keepNewlines: true }) })),
    ],
  })
}

export function headline(h: HeadlineData, ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  const p = hex(ctx)
  const head = `✦ Turn ${h.turn}`
  const title = printable(h.title, 120)
  // The rule is the same sweep, muted toward the background so the title leads.
  const muted = [p.g1, p.g2, p.g3].map(c => mix(c, p.bg, 0.45))
  const ruleLen = Math.max(0, Math.min(400, ctx.columns - [...head].length - title.length - 2))
  return Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [
      Box({ flexShrink: 0, children: gradientText(ctx, head, [p.g1, p.g2, p.g3], { bold: true }) }),
      Box({ flexShrink: 1, minWidth: 0, children: Text({ color: tone(C.text, ctx.fade), bold: ctx.fade === 0, wrap: 'truncate-end', children: title }) }),
      clipped(ctx, gradientRun(ctx, '─', ruleLen, muted)),
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

/** The turn's fingerprint: a ribbon split by file in each file's hue, or a gradient when no files changed. */
function ribbon(ctx: Ctx, files: readonly FileChange[], width: number): RenderElement {
  const p = hex(ctx)
  const split = ribbonSplit(files, width)
  const children = split.length === 0 ? gradientRun(ctx, '▰', width, [p.g1, p.g2, p.g3], width) : split.map(s => ctx.els.Text({ color: tone(hueOf(ctx, s.file), ctx.fade), children: '▰'.repeat(s.cells) }))
  return ctx.els.Box({ flexShrink: 0, children: ctx.els.Text({ children }) })
}

function legend(ctx: Ctx, byFile: readonly FileChange[], isCounted: boolean): RenderElement {
  const { Box, Text } = ctx.els
  const parts: Array<RenderElement | string> = []
  byFile.forEach((f, i) => {
    if (i > 0) parts.push('  ')
    parts.push(txt(ctx, hueOf(ctx, f.file), '●'), ' ', txt(ctx, C.text, safePath(ctx, f.file).base))
    if (isCounted) parts.push(' ', txt(ctx, C.dim, String(f.add + f.del)))
  })
  return Box({ paddingLeft: 2, children: Text({ wrap: 'truncate-end', children: parts }) })
}

function receiptLine(data: ReceiptData, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  const p = hex(ctx)
  const s = data.stats
  const sep = (): RenderElement => txt(ctx, C.faint, '·')
  const star = txt(ctx, p.g1, '✦', { bold: true })
  const parts: RenderElement[] = [s ? ctx.els.Text({ children: [star, ' ', txt(ctx, C.text, `turn ${s.turn}`, { bold: ctx.fade === 0 })] }) : star]
  if (s) parts.push(ribbon(ctx, changesOf(s).files, ctx.columns >= NARROW_COLUMNS ? 24 : 12))
  parts.push(txt(ctx, C.dim, formatDuration(data.durationMs)))
  if (s && (s.add > 0 || s.del > 0)) parts.push(sep(), ...delta(ctx, s.add, s.del))
  if (s && s.contextPercent !== undefined) parts.push(sep(), txt(ctx, C.dim, `${Math.round(s.contextPercent)}%`))
  const row: RenderElement[] = [Box({ flexDirection: 'row', columnGap: 1, flexShrink: 0, children: parts })]
  if (ctx.settings.ingredients.inator) row.push(clipped(ctx, [txt(ctx, C.faint, '· '), gradientText(ctx, inatorQuip(s), [p.g1, p.g2, p.g3])]))
  return Box({ flexDirection: 'row', columnGap: 1, children: row })
}

export function receipt(data: ReceiptData, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  const p = hex(ctx)
  const { files, isCounted } = changesOf(data.stats)
  const blocks: Array<RenderElement | null> = [
    notesBlock(ctx, data.notes, { indent: 2, accent: p.g1 }),
    receiptLine(data, ctx),
    files.length > 0 ? legend(ctx, files, isCounted) : null,
    data.timeStrip ? timeStripRow(ctx, data.timeStrip, { glyph: '▬', indent: 2, thinking: p.g1, tools: p.g2, waiting: 'error' }) : null,
  ]
  const shown = blocks.filter((x): x is RenderElement => x !== null)
  return shown.length === 1 && shown[0] ? shown[0] : Box({ flexDirection: 'column', children: shown })
}
