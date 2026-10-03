import { describe, expect, test } from 'claude-code/testing'

import { HAIRLINE } from '../src/looks/hairline'
import { navigatorView } from '../src/panes/navigator'
import { TERMINAL_ELS, textOf } from './fixtures'

const data = {
  tab: 'chapters' as const,
  cwd: '/work',
  turns: [
    { turn: 1, prompt: 'fix the cart', title: 'Fixed the cart', userRowId: 'u1', startedAt: 0, durationMs: 12_000, add: 2, del: 1, files: 1 },
    { turn: 2, prompt: 'add a test', startedAt: 20_000, add: 0, del: 0, files: 0 },
  ],
  ledger: [{ file: '/work/src/cart.js', add: 3, del: 1, turns: [1, 2], lastToolId: 't9' }],
  pins: [{ text: 'Use BroadcastChannel, not a service worker', turn: 1 }],
}

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

describe('navigator pane', () => {
  const noop = { setTab: () => {}, jumpToTurn: () => {}, jumpToTool: () => {}, unpin: () => {} }

  test('Chapters lists each turn by title, with its changes and time', async () => {
    const text = textOf(navigatorView(TERMINAL_ELS, HAIRLINE.paneStyle, data, noop))
    expect(text).toContain('Fixed the cart')
    expect(text).toContain('+2')
    expect(text).toContain('12s')
    expect(text, 'a running turn shows its prompt').toContain('Add a test')
  })

  test('pressing a chapter jumps to its prompt', async () => {
    const jumps: number[] = []
    const tree = navigatorView(TERMINAL_ELS, HAIRLINE.paneStyle, data, { ...noop, jumpToTurn: n => jumps.push(n) })
    ;(find(tree, 'chapter-1')?.onPress as () => void)()
    expect(jumps).toEqual([1])
  })

  test('Ledger lists every changed file and jumps to its last edit', async () => {
    const tools: string[] = []
    const tree = navigatorView(TERMINAL_ELS, HAIRLINE.paneStyle, { ...data, tab: 'ledger' }, { ...noop, jumpToTool: id => tools.push(id) })
    expect(textOf(tree)).toContain('src/cart.js')
    expect(textOf(tree)).toContain('turns 1, 2')
    ;(find(tree, 'file-0')?.onPress as () => void)()
    expect(tools).toEqual(['t9'])
  })

  test('Pins list notes and remove them', async () => {
    const removed: number[] = []
    const tree = navigatorView(TERMINAL_ELS, HAIRLINE.paneStyle, { ...data, tab: 'pins' }, { ...noop, unpin: i => removed.push(i) })
    expect(textOf(tree)).toContain('BroadcastChannel')
    ;(find(tree, 'unpin-0')?.onPress as () => void)()
    expect(removed).toEqual([0])
  })

  test('empty tabs say how to fill them', async () => {
    const empty = { ...data, turns: [], ledger: [], pins: [] }
    expect(textOf(navigatorView(TERMINAL_ELS, HAIRLINE.paneStyle, empty, noop))).toContain('No turns yet')
    expect(textOf(navigatorView(TERMINAL_ELS, HAIRLINE.paneStyle, { ...empty, tab: 'pins' }, noop))).toContain('/pin')
  })
})
