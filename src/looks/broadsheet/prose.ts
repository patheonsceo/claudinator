import { oneLine, plural, splitPath } from '../../engine/format'
import { factsOf } from '../../engine/tool-facts'
import type { Glyph } from '../../engine/tool-facts'

/** A run of a sentence; `path` marks a file name, which File colors may paint. */
export type Seg = { text: string; path?: string }

const QUOTE_MAX = 48

function quoted(text: string): string {
  return `“${oneLine(text, QUOTE_MAX)}”`
}

/** An MCP tool's own name, made printable: tool names come from servers, not from us. */
function shortName(tool: string): string {
  const parts = tool.split('__')
  return oneLine(parts[parts.length - 1] || tool, 60) || 'a tool'
}

const NUMERALS: Array<[number, string]> = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]

/** `7` → `VII`. Outside 1 to 3999 the number stays in Arabic figures. */
export function roman(n: number): string {
  let left = Math.floor(n)
  if (!Number.isFinite(left) || left < 1 || left > 3999) return String(Number.isFinite(left) ? left : 0)
  let out = ''
  for (const [value, mark] of NUMERALS) {
    while (left >= value) {
      out += mark
      left -= value
    }
  }
  return out
}

/** `a`, `a and b`, `a, b and c`: no Oxford comma, as the house style asks. */
export function joinList<T>(items: T[][], comma: T, and: T): T[] {
  const out: T[] = []
  items.forEach((item, i) => {
    if (i > 0) out.push(i === items.length - 1 ? and : comma)
    out.push(...item)
  })
  return out
}

function capitalized(segs: Seg[]): Seg[] {
  const [first, ...rest] = segs
  if (!first) return segs
  return [{ ...first, text: first.text.charAt(0).toUpperCase() + first.text.slice(1) }, ...rest]
}

/** The file name of a path, marked for coloring. */
function nameSeg(target: string, cwd: string): Seg {
  const { dir, base } = splitPath(target, cwd)
  return { text: base, path: dir + base }
}

/** One kind of step in a folded group: `read cart.js`, `ran 3 commands`. */
function clause(glyph: Glyph, calls: Array<{ tool: string; input: unknown }>, cwd: string): Seg[] {
  const n = calls.length
  const only = n === 1 ? calls[0] : undefined
  const facts = only ? factsOf(only.tool, only.input) : undefined
  const named = facts !== undefined && facts.target !== ''
  switch (glyph) {
    case 'read':
      return named ? [{ text: 'read ' }, nameSeg(facts.target, cwd)] : [{ text: `read ${plural(n, 'file')}` }]
    case 'edit':
      return named ? [{ text: 'edited ' }, nameSeg(facts.target, cwd)] : [{ text: `edited ${plural(n, 'file')}` }]
    case 'create':
      return named ? [{ text: 'wrote ' }, nameSeg(facts.target, cwd)] : [{ text: `wrote ${plural(n, 'file')}` }]
    case 'search':
      if (named) return [{ text: `${only?.tool === 'Glob' ? 'looked for' : 'searched for'} ${quoted(facts.target)}` }]
      return [{ text: `ran ${plural(n, 'search', 'searches')}` }]
    case 'run':
      return [{ text: `ran ${plural(n, 'command')}` }]
    case 'web':
      if (named) return [{ text: only?.tool === 'WebSearch' ? `searched the web for ${quoted(facts.target)}` : `fetched ${oneLine(facts.target, QUOTE_MAX)}` }]
      return [{ text: `fetched ${plural(n, 'page')}` }]
    case 'agent':
      return [{ text: n === 1 ? 'briefed an agent' : `briefed ${n} agents` }]
    case 'other':
      return [{ text: only ? `used ${shortName(only.tool)}` : `used ${plural(n, 'tool')}` }]
  }
}

/** A folded group as one sentence, without its closing stop. */
export function groupSegments(calls: ReadonlyArray<{ tool: string; input: unknown }>, cwd: string): Seg[] {
  const order: Glyph[] = []
  const byKind = new Map<Glyph, Array<{ tool: string; input: unknown }>>()
  for (const call of calls) {
    const glyph = factsOf(call.tool, call.input).glyph
    if (!byKind.has(glyph)) order.push(glyph)
    byKind.set(glyph, [...(byKind.get(glyph) ?? []), call])
  }
  if (order.length === 0) return [{ text: 'Nothing yet' }]
  return capitalized(joinList(order.map(g => clause(g, byKind.get(g) ?? [], cwd)), { text: ', ' }, { text: ' and ' }))
}

/** `Read cart.js, searched for “x” and ran 1 command`. */
export function sentenceOf(calls: ReadonlyArray<{ tool: string; input: unknown }>, cwd: string): string {
  return groupSegments(calls, cwd).map(s => s.text).join('')
}

/** The verb of one call, done and in progress, and what to say when it has no target. */
const VERBS: Record<string, [string, string, string]> = {
  Read: ['Read', 'Reading', 'a file'],
  Bash: ['Ran', 'Running', 'a command'],
  Grep: ['Searched for', 'Searching for', 'a pattern'],
  Glob: ['Looked for', 'Looking for', 'files'],
  WebFetch: ['Fetched', 'Fetching', 'a page'],
  WebSearch: ['Searched the web for', 'Searching the web for', 'an answer'],
  Task: ['Briefed an agent:', 'Briefing an agent:', 'a task'],
  Agent: ['Briefed an agent:', 'Briefing an agent:', 'a task'],
  TodoWrite: ['Updated the plan:', 'Updating the plan:', 'next steps'],
  Edit: ['Edited', 'Editing', 'a file'],
  MultiEdit: ['Edited', 'Editing', 'a file'],
  NotebookEdit: ['Edited', 'Editing', 'a notebook'],
  Write: ['Wrote', 'Writing', 'a file'],
}

const QUOTED_TOOLS = new Set(['Grep', 'Glob', 'WebSearch'])

/** One call as a sentence without its stop: `Read src/cart.js`, `Ran npm test`. */
export function callSegments(tool: string, input: unknown, cwd: string, isRunning: boolean): Seg[] {
  if (tool === 'ExitPlanMode') return [{ text: isRunning ? 'Presenting the plan' : 'Presented the plan' }]
  const facts = factsOf(tool, input)
  const verbs = VERBS[tool]
  if (!verbs) {
    const name = shortName(tool)
    const head = `${isRunning ? 'Using' : 'Used'} ${name}`
    return [{ text: facts.target === '' ? head : `${head} with ${quoted(facts.target)}` }]
  }
  const verb = isRunning ? verbs[1] : verbs[0]
  if (facts.target === '') return [{ text: `${verb} ${verbs[2]}` }]
  if (facts.isPath) {
    const { dir, base } = splitPath(facts.target, cwd)
    return [{ text: `${verb} ${dir}` }, { text: base, path: dir + base }]
  }
  return [{ text: `${verb} ${QUOTED_TOOLS.has(tool) ? quoted(facts.target) : facts.target}` }]
}

/** `2 min 14 s`, `42 s`, `9.0 s`: durations as a compositor would set them. */
export function spelledDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  if (ms < 10_000) return `${(Math.round(ms / 100) / 10).toFixed(1)} s`
  const total = Math.round(ms / 1000)
  if (total < 60) return `${total} s`
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return m === 0 ? `${h} h` : `${h} h ${m} min`
  return s === 0 ? `${m} min` : `${m} min ${s} s`
}
