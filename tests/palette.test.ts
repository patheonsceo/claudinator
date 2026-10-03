import { describe, expect, test } from 'claude-code/testing'

import { FILE_COLORS, fadeOf, fileColor, tone } from '../src/engine/palette'
import { encodeCells, toBase64 } from '../src/engine/raster'

describe('palette', () => {
  test('a file keeps one color', async () => {
    expect(fileColor('src/auth/session.ts')).toBe(fileColor('src/auth/session.ts'))
    expect(FILE_COLORS).toContain(fileColor('anything.md'))
  })

  test('fades follow how many turns ago a row belongs to', async () => {
    expect(fadeOf(7, 7, true)).toBe(0)
    expect(fadeOf(6, 7, true)).toBe(1)
    expect(fadeOf(2, 7, true)).toBe(2)
    expect(fadeOf(2, 7, false)).toBe(0)
    expect(fadeOf(undefined, 7, true), 'rows from before Claudinator saw them count as old').toBe(2)
    expect(fadeOf(undefined, 0, true), 'nothing is old before the first turn').toBe(0)
  })

  test('tone swaps a color for the dimmer theme tokens as rows age', async () => {
    expect(tone('suggestion', 0)).toBe('suggestion')
    expect(tone('suggestion', 1)).toBe('inactive')
    expect(tone('#ff0000', 2)).toBe('subtle')
  })

  test('base64 matches the standard encoding', async () => {
    expect(toBase64(new Uint8Array([77, 97, 110]))).toBe('TWFu')
    expect(toBase64(new Uint8Array([77, 97]))).toBe('TWE=')
    expect(toBase64(new Uint8Array([77]))).toBe('TQ==')
  })

  test('cells pack as code point, foreground, background', async () => {
    const packed = encodeCells([{ char: 'A', fg: 0xff0000 }])
    expect(packed).toBe(toBase64(new Uint8Array(Uint32Array.from([65, 0xff0000, 0x01000000]).buffer)))
    expect(encodeCells([{ char: '😀', fg: 0 }]), 'astral characters become ?').toBe(encodeCells([{ char: '?', fg: 0 }]))
  })
})
