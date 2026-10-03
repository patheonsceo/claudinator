import type { CommandRunInput, On, SessionStartInput } from 'claude-code'
import { mock } from 'claude-code/testing'
import type { MockClock } from 'claude-code/testing'

/** An interactive terminal session in /work. */
export const SESSION: SessionStartInput = { surface: 'terminal', isInteractive: true, cwd: '/work' }

/**
 * Answers what a Claudinator session asks Claude Code for: its start, its
 * commands, an empty store (recording writes), no project file, toasts and
 * pane opens. Rows Claudinator passes through draw as "engine".
 */
export function startsSession(on: On, world: { projectFile?: string } = {}): { saved: Map<string, unknown>; clock: MockClock } {
  const saved = new Map<string, unknown>()
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('store.get', ($, e) => ({ value: saved.get(e.key) }))
  on('store.set', ($, e) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('fs.read', () => (world.projectFile === undefined ? { deny: 'no such file' } : { value: world.projectFile }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.blit', () => ({ value: {} }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 82000, window: 200000, percent: 41 }, rateLimits: [] } }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine'] }))
  const clock = mock.clock(on, { now: 1_000 })
  return { saved, clock }
}

/** A command the user typed at the prompt, in fullscreen. */
export function commandInput(command: string, args = ''): CommandRunInput {
  return { command, args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } }
}
