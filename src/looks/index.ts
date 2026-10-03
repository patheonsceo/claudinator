import type { LookId } from '../engine/settings'
import { HAIRLINE } from './hairline'
import type { Look } from './look'

/** Every look by id; null means Claudinator draws nothing and Claude Code draws its own. */
export const LOOKS: Record<LookId, Look | null> = { hairline: HAIRLINE, off: null }
