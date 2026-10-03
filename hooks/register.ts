// SPDX-License-Identifier: MIT
// Claudinator's only hooks module. Claude Code reads on(...) and $.noun.method(...)
// from source, so every call is spelled literally, and helpers that take $ are
// top-level functions in this file. Everything else lives in ../src as pure code.
import { atom, read, update } from 'claude-code'
import type { ElementTable, EngineInterface, Register, RenderElement, RenderSurface } from 'claude-code'

import { isDarkTheme, ladderActions, notifyCommands, soundCommands, waitsOnUser } from '../src/engine/attention'
import { comboById } from '../src/engine/combos'
import { printable } from '../src/engine/format'
import { fadeOf } from '../src/engine/palette'
import * as Model from '../src/engine/session-model'
import { DEFAULT_SETTINGS, LOOK_LABELS, changedIngredient, changedLook, isLookId, layerOf, optionsLayer, projectLayerOf, resolveSettings } from '../src/engine/settings'
import type { Settings, SettingsLayer } from '../src/engine/settings'
import { decodeShareCode, encodeShareCode } from '../src/engine/share-code'
import { factsOf, isFootnotable, isQuietable } from '../src/engine/tool-facts'
import { LOOKS } from '../src/looks'
import { waitingBand, withMarks } from '../src/looks/common'
import { liveStateOf } from '../src/looks/hairline/live'
import type { Ctx, LiveState, Look, ReceiptData, ToolRow, UsageData } from '../src/looks/look'
import { navigatorView } from '../src/panes/navigator'
import type { NavigatorTab, Pin } from '../src/panes/navigator'
import { pickerView } from '../src/panes/picker'

const settingsAtom = atom({ plugin: 'claudinator', key: 'settings' } as const, DEFAULT_SETTINGS)

let model = Model.createModel()
let options: SettingsLayer = {}
let project: SettingsLayer = {}
let saved: SettingsLayer = {}
let cwd = ''
let frame = 0
let isFullscreen = true
let isDark = true
let live: { requestId: string; state: LiveState } | null = null
let usage: UsageData | null = null
let pins: Pin[] = []
let navTab: NavigatorTab = 'chapters'
let ladder = { toasted: false, alerted: false }
let lastBandSecond = -1
/** The session's permission mode, as the last tool call reported it. */
let permissionMode: string | undefined
/** How long each call's tool itself ran, as Claude Code reports it after the call. */
const execMs = new Map<string, number>()

function ctxOf(e: { surface: RenderSurface; viewport?: { columns: number } }, els: ElementTable, settings: Settings, fade: 0 | 1 | 2): Ctx {
  return { els, surface: e.surface, columns: e.viewport?.columns ?? 120, settings, fade, cwd, isDark }
}

function rowOf(id: string, p: { tool: string; input: unknown; isRunning: boolean; isErrored: boolean; isInterrupted: boolean }): ToolRow {
  const row: ToolRow = { id, tool: p.tool, input: p.input, isRunning: p.isRunning, isErrored: p.isErrored, isInterrupted: p.isInterrupted }
  const durationMs = Model.durationOf(model, id)
  if (durationMs !== undefined) row.durationMs = durationMs
  const start = model.toolStart.get(id)
  const turn = model.toolTurn.get(id)
  const record = model.turns.find(t => t.turn === turn)
  if (start !== undefined && record) row.turnOffsetMs = Math.max(0, start - record.startedAt)
  const changeIndex = Model.changeIndexOf(model, id)
  if (changeIndex !== undefined) row.changeIndex = changeIndex
  return row
}

function isHiddenByQuiet(settings: Settings, row: { tool: string; isErrored: boolean }): boolean {
  return settings.ingredients.quiet && isQuietable(row.tool) && !row.isErrored
}

/** A footnoted row hides only in the terminal, where the receipt that carries its note is drawn. */
function isFootnoted(settings: Settings, row: { id: string; isErrored: boolean; isInterrupted?: boolean }, surface: string): boolean {
  return settings.ingredients.footnotes && surface === 'terminal' && !row.isErrored && !row.isInterrupted && Model.isNoteShown(model, row.id)
}

/** Defaults, then /config options, then the project's file, then what the user chose; later wins. */
function currentSettings(): Settings {
  return resolveSettings([options, project, saved])
}

/** The strip and its legend need room; below this width the receipt goes without. */
const TIME_STRIP_MIN_COLUMNS = 100

function receiptData(settings: Settings, durationMs: number, stats: Model.TurnStats | null, columns: number): ReceiptData {
  const data: ReceiptData = { durationMs, stats, notes: [], timeStrip: null }
  if (stats?.title) data.title = stats.title
  if (settings.ingredients.footnotes && stats?.notes) data.notes = stats.notes
  if (settings.ingredients.timeStrip && columns >= TIME_STRIP_MIN_COLUMNS && stats && stats.toolsMs !== undefined) {
    const toolsMs = stats.toolsMs
    const waitingMs = stats.waitingMs ?? 0
    // Claude Code's duration leaves out permission waits, so thinking is measured against the turn's own time.
    const wallMs = stats.wallMs ?? durationMs
    data.timeStrip = { thinkingMs: Math.max(0, wallMs - toolsMs - waitingMs), toolsMs, waitingMs }
  }
  return data
}

async function readProjectLayer($: EngineInterface): Promise<SettingsLayer> {
  try {
    return projectLayerOf(JSON.parse(await $.fs.read('.claude/claudinator.json')))
  } catch {
    return {}
  }
}

async function readTheme($: EngineInterface): Promise<void> {
  try {
    isDark = isDarkTheme((await $.settings.read()).theme)
  } catch {
    isDark = true
  }
}

async function loadSettings($: EngineInterface): Promise<void> {
  saved = layerOf(await $.store.get('settings'))
  project = await readProjectLayer($)
  const storedPins = await $.store.get('pins')
  pins = Array.isArray(storedPins) ? storedPins.filter((p): p is Pin => typeof p === 'object' && p !== null && typeof (p as Pin).text === 'string') : []
  await update($, settingsAtom, () => currentSettings())
}

/**
 * Saves one change the user made. It starts from what the store holds now, so
 * only the touched field changes: project settings and /config options never
 * leak into the user's choice for other repositories.
 */
async function saveChange($: EngineInterface, change: (layer: SettingsLayer) => SettingsLayer): Promise<void> {
  saved = change(layerOf(await $.store.get('settings')))
  await $.store.set('settings', saved)
  await update($, settingsAtom, () => currentSettings())
}

async function savePins($: EngineInterface, next: Pin[]): Promise<void> {
  pins = next.slice(-50)
  await $.store.set('pins', pins)
  $.ui.invalidate('ui.render')
}

async function openNavigator($: EngineInterface, tab: NavigatorTab): Promise<void> {
  navTab = tab
  await $.ui.open({ id: 'claudinator-navigator', title: 'Claudinator', focus: true, closeOnEscape: true })
  $.ui.invalidate('ui.render')
}

async function runFirst($: EngineInterface, candidates: string[][]): Promise<void> {
  for (const argv of candidates) {
    try {
      const result = await $.process.run(argv, { timeoutMs: 5_000 })
      if (result.exitCode === 0) return
    } catch {
      // Not installed here; try the next program.
    }
  }
}

async function climbLadder($: EngineInterface, settings: Settings): Promise<void> {
  const waiting = Model.waitingOf(model, await $.clock.now())
  if (!waiting) return
  const second = Math.floor(waiting.waitedMs / 1000)
  if (second !== lastBandSecond) {
    lastBandSecond = second
    $.ui.invalidate('ui.render')
  }
  const facts = factsOf(waiting.tool, waiting.input)
  const what = `${facts.verb} ${facts.target}`.trim()
  for (const action of ladderActions(waiting.waitedMs, settings, ladder)) {
    if (action === 'toast') {
      ladder = { ...ladder, toasted: true }
      $.ui.toast(`Claude needs you: approve ${printable(what, 80)}`, { timeoutMs: 8_000 })
    } else {
      ladder = { ...ladder, alerted: true }
      if (action === 'sound') await runFirst($, soundCommands())
      else await runFirst($, notifyCommands('Claude needs you', `Approve ${what}`))
    }
  }
}

async function tick($: EngineInterface): Promise<void> {
  frame += 1
  const settings = await read($, settingsAtom)
  if (model.waiting && frame % 5 === 0) await climbLadder($, settings)
  const target = live
  if (!target || !model.isWorking) return
  const look = LOOKS[settings.look]
  if (!look) return
  const state = { ...target.state, elapsedMs: (await $.clock.now()) - model.turnStartedAt }
  for (const f of look.liveFrames(state, frame)) {
    const result = await $.ui.blit({ requestId: target.requestId, key: f.key, columns: f.columns, rows: 1, cells: f.cells })
    if (result && typeof result === 'object' && 'deny' in result) {
      live = null
      return
    }
  }
}

async function refreshUsage($: EngineInterface): Promise<number | undefined> {
  try {
    const u = await $.session.usage()
    usage = {
      contextPercent: u.context.percent,
      rateLimits: u.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, ...(typeof r.resetsAt === 'number' ? { resetsAt: r.resetsAt } : {}) })),
      ...(u.cost && typeof u.cost.usd === 'number' ? { costUsd: u.cost.usd } : {}),
    }
    return u.context.percent
  } catch {
    return undefined
  }
}

async function runLook($: EngineInterface, args: string): Promise<void> {
  const arg = args.trim()
  const lower = arg.toLowerCase()
  if (lower === '') {
    $.ui.toast('Try /look hairline, /look zen, /look share or /look use HL-43H. /claudinator opens the picker.')
    return
  }
  if (lower === 'share') {
    const code = encodeShareCode(await read($, settingsAtom))
    $.ui.toast(`Share this setup: ${code}. Others type /look use ${code}.`, { timeoutMs: 10_000 })
    return
  }
  if (lower.startsWith('use ')) {
    const decoded = decodeShareCode(arg.slice(4))
    if (!decoded.ok) {
      $.ui.toast(decoded.reason)
      return
    }
    await saveChange($, () => decoded.layer)
    $.ui.toast(`Applied ${arg.slice(4).trim().toUpperCase()}`)
    return
  }
  const combo = comboById(lower)
  if (combo) {
    await saveChange($, () => combo.layer)
    $.ui.toast(`Combo: ${combo.label}`)
    return
  }
  if (isLookId(lower)) {
    await saveChange($, layer => changedLook(layer, lower))
    $.ui.toast(`Look: ${LOOK_LABELS[lower]}`)
    return
  }
  $.ui.toast(`No look, combo or code called "${printable(arg, 40)}". Try /look hairline or /claudinator.`)
}

export const register: Register = (on, opts) => {
  options = optionsLayer(opts)

  on('session.start', async ($, e, next) => {
    model = Model.createModel()
    cwd = e.cwd ?? ''
    await loadSettings($)
    await readTheme($)
    $.clock.every(100, () => {
      void tick($)
    })
    await $.command.register({ name: 'claudinator', description: 'Pick a Claudinator look, ingredients or combo', immediate: true })
    await $.command.register({ name: 'look', description: 'Switch look or combo, or share your setup', argumentHint: '<look|combo|share|use CODE>', immediate: true })
    await $.command.register({ name: 'chapters', description: 'Open Claudinator Chapters: every turn, jump to any', immediate: true })
    await $.command.register({ name: 'ledger', description: 'Open Claudinator Ledger: every file changed this session', immediate: true })
    await $.command.register({ name: 'pins', description: 'Open Claudinator Pins', immediate: true })
    await $.command.register({ name: 'pin', description: 'Pin a note (or the last turn) to Claudinator Pins', argumentHint: '[note]', immediate: true })
    return next(e)
  })

  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    model = Model.createModel()
    await loadSettings($)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.turnId === undefined) Model.promptSubmitted(model, await $.clock.now(), e.text)
    else Model.promptQueued(model, e.text)
    return next(e)
  })

  // turn.start fires for the main conversation's turns only; subagents do not raise it.
  on('turn.start', async ($, e, next) => {
    Model.startTurn(model, await $.clock.now())
    ladder = { toasted: false, alerted: false }
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) {
      const now = await $.clock.now()
      const percent = await refreshUsage($)
      Model.completeTurn(model, now, percent, e.answer)
      live = null
      $.ui.invalidate('ui.render')
    }
    return result
  })

  // Observers only: the session's permission mode, and how long each tool itself ran.
  on('classic.UserPromptSubmit', async ($, e, next) => {
    permissionMode = e.permission_mode
    return next(e)
  })

  on('classic.PostToolUse', async ($, e, next) => {
    permissionMode = e.permission_mode
    if (typeof e.duration_ms === 'number') execMs.set(e.tool_use_id, e.duration_ms)
    return next(e)
  })

  on('classic.PostToolUseFailure', async ($, e, next) => {
    permissionMode = e.permission_mode
    if (typeof e.duration_ms === 'number') execMs.set(e.tool_use_id, e.duration_ms)
    return next(e)
  })

  // Observes the permission verdict only: a call that asks waits on the user, which
  // starts the attention ladder and keeps that time out of the call's duration.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (e.tool_use_id && verdict.decision === 'ask' && waitsOnUser(permissionMode)) {
      Model.toolPrompted(model, e.tool_use_id)
      Model.waitingStarted(model, e.tool_use_id, e.tool, e.input, await $.clock.now())
      ladder = { toasted: false, alerted: false }
      $.ui.invalidate('ui.render')
    }
    return verdict
  })

  on('tool.call', async ($, e, next) => {
    const settings = await read($, settingsAtom)
    const isSubagent = e.agentId !== undefined
    const footnoted = settings.ingredients.footnotes && isFootnotable(e.tool) && !isSubagent
    Model.toolStarted(model, e.tool_use_id, e.tool, e, await $.clock.now(), footnoted, isSubagent)
    $.ui.invalidate('ui.render')
    let isError = true
    try {
      const result = await next(e)
      isError = Boolean(result && typeof result === 'object' && ('deny' in result || ('isError' in result && result.isError)))
      return result
    } finally {
      Model.waitingEnded(model, e.tool_use_id)
      Model.toolFinished(model, e.tool_use_id, e.tool, e, await $.clock.now(), isError, execMs.get(e.tool_use_id))
      execMs.delete(e.tool_use_id)
      $.ui.invalidate('ui.render')
    }
  })

  on('command.run', { command: 'claudinator' }, async $ => {
    await readTheme($)
    await $.ui.open({ id: 'claudinator', title: 'Claudinator', focus: true, closeOnEscape: true })
    return {}
  })

  on('command.run', { command: 'look' }, async ($, e) => {
    await runLook($, e.args)
    return {}
  })

  on('command.run', { command: 'chapters' }, async $ => {
    await openNavigator($, 'chapters')
    return {}
  })

  on('command.run', { command: 'ledger' }, async $ => {
    await openNavigator($, 'ledger')
    return {}
  })

  on('command.run', { command: 'pins' }, async $ => {
    await openNavigator($, 'pins')
    return {}
  })

  on('command.run', { command: 'pin' }, async ($, e) => {
    const last = model.turns[model.turns.length - 1]
    const text = printable(e.args.trim(), 300) || last?.title || ''
    if (text === '') {
      $.ui.toast('Nothing to pin yet. Type /pin and a note.')
      return {}
    }
    const pin: Pin = e.args.trim() === '' && last ? { text, turn: last.turn } : { text }
    await savePins($, [...pins, pin])
    $.ui.toast(`Pinned: ${printable(text, 60)}`)
    return {}
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if (e.viewport && typeof e.viewport.isFullscreen === 'boolean') isFullscreen = e.viewport.isFullscreen
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: 'claudinator' }, async ($, e) => {
    const settings = await read($, settingsAtom)
    return pickerView(
      $.ui.resolve(e),
      settings,
      { isFullscreen, hasProjectFile: Object.keys(project).some(k => k !== 'fromProject'), shareCode: encodeShareCode(settings), columns: e.props.bodyColumns, isDark },
      {
        setLook: id => {
          void saveChange($, layer => changedLook(layer, id))
        },
        toggle: id => {
          void saveChange($, layer => changedIngredient(layer, id, !settings.ingredients[id]))
        },
        applyCombo: id => {
          const combo = comboById(id)
          if (combo) void saveChange($, () => combo.layer)
        },
      },
    )
  })

  on('ui.render', { component: 'Pane', requestId: 'claudinator-navigator' }, async ($, e) => {
    const settings = await read($, settingsAtom)
    const style = (LOOKS[settings.look] ?? LOOKS.hairline)?.paneStyle ?? { accent: 'suggestion', marker: '·', current: '›' }
    return navigatorView(
      $.ui.resolve(e),
      style,
      { tab: navTab, cwd, turns: model.turns, ledger: Model.ledgerOf(model), pins },
      {
        setTab: tab => {
          navTab = tab
          $.ui.invalidate('ui.render')
        },
        // A jump can be refused (classic layout, row not mounted); that is fine, so failures are dropped.
        jumpToTurn: turn => {
          const rowId = model.turns.find(t => t.turn === turn)?.userRowId
          if (rowId) $.ui.scroll({ to: { requestId: rowId }, block: 'start' }).catch(() => undefined)
        },
        jumpToTool: toolId => {
          $.ui.scroll({ to: { requestId: toolId }, block: 'center' }).catch(() => undefined)
        },
        unpin: index => {
          void savePins($, pins.filter((_, i) => i !== index))
        },
      },
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.component !== 'AbovePrompt') return next(e)
    const settings = await read($, settingsAtom)
    const look = LOOKS[settings.look]
    if (!look || e.props.hasSurvey) return next(e)
    const waiting = settings.ingredients.attention ? Model.waitingOf(model, await $.clock.now()) : null
    // The band is as wide as the body beside any docked pane, not the whole terminal.
    const ctx = ctxOf({ surface: e.surface, viewport: { columns: e.props.bodyColumns } }, $.ui.resolve(e), settings, 0)
    const drawn = look.band({ usage, waiting, isWorking: model.isWorking }, ctx) ?? (waiting ? waitingBand(ctx, waiting) : null)
    if (!drawn) return next(e)
    const others = await next(e)
    return ctx.els.Box({ flexDirection: 'column', children: [drawn, others] as RenderElement[] })
  }).catch(async ($, e, next) => next(e))

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.component !== 'AssistantMessage') return next(e)
    Model.assistantSeen(model, e.requestId, await $.clock.now())
    const settings = await read($, settingsAtom)
    const marks = Model.marksOf(model, e.requestId)
    if (!LOOKS[settings.look] || !settings.ingredients.footnotes || marks.length === 0) return next(e)
    return next({ ...e, props: { ...e.props, text: withMarks(e.props.text, marks) } })
  }).catch(async ($, e, next) => next(e))

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.component !== 'ToolUse') return next(e)
    const settings = await read($, settingsAtom)
    const look = LOOKS[settings.look]
    if (!look) return next(e)
    const row = rowOf(e.props.tool_use_id, e.props)
    const fade = fadeOf(model.toolTurn.get(row.id), model.turn, settings.ingredients.recency)
    const ctx = ctxOf(e, $.ui.resolve(e), settings, fade)
    if (isFootnoted(settings, row, e.surface)) return ctx.els.Box({})
    if (isHiddenByQuiet(settings, row)) return look.quietLine(1, ctx)
    return look.toolRow(row, ctx)
  }).catch(async ($, e, next) => next(e))

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (e.component !== 'ToolGroup') return next(e)
    const settings = await read($, settingsAtom)
    const look = LOOKS[settings.look]
    // An expanded group (ctrl+o, --verbose) unfolds into Claude Code's own rows.
    if (!look || e.props.isExpanded) return next(e)
    const rows = e.props.calls.map(c => rowOf(c.tool_use_id ?? '', c))
    const first = rows[0]
    const fade = fadeOf(first ? model.toolTurn.get(first.id) : undefined, model.turn, settings.ingredients.recency)
    const ctx = ctxOf(e, $.ui.resolve(e), settings, fade)
    const visible = rows.filter(r => !isFootnoted(settings, r, e.surface))
    if (visible.length === 0) return ctx.els.Box({})
    const hidden = visible.filter(r => isHiddenByQuiet(settings, r)).length
    if (hidden > 0 && hidden === visible.length) return look.quietLine(hidden, ctx)
    return look.toolGroup(visible, ctx)
  }).catch(async ($, e, next) => next(e))

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.component !== 'ToolResult') return next(e)
    const settings = await read($, settingsAtom)
    const look = LOOKS[settings.look]
    if (!look) return next(e)
    const els = $.ui.resolve(e)
    const isFolded = isFootnoted(settings, { id: e.props.tool_use_id, isErrored: e.props.isErrored }, e.surface)
    if (!e.props.isErrored && (isHiddenByQuiet(settings, e.props) || isFolded)) return els.Box({})
    const fade = fadeOf(model.toolTurn.get(e.props.tool_use_id), model.turn, settings.ingredients.recency)
    const drawn = look.toolResult({ tool: e.props.tool, output: e.props.output, isErrored: e.props.isErrored }, ctxOf(e, els, settings, fade))
    return drawn ?? next(e)
  }).catch(async ($, e, next) => next(e))

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.component !== 'UserMessage') return next(e)
    const settings = await read($, settingsAtom)
    const look = LOOKS[settings.look]
    if (!look || e.props.isExpanded || e.props.origin.kind !== 'composer') return next(e)
    const turn = Model.turnOfRow(model, e.requestId, await $.clock.now())
    const fade = fadeOf(turn, model.turn, settings.ingredients.recency)
    const ctx = ctxOf(e, $.ui.resolve(e), settings, fade)
    const prompt = look.userMessage(e.props.text, ctx)
    const title = settings.ingredients.headlines ? model.turns.find(t => t.turn === turn)?.title : undefined
    if (!title || turn === undefined) return prompt
    return ctx.els.Box({ flexDirection: 'column', children: [look.headline({ turn, title }, ctx), prompt] })
  }).catch(async ($, e, next) => next(e))

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    if (e.component !== 'TurnDuration') return next(e)
    const settings = await read($, settingsAtom)
    const look: Look | null = LOOKS[settings.look]
    if (!look) return next(e)
    const stats = Model.receiptFor(model, e.requestId, await $.clock.now())
    const fade = fadeOf(stats?.turn, model.turn, settings.ingredients.recency)
    const ctx = ctxOf(e, $.ui.resolve(e), settings, fade)
    return look.receipt(receiptData(settings, e.props.durationMs, stats, ctx.columns), ctx)
  }).catch(async ($, e, next) => next(e))

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.component !== 'Spinner') return next(e)
    const wasWaiting = model.waiting !== null
    Model.workingLineDrawn(model, await $.clock.now())
    if (wasWaiting && model.waiting === null) $.ui.invalidate('ui.render')
    const settings = await read($, settingsAtom)
    const look = LOOKS[settings.look]
    if (!look) return next(e)
    const elapsed = model.isWorking ? (await $.clock.now()) - model.turnStartedAt : 0
    const state = { ...liveStateOf(e.props.mode, Model.latestRunning(model), elapsed, cwd, e.props.message), inator: settings.ingredients.inator }
    live = e.surface === 'terminal' ? { requestId: e.requestId, state } : null
    return look.live(state, frame, ctxOf(e, $.ui.resolve(e), settings, 0))
  }).catch(async ($, e, next) => next(e))
}
