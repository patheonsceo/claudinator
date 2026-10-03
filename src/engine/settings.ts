import type { ClaudinatorSettings, IngredientId, LookId } from '../../types'

export type { IngredientId, LookId } from '../../types'

export type Settings = ClaudinatorSettings

export const LOOK_IDS: readonly LookId[] = ['hairline', 'off']

export const INGREDIENT_IDS: readonly IngredientId[] = ['recency', 'miniDiffs', 'fileColors', 'quiet']

/** Part of a Settings, as one source sets it. */
export type SettingsLayer = { look?: LookId; ingredients?: Partial<Record<IngredientId, boolean>> }

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  look: 'hairline',
  ingredients: { recency: true, miniDiffs: true, fileColors: false, quiet: false },
}

export const LOOK_LABELS: Record<LookId, string> = { hairline: 'Hairline', off: 'Off' }

export const INGREDIENT_LABELS: Record<IngredientId, string> = {
  recency: 'Recency fade',
  miniDiffs: 'Mini diffs',
  fileColors: 'File colors',
  quiet: 'Quiet',
}

export const INGREDIENT_HOTKEYS: Record<IngredientId, string> = { recency: 'r', miniDiffs: 'd', fileColors: 'f', quiet: 'q' }

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

function compact(look: unknown, ingredients: Partial<Record<IngredientId, boolean>>): SettingsLayer {
  const layer: SettingsLayer = {}
  if (isLookId(look)) layer.look = look
  if (Object.keys(ingredients).length > 0) layer.ingredients = ingredients
  return layer
}

/** A layer from stored or project JSON, keeping only valid fields. */
export function layerOf(raw: unknown): SettingsLayer {
  if (raw === null || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  return compact(r.look, ingredientsOf(r.ingredients))
}

/** Ingredients that hide rows. Only the user may turn these on, never a project file. */
const HIDING_INGREDIENTS: readonly IngredientId[] = ['quiet']

/**
 * A layer from a project's .claude/claudinator.json. A repository you clone
 * must not be able to hide tool calls from you, so hiding ingredients are dropped.
 */
export function projectLayerOf(raw: unknown): SettingsLayer {
  const layer = layerOf(raw)
  if (!layer.ingredients) return layer
  const ingredients = { ...layer.ingredients }
  for (const id of HIDING_INGREDIENTS) delete ingredients[id]
  return compact(layer.look, ingredients)
}

/** A layer from the plugin's userConfig options (`look`, `recency`, `miniDiffs`, ...). */
export function optionsLayer(options: Readonly<Record<string, unknown>>): SettingsLayer {
  return compact(options.look, ingredientsOf(options))
}

/** Defaults, then each layer in order; later layers win field by field. */
export function resolveSettings(layers: SettingsLayer[]): Settings {
  let look: LookId = DEFAULT_SETTINGS.look
  const ingredients = { ...DEFAULT_SETTINGS.ingredients }
  for (const layer of layers) {
    if (layer.look) look = layer.look
    Object.assign(ingredients, layer.ingredients ?? {})
  }
  return { version: 1, look, ingredients }
}

export function withLook(s: Settings, look: LookId): Settings {
  return { ...s, look, ingredients: { ...s.ingredients } }
}

export function toggled(s: Settings, id: IngredientId): Settings {
  return { ...s, ingredients: { ...s.ingredients, [id]: !s.ingredients[id] } }
}

/** The user's saved layer with only the look changed. */
export function changedLook(layer: SettingsLayer, look: LookId): SettingsLayer {
  return { ...layer, look }
}

/** The user's saved layer with only one ingredient changed. */
export function changedIngredient(layer: SettingsLayer, id: IngredientId, value: boolean): SettingsLayer {
  return { ...layer, ingredients: { ...(layer.ingredients ?? {}), [id]: value } }
}

/** What the picker saves: the full choice, as a layer. */
export function choiceOf(s: Settings): SettingsLayer {
  return { look: s.look, ingredients: { ...s.ingredients } }
}
