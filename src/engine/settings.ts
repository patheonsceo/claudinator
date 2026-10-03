import type { ClaudinatorSettings, IngredientId, LookId } from '../../types'

export type { IngredientId, LookId } from '../../types'

export type Settings = ClaudinatorSettings

export const LOOK_IDS: readonly LookId[] = ['hairline', 'broadsheet', 'mission', 'prism', 'sumi', 'blueprint', 'thermal', 'off']

export const INGREDIENT_IDS: readonly IngredientId[] = ['recency', 'miniDiffs', 'fileColors', 'quiet', 'headlines', 'footnotes', 'timeStrip', 'attention', 'inator']

/** Part of a Settings, as one source sets it. */
export type SettingsLayer = {
  /** Set on a project file's layer: a look it picks never brings ingredients that hide rows. */
  fromProject?: true
  look?: LookId
  ingredients?: Partial<Record<IngredientId, boolean>>
  attention?: Partial<Settings['attention']>
}

const BASE_INGREDIENTS: Record<IngredientId, boolean> = {
  recency: false,
  miniDiffs: false,
  fileColors: false,
  quiet: false,
  headlines: false,
  footnotes: false,
  timeStrip: false,
  attention: true,
  inator: false,
}

/** What each look turns on by default. The user's own choices always win. */
export const LOOK_DEFAULTS: Record<LookId, Partial<Record<IngredientId, boolean>>> = {
  hairline: { recency: true, miniDiffs: true },
  broadsheet: { headlines: true, footnotes: true },
  mission: { recency: true, timeStrip: true },
  prism: { fileColors: true, miniDiffs: true },
  sumi: { recency: true },
  blueprint: { miniDiffs: true, headlines: true },
  thermal: {},
  off: {},
}

export const LOOK_LABELS: Record<LookId, string> = {
  hairline: 'Hairline',
  broadsheet: 'Broadsheet',
  mission: 'Mission Control',
  prism: 'Prism',
  sumi: 'Sumi',
  blueprint: 'Blueprint',
  thermal: 'Thermal',
  off: 'Off',
}

export const INGREDIENT_LABELS: Record<IngredientId, string> = {
  recency: 'Recency fade',
  miniDiffs: 'Mini diffs',
  fileColors: 'File colors',
  quiet: 'Quiet',
  headlines: 'Headlines',
  footnotes: 'Footnotes',
  timeStrip: 'Time strip',
  attention: 'Attention ladder',
  inator: '-inator mode',
}

export const INGREDIENT_HOTKEYS: Record<IngredientId, string> = {
  recency: 'r',
  miniDiffs: 'd',
  fileColors: 'f',
  quiet: 'q',
  headlines: 'h',
  footnotes: 'n',
  timeStrip: 't',
  attention: 'a',
  inator: 'i',
}

export function isLookId(value: unknown): value is LookId {
  return typeof value === 'string' && (LOOK_IDS as readonly string[]).includes(value)
}

function ingredientsOf(raw: unknown): Partial<Record<IngredientId, boolean>> {
  if (raw === null || typeof raw !== 'object') return {}
  const out: Partial<Record<IngredientId, boolean>> = {}
  for (const id of INGREDIENT_IDS) {
    const value = (raw as Record<string, unknown>)[id]
    if (typeof value === 'boolean') out[id] = value
  }
  return out
}

function attentionOf(raw: unknown): Partial<Settings['attention']> {
  if (raw === null || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const out: Partial<Settings['attention']> = {}
  if (typeof r.sound === 'boolean') out.sound = r.sound
  if (typeof r.notify === 'boolean') out.notify = r.notify
  return out
}

function compact(look: unknown, ingredients: Partial<Record<IngredientId, boolean>>, attention: Partial<Settings['attention']> = {}): SettingsLayer {
  const layer: SettingsLayer = {}
  if (isLookId(look)) layer.look = look
  if (Object.keys(ingredients).length > 0) layer.ingredients = ingredients
  if (Object.keys(attention).length > 0) layer.attention = attention
  return layer
}

/** A layer from stored or project JSON, keeping only valid fields. */
export function layerOf(raw: unknown): SettingsLayer {
  if (raw === null || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  return compact(r.look, ingredientsOf(r.ingredients), attentionOf(r.attention))
}

/** Ingredients that hide rows. Only the user may turn these on, never a project file. */
const HIDING_INGREDIENTS: readonly IngredientId[] = ['quiet', 'footnotes']

/**
 * A layer from a project's .claude/claudinator.json. A repository you clone
 * must not be able to hide tool calls from you or make noise, so hiding
 * ingredients and the attention options are dropped.
 */
export function projectLayerOf(raw: unknown): SettingsLayer {
  const layer = layerOf(raw)
  const ingredients = { ...(layer.ingredients ?? {}) }
  for (const id of HIDING_INGREDIENTS) delete ingredients[id]
  return { ...compact(layer.look, ingredients), fromProject: true }
}

/** A layer from the plugin's userConfig options: `look`, `attentionSound`, `attentionNotify`. */
export function optionsLayer(options: Readonly<Record<string, unknown>>): SettingsLayer {
  return compact(options.look, {}, attentionOf({ sound: options.attentionSound, notify: options.attentionNotify }))
}

/**
 * The look is the last one any layer sets. Ingredients start from the base,
 * then that look's defaults, then each layer in order: later layers win.
 */
export function resolveSettings(layers: SettingsLayer[]): Settings {
  let look: LookId = 'hairline'
  let isProjectLook = false
  for (const layer of layers) {
    if (layer.look) {
      look = layer.look
      isProjectLook = layer.fromProject === true
    }
  }
  const lookDefaults = { ...LOOK_DEFAULTS[look] }
  // A project can pick a look, but not use the look to hide rows from you.
  if (isProjectLook) for (const id of HIDING_INGREDIENTS) delete lookDefaults[id]
  const ingredients = { ...BASE_INGREDIENTS, ...lookDefaults }
  const attention = { sound: false, notify: false }
  for (const layer of layers) {
    Object.assign(ingredients, layer.ingredients ?? {})
    Object.assign(attention, layer.attention ?? {})
  }
  return { version: 1, look, ingredients, attention }
}

export const DEFAULT_SETTINGS: Settings = resolveSettings([])

/** The user's saved layer with only the look changed. */
export function changedLook(layer: SettingsLayer, look: LookId): SettingsLayer {
  return { ...layer, look }
}

/** The user's saved layer with only one ingredient changed. */
export function changedIngredient(layer: SettingsLayer, id: IngredientId, value: boolean): SettingsLayer {
  return { ...layer, ingredients: { ...(layer.ingredients ?? {}), [id]: value } }
}

/** A whole setup replacing the user's saved layer (a combo or a share code). */
export function setupLayer(look: LookId, ingredients: Partial<Record<IngredientId, boolean>>): SettingsLayer {
  return { look, ingredients: { ...ingredients } }
}

export function withLook(s: Settings, look: LookId): Settings {
  return { ...s, look, ingredients: { ...s.ingredients } }
}

export function toggled(s: Settings, id: IngredientId): Settings {
  return { ...s, ingredients: { ...s.ingredients, [id]: !s.ingredients[id] } }
}

/** The full choice, as a layer. */
export function choiceOf(s: Settings): SettingsLayer {
  return { look: s.look, ingredients: { ...s.ingredients } }
}
