import { INGREDIENT_IDS, setupLayer } from './settings'
import type { IngredientId, LookId, SettingsLayer } from './settings'

export type Combo = { id: string; label: string; summary: string; layer: SettingsLayer }

function combo(id: string, label: string, summary: string, look: LookId, on: IngredientId[]): Combo {
  const ingredients = Object.fromEntries(INGREDIENT_IDS.map(i => [i, on.includes(i)])) as Record<IngredientId, boolean>
  return { id, label, summary, layer: setupLayer(look, ingredients) }
}

/** Ready-made setups: a look plus a full set of ingredients. */
export const COMBOS: readonly Combo[] = [
  combo('daily', 'Daily driver', 'Hairline, headlines, file colors', 'hairline', ['recency', 'miniDiffs', 'headlines', 'fileColors', 'attention']),
  combo('storyteller', 'Storyteller', 'Broadsheet with footnotes', 'broadsheet', ['headlines', 'footnotes', 'fileColors', 'attention']),
  combo('showoff', 'Show-off', 'Prism with a time strip', 'prism', ['fileColors', 'miniDiffs', 'timeStrip', 'attention']),
  combo('doof', 'Doof mode', 'Blueprint, fully -inator', 'blueprint', ['miniDiffs', 'headlines', 'timeStrip', 'inator', 'attention']),
  combo('zen', 'Zen', 'Sumi, footnotes, fade', 'sumi', ['recency', 'footnotes', 'attention']),
]

export function comboById(id: string): Combo | undefined {
  return COMBOS.find(c => c.id === id.toLowerCase())
}
