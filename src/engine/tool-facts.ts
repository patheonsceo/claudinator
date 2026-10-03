import { lastLine, oneLine, plural } from './format'

export type Glyph = 'read' | 'search' | 'edit' | 'create' | 'run' | 'web' | 'agent' | 'other'

/** One single-width character per kind of step. */
export const GLYPHS: Record<Glyph, string> = {
  read: '◇',
  search: '⌕',
  edit: '◆',
  create: '◆',
  run: '›',
  web: '◎',
  agent: '✦',
  other: '·',
}

export type ToolFacts = { glyph: Glyph; verb: string; target: string; isPath: boolean }
export type DiffLine = { kind: '+' | '-'; text: string }
export type Change = { file: string; add: number; del: number; lines: DiffLine[] }

const MAX_TARGET = 200

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function rec(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function shortName(tool: string): string {
  const parts = tool.split('__')
  return parts[parts.length - 1] || tool
}

/** What a call is, from its tool name and input. Safe on partial input. */
export function factsOf(tool: string, input: unknown): ToolFacts {
  const i = rec(input)
  const path = (target: string, glyph: Glyph, verb: string): ToolFacts => ({ glyph, verb, target, isPath: true })
  const text = (target: string, glyph: Glyph, verb: string): ToolFacts => ({ glyph, verb, target: oneLine(target, MAX_TARGET), isPath: false })
  switch (tool) {
    case 'Read':
      return path(str(i.file_path), 'read', 'Read')
    case 'Edit':
    case 'MultiEdit':
      return path(str(i.file_path), 'edit', 'Edit')
    case 'Write':
      return path(str(i.file_path), 'create', 'Write')
    case 'NotebookEdit':
      return path(str(i.notebook_path), 'edit', 'Edit')
    case 'Bash':
      return text(str(i.command), 'run', 'Run')
    case 'Grep':
      return text(str(i.pattern), 'search', 'Search')
    case 'Glob':
      return text(str(i.pattern), 'search', 'Find')
    case 'WebFetch':
      return text(str(i.url), 'web', 'Fetch')
    case 'WebSearch':
      return text(str(i.query), 'web', 'Search')
    case 'Task':
    case 'Agent':
      return text(str(i.description), 'agent', 'Agent')
    default: {
      const first = Object.values(i).find(v => typeof v === 'string')
      return text(str(first), 'other', shortName(tool))
    }
  }
}

/** Tools whose calls change files. */
export function isChangeTool(tool: string): boolean {
  return tool === 'Edit' || tool === 'MultiEdit' || tool === 'Write' || tool === 'NotebookEdit'
}

/** The lines that differ between two texts, after their shared first and last lines. */
export function lineDelta(before: string, after: string): Omit<Change, 'file'> {
  const a = before === '' ? [] : before.split('\n')
  const b = after === '' ? [] : after.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  const removed = a.slice(start, endA)
  const added = b.slice(start, endB)
  return {
    add: added.length,
    del: removed.length,
    lines: [...removed.map(text => ({ kind: '-' as const, text })), ...added.map(text => ({ kind: '+' as const, text }))],
  }
}

/** The change an Edit, MultiEdit or Write call makes, or null for other tools. */
export function changeOf(tool: string, input: unknown): Change | null {
  const i = rec(input)
  const file = str(i.file_path)
  if (tool === 'Edit') return { file, ...lineDelta(str(i.old_string), str(i.new_string)) }
  if (tool === 'Write') return { file, ...lineDelta('', str(i.content)) }
  if (tool === 'MultiEdit') {
    const edits = Array.isArray(i.edits) ? i.edits : []
    const total: Change = { file, add: 0, del: 0, lines: [] }
    for (const edit of edits) {
      const d = lineDelta(str(rec(edit).old_string), str(rec(edit).new_string))
      total.add += d.add
      total.del += d.del
      total.lines.push(...d.lines)
    }
    return total
  }
  return null
}

/** Up to `max` non-blank changed lines, in order. */
export function pickDiffLines(lines: DiffLine[], max: number): DiffLine[] {
  return lines.filter(l => l.text.trim() !== '').slice(0, max)
}

const PHRASES: Record<Glyph, [string, string]> = {
  read: ['read', 'file'],
  search: ['searched', 'pattern'],
  run: ['ran', 'command'],
  web: ['fetched', 'page'],
  agent: ['started', 'agent'],
  edit: ['edited', 'file'],
  create: ['wrote', 'file'],
  other: ['used', 'tool'],
}

/** `Read 2 files, ran 1 command`: a folded group in one phrase. */
export function groupSummary(calls: ReadonlyArray<{ tool: string; input: unknown }>): string {
  const order: Glyph[] = []
  const counts = new Map<Glyph, number>()
  for (const call of calls) {
    const glyph = factsOf(call.tool, call.input).glyph
    if (!counts.has(glyph)) order.push(glyph)
    counts.set(glyph, (counts.get(glyph) ?? 0) + 1)
  }
  const text = order.map(g => `${PHRASES[g][0]} ${plural(counts.get(g) ?? 0, PHRASES[g][1])}`).join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** The last meaningful line a Bash call printed, or empty. */
export function bashSummary(output: unknown): string {
  const o = rec(output)
  return lastLine(str(o.stdout), 160) || lastLine(str(o.stderr), 160)
}

/** The first line of an error result. */
export function errorSummary(output: unknown): string {
  if (typeof output === 'string') return oneLine(output, 160)
  const o = rec(output)
  return oneLine(str(o.stderr) || str(o.error) || str(o.message), 160)
}
