import { describe, expect, test } from 'claude-code/testing'

import { INGREDIENT_HOTKEYS, INGREDIENT_IDS, LOOK_IDS, layerOf, resolveSettings } from '../src/engine/settings'

describe('settings for every look', () => {
  test('seven looks and Off, in picker order', async () => {
    expect(LOOK_IDS).toEqual(['hairline', 'broadsheet', 'mission', 'prism', 'sumi', 'blueprint', 'thermal', 'off'])
  })

  test('nine ingredients, each with its own hotkey', async () => {
    expect(INGREDIENT_IDS).toHaveLength(9)
    expect(new Set(INGREDIENT_IDS.map(id => INGREDIENT_HOTKEYS[id])).size).toBe(9)
  })

  test('each look brings its own default ingredients', async () => {
    expect(resolveSettings([{ look: 'broadsheet' }]).ingredients).toMatchObject({ headlines: true, footnotes: true })
    expect(resolveSettings([{ look: 'mission' }]).ingredients.timeStrip).toBe(true)
    expect(resolveSettings([{ look: 'prism' }]).ingredients.fileColors).toBe(true)
    expect(resolveSettings([{ look: 'hairline' }]).ingredients).toMatchObject({ recency: true, miniDiffs: true, headlines: false })
  })

  test("the user's own ingredient choices beat a look's defaults", async () => {
    expect(resolveSettings([{ look: 'broadsheet' }, layerOf({ ingredients: { footnotes: false } })]).ingredients.footnotes).toBe(false)
  })

  test('the attention ladder is on by default, sound and notifications off', async () => {
    const s = resolveSettings([])
    expect(s.ingredients.attention).toBe(true)
    expect(s.attention).toEqual({ sound: false, notify: false })
    expect(resolveSettings([{ attention: { sound: true } }]).attention).toEqual({ sound: true, notify: false })
  })
})
