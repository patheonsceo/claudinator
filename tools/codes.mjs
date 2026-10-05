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

/** What each look's receipt shows for turn n: the recording waits for it before going on. tests/tape-codes.test.ts checks it. */
export const RECEIPT = {
  hairline: n => `Turn ${n}`,
  broadsheet: () => 'set in',
  mission: n => `T0${n}`,
  prism: n => `turn ${n}`,
  sumi: () => '■ ───',
  blueprint: n => `DWG T-0${n}`,
}

/**
 * What recorded sessions may do without asking: edit files in the throwaway project, keep a task
 * list, and run the fixture's tests or look around. Anything else stops at a permission prompt.
 */
export const ALLOWED_TOOLS = 'Read,Edit,Write,Glob,Grep,TaskCreate,TaskUpdate,TaskList,TaskGet,TodoWrite,ToolSearch,Bash(node --test:*),Bash(find:*),Bash(ls:*),Bash(cat:*)'
