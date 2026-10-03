import { describe, expect, test } from 'claude-code/testing'

import { DEFAULT_SETTINGS } from '../src/engine/settings'
import { pickerView } from '../src/panes/picker'
import { TERMINAL_ELS, textOf } from './fixtures'

const info = { isFullscreen: true, hasProjectFile: false }
const noop = { setLook: () => {}, toggle: () => {} }

function find(tree: unknown, key: string): Record<string, unknown> | undefined {
  if (tree === null || typeof tree !== 'object') return undefined
  const t = tree as { props?: Record<string, unknown>; children?: unknown[] }
  if (t.props?.key === key) return t.props
  for (const child of t.children ?? []) {
    const hit = find(child, key)
    if (hit) return hit
  }
  return undefined
}

describe('picker', () => {
  test('lists every look and ingredient with its state', async () => {
    const text = textOf(pickerView(TERMINAL_ELS, DEFAULT_SETTINGS, info, noop))
    expect(text).toContain('Hairline')
    expect(text).toContain('Off')
    expect(text).toContain('Recency fade · on')
    expect(text).toContain('File colors · off')
  })

  test('buttons call back with what they change', async () => {
    const calls: string[] = []
    const tree = pickerView(TERMINAL_ELS, DEFAULT_SETTINGS, info, { setLook: id => calls.push(`look:${id}`), toggle: id => calls.push(`toggle:${id}`) })
    const off = find(tree, 'look-off')
    const quiet = find(tree, 'ingredient-quiet')
    ;(off?.onPress as () => void)()
    ;(quiet?.onPress as () => void)()
    expect(calls).toEqual(['look:off', 'toggle:quiet'])
    expect(off?.hotkey).toBe('8')
    expect(quiet?.hotkey).toBe('q')
  })

  test('the footer explains the classic layout', async () => {
    expect(textOf(pickerView(TERMINAL_ELS, DEFAULT_SETTINGS, { ...info, isFullscreen: false }, noop))).toContain('CLAUDE_CODE_NO_FLICKER=1')
  })

  test('the footer mentions a project file when one sets defaults', async () => {
    expect(textOf(pickerView(TERMINAL_ELS, DEFAULT_SETTINGS, { ...info, hasProjectFile: true }, noop))).toContain('.claude/claudinator.json')
    expect(textOf(pickerView(TERMINAL_ELS, DEFAULT_SETTINGS, info, noop))).not.toContain('.claude/claudinator.json')
  })
})
