import { describe, expect, test } from 'claude-code/testing'

import { resolveSettings } from '../src/engine/settings'
import type { LookId } from '../src/engine/settings'
import { encodeShareCode } from '../src/engine/share-code'
import { DEFAULT_CODES, SHOWCASE_CODES } from '../tools/codes.mjs'

describe('demo share codes', () => {
  test('each default code is that look with its own defaults', async () => {
    for (const [look, code] of Object.entries(DEFAULT_CODES)) {
      expect(code, look).toBe(encodeShareCode(resolveSettings([{ look: look as LookId }])))
    }
  })

  test('each showcase code turns on every visual ingredient', async () => {
    const ingredients = { miniDiffs: true, fileColors: true, headlines: true, timeStrip: true, attention: true, recency: false, footnotes: false, quiet: false, inator: false }
    for (const [look, code] of Object.entries(SHOWCASE_CODES)) {
      expect(code, look).toBe(encodeShareCode(resolveSettings([{ look: look as LookId, ingredients }])))
    }
  })
})
