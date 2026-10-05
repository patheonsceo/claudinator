import type { RenderElement } from 'claude-code'

import { plural, printable, splitPath } from '../../engine/format'
import { tone } from '../../engine/palette'
import { GLYPHS, bashSummary, changeOf, factsOf, isChangeTool, pickDiffLines } from '../../engine/tool-facts'
import type { DiffLine, Glyph, ToolFacts } from '../../engine/tool-facts'
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
      children: `${line.kind} ${printable(line.text, 400)}`,
    }),
  })
}

/** The six-wide verb column: `Read  `, `Search`, `Create`. */
function verbLabel(facts: ToolFacts): string {
  const verb = facts.glyph === 'create' ? 'Create' : facts.verb
  return verb.length > 6 ? verb.slice(0, 5) + '…' : verb.padEnd(6)
}

/** A search pattern reads quoted; other targets as they are. */
function targetText(tool: string, facts: ToolFacts): string {
  return tool === 'Grep' && facts.target !== '' ? `"${facts.target}"` : facts.target
}

export function toolRow(row: ToolRow, ctx: Ctx): RenderElement {
  const { Box } = ctx.els
  const facts = factsOf(row.tool, row.input)
  const change = isChangeTool(row.tool) ? changeOf(row.tool, row.input) : null
  const failed = row.isErrored || row.isInterrupted
  const glyph = failed ? txt(ctx, C.err, '✕') : txt(ctx, change ? C.accent : C.dim, GLYPHS[facts.glyph])
  const verb = txt(ctx, change ? C.text : C.dim, verbLabel(facts))
  const target = facts.isPath && facts.target !== '' ? pathLabel(ctx, facts.target) : txt(ctx, C.text, targetText(row.tool, facts), { wrap: 'truncate-end' })
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

/** How a folded group counts each kind of step: the first kind as a bare count, the rest with their verb. */
const NOUNS: Record<Glyph, [string, string]> = {
  read: ['read', 'file'],
  search: ['searched', 'pattern'],
  run: ['ran', 'command'],
  web: ['fetched', 'page'],
  agent: ['started', 'agent'],
  edit: ['edited', 'file'],
  create: ['wrote', 'file'],
  plan: ['updated', 'task'],
  other: ['used', 'tool'],
}

/** `5 files`, `2 files, ran 1 command`: the group's verb column already names the first kind. */
function groupPhrase(facts: ToolFacts[]): string {
  const order: Glyph[] = []
  const counts = new Map<Glyph, number>()
  for (const f of facts) {
    if (!counts.has(f.glyph)) order.push(f.glyph)
    counts.set(f.glyph, (counts.get(f.glyph) ?? 0) + 1)
  }
  return order.map((g, i) => `${i === 0 ? '' : NOUNS[g][0] + ' '}${plural(counts.get(g) ?? 0, NOUNS[g][1])}`).join(', ')
}

/** The folder every file in the group shares, or empty. */
function sharedFolder(facts: ToolFacts[], cwd: string): string {
  if (facts.length === 0 || !facts.every(f => f.isPath && f.target !== '')) return ''
  const dirs = new Set(facts.map(f => splitPath(f.target, cwd).dir))
  return dirs.size === 1 ? ([...dirs][0] ?? '') : ''
}

/** `◇ Read   ▾ 5 files in src/auth/`, its files listed under the target column. A group of one is just its row. */
export function toolGroup(rows: ToolRow[], ctx: Ctx): RenderElement {
  const { Box, Text } = ctx.els
  const only = rows.length === 1 ? rows[0] : undefined
  if (only) return toolRow(only, ctx)
  const failed = rows.some(r => r.isErrored || r.isInterrupted)
  const running = rows.some(r => r.isRunning)
  const isTimed = rows.length > 0 && rows.every(r => r.durationMs !== undefined)
  const facts = rows.map(r => factsOf(r.tool, r.input))
  const first = facts[0]
  const glyph = failed ? txt(ctx, C.err, '✕') : txt(ctx, C.dim, first ? GLYPHS[first.glyph] : '·')
  const folder = sharedFolder(facts, ctx.cwd)
  const head = Text({
    wrap: 'truncate-end',
    children: [txt(ctx, C.dim, '▾ '), txt(ctx, C.text, groupPhrase(facts)), ...(folder ? [txt(ctx, C.dim, ` in ${folder}`)] : [])],
  })
  const parts: RenderElement[] = [glyph, txt(ctx, C.dim, first ? verbLabel(first) : ' '.repeat(6)), grow(ctx, head)]
  if (failed) parts.push(txt(ctx, C.err, 'failed'))
  if (isTimed) parts.push(timing(ctx, rows.reduce((sum, r) => sum + (r.durationMs ?? 0), 0)))
  else if (running) parts.push(txt(ctx, C.dim, '…'))
  const line = Box({ flexDirection: 'row', columnGap: 1, children: parts })
  const names: RenderElement[] = []
  rows.forEach((r, i) => {
    const f = facts[i]
    if (!f || f.target === '') return
    if (names.length > 0) names.push(txt(ctx, C.faint, ' · '))
    names.push(f.isPath ? fileName(ctx, f.target) : txt(ctx, C.dim, targetText(r.tool, f)))
  })
  if (names.length === 0) return line
  return Box({ flexDirection: 'column', children: [line, Box({ paddingLeft: INDENT, children: Text({ wrap: 'truncate-end', children: names }) })] })
}

export function quietLine(hidden: number, ctx: Ctx): RenderElement {
  return ctx.els.Box({ flexDirection: 'row', columnGap: 1, children: [txt(ctx, C.faint, '·'), txt(ctx, C.dim, `${plural(hidden, 'step')} hidden`)] })
}

/** A passing command's telling line under its target: `✓ 24 passed`. */
function passLine(ctx: Ctx, text: string): RenderElement {
  return ctx.els.Box({ paddingLeft: INDENT, children: ctx.els.Text({ wrap: 'truncate-end', children: [txt(ctx, C.ok, '✓ '), txt(ctx, C.dim, text)] }) })
}

/** A failure under its row: `╰ <first error line>` in the error color, the next line dim beneath it. */
function failLines(ctx: Ctx, output: unknown): RenderElement {
  const { Box, Text } = ctx.els
  const [first, second] = errorLines(output)
  const head = Box({ paddingLeft: INDENT, children: Text({ wrap: 'truncate-end', children: [txt(ctx, C.err, '╰ '), txt(ctx, C.err, first || 'failed')] }) })
  if (!second) return head
  return Box({ flexDirection: 'column', children: [head, Box({ paddingLeft: INDENT + 2, children: txt(ctx, C.dim, second, { wrap: 'truncate-end' }) })] })
}

/** Words that mark the line a failure is about. */
const TELLING = /error|fail|✕|✗|×|✘|expected|assert|denied|not found|no such|cannot|does not exist/i
/** A leading cross a test runner prints: the ╰ already says it. */
const MARK = /^[✕✗×✘]\s*/

/** The two lines that tell a failure: the first that names the error (else the first line), and the one after it. */
export function errorLines(output: unknown): [string, string] {
  const o = output !== null && typeof output === 'object' ? (output as Record<string, unknown>) : {}
  const pick = (v: unknown): string => (typeof v === 'string' ? v : '')
  const raw = typeof output === 'string' ? output : pick(o.stderr) || pick(o.error) || pick(o.message) || pick(o.stdout)
  const lines = raw
    .split(/\r?\n/, 400)
    .map(l => printable(l, 300).trim())
    .filter(l => l !== '')
  const at = Math.max(0, lines.findIndex(l => TELLING.test(l)))
  return [(lines[at] ?? '').replace(MARK, ''), lines[at + 1] ?? '']
}

/** A result collapsed to its telling line; null leaves Claude Code's drawing. */
export function toolResult(row: ResultRow, ctx: Ctx): RenderElement | null {
  if (row.isErrored) return failLines(ctx, row.output)
  switch (row.tool) {
    case 'Bash': {
      const summary = bashSummary(row.output).replace(/^[✓✔]\s*/, '')
      return summary === '' ? ctx.els.Box({}) : passLine(ctx, summary)
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
