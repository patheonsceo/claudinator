import type { LookId } from '../engine/settings'
import { HAIRLINE } from './hairline'
import type { Look } from './look'

/** Every look by id; null means Claudinator draws nothing and Claude Code draws its own. */
export const LOOKS: Record<LookId, Look | null> = {
  hairline: HAIRLINE,
  // Wired in as each look lands; until then a look id draws nothing, like Off.
  broadsheet: null,
  mission: null,
  prism: null,
  sumi: null,
  blueprint: null,
  thermal: null,
  off: null,
}
