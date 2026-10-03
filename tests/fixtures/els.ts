import type { ElementTable } from 'claude-code'

import { DEFAULT_SETTINGS } from '../../src/engine/settings'
import type { Ctx } from '../../src/looks/look'

function make(type: string) {
  return (props: Record<string, unknown> = {}) => {
    const { children, ...rest } = props
    return { type, props: rest, children: children === undefined ? [] : [children].flat() }
  }
}

/** Element constructors shaped like Claude Code's, for testing views without it. */
export const TERMINAL_ELS = {
  Box: make('Box'),
  Text: make('Text'),
  Button: make('Button'),
  Raster: make('Raster'),
} as unknown as ElementTable<'terminal'>

export const DESKTOP_ELS = { Box: make('Box'), Text: make('Text'), Button: make('Button') } as unknown as ElementTable<'desktop'>

export function ctxOf(overrides: Partial<Ctx> = {}): Ctx {
  return { els: TERMINAL_ELS, surface: 'terminal', columns: 120, settings: DEFAULT_SETTINGS, fade: 0, cwd: '/work', ...overrides }
}
