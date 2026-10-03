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
    const body = '-u critical " & do shell script "rm -rf ~" & "\x07'
    const cmds = notifyCommands('Claude needs you', body)
    expect(cmds[0], 'options end before the text').toEqual(['notify-send', '--app-name=Claudinator', '--', 'Claude needs you', '-u critical " &amp; do shell script "rm -rf ~" &amp; "'])
    const osa = cmds[1] ?? []
    expect(osa[0]).toBe('osascript')
    const script = osa.filter((_, i) => osa[i - 1] === '-e').join('\n')
    expect(script, 'the script never contains the text').not.toContain('rm -rf')
    expect(osa.slice(-2), 'the text arrives as plain arguments').toEqual(['Claude needs you', '-u critical " & do shell script "rm -rf ~" & "'])
    expect(soundCommands().map(c => c[0])).toEqual(['pw-play', 'paplay', 'afplay'])
  })

  test('notification servers that read markup see the text as plain text', async () => {
    const [send] = notifyCommands('Claude <needs> you', 'Run a && b <i>now</i>')
    // The notification spec reads markup in the body only.
    expect(send?.slice(-2)).toEqual(['Claude <needs> you', 'Run a &amp;&amp; b &lt;i&gt;now&lt;/i&gt;'])
  })

  test('light themes are told apart from dark ones', async () => {
    expect(isDarkTheme('custom:claudinator:hairline-light')).toBe(false)
    expect(isDarkTheme('light-daltonized')).toBe(false)
    expect(isDarkTheme('dark')).toBe(true)
    expect(isDarkTheme(undefined)).toBe(true)
  })
})
