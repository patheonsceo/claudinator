import type { Look } from '../look'
import { live, liveFrames } from './live'
import { quietLine, toolGroup, toolResult, toolRow } from './rows'
import { headline, receipt, userMessage } from './turn'

/** The session as a well-edited story: italic narration, pull quotes, chapter heads and a colophon. */
export const BROADSHEET: Look = {
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
  paneStyle: { accent: 'suggestion', marker: '❧', current: '›' },
}
