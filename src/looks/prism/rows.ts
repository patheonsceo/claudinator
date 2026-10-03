import type { RenderElement } from 'claude-code'

import { plural, printable } from '../../engine/format'
import { tone } from '../../engine/palette'
import { GLYPHS, bashSummary, changeOf, errorSummary, factsOf, isChangeTool, pickDiffLines } from '../../engine/tool-facts'
import type { DiffLine, ToolFacts } from '../../engine/tool-facts'
import type { Ctx, ResultRow, ToolRow } from '../look'
import { C, CHIP_COLUMNS, chip, delta, gradientChip, grow, hex, hueOf, pathLabel, safePath, timing, txt } from './style'

/** `EDIT`, `SEARCH`; long MCP names end in an ellipsis instead of being cut. */
export function chipWord(verb: string): string {
  const word = printable(verb, 40).toUpperCase()
  return word.length > 6 ? word.slice(0, 5) + '…' : word
}

/** A call's pill: the file's hue for single-file calls, a gradient for agents, neutral otherwise. */
function rowChip(ctx: Ctx, facts: ToolFacts, failed: boolean): RenderElement {
  const h = hex(ctx)
  const word = chipWord(facts.verb)
  if (failed) return chip(ctx, ` ✕ ${word} `, h.err)
  const label = ` ${GLYPHS[facts.glyph]} ${word} `
  if (facts.glyph === 'agent') return gradientChip(ctx, label)
  if (facts.isPath && facts.target !== '') return chip(ctx, label, hueOf(ctx, facts.target))
  return chip(ctx, label, h.neutralBg, h.neutralFg)
}

function diffLine(ctx: Ctx, line: DiffLine, hue: string): RenderElement {
  const { Box, Text } = ctx.els
  const faded = ctx.fade > 0
  return Box({
    paddingLeft: 2,
    children: Text({
      wrap: 'truncate-end',
      children: [
        txt(ctx, hue, '▎'),
        txt(ctx, line.kind === '+' ? C.ok : C.err, ` ${line.kind} `),
        Text({ color: tone(C.text, ctx.fade), ...(faded ? {} : { backgroundColor: line.kind === '+' ? 'diffAdded' : 'diffRemoved' }), children: printable(line.text, 400) }),
      ],
    }),
  })
}

export function toolRow(row: ToolRow, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  const facts = factsOf(row.tool, row.input)
  const change = isChangeTool(row.tool) ? changeOf(row.tool, row.input) : null
  const failed = row.isErrored || row.isInterrupted
  const target = facts.isPath && facts.target !== '' ? pathLabel(ctx, facts.target) : txt(ctx, facts.isPath ? C.dim : C.text, printable(facts.target, 400), { wrap: 'truncate-end' })
  const parts: RenderElement[] = [Box({ width: CHIP_COLUMNS, flexShrink: 0, children: rowChip(ctx, facts, failed) }), grow(ctx, target)]
  if (failed) parts.push(txt(ctx, C.err, row.isInterrupted ? 'interrupted' : 'failed'))
  else if (change) parts.push(...delta(ctx, change.add, change.del))
  if (row.durationMs !== undefined) parts.push(timing(ctx, row.durationMs))
  else if (row.isRunning) parts.push(txt(ctx, C.dim, '…'))
  const line = Box({ flexDirection: 'row', columnGap: 1, children: parts })
  if (!change || failed || !ctx.settings.ingredients.miniDiffs) return line
  const lines = pickDiffLines(change.lines, 3)
  if (lines.length === 0) return line
  const hue = facts.target !== '' ? hueOf(ctx, facts.target) : hex(ctx).g1
  return Box({ flexDirection: 'column', children: [line, ...lines.map(l => diffLine(ctx, l, hue))] })
}

/** `◇ READ ×3` when the group is all one kind, `◇ STEPS ×4` when mixed; no count for one. */
function groupLabel(rows: ToolRow[]): string {
  const kinds = new Set(rows.map(r => factsOf(r.tool, r.input).glyph))
  const first = rows[0]
  const count = rows.length > 1 ? ` ×${rows.length}` : ''
  if (kinds.size === 1 && first) {
    const facts = factsOf(first.tool, first.input)
    return ` ${GLYPHS[facts.glyph]} ${chipWord(facts.verb)}${count} `
  }
  return ` ◇ STEPS${count} `
}

/** The group's files as a run of dots in their hues, then their names; other calls as glyph and target. */
function groupBody(ctx: Ctx, rows: ToolRow[]): Array<RenderElement | string> {
  const facts = rows.map(r => factsOf(r.tool, r.input))
  const paths = [...new Set(facts.filter(f => f.isPath && f.target !== '').map(f => f.target))]
  const others = facts.filter(f => !(f.isPath && f.target !== ''))
  const body: Array<RenderElement | string> = []
  const sep = (): void => {
    if (body.length > 0) body.push(txt(ctx, C.faint, ' · '))
  }
  if (paths.length > 0) body.push(ctx.els.Text({ children: paths.map(p => ctx.els.Text({ color: tone(hueOf(ctx, p), ctx.fade), children: '●' })) }), ' ')
  paths.forEach((p, i) => {
    if (i > 0) sep()
    body.push(txt(ctx, C.dim, safePath(ctx, p).base))
  })
  for (const f of others) {
    sep()
    body.push(txt(ctx, C.faint, `${GLYPHS[f.glyph]} `), txt(ctx, C.dim, printable(f.target === '' ? f.verb : f.target, 200)))
  }
  return body
}

export function toolGroup(rows: ToolRow[], ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  const h = hex(ctx)
  const failed = rows.some(r => r.isErrored || r.isInterrupted)
  const running = rows.some(r => r.isRunning)
  const isTimed = rows.length > 0 && rows.every(r => r.durationMs !== undefined)
  const label = groupLabel(rows)
  const pill = failed ? chip(ctx, label.replace(/^ \S/, ' ✕'), h.err) : chip(ctx, label, h.neutralBg, h.neutralFg)
  const parts: RenderElement[] = [Box({ flexShrink: 0, children: pill }), grow(ctx, Text({ wrap: 'truncate-end', children: groupBody(ctx, rows) }))]
  if (failed) parts.push(txt(ctx, C.err, 'failed'))
  if (isTimed) parts.push(timing(ctx, rows.reduce((sum, r) => sum + (r.durationMs ?? 0), 0)))
  else if (running) parts.push(txt(ctx, C.dim, '…'))
  return Box({ flexDirection: 'row', columnGap: 1, children: parts })
}

export function quietLine(hidden: number, ctx: Ctx): RenderElement {
  const h = hex(ctx)
  return ctx.els.Text({ children: [txt(ctx, h.g1, '✦'), txt(ctx, C.dim, ` ${plural(hidden, 'step')} folded`)] })
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
