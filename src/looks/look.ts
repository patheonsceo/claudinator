import type { ElementTable, RenderElement, RenderSurface } from 'claude-code'

import type { Fade } from '../engine/palette'
import type { TurnStats } from '../engine/session-model'
import type { Settings } from '../engine/settings'

export type Els = ElementTable

/** Everything a look needs to draw one site, passed in by the hooks module. */
export type Ctx = {
  els: Els
  surface: RenderSurface
  columns: number
  settings: Settings
  fade: Fade
  cwd: string
  /** True unless the user's Claude Code theme is a light one. */
  isDark: boolean
}

export type ToolRow = {
  id: string
  tool: string
  input: unknown
  isRunning: boolean
  isErrored: boolean
  isInterrupted: boolean
  durationMs?: number
  /** Milliseconds from the start of its turn to the start of this call, when Claudinator saw both. */
  turnOffsetMs?: number
  /** 1 for the turn's first file change, 2 for the second, and so on; only on change calls. */
  changeIndex?: number
}

export type ResultRow = { tool: string; output: unknown; isErrored: boolean }

export type LiveMode = 'thinking' | 'writing' | 'running'
/** `inator` swaps in -inator words; animated words must keep the same width across frames. */
export type LiveState = { mode: LiveMode; detail: string; elapsedMs: number; inator?: boolean }
export type LiveFrame = { key: string; columns: number; cells: string }

/** A finished turn's title, drawn above its prompt when Headlines is on. */
export type HeadlineData = { turn: number; title: string }

/** One tool call folded into a footnote when Footnotes is on. */
export type FootnoteData = { n: number; tool: string; input: unknown; durationMs?: number }

/** Where a turn's time went, when Time strip is on. */
export type TimeStripData = { thinkingMs: number; toolsMs: number; waitingMs: number }

export type ReceiptData = {
  durationMs: number
  /** The turn's headline, when Headlines is on and one was derived. */
  title?: string
  stats: TurnStats | null
  /** The turn's footnotes, drawn above the receipt line. Empty unless Footnotes is on. */
  notes: FootnoteData[]
  /** Drawn under the receipt line; null unless Time strip is on and the turn was watched. */
  timeStrip: TimeStripData | null
}

export type UsageData = {
  contextPercent?: number
  rateLimits: Array<{ kind: string; percentUsed: number; resetsAt?: number }>
  costUsd?: number
}

/** A call waiting on the user's permission, for the attention ladder. */
export type WaitingData = { tool: string; input: unknown; waitedMs: number }

export type BandData = { usage: UsageData | null; waiting: WaitingData | null; isWorking: boolean }

/** How panes (Chapters, Ledger, Pins) dress in this look. */
export type PaneStyle = {
  /** Theme token or hex color for headings and the current row. */
  accent: string
  /** Glyph in front of each list row. */
  marker: string
  /** Glyph in front of the current or selected row. */
  current: string
}

/**
 * A complete visual language. A renderer returns a tree; `toolResult` and
 * `band` may return null to leave Claude Code's (or another mod's) drawing.
 */
export type Look = {
  toolRow: (row: ToolRow, ctx: Ctx) => RenderElement
  toolGroup: (rows: ToolRow[], ctx: Ctx) => RenderElement
  quietLine: (hidden: number, ctx: Ctx) => RenderElement
  toolResult: (row: ResultRow, ctx: Ctx) => RenderElement | null
  userMessage: (text: string, ctx: Ctx) => RenderElement
  headline: (headline: HeadlineData, ctx: Ctx) => RenderElement
  receipt: (data: ReceiptData, ctx: Ctx) => RenderElement
  live: (state: LiveState, frame: number, ctx: Ctx) => RenderElement
  liveFrames: (state: LiveState, frame: number) => LiveFrame[]
  band: (data: BandData, ctx: Ctx) => RenderElement | null
  paneStyle: PaneStyle
}
