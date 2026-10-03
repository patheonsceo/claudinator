import { INGREDIENT_IDS, LOOK_IDS, setupLayer } from './settings'
import type { IngredientId, LookId, Settings, SettingsLayer } from './settings'

// A share code is `<look>-<ingredients><check>`, such as `HL-43H`: two letters
// for the look, two base-32 digits for the nine ingredient bits, and a check
// character that catches typos. Codes ignore case.
const LOOK_CODES: Record<LookId, string> = {
  hairline: 'HL',
  broadsheet: 'BS',
  mission: 'MC',
  prism: 'PR',
  sumi: 'SU',
  blueprint: 'BP',
  off: 'OF',
}
const DIGITS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

// Each character's value times an odd weight, so any single wrong character
// changes the sum, and different weights catch most swapped neighbors.
const WEIGHTS = [1, 3, 5, 7]

function checkOf(lookCode: string, digits: string): string {
  const values = [...lookCode].map(c => c.charCodeAt(0) - 65).concat([...digits].map(d => DIGITS.indexOf(d)))
  const sum = values.reduce((acc, v, i) => acc + v * (WEIGHTS[i] ?? 1), 0)
  return DIGITS[sum % DIGITS.length] ?? '0'
}

export function encodeShareCode(s: Settings): string {
  let bits = 0
  INGREDIENT_IDS.forEach((id, i) => {
    if (s.ingredients[id]) bits |= 1 << i
  })
  const digits = `${DIGITS[(bits >> 5) & 31]}${DIGITS[bits & 31]}`
  return `${LOOK_CODES[s.look]}-${digits}${checkOf(LOOK_CODES[s.look], digits)}`
}

export type Decoded = { ok: true; layer: SettingsLayer } | { ok: false; reason: string }

export function decodeShareCode(raw: string): Decoded {
  const code = raw.trim().toUpperCase()
  const match = code.match(/^([A-Z]{2})-([0-9A-Z]{2})([0-9A-Z])$/)
  if (!match) return { ok: false, reason: 'That is not a Claudinator code. Codes look like HL-43H.' }
  const [, lookCode, digits, check] = match as unknown as [string, string, string, string]
  const look = (Object.keys(LOOK_CODES) as LookId[]).find(id => LOOK_CODES[id] === lookCode)
  if (!look || !LOOK_IDS.includes(look)) return { ok: false, reason: `No look has the code ${lookCode}.` }
  if (checkOf(lookCode, digits) !== check) return { ok: false, reason: 'That code has a typo: its check character does not match.' }
  const hi = DIGITS.indexOf(digits[0] ?? '')
  const lo = DIGITS.indexOf(digits[1] ?? '')
  if (hi < 0 || lo < 0) return { ok: false, reason: 'That code has a character Claudinator does not use.' }
  const bits = (hi << 5) | lo
  const ingredients = Object.fromEntries(INGREDIENT_IDS.map((id, i) => [id, (bits & (1 << i)) !== 0])) as Record<IngredientId, boolean>
  return { ok: true, layer: setupLayer(look, ingredients) }
}
