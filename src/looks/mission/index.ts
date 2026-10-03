import type { Look } from '../look'
import { band } from './band'
import { live, liveFrames } from './live'
import { quietLine, toolGroup, toolResult, toolRow } from './rows'
import { headline, receipt, userMessage } from './turn'

/** Mission Control: a precision instrument, a flight recorder where every line is a reading. */
export const MISSION: Look = {
  toolRow,
  toolGroup,
  quietLine,
  toolResult,
  userMessage,
  headline,
  receipt,
  live,
  liveFrames,
  band,
  paneStyle: { accent: 'warning', marker: '▪', current: '▶' },
}
