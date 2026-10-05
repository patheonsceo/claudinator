import type { RenderElement } from 'claude-code'

import { clockLabel, formatDuration, splitPath } from '../engine/format'
import { tone } from '../engine/palette'
import type { Progress, TurnStats } from '../engine/session-model'
import type { Cell } from '../engine/raster'
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

export type StripColors = { thinking: string; tools: string; waiting: string }

/** Each look's strip colors, dark and light: three that never blur together. */
const STRIP_COLORS: Record<'hairline' | 'broadsheet' | 'mission' | 'prism' | 'sumi' | 'blueprint', { dark: StripColors; light: StripColors }> = {
  hairline: { dark: { thinking: '#a0a3ff', tools: '#6fd0d6', waiting: '#ff7a85' }, light: { thinking: '#5559de', tools: '#137f86', waiting: '#cf3747' } },
  broadsheet: { dark: { thinking: '#e3b65c', tools: '#8fbfb4', waiting: '#ef8b73' }, light: { thinking: '#94680f', tools: '#2f6f68', waiting: '#b2432c' } },
  mission: { dark: { thinking: '#6fd6c3', tools: '#ffb347', waiting: '#ff6b57' }, light: { thinking: '#11796a', tools: '#b26a00', waiting: '#c23a28' } },
  prism: { dark: { thinking: '#ff8ab8', tools: '#b9a8ff', waiting: '#ffc27a' }, light: { thinking: '#d63f79', tools: '#5b4bff', waiting: '#b5651d' } },
  sumi: { dark: { thinking: '#8aa4e0', tools: '#a9b8a0', waiting: '#e0907a' }, light: { thinking: '#2d4f9e', tools: '#56704a', waiting: '#b2432c' } },
  blueprint: { dark: { thinking: '#7fd4ff', tools: '#e6f0ff', waiting: '#ff8a7a' }, light: { thinking: '#0e7fa8', tools: '#0f2d5c', waiting: '#c2334a' } },
}

export function stripColors(look: keyof typeof STRIP_COLORS, isDark: boolean): StripColors {
  return STRIP_COLORS[look][isDark ? 'dark' : 'light']
}

/** `1:18` from a minute up, `0.6s` under a second. */
function legendTime(ms: number): string {
  return ms < 1000 ? formatDuration(ms) : clockLabel(ms)
}

/**
 * The line under each run: where its time went, each part in its look's color,
 * and how far through its todo list Claude got when it kept one.
 */
export function runStatsLine(ctx: Ctx, data: TimeStripData, style: StripColors & { indent?: number }): RenderElement {
  const { Box, Text } = ctx.els
  const part = (color: string, label: string, ms: number): RenderElement[] => [
    Text({ color: tone(color, ctx.fade), children: '■' }),
    Text({ color: tone('inactive', ctx.fade), children: `${label} ${legendTime(ms)}` }),
  ]
  const children: RenderElement[] = [...part(style.thinking, 'thinking', data.thinkingMs), Text({ children: ' ' }), ...part(style.tools, 'tools', data.toolsMs)]
  if (data.waitingMs > 0) children.push(Text({ children: ' ' }), ...part(style.waiting, 'waiting on you', data.waitingMs))
  if (data.tasks) children.push(Text({ color: tone('subtle', ctx.fade), children: '·' }), Text({ color: tone('inactive', ctx.fade), children: `${data.tasks.done} of ${data.tasks.total} tasks` }))
  return Box({ flexDirection: 'row', columnGap: 1, paddingLeft: style.indent ?? 3, height: 1, overflow: 'hidden', children })
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

/** What the working bar shows: the turn's time so far, and Claude's task list when it keeps one. */
export type WorkData = { thinkingMs: number; toolsMs: number; waitingMs: number; progress: Progress | null }

/** The bar's words: `2 of 4 · Fixing total`, or `0:42 · thinking 0:30 · tools 0:12`. */
export function workingBarText(work: WorkData): string {
  if (work.progress) return [`${work.progress.done} of ${work.progress.total}`, work.progress.active].filter(Boolean).join(' · ')
  // The clock is already at the end of the live line above; the bar says where the time went.
  const parts = [`thinking ${legendTime(work.thinkingMs)}`, `tools ${legendTime(work.toolsMs)}`]
  if (work.waitingMs > 0) parts.push(`waiting on you ${legendTime(work.waitingMs)}`)
  return parts.join(' · ')
}

const hexToInt = (hex: string): number => (/^#[0-9a-f]{6}$/i.test(hex) ? parseInt(hex.slice(1), 16) : 0x8a8a8a)
const TEXT = 0x01000000
const BAR_FAINT = { dark: 0x4a4d5a, light: 0xc9ccd6 }
const BAR_DIM = 0x8a8a8a

/**
 * The working bar as one row of cells, `width` wide, for the host to blit ten
 * times a second. With a task list: a block per task (done, the one in hand
 * pulsing, then those to come). Without: the turn so far split into thinking,
 * tools and waiting, with a highlight sweeping across. Then the words.
 */
export function workingBarCells(work: WorkData, colors: StripColors, isDark: boolean, width: number, frame: number): Cell[] {
  const faint = isDark ? BAR_FAINT.dark : BAR_FAINT.light
  const barWidth = Math.max(8, Math.min(32, width - 34))
  const bar: Cell[] = []
  if (work.progress && work.progress.total > 0) {
    const total = work.progress.total
    const per = Math.max(1, Math.min(6, Math.floor((barWidth - (total - 1)) / total)))
    const pulse = frame % 10 < 6
    for (let i = 0; i < total && bar.length < barWidth; i++) {
      if (i > 0) bar.push({ char: ' ', fg: faint })
      const isDone = i < work.progress.done
      const isActive = i === work.progress.done
      const fg = isDone ? hexToInt(colors.thinking) : isActive ? (pulse ? hexToInt(colors.tools) : faint) : faint
      for (let c = 0; c < per; c++) bar.push({ char: isDone || isActive ? '■' : '□', fg })
    }
  } else {
    const seg = timeStripSegments(work, barWidth)
    const fills = [
      ...Array<number>(seg.thinking).fill(hexToInt(colors.thinking)),
      ...Array<number>(seg.tools).fill(hexToInt(colors.tools)),
      ...Array<number>(seg.waiting).fill(hexToInt(colors.waiting)),
    ]
    const sweep = frame % (barWidth + 8)
    fills.forEach((fg, i) => bar.push({ char: '■', fg: Math.abs(i - sweep) <= 1 ? TEXT : fg }))
  }
  const words = `  ${workingBarText(work)}`
  const cells: Cell[] = [...bar]
  for (const ch of words) {
    if (cells.length >= width) break
    cells.push({ char: ch, fg: ch === '·' ? faint : BAR_DIM })
  }
  while (cells.length < width) cells.push({ char: ' ', fg: BAR_DIM })
  return cells.slice(0, width)
}
