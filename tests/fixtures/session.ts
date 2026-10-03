import type { CommandRunInput, On, PromptSubmitInput, SessionStartInput } from 'claude-code'
import { mock } from 'claude-code/testing'
import type { MockClock } from 'claude-code/testing'

/** An interactive terminal session in /work. */
export const SESSION: SessionStartInput = { surface: 'terminal', isInteractive: true, cwd: '/work' }

/**
 * Answers what a Claudinator session asks Claude Code for: its start, its
 * commands, an empty store (recording writes), no project file, toasts and
 * pane opens. Rows Claudinator passes through draw as "engine".
 */
export function startsSession(on: On, world: { projectFile?: string; theme?: string } = {}): { saved: Map<string, unknown>; clock: MockClock; toasts: string[] } {
  const saved = new Map<string, unknown>()
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('store.get', ($, e) => ({ value: saved.get(e.key) }))
  on('store.set', ($, e) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('fs.read', () => (world.projectFile === undefined ? { deny: 'no such file' } : { value: world.projectFile }))
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.close', () => ({ value: undefined }))
  on('settings.read', () => ({ value: world.theme === undefined ? {} : { theme: world.theme } }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.blit', () => ({ value: {} }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 82000, window: 200000, percent: 41 }, rateLimits: [] } }))
  // Claude Code's own drawing: a reply shows its (possibly rewritten) text, anything else 'engine'.
  on('ui.render', ($, e) => ({ type: 'Text', props: {}, children: [e.component === 'AssistantMessage' ? String((e.props as { text?: unknown }).text ?? '') : 'engine'] }))
  const clock = mock.clock(on, { now: 1_000 })
  return { saved, clock, toasts }
}

/** A command the user typed at the prompt, in fullscreen. */
export function commandInput(command: string, args = ''): CommandRunInput {
  return { command, args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 } }
}

/** A prompt the user typed and sent. */
export function promptInput(text: string): PromptSubmitInput {
  return { text, wait: false, origin: { kind: 'composer' } }
}
