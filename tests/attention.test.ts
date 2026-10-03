import { describe, expect, test } from 'claude-code/testing'

import { ALERT_AFTER_MS, TOAST_AFTER_MS, isDarkTheme, ladderActions, notifyCommands, soundCommands } from '../src/engine/attention'
import { DEFAULT_SETTINGS } from '../src/engine/settings'

const withAttention = (sound: boolean, notify: boolean) => ({ ...DEFAULT_SETTINGS, attention: { sound, notify } })

describe('attention ladder', () => {
  test('a toast after 30 seconds, once', async () => {
    const state = { toasted: false, alerted: false }
    expect(ladderActions(TOAST_AFTER_MS - 1, DEFAULT_SETTINGS, state)).toEqual([])
    expect(ladderActions(TOAST_AFTER_MS, DEFAULT_SETTINGS, state)).toEqual(['toast'])
    expect(ladderActions(TOAST_AFTER_MS + 5_000, DEFAULT_SETTINGS, { toasted: true, alerted: false })).toEqual([])
  })

  test('sound and a desktop notification after two minutes, only when turned on', async () => {
    const state = { toasted: true, alerted: false }
    expect(ladderActions(ALERT_AFTER_MS, DEFAULT_SETTINGS, state)).toEqual([])
    expect(ladderActions(ALERT_AFTER_MS, withAttention(true, true), state)).toEqual(['sound', 'notify'])
    expect(ladderActions(ALERT_AFTER_MS, withAttention(false, true), { toasted: true, alerted: true })).toEqual([])
  })

  test('the ladder is silent when the ingredient is off', async () => {
    const off = { ...DEFAULT_SETTINGS, ingredients: { ...DEFAULT_SETTINGS.ingredients, attention: false } }
    expect(ladderActions(ALERT_AFTER_MS * 2, off, { toasted: false, alerted: false })).toEqual([])
  })

  test('notifications and sounds use fixed system programs, with safe text', async () => {
    const cmds = notifyCommands('Claude needs you', 'Approve "rm" \\ now\x07')
    expect(cmds[0]).toEqual(['notify-send', '--app-name=Claudinator', 'Claude needs you', 'Approve "rm" \\ now'])
    expect(cmds[1]?.[0]).toBe('osascript')
    expect(cmds[1]?.[2]).not.toContain('"rm"')
    expect(soundCommands().map(c => c[0])).toEqual(['pw-play', 'paplay', 'afplay'])
  })

  test('light themes are told apart from dark ones', async () => {
    expect(isDarkTheme('custom:claudinator:hairline-light')).toBe(false)
    expect(isDarkTheme('light-daltonized')).toBe(false)
    expect(isDarkTheme('dark')).toBe(true)
    expect(isDarkTheme(undefined)).toBe(true)
  })
})
