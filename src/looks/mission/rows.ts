import type { RenderElement } from 'claude-code'

import { SLOW_MS, formatDuration, oneLine, printable } from '../../engine/format'
import { bashSummary, changeOf, errorSummary, factsOf, isChangeTool, pickDiffLines } from '../../engine/tool-facts'
import type { DiffLine, Glyph } from '../../engine/tool-facts'
import type { Ctx, ResultRow, ToolRow } from '../look'
import { C, DURATION_WIDTH, LEADER, METER_WIDTH, NARROW_COLUMNS, READOUT_WIDTH, TAGS, TAG_WIDTH, fileName, fill, fixed, grow, meter, pathLabel, shrinks, tClock, txt } from './style'

/** What one channel line carries; `channel` lays it out on the shared columns. */
export type Channel = {
  rail: string
  railColor: string
  offsetMs?: number
  /** Fixed cells after the clock (a tag, a footnote number), each followed by a space. */
  lead: RenderElement[]
  target: RenderElement
  /** An edit's meter, or null to run the leader through the meter column. */
  meter: RenderElement[] | null
  /** The reading, right-aligned in its column: parts and their width in cells. */
  value: Reading | null
  durationMs?: number
  isRunning: boolean
}

export type Reading = { parts: RenderElement[]; width: number }

/** A one-color reading: `PASS`, `FAIL`, `L40–80`. */
function reading(ctx: Ctx, text: string, color: string, bold = false): Reading | null {
  return text === '' ? null : { parts: [txt(ctx, color, text, bold ? { bold: true } : {})], width: text.length }
}

/** `+3 −1`; a zero side reads faint. */
function counts(ctx: Ctx, add: number, del: number): Reading {
  const a = `+${add}`
  const d = `−${del}`
  return { parts: [txt(ctx, add > 0 ? C.ok : C.faint, a), txt(ctx, C.faint, ' '), txt(ctx, del > 0 ? C.err : C.faint, d)], width: a.length + 1 + d.length }
}

const BLANK_DURATION = ' '.repeat(DURATION_WIDTH + 1)

/** Cells between the rail and a row's target, so continuation lines line up under it. */
export function targetIndent(offsetMs: number | undefined): number {
  return 1 + (offsetMs === undefined ? 0 : 8) + TAG_WIDTH + 1
}

function dots(ctx: Ctx, n: number): RenderElement {
  return txt(ctx, C.faint, '·'.repeat(Math.max(0, n)))
}

/**
 * One instrument line: rail, clock, tag, target, a dotted leader, then the
 * meter, the reading and the duration on fixed right-aligned columns.
 */
export function channel(ctx: Ctx, ch: Channel): RenderElement {
  const head: RenderElement[] = [txt(ctx, ch.railColor, ch.rail), txt(ctx, C.dim, ' ')]
  if (ch.offsetMs !== undefined) head.push(txt(ctx, C.dim, tClock(ch.offsetMs) + ' '))
  head.push(...ch.lead)

  const tail: RenderElement[] = []
  const wide = ctx.columns >= NARROW_COLUMNS
  const metered = wide && ch.meter !== null
  if (metered) tail.push(txt(ctx, C.faint, ' '), ...(ch.meter ?? []), txt(ctx, C.faint, ' '))
  else if (wide) tail.push(dots(ctx, METER_WIDTH + 2))
  const value = ch.value
  if (value) {
    const pad = READOUT_WIDTH - 1 - value.width
    tail.push(metered ? txt(ctx, C.faint, ' '.repeat(Math.max(0, pad))) : dots(ctx, pad), txt(ctx, C.faint, ' '), ...value.parts)
  } else tail.push(metered ? txt(ctx, C.faint, ' '.repeat(READOUT_WIDTH)) : dots(ctx, READOUT_WIDTH))
  if (ch.durationMs !== undefined) {
    const slow = ch.durationMs >= SLOW_MS
    tail.push(txt(ctx, slow ? C.amber : C.dim, ' ' + formatDuration(ch.durationMs).padStart(DURATION_WIDTH), slow ? { bold: true } : {}))
  } else if (ch.isRunning) tail.push(txt(ctx, C.dim, ' ' + '…'.padStart(DURATION_WIDTH)))
  else tail.push(txt(ctx, C.faint, BLANK_DURATION))

  return ctx.els.Box({
    flexDirection: 'row',
    children: [fixed(ctx, head), shrinks(ctx, ch.target), fill(ctx, C.faint, ' ' + LEADER), fixed(ctx, tail)],
  })
}

/** A tag in its column: `READ`, `NEW `. */
export function tagCell(ctx: Ctx, glyph: Glyph): RenderElement {
  return txt(ctx, C.teal, TAGS[glyph].padEnd(TAG_WIDTH) + ' ')
}

/** A call's target: a path as folder and name, anything else as one truncated line. */
export function targetOf(ctx: Ctx, tool: string, input: unknown): RenderElement {
  const facts = factsOf(tool, input)
  if (facts.isPath && facts.target !== '') return pathLabel(ctx, facts.target)
  const label = facts.glyph === 'other' ? [txt(ctx, C.dim, facts.verb + ' ')] : []
  return ctx.els.Text({ wrap: 'truncate-end', children: [...label, txt(ctx, C.text, facts.target)] })
}

function rec(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

/** A quiet reading for calls with nothing to count: the lines a Read took, a search's file filter. */
function metaOf(tool: string, input: unknown): string {
  const i = rec(input)
  const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : undefined)
  if (tool === 'Read') {
    const offset = num(i.offset)
    const limit = num(i.limit)
    if (offset !== undefined && limit !== undefined) return `L${offset}–${offset + limit}`
    if (offset !== undefined) return `L${offset}+`
    if (limit !== undefined) return `L0–${limit}`
    return ''
  }
  if (tool === 'Grep') {
    const filter = typeof i.glob === 'string' ? i.glob : typeof i.type === 'string' ? i.type : ''
    return oneLine(filter, 8)
  }
  return ''
}

function diffLine(ctx: Ctx, indent: number, line: DiffLine): RenderElement {
  const added = line.kind === '+'
  return ctx.els.Box({
    flexDirection: 'row',
    children: [
      fixed(ctx, [txt(ctx, C.faint, '│'), txt(ctx, C.faint, ' '.repeat(indent))]),
      grow(ctx, ctx.els.Text({ wrap: 'truncate-end', children: [txt(ctx, added ? C.ok : C.err, added ? '+ ' : '− '), txt(ctx, added ? C.text : C.dim, printable(line.text, 400))] })),
    ],
  })
}

export function toolRow(row: ToolRow, ctx: Ctx): RenderElement {
  const facts = factsOf(row.tool, row.input)
  const change = isChangeTool(row.tool) ? changeOf(row.tool, row.input) : null
  const failed = row.isErrored || row.isInterrupted
  let value: Reading | null
  if (failed) value = reading(ctx, row.isInterrupted ? 'ABORT' : 'FAIL', C.err, true)
  else if (change) value = counts(ctx, change.add, change.del)
  else if (row.isRunning) value = null
  else if (facts.glyph === 'run') value = reading(ctx, 'PASS', C.ok)
  else value = reading(ctx, metaOf(row.tool, row.input), C.dim)

  const line = channel(ctx, {
    rail: failed ? '┿' : change ? '├' : '│',
    railColor: failed ? C.err : change ? C.amber : C.faint,
    ...(row.turnOffsetMs === undefined ? {} : { offsetMs: row.turnOffsetMs }),
    lead: [tagCell(ctx, facts.glyph)],
    target: targetOf(ctx, row.tool, row.input),
    meter: change && !failed ? meter(ctx, change.add, change.del) : null,
    value,
    ...(row.durationMs === undefined ? {} : { durationMs: row.durationMs }),
    isRunning: row.isRunning,
  })
  if (!change || failed || !ctx.settings.ingredients.miniDiffs) return line
  const lines = pickDiffLines(change.lines, 3)
  if (lines.length === 0) return line
  const indent = targetIndent(row.turnOffsetMs)
  return ctx.els.Box({ flexDirection: 'column', children: [line, ...lines.map(l => diffLine(ctx, indent, l))] })
}

export function toolGroup(rows: ToolRow[], ctx: Ctx): RenderElement {
  const failed = rows.some(r => r.isErrored || r.isInterrupted)
  const running = rows.some(r => r.isRunning)
  const timed = rows.length > 0 && rows.every(r => r.durationMs !== undefined)
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
    summary.push(txt(ctx, C.teal, TAGS[g]), txt(ctx, C.dim, ` ×${counts.get(g) ?? 0}`))
  })
  const offsetMs = rows[0]?.turnOffsetMs
  const line = channel(ctx, {
    rail: failed ? '┿' : '│',
    railColor: failed ? C.err : C.faint,
    ...(offsetMs === undefined ? {} : { offsetMs }),
    lead: [],
    target: ctx.els.Text({ wrap: 'truncate-end', children: summary }),
    meter: null,
    value: failed ? reading(ctx, 'FAIL', C.err, true) : null,
    ...(timed ? { durationMs: rows.reduce((sum, r) => sum + (r.durationMs ?? 0), 0) } : {}),
    isRunning: running,
  })
  const paths = rows.map(r => factsOf(r.tool, r.input)).filter(f => f.isPath && f.target !== '').map(f => f.target)
  if (paths.length === 0) return line
  const names: RenderElement[] = []
  paths.forEach((p, i) => {
    if (i > 0) names.push(txt(ctx, C.faint, ' · '))
    names.push(fileName(ctx, p))
  })
  const indent = 1 + (offsetMs === undefined ? 0 : 8)
  return ctx.els.Box({
    flexDirection: 'column',
    children: [
      line,
      ctx.els.Box({
        flexDirection: 'row',
        children: [fixed(ctx, [txt(ctx, C.faint, '│'), txt(ctx, C.faint, ' '.repeat(indent))]), grow(ctx, ctx.els.Text({ wrap: 'truncate-end', children: names }))],
      }),
    ],
  })
}

export function quietLine(hidden: number, ctx: Ctx): RenderElement {
  const n = Math.max(0, Math.floor(hidden))
  return ctx.els.Text({ wrap: 'truncate-end', children: [txt(ctx, C.faint, '┆ ░░ '), txt(ctx, C.dim, `${n} ${n === 1 ? 'EVENT' : 'EVENTS'} SUPPRESSED`)] })
}

function resultLine(ctx: Ctx, color: string, text: string): RenderElement {
  return ctx.els.Box({
    flexDirection: 'row',
    children: [fixed(ctx, [txt(ctx, C.faint, '│ └ ')]), grow(ctx, txt(ctx, color, text, { wrap: 'truncate-end' }))],
  })
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
