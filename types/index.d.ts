// Claudinator's $.state contract. Claude Code requires it to be self-contained,
// so the settings types are declared here and imported by src/engine/settings.ts.
// The settings type is named ClaudinatorSettings because, inside the
// `declare module 'claude-code'` block below, a bare `Settings` would resolve
// to Claude Code's own exported Settings type.

export type LookId = 'hairline' | 'broadsheet' | 'mission' | 'prism' | 'sumi' | 'blueprint' | 'off'

export type IngredientId = 'recency' | 'miniDiffs' | 'fileColors' | 'quiet' | 'headlines' | 'footnotes' | 'timeStrip' | 'attention' | 'inator'

export type ClaudinatorSettings = {
  version: 1
  look: LookId
  ingredients: Record<IngredientId, boolean>
  attention: { sound: boolean; notify: boolean }
}

declare module 'claude-code' {
  interface PluginState {
    claudinator: {
      settings: ClaudinatorSettings
    }
  }
}
