import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_SETTINGS, choiceOf, layerOf, optionsLayer, resolveSettings, toggled, withLook } from '../src/engine/settings'

describe('settings', () => {
  test('defaults are Hairline with recency fade and mini diffs', async () => {
    expect(resolveSettings([])).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.look).toBe('hairline')
    expect(DEFAULT_SETTINGS.ingredients).toEqual({ recency: true, miniDiffs: true, fileColors: false, quiet: false })
  })

  test('later layers win, field by field', async () => {
    const options = optionsLayer({ look: 'off', recency: false })
    const saved = layerOf({ look: 'hairline', ingredients: { quiet: true } })
    const project = layerOf({ ingredients: { fileColors: true } })
    expect(resolveSettings([options, saved, project])).toEqual({
      version: 1,
      look: 'hairline',
      ingredients: { recency: false, miniDiffs: true, fileColors: true, quiet: true },
    })
  })

  test('garbage, unknown looks and wrong types are ignored', async () => {
    expect(layerOf('nonsense')).toEqual({})
    expect(layerOf(null)).toEqual({})
    expect(layerOf({ look: 'neon', ingredients: { recency: 'yes', quiet: true, extra: true } })).toEqual({ ingredients: { quiet: true } })
    expect(optionsLayer({ look: 42, miniDiffs: 'true' })).toEqual({})
  })

  test('the picker helpers return new settings', async () => {
    const off = withLook(DEFAULT_SETTINGS, 'off')
    expect(off.look).toBe('off')
    expect(DEFAULT_SETTINGS.look, 'the input is untouched').toBe('hairline')
    expect(toggled(DEFAULT_SETTINGS, 'quiet').ingredients.quiet).toBe(true)
    expect(choiceOf(off)).toEqual({ look: 'off', ingredients: DEFAULT_SETTINGS.ingredients })
  })
})
