// SPDX-License-Identifier: MIT
// Claudinator's only hooks module. Claude Code reads on(...) and $.noun.method(...)
// from source, so every call is spelled literally, and helpers that take $ are
// top-level functions in this file. Everything else lives in ../src as pure code.
import { atom, read, update } from 'claude-code'
import type { ElementTable, EngineInterface, Register, RenderSurface } from 'claude-code'

import { fadeOf } from '../src/engine/palette'
import * as Model from '../src/engine/session-model'
import { DEFAULT_SETTINGS, LOOK_LABELS, changedIngredient, changedLook, isLookId, layerOf, optionsLayer, projectLayerOf, resolveSettings } from '../src/engine/settings'
import type { Settings, SettingsLayer } from '../src/engine/settings'
import { isQuietable } from '../src/engine/tool-facts'
import { LOOKS } from '../src/looks'
import { liveStateOf } from '../src/looks/hairline/live'
import type { Ctx, LiveState, ToolRow } from '../src/looks/look'
import { pickerView } from '../src/panes/picker'

const settingsAtom = atom({ plugin: 'claudinator', key: 'settings' } as const, DEFAULT_SETTINGS)

let model = Model.createModel()
let options: SettingsLayer = {}
let project: SettingsLayer = {}
let saved: SettingsLayer = {}
let cwd = ''
let frame = 0
let isFullscreen = true
let live: { requestId: string; state: LiveState } | null = null

function ctxOf(e: { surface: RenderSurface; viewport?: { columns: number } }, els: ElementTable, settings: Settings, fade: 0 | 1 | 2): Ctx {
  return { els, surface: e.surface, columns: e.viewport?.columns ?? 120, settings, fade, cwd }
}

function rowOf(id: string, p: { tool: string; input: unknown; isRunning: boolean; isErrored: boolean; isInterrupted: boolean }): ToolRow {
  const durationMs = Model.durationOf(model, id)
  return { id, tool: p.tool, input: p.input, isRunning: p.isRunning, isErrored: p.isErrored, isInterrupted: p.isInterrupted, ...(durationMs === undefined ? {} : { durationMs }) }
}

function isHiddenByQuiet(settings: Settings, row: { tool: string; isErrored: boolean }): boolean {
  return settings.ingredients.quiet && isQuietable(row.tool) && !row.isErrored
}

/** Defaults, then /config options, then the project's file, then what the user chose; later wins. */
function currentSettings(): Settings {
  return resolveSettings([options, project, saved])
}

async function readProjectLayer($: EngineInterface): Promise<SettingsLayer> {
  try {
    return projectLayerOf(JSON.parse(await $.fs.read('.claude/claudinator.json')))
  } catch {
    return {}
  }
}

async function loadSettings($: EngineInterface): Promise<void> {
  saved = layerOf(await $.store.get('settings'))
  project = await readProjectLayer($)
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

async function tick($: EngineInterface): Promise<void> {
  frame += 1
  const target = live
  if (!target || !model.isWorking) return
  const look = LOOKS[(await read($, settingsAtom)).look]
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

export const register: Register = (on, opts) => {
  options = optionsLayer(opts)

  on('session.start', async ($, e, next) => {
    model = Model.createModel()
    cwd = e.cwd ?? ''
    await loadSettings($)
    $.clock.every(100, () => {
      void tick($)
    })
    await $.command.register({ name: 'claudinator', description: 'Pick a Claudinator look and ingredients', immediate: true })
    await $.command.register({ name: 'look', description: 'Switch the Claudinator look', argumentHint: '<hairline|off>', immediate: true })
    return next(e)
  })

  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    model = Model.createModel()
    await loadSettings($)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    Model.promptSubmitted(model, await $.clock.now())
    return next(e)
  })

  // turn.start fires for the main conversation's turns only; subagents do not raise it.
  on('turn.start', async ($, e, next) => {
    Model.startTurn(model, await $.clock.now())
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId) {
      let percent: number | undefined
      try {
        percent = (await $.session.usage()).context.percent
      } catch {
        percent = undefined
      }
      Model.completeTurn(model, await $.clock.now(), percent)
      live = null
      $.ui.invalidate('ui.render')
    }
    return result
  })

  // Observes the permission verdict only, so a call that waited on the user shows no duration.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (e.tool_use_id && verdict.decision === 'ask') Model.toolPrompted(model, e.tool_use_id)
    return verdict
  })

  on('tool.call', async ($, e, next) => {
    Model.toolStarted(model, e.tool_use_id, e.tool, e, await $.clock.now())
    $.ui.invalidate('ui.render')
    let isError = true
    try {
      const result = await next(e)
      isError = Boolean(result && typeof result === 'object' && ('deny' in result || ('isError' in result && result.isError)))
      return result
    } finally {
      Model.toolFinished(model, e.tool_use_id, e.tool, e, await $.clock.now(), isError)
      $.ui.invalidate('ui.render')
    }
  })

  on('command.run', { command: 'claudinator' }, async $ => {
    await $.ui.open({ id: 'claudinator', title: 'Claudinator', focus: true, closeOnEscape: true })
    return {}
  })

  on('command.run', { command: 'look' }, async ($, e) => {
    const id = e.args.trim().toLowerCase()
    if (!isLookId(id)) {
      $.ui.toast(`No look called "${id}". Try /look hairline or /look off.`)
      return {}
    }
    await saveChange($, layer => changedLook(layer, id))
    $.ui.toast(`Look: ${LOOK_LABELS[id]}`)
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
      { isFullscreen, hasProjectFile: Object.keys(project).length > 0 },
      {
        setLook: id => {
          void saveChange($, layer => changedLook(layer, id))
        },
        toggle: id => {
          void saveChange($, layer => changedIngredient(layer, id, !settings.ingredients[id]))
        },
      },
    )
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.component !== 'ToolUse') return next(e)
    const settings = await read($, settingsAtom)
    const look = LOOKS[settings.look]
    if (!look) return next(e)
    const row = rowOf(e.props.tool_use_id, e.props)
    const fade = fadeOf(model.toolTurn.get(row.id), model.turn, settings.ingredients.recency)
    const ctx = ctxOf(e, $.ui.resolve(e), settings, fade)
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
    const hidden = rows.filter(r => isHiddenByQuiet(settings, r)).length
    if (hidden > 0 && hidden === rows.length) return look.quietLine(hidden, ctx)
    return look.toolGroup(rows, ctx)
  }).catch(async ($, e, next) => next(e))

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.component !== 'ToolResult') return next(e)
    const settings = await read($, settingsAtom)
    const look = LOOKS[settings.look]
    if (!look) return next(e)
    const els = $.ui.resolve(e)
    if (isHiddenByQuiet(settings, e.props)) return els.Box({})
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
    return look.userMessage(e.props.text, ctxOf(e, $.ui.resolve(e), settings, fade))
  }).catch(async ($, e, next) => next(e))

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    if (e.component !== 'TurnDuration') return next(e)
    const settings = await read($, settingsAtom)
    const look = LOOKS[settings.look]
    if (!look) return next(e)
    const stats = Model.receiptFor(model, e.requestId, await $.clock.now())
    const fade = fadeOf(stats?.turn, model.turn, settings.ingredients.recency)
    return look.receipt({ durationMs: e.props.durationMs, stats }, ctxOf(e, $.ui.resolve(e), settings, fade))
  }).catch(async ($, e, next) => next(e))

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (e.component !== 'Spinner') return next(e)
    const settings = await read($, settingsAtom)
    const look = LOOKS[settings.look]
    if (!look) return next(e)
    const elapsed = model.isWorking ? (await $.clock.now()) - model.turnStartedAt : 0
    const state = liveStateOf(e.props.mode, Model.latestRunning(model), elapsed, cwd, e.props.message)
    live = e.surface === 'terminal' ? { requestId: e.requestId, state } : null
    return look.live(state, frame, ctxOf(e, $.ui.resolve(e), settings, 0))
  }).catch(async ($, e, next) => next(e))
}
