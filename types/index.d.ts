// Claudinator's $.state contract. Claude Code requires it to be self-contained,
// so the settings types are declared here and imported by src/engine/settings.ts.

export type LookId = 'hairline' | 'off'

export type IngredientId = 'recency' | 'miniDiffs' | 'fileColors' | 'quiet'

export type Settings = { version: 1; look: LookId; ingredients: Record<IngredientId, boolean> }

declare module 'claude-code' {
  interface PluginState {
    claudinator: {
      settings: Settings
    }
  }
}
