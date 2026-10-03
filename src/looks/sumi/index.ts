import type { Look } from '../look'
import { live, liveFrames } from './live'
import { quietLine, toolGroup, toolResult, toolRow } from './rows'
import { headline, receipt, userMessage } from './turn'

/** Ink and negative space: reads leave a dot, only changes get the indigo seal. */
export const SUMI: Look = {
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
  paneStyle: { accent: 'suggestion', marker: '·', current: '■' },
}
