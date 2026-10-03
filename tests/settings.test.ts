import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_SETTINGS, changedIngredient, changedLook, choiceOf, layerOf, optionsLayer, projectLayerOf, resolveSettings, toggled, withLook } from '../src/engine/settings'

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

  test('a project file cannot hide rows: it may not turn on Quiet', async () => {
    expect(projectLayerOf({ look: 'off', ingredients: { quiet: true, fileColors: true } })).toEqual({ look: 'off', ingredients: { fileColors: true } })
    expect(projectLayerOf({ ingredients: { quiet: true } })).toEqual({})
  })

  test('a change touches only the field the user changed', async () => {
    expect(changedLook({ ingredients: { quiet: true } }, 'off')).toEqual({ look: 'off', ingredients: { quiet: true } })
    expect(changedIngredient({ look: 'off' }, 'recency', false)).toEqual({ look: 'off', ingredients: { recency: false } })
  })

  test('the picker helpers return new settings', async () => {
    const off = withLook(DEFAULT_SETTINGS, 'off')
    expect(off.look).toBe('off')
    expect(DEFAULT_SETTINGS.look, 'the input is untouched').toBe('hairline')
    expect(toggled(DEFAULT_SETTINGS, 'quiet').ingredients.quiet).toBe(true)
    expect(choiceOf(off)).toEqual({ look: 'off', ingredients: DEFAULT_SETTINGS.ingredients })
  })
})
