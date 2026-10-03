// Share codes that pin each demo recording to an exact setup, so recordings never
// depend on what an earlier session saved. tests/tape-codes.test.ts keeps them in step.

/** Each look with its own default ingredients. */
export const DEFAULT_CODES = {
  hairline: 'HL-438',
  broadsheet: 'BS-5GE',
  mission: 'MC-61J',
  prism: 'PR-46D',
  sumi: 'SU-418',
  blueprint: 'BP-4JN',
}

/** Each look with every visual ingredient on (Mini diffs, File colors, Headlines, Time strip) and Recency fade off. */
export const SHOWCASE_CODES = {
  hairline: 'HL-6P3',
  broadsheet: 'BS-6PP',
  mission: 'MC-6PH',
  prism: 'PR-6P5',
  sumi: 'SU-6P5',
  blueprint: 'BP-6PS',
}
