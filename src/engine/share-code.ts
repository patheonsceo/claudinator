import { INGREDIENT_IDS, LOOK_IDS, setupLayer } from './settings'
import type { IngredientId, LookId, Settings, SettingsLayer } from './settings'

// A share code is `<look>-<ingredients><check>`, such as `HL-1F3`: two letters
// for the look, two base-32 digits for the nine ingredient bits, and a check
// character that catches typos. Codes ignore case.
const LOOK_CODES: Record<LookId, string> = {
  hairline: 'HL',
  broadsheet: 'BS',
  mission: 'MC',
  prism: 'PR',
  sumi: 'SU',
  blueprint: 'BP',
  thermal: 'TH',
  off: 'OF',
}
const DIGITS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function checkOf(text: string): string {
  let sum = 0
  for (let i = 0; i < text.length; i++) sum = (sum * 31 + text.charCodeAt(i)) % DIGITS.length
  return DIGITS[sum] ?? '0'
}

export function encodeShareCode(s: Settings): string {
  let bits = 0
  INGREDIENT_IDS.forEach((id, i) => {
    if (s.ingredients[id]) bits |= 1 << i
  })
  const body = `${LOOK_CODES[s.look]}-${DIGITS[(bits >> 5) & 31]}${DIGITS[bits & 31]}`
  return body + checkOf(body)
}

export type Decoded = { ok: true; layer: SettingsLayer } | { ok: false; reason: string }

export function decodeShareCode(raw: string): Decoded {
  const code = raw.trim().toUpperCase()
  const match = code.match(/^([A-Z]{2})-([0-9A-Z]{2})([0-9A-Z])$/)
  if (!match) return { ok: false, reason: 'That is not a Claudinator code. Codes look like HL-1F3.' }
  const [, lookCode, digits, check] = match as unknown as [string, string, string, string]
  const look = (Object.keys(LOOK_CODES) as LookId[]).find(id => LOOK_CODES[id] === lookCode)
  if (!look || !LOOK_IDS.includes(look)) return { ok: false, reason: `No look has the code ${lookCode}.` }
  if (checkOf(`${lookCode}-${digits}`) !== check) return { ok: false, reason: 'That code has a typo: its check character does not match.' }
  const hi = DIGITS.indexOf(digits[0] ?? '')
  const lo = DIGITS.indexOf(digits[1] ?? '')
  if (hi < 0 || lo < 0) return { ok: false, reason: 'That code has a character Claudinator does not use.' }
  const bits = (hi << 5) | lo
  const ingredients = Object.fromEntries(INGREDIENT_IDS.map((id, i) => [id, (bits & (1 << i)) !== 0])) as Record<IngredientId, boolean>
  return { ok: true, layer: setupLayer(look, ingredients) }
}
