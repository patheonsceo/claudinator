import { printable } from './format'
import type { Settings } from './settings'

/** The ladder's steps: a glow in the band at once, a toast at 30 s, sound and a notification at 2 min. */
export const TOAST_AFTER_MS = 30_000
export const ALERT_AFTER_MS = 120_000

export type LadderState = { toasted: boolean; alerted: boolean }
export type LadderAction = 'toast' | 'sound' | 'notify'

/** What the ladder should do now, given how long Claude has waited and what already happened. */
export function ladderActions(waitedMs: number, settings: Settings, state: LadderState): LadderAction[] {
  if (!settings.ingredients.attention) return []
  const actions: LadderAction[] = []
  if (!state.toasted && waitedMs >= TOAST_AFTER_MS) actions.push('toast')
  if (!state.alerted && waitedMs >= ALERT_AFTER_MS) {
    if (settings.attention.sound) actions.push('sound')
    if (settings.attention.notify) actions.push('notify')
  }
  return actions
}

/**
 * Programs to try, in order, for a desktop notification: Linux, then macOS.
 * The text always travels as plain arguments, never inside a script or as an
 * option: `--` ends notify-send's options, and AppleScript reads it from argv.
 */
export function notifyCommands(title: string, body: string): string[][] {
  const t = printable(title, 80)
  const b = printable(body, 160)
  return [
    ['notify-send', '--app-name=Claudinator', '--', t, b],
    ['osascript', '-e', 'on run argv', '-e', 'display notification (item 2 of argv) with title (item 1 of argv)', '-e', 'end run', t, b],
  ]
}

/** Programs to try, in order, for a short system sound: PipeWire, PulseAudio, then macOS. */
export function soundCommands(): string[][] {
  return [
    ['pw-play', '/usr/share/sounds/freedesktop/stereo/message.oga'],
    ['paplay', '/usr/share/sounds/freedesktop/stereo/message.oga'],
    ['afplay', '/System/Library/Sounds/Glass.aiff'],
  ]
}

/** True unless the Claude Code theme setting names a light theme. */
export function isDarkTheme(theme: unknown): boolean {
  return !(typeof theme === 'string' && /light/i.test(theme))
}
