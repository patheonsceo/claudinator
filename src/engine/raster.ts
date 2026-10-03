import { LIVE } from './palette'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Standard base64, written out because the module environment has no btoa. */
export function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += ALPHABET[(n >> 18) & 63]
    out += ALPHABET[(n >> 12) & 63]
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '='
    out += i + 2 < bytes.length ? ALPHABET[n & 63] : '='
  }
  return out
}

export type Cell = { char: string; fg: number; bg?: number }

/** One row of cells packed as the `cells` a Raster takes. */
export function encodeCells(cells: Cell[]): string {
  const words = new Uint32Array(cells.length * 3)
  cells.forEach((cell, i) => {
    const cp = cell.char.codePointAt(0) ?? 32
    words[i * 3] = cp > 0xffff ? 63 : cp
    words[i * 3 + 1] = cell.fg
    words[i * 3 + 2] = cell.bg ?? LIVE.DEFAULT
  })
  return toBase64(new Uint8Array(words.buffer))
}
