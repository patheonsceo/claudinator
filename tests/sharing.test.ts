import { describe, expect, test } from 'claude-code/testing'

import { COMBOS, comboById } from '../src/engine/combos'
import { resolveSettings } from '../src/engine/settings'
import { decodeShareCode, encodeShareCode } from '../src/engine/share-code'

describe('combos and share codes', () => {
  test('five combos, each a full setup', async () => {
    expect(COMBOS.map(c => c.id)).toEqual(['daily', 'storyteller', 'showoff', 'doof', 'zen'])
    const doof = resolveSettings([comboById('doof')!.layer])
    expect(doof.look).toBe('blueprint')
    expect(doof.ingredients.inator).toBe(true)
    expect(doof.ingredients.quiet).toBe(false)
  })

  test('a share code round-trips a look and its ingredients', async () => {
    const s = resolveSettings([comboById('storyteller')!.layer])
    const code = encodeShareCode(s)
    expect(code).toMatch(/^BS-[0-9A-Z]{3}$/)
    const back = decodeShareCode(code)
    expect(back.ok && resolveSettings([back.layer])).toEqual(s)
  })

  test('codes are case-insensitive and reject typos', async () => {
    const code = encodeShareCode(resolveSettings([]))
    expect(decodeShareCode(code.toLowerCase()).ok).toBe(true)
    const broken = code.slice(0, -1) + (code.endsWith('0') ? '1' : '0')
    expect(decodeShareCode(broken)).toEqual({ ok: false, reason: 'That code has a typo: its check character does not match.' })
    expect(decodeShareCode('ZZ-000').ok).toBe(false)
    expect(decodeShareCode('nonsense').ok).toBe(false)
  })
})
