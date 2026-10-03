import type { RenderElement } from 'claude-code'

import { formatDuration, plural, printable, splitPath } from '../../engine/format'
import { tone } from '../../engine/palette'
import { bashSummary, changeOf, errorSummary, factsOf, isChangeTool, pickDiffLines } from '../../engine/tool-facts'
import type { Change, DiffLine } from '../../engine/tool-facts'
import type { Ctx, ResultRow, ToolRow } from '../look'
import { callSegments, groupSegments } from './prose'
import type { Seg } from './prose'
import { C, INDENT, delta, fixed, grow, it, nameColor, txt } from './style'

/** A sentence's runs as italic type; file names take their color when File colors is on. */
function sentence(ctx: Ctx, segs: Seg[], color: string): RenderElement[] {
  return segs.map(s => it(ctx, s.path !== undefined ? nameColor(ctx, s.path, color) : color, s.text))
}

function time(ctx: Ctx, ms: number): RenderElement {
  return fixed(ctx, txt(ctx, C.dim, formatDuration(ms).padStart(5)))
}

/** glyph · sentence (truncating) · whatever sits at the right. */
function line(ctx: Ctx, glyph: RenderElement, body: RenderElement[], right: RenderElement[]): RenderElement {
  return ctx.els.Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [fixed(ctx, glyph), grow(ctx, ctx.els.Text({ wrap: 'truncate-end', children: body })), ...right],
  })
}

/**
 * How a failed call's sentence ends. Alone, a failure hands over to the detail
 * line under it with a colon; inside a group no detail follows, so it stops.
 */
function failure(row: ToolRow, inGroup: boolean): string {
  if (row.isInterrupted) return ' It was interrupted.'
  return inGroup ? ' It failed.' : ' It failed:'
}

/** A change's lines with their shared indentation taken off, so the code sits flush. */
function flush(lines: DiffLine[]): DiffLine[] {
  const texts = lines.map(l => printable(l.text, 400))
  const indent = Math.min(...texts.map(t => t.length - t.trimStart().length))
  return lines.map((l, i) => ({ kind: l.kind, text: (texts[i] ?? '').slice(Number.isFinite(indent) ? indent : 0) }))
}

function diffLine(ctx: Ctx, l: DiffLine): RenderElement {
  const faded = ctx.fade > 0
  const mark = l.kind === '+' ? '+' : '−'
  return ctx.els.Box({
    paddingLeft: INDENT,
    children: ctx.els.Text({
      color: tone(faded ? C.dim : C.text, ctx.fade),
      ...(faded ? {} : { backgroundColor: l.kind === '+' ? 'diffAdded' : 'diffRemoved' }),
      wrap: 'truncate-end',
      children: ` ${mark} ${l.text} `,
    }),
  })
}

/** `✎ Edited cart.js in src/`, the counts at the right and, with Mini diffs, a few changed lines below. */
function changeRow(row: ToolRow, change: Change, ctx: Ctx, inGroup: boolean): RenderElement {
  const failed = row.isErrored || row.isInterrupted
  // The path as factsOf made it printable; change.file is the raw input.
  const { dir, base } = splitPath(factsOf(row.tool, row.input).target, ctx.cwd)
  const verb = row.tool === 'Write' ? ['Created', 'Creating', 'create'] : ['Edited', 'Editing', 'edit']
  // The verb is set upright, as in the lookbook; a failure is all italic, in the error color.
  const body: RenderElement[] = [failed ? it(ctx, C.err, `Tried to ${verb[2]} `) : txt(ctx, C.text, `${row.isRunning ? verb[1] : verb[0]} `)]
  body.push(base === '' ? it(ctx, failed ? C.err : C.dim, 'a file') : txt(ctx, failed ? C.err : nameColor(ctx, dir + base, C.text), base))
  if (dir !== '') body.push(it(ctx, failed ? C.err : C.dim, ` in ${dir}`))
  if (failed) body.push(it(ctx, C.err, '.' + failure(row, inGroup)))
  else if (row.isRunning) body.push(it(ctx, C.dim, '…'))
  const right: RenderElement[] = []
  if (!failed) {
    const counts = delta(ctx, change.add, change.del)
    if (counts.length > 0) right.push(ctx.els.Box({ flexDirection: 'row', columnGap: 1, flexShrink: 0, children: counts }))
  }
  if (row.durationMs !== undefined) right.push(time(ctx, row.durationMs))
  const head = line(ctx, txt(ctx, failed ? C.err : C.accent, failed ? '✗' : '✎'), body, right)
  if (failed || !ctx.settings.ingredients.miniDiffs) return head
  const lines = pickDiffLines(change.lines, 3)
  if (lines.length === 0) return head
  return ctx.els.Box({ flexDirection: 'column', children: [head, ...flush(lines).map(l => diffLine(ctx, l))] })
}

function callRow(row: ToolRow, ctx: Ctx, inGroup: boolean): RenderElement {
  const change = isChangeTool(row.tool) ? changeOf(row.tool, row.input) : null
  if (change) return changeRow(row, change, ctx, inGroup)
  const failed = row.isErrored || row.isInterrupted
  const color = failed ? C.err : C.dim
  const body = sentence(ctx, callSegments(row.tool, row.input, ctx.cwd, row.isRunning && !failed), color)
  body.push(it(ctx, color, failed ? '.' + failure(row, inGroup) : row.isRunning ? '…' : '.'))
  const right = row.durationMs !== undefined ? [time(ctx, row.durationMs)] : []
  return line(ctx, txt(ctx, color, failed ? '✗' : '↳'), body, right)
}

export function toolRow(row: ToolRow, ctx: Ctx): RenderElement {
  return callRow(row, ctx, false)
}

/** Quiet steps folded into one italic sentence, `↳ Read cart.js and ran 2 commands.`, their summed time at the right. */
function fold(rows: ToolRow[], ctx: Ctx): RenderElement {
  // A fold of one reads better as that call's own sentence: `Ran ls.`, not `Ran 1 command.`
  const only = rows.length === 1 ? rows[0] : undefined
  if (only) return callRow(only, ctx, true)
  const body = sentence(ctx, groupSegments(rows, ctx.cwd), C.dim)
  body.push(it(ctx, C.dim, rows.some(r => r.isRunning) ? '…' : '.'))
  const isTimed = rows.length > 0 && rows.every(r => r.durationMs !== undefined)
  const right = isTimed ? [time(ctx, rows.reduce((sum, r) => sum + (r.durationMs ?? 0), 0))] : []
  return line(ctx, txt(ctx, C.dim, '↳'), body, right)
}

/**
 * A group as the lookbook sets it: quiet steps fold into sentences, while an
 * edit or a failure breaks out onto its own line, in the order they happened.
 */
export function toolGroup(rows: ToolRow[], ctx: Ctx): RenderElement {
  const lines: RenderElement[] = []
  let quiet: ToolRow[] = []
  const flushQuiet = () => {
    if (quiet.length > 0) lines.push(fold(quiet, ctx))
    quiet = []
  }
  for (const r of rows) {
    if (r.isErrored || r.isInterrupted || isChangeTool(r.tool)) {
      flushQuiet()
      lines.push(callRow(r, ctx, true))
    } else quiet.push(r)
  }
  flushQuiet()
  if (lines.length === 0) return fold([], ctx)
  return lines.length === 1 && lines[0] ? lines[0] : ctx.els.Box({ flexDirection: 'column', children: lines })
}

export function quietLine(hidden: number, ctx: Ctx): RenderElement {
  return ctx.els.Box({ paddingLeft: INDENT, children: it(ctx, C.dim, `(${plural(hidden, 'step')} omitted)`, { wrap: 'truncate-end' }) })
}

/** Columns from the left edge to a detail line: two past the row's sentence, as the lookbook sets it. */
const DETAIL_INDENT = INDENT + 2

/** A result as a dim italic detail line under its row: `Tests: 24 passed`. */
function aside(ctx: Ctx, text: string): RenderElement {
  return ctx.els.Box({ paddingLeft: DETAIL_INDENT, children: it(ctx, C.dim, text, { wrap: 'truncate-end' }) })
}

/** A result collapsed to its telling line; null leaves Claude Code's drawing. */
export function toolResult(row: ResultRow, ctx: Ctx): RenderElement | null {
  if (row.isErrored) return aside(ctx, errorSummary(row.output) || 'no details were given')
  switch (row.tool) {
    case 'Bash': {
      const summary = bashSummary(row.output)
      return summary === '' ? ctx.els.Box({}) : aside(ctx, summary)
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
