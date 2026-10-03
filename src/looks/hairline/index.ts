import type { Look } from '../look'
import { live, liveFrames } from './live'
import { quietLine, toolGroup, toolResult, toolRow } from './rows'
import { headline, receipt, userMessage } from './turn'

export const HAIRLINE: Look = {
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
  paneStyle: { accent: 'suggestion', marker: '◇', current: '›' },
}
