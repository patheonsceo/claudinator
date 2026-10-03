import type { ElementTable, RenderElement, RenderSurface } from 'claude-code'

import type { Fade } from '../engine/palette'
import type { TurnStats } from '../engine/session-model'
import type { Settings } from '../engine/settings'

export type Els = ElementTable

/** Everything a look needs to draw one site, passed in by the hooks module. */
export type Ctx = { els: Els; surface: RenderSurface; columns: number; settings: Settings; fade: Fade; cwd: string }

export type ToolRow = {
  id: string
  tool: string
  input: unknown
  isRunning: boolean
  isErrored: boolean
  isInterrupted: boolean
  durationMs?: number
}

export type ResultRow = { tool: string; output: unknown; isErrored: boolean }

export type LiveMode = 'thinking' | 'writing' | 'running'
export type LiveState = { mode: LiveMode; detail: string; elapsedMs: number }
export type LiveFrame = { key: string; columns: number; cells: string }
export type ReceiptData = { durationMs: number; stats: TurnStats | null }

/**
 * A complete visual language. A renderer returns a tree, or for `toolResult`
 * null to leave Claude Code's own drawing in place.
 */
export type Look = {
  toolRow: (row: ToolRow, ctx: Ctx) => RenderElement
  toolGroup: (rows: ToolRow[], ctx: Ctx) => RenderElement
  quietLine: (hidden: number, ctx: Ctx) => RenderElement
  toolResult: (row: ResultRow, ctx: Ctx) => RenderElement | null
  userMessage: (text: string, ctx: Ctx) => RenderElement
  receipt: (data: ReceiptData, ctx: Ctx) => RenderElement
  live: (state: LiveState, frame: number, ctx: Ctx) => RenderElement
  liveFrames: (state: LiveState, frame: number) => LiveFrame[]
}
