import type { RenderElement } from 'claude-code'

import { printable, splitPath } from '../../engine/format'
import { fileColor } from '../../engine/palette'
import { bashSummary, changeOf, errorSummary, factsOf, isChangeTool, pickDiffLines } from '../../engine/tool-facts'
import type { DiffLine } from '../../engine/tool-facts'
import type { Ctx, ResultRow, ToolRow } from '../look'
import { C, cellsOf, fixed, give, item, line, paperOf, priceOf, txt, upper } from './style'

/** Mini diff lines print indented under their item, sign in color, code as written. */
function diffLine(ctx: Ctx, width: number, l: DiffLine): RenderElement {
  return line(ctx, width, [
    give(ctx, ctx.els.Text({ wrap: 'truncate-end', children: [txt(ctx, l.kind === '+' ? C.ok : C.err, l.kind), txt(ctx, C.dim, ' ' + printable(l.text.trim(), 400))] })),
  ], { paddingLeft: 2 })
}

/** What the item is called on the slip: the verb, then the target in capitals. */
function labelOf(row: ToolRow, ctx: Ctx, color: string): { els: RenderElement[]; cells: number } {
  const facts = factsOf(row.tool, row.input)
  const verb = upper(facts.verb.length > 10 ? facts.verb.slice(0, 9) + '…' : facts.verb)
  if (facts.target === '') return { els: [fixed(ctx, txt(ctx, color, verb))], cells: cellsOf(verb) }
  // The space rides on the verb so the label reads as one phrase wherever it is copied.
  const els: RenderElement[] = [fixed(ctx, txt(ctx, color, verb + ' '))]
  let target: RenderElement
  let cells: number
  if (facts.isPath) {
    const { dir, base } = splitPath(facts.target, ctx.cwd)
    const baseColor = ctx.settings.ingredients.fileColors ? fileColor(dir + base) : color
    target = ctx.els.Text({ wrap: 'truncate-start', children: [txt(ctx, color === C.ink ? C.dim : color, upper(dir)), txt(ctx, baseColor, upper(base))] })
    cells = cellsOf(dir + base)
  } else {
    const text = upper(facts.target)
    target = txt(ctx, color, text, { wrap: 'truncate-end' })
    cells = cellsOf(text)
  }
  els.push(give(ctx, target))
  return { els, cells: cellsOf(verb) + 1 + cells }
}

export function toolRow(row: ToolRow, ctx: Ctx): RenderElement {
  const width = paperOf(ctx)
  const failed = row.isErrored
  const voided = row.isInterrupted && !failed
  const change = isChangeTool(row.tool) ? changeOf(row.tool, row.input) : null
  const ink = failed ? C.err : voided ? C.dim : C.ink
  const label = labelOf(row, ctx, ink)
  let cells = label.cells
  const els = [...label.els]
  const note = (children: RenderElement[], n: number): void => {
    els.push(fixed(ctx, ctx.els.Text({ children }), { marginLeft: 2 }))
    cells += 2 + n
  }
  if (failed) note([txt(ctx, C.err, 'FAILED', { bold: true })], 6)
  else if (voided) note([txt(ctx, C.warn, 'VOID', { bold: true })], 4)
  else if (change && change.add + change.del > 0) {
    const add = `+${change.add}`
    const del = `-${change.del}`
    note([txt(ctx, C.ok, add), txt(ctx, C.dim, ' '), txt(ctx, C.err, del)], add.length + 1 + del.length)
  }
  const priceText = row.durationMs !== undefined ? priceOf(row.durationMs) : row.isRunning ? '...' : ''
  const price = priceText === '' ? null : txt(ctx, failed ? C.err : C.ink, priceText)
  const main = item(ctx, width, els, cells, price, priceText.length)
  if (!change || failed || voided || !ctx.settings.ingredients.miniDiffs) return main
  const lines = pickDiffLines(change.lines, 3)
  if (lines.length === 0) return main
  return ctx.els.Box({ flexDirection: 'column', children: [main, ...lines.map(l => diffLine(ctx, width, l))] })
}

/** A folded run prints as what it is: several items, one per line. */
export function toolGroup(rows: ToolRow[], ctx: Ctx): RenderElement {
  return ctx.els.Box({ flexDirection: 'column', children: rows.map(r => toolRow(r, ctx)) })
}

export function quietLine(hidden: number, ctx: Ctx): RenderElement {
  return txt(ctx, C.dim, `(${hidden} ${hidden === 1 ? 'ITEM' : 'ITEMS'} NOT PRINTED)`)
}

function resultLine(ctx: Ctx, color: string, text: string): RenderElement {
  return line(ctx, paperOf(ctx), [give(ctx, txt(ctx, color, text, { wrap: 'truncate-end' }))], { paddingLeft: 2 })
}

/** A result collapsed to its telling line; null leaves Claude Code's drawing. */
export function toolResult(row: ResultRow, ctx: Ctx): RenderElement | null {
  if (row.isErrored) return resultLine(ctx, C.err, `** ${upper(errorSummary(row.output) || 'failed')}`)
  switch (row.tool) {
    case 'Bash': {
      const summary = bashSummary(row.output)
      return summary === '' ? ctx.els.Box({}) : resultLine(ctx, C.dim, `> ${upper(summary)}`)
    }
    case 'Read':
    case 'Grep':
    case 'Glob':
      return ctx.els.Box({})
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
      return ctx.settings.ingredients.miniDiffs ? ctx.els.Box({}) : null
    default:
      return null
  }
}
