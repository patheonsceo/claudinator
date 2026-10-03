import type { RenderInput } from 'claude-code'

const VIEWPORT = { columns: 120, rows: 40, isFullscreen: true }

export function toolUseInput(tool: string, input: unknown, over: Record<string, unknown> = {}, surface: 'terminal' | 'desktop' = 'terminal'): RenderInput<'ToolUse'> {
  const id = typeof over.tool_use_id === 'string' ? over.tool_use_id : 'toolu_1'
  return {
    component: 'ToolUse',
    surface,
    requestId: id,
    viewport: VIEWPORT,
    props: { tool_use_id: id, tool, input, isRunning: false, isErrored: false, isInterrupted: false, ...over },
  } as RenderInput<'ToolUse'>
}

export function toolGroupInput(calls: Array<{ tool: string; input: unknown }>): RenderInput<'ToolGroup'> {
  return {
    component: 'ToolGroup',
    surface: 'terminal',
    requestId: 'collapsed-1',
    viewport: VIEWPORT,
    props: {
      calls: calls.map((c, i) => ({ tool_use_id: `toolu_g${i}`, tool: c.tool, input: c.input, isRunning: false, isErrored: false, isInterrupted: false })),
      isActive: false,
      isExpanded: false,
    },
  } as RenderInput<'ToolGroup'>
}

export function userMessageInput(text: string, isExpanded = false): RenderInput<'UserMessage'> {
  return {
    component: 'UserMessage',
    surface: 'terminal',
    requestId: 'msg_u1',
    viewport: VIEWPORT,
    props: { text, origin: { kind: 'composer' }, isExpanded },
  } as RenderInput<'UserMessage'>
}

export function turnDurationInput(durationMs: number): RenderInput<'TurnDuration'> {
  return { component: 'TurnDuration', surface: 'terminal', requestId: 'msg_t1', viewport: VIEWPORT, props: { word: 'Worked', durationMs } } as RenderInput<'TurnDuration'>
}

export function spinnerInput(mode: string, surface: 'terminal' | 'desktop' = 'terminal'): RenderInput<'Spinner'> {
  return { component: 'Spinner', surface, requestId: 'main', viewport: VIEWPORT, props: { word: 'Baking', message: null, suffix: '…', mode } } as RenderInput<'Spinner'>
}

export const PICKER_PROPS = { title: 'Claudinator', isFocused: true, bodyColumns: 60, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 30 }, view: {} }
