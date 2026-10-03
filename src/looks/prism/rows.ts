import type { RenderElement } from 'claude-code'

import { plural, printable } from '../../engine/format'
import { tone } from '../../engine/palette'
import { bashSummary, changeOf, errorSummary, factsOf, isChangeTool, pickDiffLines } from '../../engine/tool-facts'
import type { DiffLine, ToolFacts } from '../../engine/tool-facts'
import type { Ctx, ResultRow, ToolRow } from '../look'
import { C, FAIL, MARKS, NARROW_COLUMNS, STOP, TARGET_COLUMN, chip, chipSlot, delta, grow, hex, hueOf, markOf, pathLabel, safePath, stepChip, timing, txt } from './style'

/** What a call touches, as its row reads it: a search's pattern in quotes, anything else as given. */
function targetText(tool: string, facts: ToolFacts): string {
  const target = printable(facts.target, 400)
  return tool === 'Grep' && target !== '' ? `"${target}"` : target
}

function targetOf(ctx: Ctx, tool: string, facts: ToolFacts): RenderElement {
  if (facts.isPath && facts.target !== '') return pathLabel(ctx, facts.target)
  return txt(ctx, C.text, targetText(tool, facts), { wrap: 'truncate-end' })
}

function rowChip(ctx: Ctx, row: ToolRow, facts: ToolFacts): RenderElement {
  if (row.isInterrupted) return stepChip(ctx, facts.glyph, STOP)
  if (row.isErrored) return stepChip(ctx, facts.glyph, FAIL)
  return stepChip(ctx, facts.glyph, markOf(facts.glyph, facts.verb), facts.isPath ? facts.target : '')
}

/** A changed line under the target, sign and text on the diff tint as the lookbook draws it. */
function diffLine(ctx: Ctx, line: DiffLine): RenderElement {
  const { Box, Text } = ctx.els
  const fill = ctx.fade > 0 ? {} : { backgroundColor: line.kind === '+' ? 'diffAdded' : 'diffRemoved' }
  return Box({
    paddingLeft: TARGET_COLUMN,
    children: Text({
      wrap: 'truncate-end',
      children: Text({ ...fill, children: [txt(ctx, line.kind === '+' ? C.ok : C.err, line.kind), txt(ctx, C.text, ` ${printable(line.text, 400)}`)] }),
    }),
  })
}

export function toolRow(row: ToolRow, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  const facts = factsOf(row.tool, row.input)
  const change = isChangeTool(row.tool) ? changeOf(row.tool, row.input) : null
  const failed = row.isErrored || row.isInterrupted
  const parts: RenderElement[] = [chipSlot(ctx, rowChip(ctx, row, facts)), grow(ctx, targetOf(ctx, row.tool, facts))]
  if (failed) parts.push(txt(ctx, C.err, row.isInterrupted ? 'interrupted' : 'failed'))
  else if (change) parts.push(...delta(ctx, change.add, change.del))
  if (row.durationMs !== undefined) parts.push(timing(ctx, row.durationMs))
  else if (row.isRunning) parts.push(txt(ctx, C.dim, '…'))
  const line = Box({ flexDirection: 'row', columnGap: 1, children: parts })
  if (!change || failed || !ctx.settings.ingredients.miniDiffs) return line
  const lines = pickDiffLines(change.lines, 3)
  if (lines.length === 0) return line
  return Box({ flexDirection: 'column', children: [line, ...lines.map(l => diffLine(ctx, l))] })
}

/** The group's pill: the kind's own chip when every step is one kind, the kinds' marks side by side when mixed. */
function groupChip(ctx: Ctx, rows: ToolRow[], facts: ToolFacts[]): RenderElement {
  const h = hex(ctx)
  const kinds = [...new Set(facts.map(f => f.glyph))]
  const first = facts[0]
  if (rows.some(r => r.isErrored)) return stepChip(ctx, first?.glyph ?? 'other', FAIL)
  if (rows.some(r => r.isInterrupted)) return stepChip(ctx, first?.glyph ?? 'other', STOP)
  if (kinds.length === 1 && first) return stepChip(ctx, first.glyph, markOf(first.glyph, first.verb))
  return chip(ctx, ` ${kinds.slice(0, 4).map(k => MARKS[k].mark).join(' ')} `, h.cread, h.fg)
}

/**
 * The group's files as the lookbook counts them ("3 files in src/" and a dot
 * per file in its hue; a lone file by its path), then every other step's
 * target; mixed groups mark each of those with its kind.
 */
function groupBody(ctx: Ctx, rows: ToolRow[], facts: ToolFacts[], isMixed: boolean): Array<RenderElement | string> {
  const { Text } = ctx.els
  const paths = [...new Set(facts.filter(f => f.isPath && f.target !== '').map(f => f.target))]
  const body: Array<RenderElement | string> = []
  const [onePath] = paths
  if (paths.length === 1 && onePath) body.push(pathLabel(ctx, onePath))
  else if (paths.length > 0) {
    const dirs = new Set(paths.map(p => safePath(ctx, p).dir))
    const [dir] = [...dirs]
    body.push(txt(ctx, C.text, plural(paths.length, 'file')))
    if (dirs.size === 1 && dir) body.push(txt(ctx, C.dim, ` in ${dir}`))
    const dot = (p: string): RenderElement => Text({ color: tone(ctx.settings.ingredients.fileColors ? hueOf(ctx, p) : C.dim, ctx.fade), children: '●' })
    body.push(' ', Text({ children: paths.map(dot) }))
  }
  facts.forEach((f, i) => {
    if (f.isPath && f.target !== '') return
    if (body.length > 0) body.push(txt(ctx, C.faint, ' · '))
    if (isMixed) body.push(txt(ctx, C.dim, `${MARKS[f.glyph].mark} `))
    const target = targetText(rows[i]?.tool ?? '', f)
    body.push(txt(ctx, C.text, target === '' ? printable(f.verb, 40) : target))
  })
  return body
}

export function toolGroup(rows: ToolRow[], ctx: Ctx): RenderElement {
  const only = rows.length === 1 ? rows[0] : undefined
  if (only) return toolRow(only, ctx)
  const { Box, Text } = ctx.els
  const facts = rows.map(r => factsOf(r.tool, r.input))
  const isMixed = new Set(facts.map(f => f.glyph)).size > 1
  const failed = rows.some(r => r.isErrored || r.isInterrupted)
  const running = rows.some(r => r.isRunning)
  const isTimed = rows.length > 0 && rows.every(r => r.durationMs !== undefined)
  const parts: RenderElement[] = [chipSlot(ctx, groupChip(ctx, rows, facts)), grow(ctx, Text({ wrap: 'truncate-end', children: groupBody(ctx, rows, facts, isMixed) }))]
  if (failed) parts.push(txt(ctx, C.err, 'failed'))
  else if (isMixed && ctx.columns >= NARROW_COLUMNS) parts.push(txt(ctx, C.dim, plural(rows.length, 'step')))
  if (isTimed) parts.push(timing(ctx, rows.reduce((sum, r) => sum + (r.durationMs ?? 0), 0)))
  else if (running) parts.push(txt(ctx, C.dim, '…'))
  return Box({ flexDirection: 'row', columnGap: 1, children: parts })
}

export function quietLine(hidden: number, ctx: Ctx): RenderElement {
  return ctx.els.Text({ children: [txt(ctx, hex(ctx).g2, '✦'), txt(ctx, C.dim, ` ${plural(hidden, 'step')} folded`)] })
}

/** A result's telling line, under the row's target. */
function resultLine(ctx: Ctx, children: RenderElement[]): RenderElement {
  return ctx.els.Box({ paddingLeft: TARGET_COLUMN, children: ctx.els.Text({ wrap: 'truncate-end', children }) })
}

/** A result collapsed to its telling line; null leaves Claude Code's drawing. */
export function toolResult(row: ResultRow, ctx: Ctx): RenderElement | null {
  if (row.isErrored) return resultLine(ctx, [txt(ctx, C.err, errorSummary(row.output) || 'failed')])
  switch (row.tool) {
    case 'Bash': {
      const summary = bashSummary(row.output)
      return summary === '' ? ctx.els.Box({}) : resultLine(ctx, [txt(ctx, C.ok, '✓ '), txt(ctx, C.dim, summary)])
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
