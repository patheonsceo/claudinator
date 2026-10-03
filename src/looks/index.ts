import type { LookId } from '../engine/settings'
import { BLUEPRINT } from './blueprint'
import { BROADSHEET } from './broadsheet'
import { HAIRLINE } from './hairline'
import { MISSION } from './mission'
import { PRISM } from './prism'
import { SUMI } from './sumi'
import { THERMAL } from './thermal'
import type { Look } from './look'

/** Every look by id; null means Claudinator draws nothing and Claude Code draws its own. */
export const LOOKS: Record<LookId, Look | null> = {
  hairline: HAIRLINE,
  broadsheet: BROADSHEET,
  mission: MISSION,
  prism: PRISM,
  sumi: SUMI,
  blueprint: BLUEPRINT,
  thermal: THERMAL,
  off: null,
}
