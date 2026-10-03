import type { Look } from '../look'
import { live, liveFrames } from './live'
import { quietLine, toolGroup, toolResult, toolRow } from './rows'
import { headline, receipt, userMessage } from './turn'

/** Every turn prints like a shop's thermal receipt: capitals, dotted leaders, one ink. */
export const THERMAL: Look = {
  toolRow,
  toolGroup,
  quietLine,
  toolResult,
  userMessage,
  headline,
  receipt,
  live,
  liveFrames,
  band: () => null,
  paneStyle: { accent: 'text', marker: '*', current: '>' },
}
