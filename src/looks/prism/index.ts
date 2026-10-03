import type { Look } from '../look'
import { live, liveFrames } from './live'
import { quietLine, toolGroup, toolResult, toolRow } from './rows'
import { headline, receipt, userMessage } from './turn'

/** Premium color: every file keeps its own hue, and color always means something. */
export const PRISM: Look = {
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
  paneStyle: { accent: 'suggestion', marker: '●', current: '✦' },
}
