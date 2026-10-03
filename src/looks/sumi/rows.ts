import type { RenderElement } from 'claude-code'

import { plural, printable, splitPath } from '../../engine/format'
import { fileColor } from '../../engine/palette'
import { bashSummary, changeOf, errorSummary, factsOf, isChangeTool, pickDiffLines } from '../../engine/tool-facts'
import type { DiffLine, ToolFacts } from '../../engine/tool-facts'
import type { Ctx, ResultRow, ToolRow } from '../look'
import { C, DIFF_INDENT, NARROW_COLUMNS, ink, line, shrink, tail, txt, wash } from './style'

/** The counts an edit carries, muted: `+3 −1`. */
function counts(add: number, del: number): string {
  return [add > 0 ? `+${add}` : '', del > 0 ? `−${del}` : ''].filter(s => s !== '').join(' ')
}

function baseName(ctx: Ctx, path: string): string {
  return splitPath(path, ctx.cwd).base
}

/** What a failed call was, in a few words: a file name, a command, or the verb. */
function whatOf(ctx: Ctx, facts: ToolFacts): string {
  if (facts.target === '') return facts.verb.toLowerCase()
  return facts.isPath ? baseName(ctx, facts.target) : facts.target
}

function diffLine(ctx: Ctx, l: DiffLine): RenderElement {
  return ctx.els.Box({
    paddingLeft: DIFF_INDENT,
    children: ctx.els.Text({
      color: ink(ctx, C.dim),
      ...(ctx.fade > 0 ? {} : { backgroundColor: l.kind === '+' ? 'diffAdded' : 'diffRemoved' }),
      wrap: 'truncate-end',
      children: `${l.kind === '+' ? '+' : '−'} ${printable(l.text.trim(), 400)}`,
    }),
  })
}

function failedRow(row: ToolRow, ctx: Ctx, facts: ToolFacts): RenderElement {
  return line(ctx, [
    txt(ctx, C.err, '✕'),
    ctx.els.Box({
      flexDirection: 'row',
      columnGap: 1,
      flexShrink: 1,
      minWidth: 0,
      children: [
        shrink(ctx, txt(ctx, C.dim, whatOf(ctx, facts), { wrap: 'truncate-end' })),
        ctx.els.Box({ flexShrink: 0, children: txt(ctx, C.dim, row.isInterrupted ? '· interrupted' : '· failed') }),
      ],
    }),
    ...tail(ctx, { isRunning: false, ...(row.durationMs === undefined ? {} : { durationMs: row.durationMs }) }),
  ])
}

/**
 * Reads, searches and commands leave a dot and a faint word. Only changes get
 * a mark: the indigo seal, the file name and its counts.
 */
export function toolRow(row: ToolRow, ctx: Ctx): RenderElement {
  const facts = factsOf(row.tool, row.input)
  if (row.isErrored || row.isInterrupted) return failedRow(row, ctx, facts)
  if (!isChangeTool(row.tool)) {
    const parts: RenderElement[] = [txt(ctx, C.dim, '·'), txt(ctx, wash(ctx), facts.verb.toLowerCase())]
    // A word alone says nothing for agents and other tools, so their target stays, faint.
    if ((facts.glyph === 'agent' || facts.glyph === 'other') && facts.target !== '') parts.push(shrink(ctx, txt(ctx, wash(ctx), facts.target, { wrap: 'truncate-end' })))
    return line(ctx, [...parts, ...tail(ctx, row)])
  }
  // NotebookEdit changes a file too, but carries no counts.
  const change = changeOf(row.tool, row.input) ?? { add: 0, del: 0, lines: [] }
  const parts: RenderElement[] = [txt(ctx, C.seal, '■')]
  if (facts.target !== '') {
    const { dir, base } = splitPath(facts.target, ctx.cwd)
    parts.push(shrink(ctx, txt(ctx, ctx.settings.ingredients.fileColors ? fileColor(dir + base) : C.text, base, { wrap: 'truncate-start' })))
  }
  const delta = counts(change.add, change.del)
  if (delta !== '') parts.push(ctx.els.Box({ flexShrink: 0, children: txt(ctx, C.dim, delta) }))
  const head = line(ctx, [...parts, ...tail(ctx, row)])
  if (!ctx.settings.ingredients.miniDiffs) return head
  const lines = pickDiffLines(change.lines, 3)
  if (lines.length === 0) return head
  return ctx.els.Box({ flexDirection: 'column', children: [head, ...lines.map(l => diffLine(ctx, l))] })
}

/** A folded run: one dot per call (a cross where one failed), then a faint count. */
export function toolGroup(rows: ToolRow[], ctx: Ctx): RenderElement {
  // A group of one says more as its own row: `·  read`, not `·  1 step`.
  const only = rows.length === 1 ? rows[0] : undefined
  if (only) return toolRow(only, ctx)
  const max = ctx.columns < NARROW_COLUMNS ? 8 : 12
  const marks: RenderElement[] = []
  rows.slice(0, max).forEach((r, i) => {
    if (i > 0) marks.push(txt(ctx, C.dim, ' '))
    if (r.isErrored || r.isInterrupted) marks.push(txt(ctx, C.err, '✕'))
    else if (isChangeTool(r.tool)) marks.push(txt(ctx, C.seal, '■'))
    else marks.push(txt(ctx, C.dim, '·'))
  })
  if (rows.length > max) marks.push(txt(ctx, wash(ctx), ' …'))
  const failed = rows.filter(r => r.isErrored || r.isInterrupted).length
  const parts: RenderElement[] = [ctx.els.Box({ flexShrink: 0, children: ctx.els.Text({ children: marks }) }), txt(ctx, wash(ctx), plural(rows.length, 'step'))]
  if (failed > 0) parts.push(ctx.els.Box({ flexShrink: 0, children: txt(ctx, C.dim, `· ${failed} failed`) }))
  const isTimed = rows.length > 0 && rows.every(r => r.durationMs !== undefined)
  const running = rows.some(r => r.isRunning)
  parts.push(...tail(ctx, isTimed ? { isRunning: false, durationMs: rows.reduce((s, r) => s + (r.durationMs ?? 0), 0) } : { isRunning: running }))
  return line(ctx, parts)
}

export function quietLine(hidden: number, ctx: Ctx): RenderElement {
  return line(ctx, [txt(ctx, wash(ctx), '·'), txt(ctx, wash(ctx), plural(hidden, 'step'))])
}

function resultLine(ctx: Ctx, text: string): RenderElement {
  return ctx.els.Box({ paddingLeft: DIFF_INDENT, children: txt(ctx, C.dim, text, { wrap: 'truncate-end' }) })
}

/** Results fall away; an error and a command's last line stay, under the row's words. */
export function toolResult(row: ResultRow, ctx: Ctx): RenderElement | null {
  if (row.isErrored) return resultLine(ctx, errorSummary(row.output) || 'failed')
  switch (row.tool) {
    case 'Bash': {
      const summary = bashSummary(row.output)
      return summary === '' ? ctx.els.Box({}) : resultLine(ctx, summary)
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
