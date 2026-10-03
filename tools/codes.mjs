// Share codes that pin each demo recording to an exact setup, so recordings never
// depend on what an earlier session saved. tests/tape-codes.test.ts keeps them in step.

/** Each look with its own default ingredients. */
export const DEFAULT_CODES = {
  hairline: 'HL-43H',
  broadsheet: 'BS-5G0',
  mission: 'MC-61Q',
  prism: 'PR-460',
  sumi: 'SU-419',
  blueprint: 'BP-4J0',
}

/** Each look with every visual ingredient on (Mini diffs, File colors, Headlines, Time strip) and Recency fade off. */
export const SHOWCASE_CODES = {
  hairline: 'HL-6P0',
  broadsheet: 'BS-6PF',
  mission: 'MC-6PA',
  prism: 'PR-6PT',
  sumi: 'SU-6P6',
  blueprint: 'BP-6P6',
}
