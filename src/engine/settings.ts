import type { Settings } from '../../types'

export type { IngredientId, LookId, Settings } from '../../types'

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  look: 'hairline',
  ingredients: { recency: true, miniDiffs: true, fileColors: false, quiet: false },
}
