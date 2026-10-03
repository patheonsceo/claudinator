import { describe, expect, test } from 'claude-code/testing'

import { resolveSettings } from '../src/engine/settings'
import type { LookId } from '../src/engine/settings'
import { encodeShareCode } from '../src/engine/share-code'
import { DEFAULT_CODES, RECEIPT, SHOWCASE_CODES } from '../tools/codes.mjs'
import { LOOKS } from '../src/looks'
import { ctxOf, textOf } from './fixtures'

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

describe('demo tapes wait for what each look really draws', () => {
  test('each look’s receipt matches the pattern its recording waits for', async () => {
    for (const [look, pattern] of Object.entries(RECEIPT)) {
      const drawn = LOOKS[look as LookId]?.receipt({ durationMs: 9_000, stats: { turn: 1, files: ['/work/a.ts'], add: 1, del: 1, contextPercent: 20 }, notes: [], timeStrip: null, title: 'Fixed' }, ctxOf({ settings: resolveSettings([{ look: look as LookId }]) }))
      // The screen puts column gaps where the tree has none, so spaces are ignored.
      expect(textOf(drawn).replace(/ /g, ''), look).toMatch(new RegExp(pattern(1).replace(/ /g, '')))
    }
  })
})
