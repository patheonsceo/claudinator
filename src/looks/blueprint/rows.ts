import type { RenderElement } from 'claude-code'

import { formatDuration, printable } from '../../engine/format'
import { tone } from '../../engine/palette'
import { bashSummary, changeOf, errorSummary, factsOf, isChangeTool, pickDiffLines } from '../../engine/tool-facts'
import type { DiffLine, Glyph } from '../../engine/tool-facts'
import type { Ctx, ResultRow, ToolRow } from '../look'
import { C, DIFF_INDENT, calloutLetter, delta, fileName, fixed, pathLabel, rule, shrink, txt } from './style'

/** What a step is called on the drawing, one word per kind. */
const GROUP_TAGS: Record<Glyph, string> = {
  read: 'SCAN',
  search: 'SEARCH',
  run: 'EXEC',
  web: 'FETCH',
  agent: 'AGENT',
  edit: 'EDIT',
  create: 'WRITE',
  other: 'TOOL',
}

/** A row's tag: the verb in capitals, commands as EXEC, long MCP names cut. */
function tagOf(tool: string, verb: string): string {
  const word = tool === 'Bash' ? 'EXEC' : verb.toUpperCase()
  return word.length > 10 ? word.slice(0, 9) + '…' : word
}

function nonNegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined
}

/** The measurement a call carries before its result: a read's line span. */
function readMeta(input: unknown): string {
  if (input === null || typeof input !== 'object') return ''
  const limit = nonNegative(Reflect.get(input, 'limit'))
  const offset = nonNegative(Reflect.get(input, 'offset'))
  if (limit === undefined) return offset === undefined ? '' : `FROM L${offset}`
  return offset === undefined ? `${limit} LN` : `L${offset}–${offset + limit - 1}`
}

/** `  0.2s`, `  …` while running, or nothing. */
function timing(ctx: Ctx, row: { durationMs?: number; isRunning: boolean }): RenderElement | null {
  if (row.durationMs !== undefined) return fixed(ctx, txt(ctx, C.dim, '  ' + formatDuration(row.durationMs).padStart(5)))
  if (row.isRunning) return fixed(ctx, txt(ctx, C.dim, '  …'))
  return null
}

function diffLine(ctx: Ctx, line: DiffLine): RenderElement {
  const faded = ctx.fade > 0
  return ctx.els.Box({
    paddingLeft: DIFF_INDENT,
    children: ctx.els.Text({
      color: tone(C.ink, ctx.fade),
      ...(faded ? {} : { backgroundColor: line.kind === '+' ? 'diffAdded' : 'diffRemoved' }),
      wrap: 'truncate-end',
      children: `${line.kind} ${printable(line.text, 400)}`,
    }),
  })
}

function present<T>(x: T | null): x is T {
  return x !== null
}

/**
 * One call as a dimension line:
 * `├── READ ── src/cart.js ───────────── 142 LN ─┤  0.2s`.
 * Changes swap the head for a callout letter, failures for a cross.
 */
export function toolRow(row: ToolRow, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  const facts = factsOf(row.tool, row.input)
  const change = isChangeTool(row.tool) ? changeOf(row.tool, row.input) : null
  const failed = row.isErrored || row.isInterrupted

  const head = failed
    ? [txt(ctx, C.err, '╳', { bold: true }), txt(ctx, C.faint, '──')]
    : change
      ? [txt(ctx, C.ink, `(${calloutLetter(row.changeIndex)})`, { bold: true })]
      : [txt(ctx, C.faint, '├──')]
  const lead = fixed(ctx, [...head, txt(ctx, C.faint, ' '), txt(ctx, C.cyan, tagOf(row.tool, facts.verb)), txt(ctx, C.faint, ' ── ')])

  const hasTarget = facts.target !== ''
  const target = hasTarget
    ? shrink(ctx, facts.isPath ? pathLabel(ctx, facts.target) : txt(ctx, C.ink, facts.target, { wrap: 'truncate-end' }))
    : null

  let meta: RenderElement[] = []
  if (failed) meta = [txt(ctx, C.err, row.isInterrupted ? 'HALT' : 'FAIL', { bold: true })]
  else if (change) meta = delta(ctx, change.add, change.del)
  else if (row.tool === 'Read') {
    const span = readMeta(row.input)
    if (span !== '') meta = [txt(ctx, C.dim, span)]
  }
  const end = meta.length > 0 ? fixed(ctx, [txt(ctx, C.faint, ' '), ...meta, txt(ctx, C.faint, ' ─┤')]) : fixed(ctx, txt(ctx, C.faint, '┤'))

  const line = Box({
    flexDirection: 'row',
    children: [lead, target, hasTarget ? fixed(ctx, txt(ctx, C.faint, ' ')) : null, rule(ctx), end, timing(ctx, row)].filter(present),
  })
  if (!change || failed || !ctx.settings.ingredients.miniDiffs) return line
  const lines = pickDiffLines(change.lines, 3)
  if (lines.length === 0) return line
  return Box({ flexDirection: 'column', children: [line, ...lines.map(l => diffLine(ctx, l))] })
}

/** A folded run: `├── SCAN ×3 · EXEC ×1 ───────┤`, then its files. */
export function toolGroup(rows: ToolRow[], ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  const failed = rows.some(r => r.isErrored || r.isInterrupted)
  const running = rows.some(r => r.isRunning)
  const isTimed = rows.length > 0 && rows.every(r => r.durationMs !== undefined)

  const order: Glyph[] = []
  const counts = new Map<Glyph, number>()
  for (const r of rows) {
    const g = factsOf(r.tool, r.input).glyph
    if (!counts.has(g)) order.push(g)
    counts.set(g, (counts.get(g) ?? 0) + 1)
  }
  const summary: RenderElement[] = []
  order.forEach((g, i) => {
    if (i > 0) summary.push(txt(ctx, C.faint, ' · '))
    summary.push(txt(ctx, C.cyan, GROUP_TAGS[g]), txt(ctx, C.dim, ` ×${counts.get(g) ?? 0}`))
  })

  const head = failed ? [txt(ctx, C.err, '╳', { bold: true }), txt(ctx, C.faint, '── ')] : [txt(ctx, C.faint, '├── ')]
  const end = failed ? fixed(ctx, [txt(ctx, C.faint, ' '), txt(ctx, C.err, 'FAIL', { bold: true }), txt(ctx, C.faint, ' ─┤')]) : fixed(ctx, txt(ctx, C.faint, '┤'))
  const time = isTimed ? timing(ctx, { durationMs: rows.reduce((sum, r) => sum + (r.durationMs ?? 0), 0), isRunning: false }) : timing(ctx, { isRunning: running })
  const line = Box({
    flexDirection: 'row',
    children: [
      fixed(ctx, head),
      shrink(ctx, Text({ wrap: 'truncate-end', children: summary })),
      fixed(ctx, txt(ctx, C.faint, ' ')),
      rule(ctx),
      end,
      time,
    ].filter(present),
  })

  const paths = rows.map(r => factsOf(r.tool, r.input)).filter(f => f.isPath && f.target !== '').map(f => f.target)
  if (paths.length === 0) return line
  const names: RenderElement[] = []
  paths.forEach((p, i) => {
    if (i > 0) names.push(txt(ctx, C.faint, ' · '))
    names.push(fileName(ctx, p))
  })
  return Box({ flexDirection: 'column', children: [line, Box({ paddingLeft: 4, children: Text({ wrap: 'truncate-end', children: names }) })] })
}

/** The trace Quiet leaves: `┆ 3 MEASUREMENTS OMITTED`. */
export function quietLine(hidden: number, ctx: Ctx): RenderElement {
  const word = hidden === 1 ? 'MEASUREMENT' : 'MEASUREMENTS'
  return ctx.els.Box({ flexDirection: 'row', children: [txt(ctx, C.faint, '┆ '), txt(ctx, C.dim, `${hidden} ${word} OMITTED`)] })
}

function resultLine(ctx: Ctx, parts: RenderElement[]): RenderElement {
  return ctx.els.Box({ paddingLeft: DIFF_INDENT, children: ctx.els.Text({ wrap: 'truncate-end', children: parts }) })
}

/** A result collapsed to its telling line; null leaves Claude Code's drawing. */
export function toolResult(row: ResultRow, ctx: Ctx): RenderElement | null {
  if (row.isErrored) {
    return resultLine(ctx, [txt(ctx, C.err, 'NOTE', { bold: true }), txt(ctx, C.faint, ' ▸ '), txt(ctx, C.err, errorSummary(row.output) || 'failed')])
  }
  switch (row.tool) {
    case 'Bash': {
      const summary = bashSummary(row.output)
      return summary === '' ? ctx.els.Box({}) : resultLine(ctx, [txt(ctx, C.faint, '└─ '), txt(ctx, C.dim, summary)])
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
