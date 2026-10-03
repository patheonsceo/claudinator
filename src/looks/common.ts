import type { RenderElement } from 'claude-code'

import { formatDuration, splitPath } from '../engine/format'
import { tone } from '../engine/palette'
import type { TurnStats } from '../engine/session-model'
import { factsOf } from '../engine/tool-facts'
import type { Ctx, FootnoteData, TimeStripData, WaitingData } from './look'

const SUPERSCRIPTS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹']

/** `12` → `¹²`. */
/** A reply with its footnote marks: after the last word, or on a paragraph of their own after a code block, table or list. */
export function withMarks(text: string, marks: number[]): string {
  if (marks.length === 0) return text
  const sup = marks.map(superscript).join('')
  const last = text.trimEnd().split('\n').pop()?.trim() ?? ''
  const isBlock = /^(```|~~~|\||[-*+] |\d+[.)] )/.test(last)
  return isBlock ? `${text.trimEnd()}\n\n${sup}` : `${text} ${sup}`
}

export function superscript(n: number): string {
  return String(Math.max(0, Math.floor(n)))
    .split('')
    .map(d => SUPERSCRIPTS[Number(d)] ?? '')
    .join('')
}

/** A footnote as a short sentence: `Read src/a.ts · 0.2s`. */
export function noteText(note: FootnoteData, cwd: string): string {
  const facts = factsOf(note.tool, note.input)
  const target = facts.isPath ? (({ dir, base }) => dir + base)(splitPath(facts.target, cwd)) : facts.target
  const head = `${facts.verb} ${target}`.trim()
  return note.durationMs === undefined ? head : `${head} · ${formatDuration(note.durationMs)}`
}

/** How many cells of a strip `width` wide each part of the turn gets. Nonzero parts get at least one. */
export function timeStripSegments(data: TimeStripData, width: number): { thinking: number; tools: number; waiting: number } {
  const total = data.thinkingMs + data.toolsMs + data.waitingMs
  if (total <= 0) return { thinking: width, tools: 0, waiting: 0 }
  const share = (ms: number): number => (ms > 0 ? Math.max(1, Math.round((ms / total) * width)) : 0)
  const tools = share(data.toolsMs)
  const waiting = share(data.waitingMs)
  return { thinking: Math.max(0, width - tools - waiting), tools, waiting }
}

/**
 * A time strip as one row of colored blocks and a legend. Looks pass their
 * own glyph and colors (theme tokens or hex), or take these defaults.
 */
export function timeStripRow(
  ctx: Ctx,
  data: TimeStripData,
  style: { glyph?: string; indent?: number; thinking?: string; tools?: string; waiting?: string } = {},
): RenderElement {
  const { Box, Text } = ctx.els
  const glyph = style.glyph ?? '▆'
  const colors = { thinking: style.thinking ?? 'suggestion', tools: style.tools ?? 'warning', waiting: style.waiting ?? 'error' }
  const width = Math.max(10, Math.min(40, ctx.columns - 50))
  const seg = timeStripSegments(data, width)
  const part = (color: string, n: number): RenderElement => Text({ color: tone(color, ctx.fade), children: glyph.repeat(n) })
  const legend = (color: string, label: string, ms: number): RenderElement[] => [
    Text({ color: tone(color, ctx.fade), children: '■' }),
    Text({ color: tone('inactive', ctx.fade), children: `${label} ${formatDuration(ms)}` }),
  ]
  return Box({
    flexDirection: 'row',
    columnGap: 1,
    paddingLeft: style.indent ?? 3,
    children: [
      Text({ children: [part(colors.thinking, seg.thinking), part(colors.tools, seg.tools), part(colors.waiting, seg.waiting)] }),
      ...legend(colors.thinking, 'thinking', data.thinkingMs),
      ...legend(colors.tools, 'tools', data.toolsMs),
      ...(data.waitingMs > 0 ? legend(colors.waiting, 'waiting on you', data.waitingMs) : []),
    ],
  })
}

/** The notes block a look puts above its receipt: `¹ Read src/a.ts · 0.2s`. */
export function notesBlock(ctx: Ctx, notes: FootnoteData[], style: { indent?: number; accent?: string; italic?: boolean } = {}): RenderElement | null {
  if (notes.length === 0) return null
  const { Box, Text } = ctx.els
  return Box({
    flexDirection: 'column',
    paddingLeft: style.indent ?? 3,
    children: notes.map(note =>
      Box({
        flexDirection: 'row',
        columnGap: 1,
        children: [
          Text({ color: tone(style.accent ?? 'suggestion', ctx.fade), children: superscript(note.n) }),
          Text({ color: tone('inactive', ctx.fade), italic: style.italic === true, wrap: 'truncate-end', children: noteText(note, ctx.cwd) }),
        ],
      }),
    ),
  })
}

export const INATOR_WORDS = ['Scheming', 'Monologuing', 'Inator-ing', 'Plotting', 'Calibrating the -inator']

/** A live-line word for -inator mode, changing every few seconds. */
export function inatorWord(frame: number): string {
  return INATOR_WORDS[Math.floor(frame / 30) % INATOR_WORDS.length] ?? 'Scheming'
}

/** A closing quip for a receipt in -inator mode. */
export function inatorQuip(stats: TurnStats | null): string {
  if (!stats || stats.files.length === 0) return 'the Thinkinator rests'
  if (stats.del > stats.add) return 'the Deletinator strikes again'
  return 'another -inator completed'
}

/** The attention ladder's first step: a calm line in the band while Claude waits for you. */
export function waitingBand(ctx: Ctx, waiting: WaitingData): RenderElement {
  const { Box, Text } = ctx.els
  const facts = factsOf(waiting.tool, waiting.input)
  const { dir, base } = facts.isPath ? splitPath(facts.target, ctx.cwd) : { dir: '', base: facts.target }
  const what = `${facts.verb} ${dir}${base}`.trim()
  return Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [
      Text({ color: 'warning', bold: true, children: '●' }),
      Text({ bold: true, children: ctx.settings.ingredients.inator ? 'Your move, evil genius' : 'Needs you' }),
      Text({ color: 'inactive', wrap: 'truncate-end', children: `· approve ${what}` }),
      Text({ color: 'inactive', children: `· ${formatDuration(waiting.waitedMs)}` }),
    ],
  })
}
