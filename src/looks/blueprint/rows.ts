import type { RenderElement } from 'claude-code'

import { formatDuration, printable, splitPath } from '../../engine/format'
import { tone } from '../../engine/palette'
import { bashSummary, changeOf, errorSummary, factsOf, isChangeTool, pickDiffLines } from '../../engine/tool-facts'
import type { DiffLine, Glyph, ToolFacts } from '../../engine/tool-facts'
import type { Ctx, ResultRow, ToolRow } from '../look'
import { C, DIFF_INDENT, NOTE_INDENT, calloutLetter, delta, fileName, fixed, pathLabel, rule, shrink, txt } from './style'

/** Every tag is padded to this many cells, so targets start in one column. */
const TAG_WIDTH = 4

/** What a step is called on the drawing: one 4-letter word per kind. */
const TAGS: Record<Glyph, string> = {
  read: 'READ',
  search: 'SCAN',
  run: 'EXEC',
  web: 'WEB',
  agent: 'TASK',
  edit: 'EDIT',
  create: 'NEW',
  plan: 'PLAN',
  other: 'TOOL',
}

/** What a group of one kind counts in its measurement. */
const COUNTS: Record<Glyph, [string, string]> = {
  read: ['FILE', 'FILES'],
  search: ['SCAN', 'SCANS'],
  run: ['RUN', 'RUNS'],
  web: ['PAGE', 'PAGES'],
  agent: ['TASK', 'TASKS'],
  edit: ['FILE', 'FILES'],
  create: ['FILE', 'FILES'],
  plan: ['TASK', 'TASKS'],
  other: ['CALL', 'CALLS'],
}

/** Built-in tools outside the main kinds that still get a word of their own. */
const OTHER_TAGS: Record<string, string> = { TodoWrite: 'TODO', ExitPlanMode: 'PLAN' }

/** A row's tag, and for unknown (MCP) tools their own name to show as the target's head. */
function tagOf(tool: string, facts: ToolFacts): { tag: string; name: string } {
  if (facts.glyph !== 'other') return { tag: TAGS[facts.glyph], name: '' }
  const own = OTHER_TAGS[tool]
  return own ? { tag: own, name: '' } : { tag: TAGS.other, name: facts.verb }
}

const pad = (tag: string): string => tag.padEnd(TAG_WIDTH)

/** A search pattern reads in quotes, as the lookbook draws it. */
function targetText(tool: string, facts: ToolFacts): string {
  return tool === 'Grep' && facts.target !== '' ? `"${facts.target}"` : facts.target
}

function nonNegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined
}

/** The measurement a read carries before its result: its line span. */
function readMeta(input: unknown): string {
  if (input === null || typeof input !== 'object') return ''
  const limit = nonNegative(Reflect.get(input, 'limit'))
  const offset = nonNegative(Reflect.get(input, 'offset'))
  if (limit === undefined) return offset === undefined ? '' : `FROM L${offset}`
  return offset === undefined ? `${limit} LINES` : `L${offset}–${offset + limit - 1}`
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
      ...(faded ? {} : { backgroundColor: line.kind === '+' ? 'diffAdded' : 'diffRemoved' }),
      wrap: 'truncate-end',
      children: [txt(ctx, line.kind === '+' ? C.ok : C.err, line.kind), txt(ctx, C.ink, ' ' + printable(line.text, 400))],
    }),
  })
}

function present<T>(x: T | null): x is T {
  return x !== null
}

/** The head of a dimension line: a tick, a callout letter, or a cross for a failure. */
function headOf(ctx: Ctx, failed: boolean, callout: string | null): RenderElement[] {
  if (failed) return [txt(ctx, C.err, ' ╳ ', { bold: true })]
  if (callout !== null) return [txt(ctx, C.ink, `(${callout})`, { bold: true })]
  return [txt(ctx, C.faint, '├──')]
}

/** The tail: ` meta ─┤`, or a bare `┤` when the line carries no measurement. */
function endOf(ctx: Ctx, meta: RenderElement[]): RenderElement {
  return meta.length > 0 ? fixed(ctx, [txt(ctx, C.faint, ' '), ...meta, txt(ctx, C.faint, ' ─┤')]) : fixed(ctx, txt(ctx, C.faint, '┤'))
}

function failWord(ctx: Ctx, interruptedOnly: boolean): RenderElement {
  return txt(ctx, C.err, interruptedOnly ? 'HALT' : 'FAIL', { bold: true })
}

/** One dimension line: head, tag, target, rule, measurement, time. */
function dimensionLine(ctx: Ctx, lead: RenderElement[], target: RenderElement | null, meta: RenderElement[], time: RenderElement | null): RenderElement {
  return ctx.els.Box({
    flexDirection: 'row',
    children: [fixed(ctx, lead), target ? shrink(ctx, target) : null, target ? fixed(ctx, txt(ctx, C.faint, ' ')) : null, rule(ctx), endOf(ctx, meta), time].filter(present),
  })
}

/**
 * One call as a dimension line:
 * `├── READ ── src/cart.js ───────────── 142 LINES ─┤  0.2s`.
 * Changes swap the tick for a callout letter, failures for a cross.
 */
export function toolRow(row: ToolRow, ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  const facts = factsOf(row.tool, row.input)
  const change = isChangeTool(row.tool) ? changeOf(row.tool, row.input) : null
  const failed = row.isErrored || row.isInterrupted
  const { tag, name } = tagOf(row.tool, facts)

  const lead = [
    ...headOf(ctx, failed, change ? calloutLetter(row.changeIndex) : null),
    txt(ctx, C.faint, ' '),
    txt(ctx, C.cyan, pad(tag)),
    txt(ctx, C.faint, ' ── '),
  ]

  let target: RenderElement | null = null
  if (name !== '') {
    const parts = [txt(ctx, C.ink, name)]
    if (facts.target !== '') parts.push(txt(ctx, C.faint, ' · '), txt(ctx, C.dim, facts.target))
    target = Text({ wrap: 'truncate-end', children: parts })
  } else if (facts.target !== '') {
    target = facts.isPath ? pathLabel(ctx, facts.target) : txt(ctx, C.ink, targetText(row.tool, facts), { wrap: 'truncate-end' })
  }

  let meta: RenderElement[] = []
  if (failed) meta = [failWord(ctx, !row.isErrored)]
  else if (change) meta = delta(ctx, change.add, change.del)
  else if (row.tool === 'Read') {
    const span = readMeta(row.input)
    if (span !== '') meta = [txt(ctx, C.dim, span)]
  } else if (row.tool === 'Bash' && !row.isRunning) meta = [txt(ctx, C.ok, 'PASS')]

  const line = dimensionLine(ctx, lead, target, meta, timing(ctx, row))
  if (!change || failed || !ctx.settings.ingredients.miniDiffs) return line
  const lines = pickDiffLines(change.lines, 3)
  if (lines.length === 0) return line
  return Box({ flexDirection: 'column', children: [line, ...lines.map(l => diffLine(ctx, l))] })
}

/** The folder every path shares, `src/auth/`, or empty. */
function commonDir(dirs: string[]): string {
  if (dirs.length === 0) return ''
  let common = dirs[0] ?? ''
  for (const d of dirs.slice(1)) {
    let i = 0
    while (i < common.length && i < d.length && common[i] === d[i]) i++
    common = common.slice(0, i)
  }
  return common.slice(0, common.lastIndexOf('/') + 1)
}

/**
 * A folded run as one dimension line. One kind reads like the lookbook,
 * `├── READ ── src/auth/ ×5 ──────── 5 FILES ─┤  1.1s`; mixed kinds put their
 * counts in the tag's place, `├── READ ×3 · EXEC ×1 ── a.ts · b.ts ── 4 STEPS ─┤`.
 */
export function toolGroup(rows: ToolRow[], ctx: Ctx): RenderElement {
  const only = rows.length === 1 ? rows[0] : undefined
  if (only) return toolRow(only, ctx)
  const { Text } = ctx.els
  const failed = rows.some(r => r.isErrored || r.isInterrupted)
  const running = rows.some(r => r.isRunning)
  const isTimed = rows.length > 0 && rows.every(r => r.durationMs !== undefined)
  const all = rows.map(r => ({ tool: r.tool, facts: factsOf(r.tool, r.input) }))

  const order: Glyph[] = []
  const counts = new Map<Glyph, number>()
  for (const { facts } of all) {
    if (!counts.has(facts.glyph)) order.push(facts.glyph)
    counts.set(facts.glyph, (counts.get(facts.glyph) ?? 0) + 1)
  }

  const items: RenderElement[] = []
  const seen = new Set<string>()
  const list = (): RenderElement | null => {
    for (const { tool, facts } of all) {
      if (facts.target === '' || seen.has(facts.target)) continue
      seen.add(facts.target)
      if (items.length > 0) items.push(txt(ctx, C.faint, ' · '))
      items.push(facts.isPath ? fileName(ctx, facts.target) : txt(ctx, C.ink, targetText(tool, facts)))
    }
    return items.length > 0 ? Text({ wrap: 'truncate-end', children: items }) : null
  }

  const lead: RenderElement[] = [...headOf(ctx, failed, null), txt(ctx, C.faint, ' ')]
  let target: RenderElement | null
  let meta: RenderElement[]
  const kind = order.length === 1 ? order[0] : undefined
  if (kind) {
    lead.push(txt(ctx, C.cyan, pad(TAGS[kind])))
    const paths = all.filter(a => a.facts.isPath && a.facts.target !== '').map(a => a.facts.target)
    const distinct = [...new Set(paths)]
    const folder = commonDir(distinct.map(p => splitPath(p, ctx.cwd).dir))
    if (paths.length === all.length && distinct.length > 1 && folder !== '') {
      target = Text({ wrap: 'truncate-end', children: [txt(ctx, C.ink, folder), txt(ctx, C.dim, ` ×${rows.length}`)] })
    } else target = list()
    const n = distinct.length > 0 ? distinct.length : rows.length
    const [one, many] = COUNTS[kind]
    meta = [txt(ctx, C.dim, `${n} ${n === 1 ? one : many}`)]
  } else {
    order.forEach((g, i) => {
      if (i > 0) lead.push(txt(ctx, C.faint, ' · '))
      lead.push(txt(ctx, C.cyan, TAGS[g]), txt(ctx, C.dim, ` ×${counts.get(g) ?? 0}`))
    })
    target = list()
    meta = [txt(ctx, C.dim, `${rows.length} STEPS`)]
  }
  lead.push(txt(ctx, C.faint, ' ── '))
  if (failed) meta = [failWord(ctx, !rows.some(r => r.isErrored))]

  const time = isTimed ? timing(ctx, { durationMs: rows.reduce((sum, r) => sum + (r.durationMs ?? 0), 0), isRunning: false }) : timing(ctx, { isRunning: running })
  return dimensionLine(ctx, lead, target, meta, time)
}

/** The trace Quiet leaves: `┆ 3 MEASUREMENTS OMITTED`. */
export function quietLine(hidden: number, ctx: Ctx): RenderElement {
  const word = hidden === 1 ? 'MEASUREMENT' : 'MEASUREMENTS'
  return ctx.els.Box({ flexDirection: 'row', children: [txt(ctx, C.faint, '┆ '), txt(ctx, C.dim, `${hidden} ${word} OMITTED`)] })
}

function resultLine(ctx: Ctx, parts: RenderElement[]): RenderElement {
  return ctx.els.Box({ paddingLeft: NOTE_INDENT, children: ctx.els.Text({ wrap: 'truncate-end', children: parts }) })
}

/** A result collapsed to its telling line; null leaves Claude Code's drawing. */
export function toolResult(row: ResultRow, ctx: Ctx): RenderElement | null {
  if (row.isErrored) {
    return resultLine(ctx, [txt(ctx, C.err, 'NOTE'), txt(ctx, C.dim, ' ' + (errorSummary(row.output) || 'failed'))])
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
