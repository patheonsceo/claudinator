import type { Look } from '../look'
import { live, liveFrames } from './live'
import { quietLine, toolGroup, toolResult, toolRow } from './rows'
import { receipt, userMessage } from './turn'

export const HAIRLINE: Look = { toolRow, toolGroup, quietLine, toolResult, userMessage, receipt, live, liveFrames }
