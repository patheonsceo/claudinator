import type { RenderElement } from 'claude-code'

import { plural } from '../../engine/format'
import { tone } from '../../engine/palette'
import { GLYPHS, bashSummary, changeOf, errorSummary, factsOf, groupSummary, isChangeTool, pickDiffLines } from '../../engine/tool-facts'
import type { DiffLine } from '../../engine/tool-facts'
import type { Ctx, ResultRow, ToolRow } from '../look'
import { C, INDENT, delta, fileName, grow, pathLabel, timing, txt } from './style'

function diffLine(ctx: Ctx, line: DiffLine): RenderElement {
  const faded = ctx.fade > 0
  return ctx.els.Box({
    paddingLeft: INDENT,
    children: ctx.els.Text({
      color: tone(C.text, ctx.fade),
      ...(faded ? {} : { backgroundColor: line.kind === '+' ? 'diffAdded' : 'diffRemoved' }),
      wrap: 'truncate-end',
      children: `${line.kind} ${line.text.replace(/\t/g, '  ')}`,
    }),
  })
}

export function toolRow(row: ToolRow, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  const facts = factsOf(row.tool, row.input)
  const change = isChangeTool(row.tool) ? changeOf(row.tool, row.input) : null
  const failed = row.isErrored || row.isInterrupted
  const glyph = failed ? txt(ctx, C.err, '✕') : txt(ctx, change ? C.accent : C.dim, GLYPHS[facts.glyph])
  const verb = txt(ctx, change ? C.text : C.dim, facts.verb.slice(0, 6).padEnd(6))
  const target = facts.isPath && facts.target !== '' ? pathLabel(ctx, facts.target) : txt(ctx, C.text, facts.target, { wrap: 'truncate-end' })
  const parts: RenderElement[] = [glyph, verb, grow(ctx, target)]
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

export function toolGroup(rows: ToolRow[], ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  const failed = rows.some(r => r.isErrored || r.isInterrupted)
  const running = rows.some(r => r.isRunning)
  const isTimed = rows.length > 0 && rows.every(r => r.durationMs !== undefined)
  const first = rows[0]
  const glyph = failed ? txt(ctx, C.err, '✕') : txt(ctx, C.dim, first ? GLYPHS[factsOf(first.tool, first.input).glyph] : '·')
  const parts: RenderElement[] = [glyph, grow(ctx, txt(ctx, C.dim, groupSummary(rows), { wrap: 'truncate-end' }))]
  if (failed) parts.push(txt(ctx, C.err, 'failed'))
  if (isTimed) parts.push(timing(ctx, rows.reduce((sum, r) => sum + (r.durationMs ?? 0), 0)))
  else if (running) parts.push(txt(ctx, C.dim, '…'))
  const line = Box({ flexDirection: 'row', columnGap: 1, children: parts })
  const paths = rows.map(r => factsOf(r.tool, r.input)).filter(f => f.isPath && f.target !== '').map(f => f.target)
  if (paths.length === 0) return line
  const names: RenderElement[] = []
  paths.forEach((p, i) => {
    if (i > 0) names.push(txt(ctx, C.faint, ' · '))
    names.push(fileName(ctx, p))
  })
  return Box({ flexDirection: 'column', children: [line, Box({ paddingLeft: 2, children: Text({ wrap: 'truncate-end', children: names }) })] })
}

export function quietLine(hidden: number, ctx: Ctx): RenderElement {
  return ctx.els.Box({ flexDirection: 'row', columnGap: 1, children: [txt(ctx, C.faint, '·'), txt(ctx, C.dim, `${plural(hidden, 'step')} hidden`)] })
}

function resultLine(ctx: Ctx, color: string, text: string): RenderElement {
  return ctx.els.Box({ paddingLeft: 2, children: ctx.els.Text({ wrap: 'truncate-end', children: [txt(ctx, C.faint, '╰ '), txt(ctx, color, text)] }) })
}

/** A result collapsed to its telling line; null leaves Claude Code's drawing. */
export function toolResult(row: ResultRow, ctx: Ctx): RenderElement | null {
  if (row.isErrored) return resultLine(ctx, C.err, errorSummary(row.output) || 'failed')
  switch (row.tool) {
    case 'Bash': {
      const summary = bashSummary(row.output)
      return summary === '' ? ctx.els.Box({}) : resultLine(ctx, C.dim, summary)
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
