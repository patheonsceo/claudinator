/** Mid-tone colors that read on dark and light terminals alike. */
export const FILE_COLORS: readonly string[] = ['#8b93ff', '#e2709b', '#d79a3f', '#3fb39b', '#a07be0', '#4c9fd9', '#7fa35a', '#d9725f']

function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** The color a file keeps everywhere. */
export function fileColor(path: string): string {
  return FILE_COLORS[hash(path) % FILE_COLORS.length] ?? '#8b93ff'
}

export type Fade = 0 | 1 | 2

/** 0 for this turn's rows, 1 for the previous turn's, 2 for anything older or unknown. */
export function fadeOf(rowTurn: number | undefined, currentTurn: number, enabled: boolean): Fade {
  if (!enabled) return 0
  if (rowTurn === undefined) return currentTurn >= 1 ? 2 : 0
  const age = currentTurn - rowTurn
  return age <= 0 ? 0 : age === 1 ? 1 : 2
}

/** A color as it reads at a fade level, using Claude Code's dimmer theme tokens. */
export function tone(color: string, fade: Fade): string {
  return fade === 0 ? color : fade === 1 ? 'inactive' : 'subtle'
}

/** 24-bit colors for Raster cells, chosen to read on dark and light terminals. */
export const LIVE = {
  DEFAULT: 0x01000000,
  GRAY: 0x8a8a8a,
  ACCENT: 0x8b8ef0,
  ACCENT_DIM: 0x4f5290,
} as const
