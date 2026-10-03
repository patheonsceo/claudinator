import type { RenderElement } from 'claude-code'

import { formatDuration, printable, splitPath } from '../engine/format'
import type { LedgerEntry, TurnRecord } from '../engine/session-model'
import type { Els, PaneStyle } from '../looks/look'

export const NAVIGATOR_PANE = 'claudinator-navigator'

export type NavigatorTab = 'chapters' | 'ledger' | 'pins'
export type Pin = { text: string; turn?: number }

/** `columns` is the pane body's width, for the tab underline. */
export type NavigatorData = { tab: NavigatorTab; cwd: string; turns: TurnRecord[]; ledger: LedgerEntry[]; pins: Pin[]; columns?: number }

export type NavigatorActions = {
  setTab: (tab: NavigatorTab) => void
  jumpToTurn: (turn: number) => void
  jumpToTool: (toolId: string) => void
  unpin: (index: number) => void
}

const TABS: Array<[NavigatorTab, string, string]> = [
  ['chapters', 'Chapters', 'c'],
  ['ledger', 'Ledger', 'l'],
  ['pins', 'Pins', 'p'],
]

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Chapters, Ledger and Pins, as the lookbook draws them: tabs over an accent
 * underline, two-line entries (what it is, then its numbers), and a faint
 * hint line closing each tab.
 */
export function navigatorView(els: Els, style: PaneStyle, data: NavigatorData, actions: NavigatorActions): RenderElement {
  const { Box, Button, Text } = els
  const columns = Math.max(24, data.columns ?? 44)
  const tabs = Box({
    flexDirection: 'row',
    columnGap: 3,
    children: TABS.map(([id, label, hotkey]) =>
      Button({ key: `tab-${id}`, label, hotkey, plain: true, dimColor: data.tab !== id, onPress: () => actions.setTab(id) }),
    ),
  })
  // Under the open tab a heavy accent line, a hairline under the rest. Each tab is "k: Label" plus a 3-cell gap.
  const rule: RenderElement[] = []
  TABS.forEach(([id, label], i) => {
    if (i > 0) rule.push(Text({ color: 'subtle', children: '───' }))
    const width = label.length + 3
    rule.push(Text({ color: data.tab === id ? style.accent : 'subtle', children: (data.tab === id ? '━' : '─').repeat(width) }))
  })
  rule.push(Text({ color: 'subtle', children: '─'.repeat(columns) }))
  const tabRule = Box({ key: 'tab-rule', height: 1, overflow: 'hidden', children: [Text({ children: rule })] })

  const hint = (text: string): RenderElement => Text({ color: 'subtle', children: text })
  const note = (text: string): RenderElement => Text({ color: 'inactive', children: text })
  const delta = (add: number, del: number): RenderElement[] => [
    ...(add > 0 ? [Text({ color: 'success', children: `+${add}` })] : []),
    ...(del > 0 ? [Text({ color: 'error', children: `−${del}` })] : []),
  ]
  /** The second line of an entry: its numbers on the left, a faint figure at the right. */
  const facts = (left: RenderElement[], right: string): RenderElement =>
    Box({
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingLeft: 5,
      children: [Box({ flexDirection: 'row', columnGap: 1, children: left }), Text({ color: 'inactive', children: right })],
    })
  let body: RenderElement[]

  if (data.tab === 'chapters') {
    body =
      data.turns.length === 0
        ? [note('No turns yet. Each prompt you send becomes a chapter.')]
        : data.turns.map((t, i) => {
            const isLast = i === data.turns.length - 1
            const title = printable(t.title ?? capitalized(t.prompt) ?? '', 80) || `Turn ${t.turn}`
            const isRunning = t.durationMs === undefined
            const left = isRunning ? [note('running')] : t.add + t.del > 0 ? delta(t.add, t.del) : [note('answer only')]
            return Box({
              key: `entry-chapter-${t.turn}`,
              flexDirection: 'column',
              children: [
                Box({
                  flexDirection: 'row',
                  columnGap: 1,
                  children: [
                    Text({ bold: isLast, color: isLast ? style.accent : 'inactive', children: `${isLast ? style.current : ' '} ${String(t.turn).padStart(2)}` }),
                    Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, height: 1, overflow: 'hidden', children: Button({ key: `chapter-${t.turn}`, label: title, plain: true, dimColor: !isLast, onPress: () => actions.jumpToTurn(t.turn) }) }),
                  ],
                }),
                facts(left, isRunning ? '' : formatDuration(t.durationMs ?? 0)),
              ],
            })
          })
    if (data.turns.length > 0) body.push(hint('↑↓ move · ⏎ jump to the prompt'))
  } else if (data.tab === 'ledger') {
    body =
      data.ledger.length === 0
        ? [note('No files changed yet.')]
        : data.ledger.map((f, i) => {
            const { dir, base } = splitPath(f.file, data.cwd)
            return Box({
              key: `entry-file-${i}`,
              flexDirection: 'column',
              children: [
                Box({
                  flexDirection: 'row',
                  columnGap: 1,
                  children: [
                    Text({ color: style.accent, children: ` ${style.marker} ` }),
                    Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, height: 1, overflow: 'hidden', children: Button({ key: `file-${i}`, label: printable(dir + base, 120), plain: true, onPress: () => actions.jumpToTool(f.lastToolId) }) }),
                  ],
                }),
                facts(delta(f.add, f.del), `turns ${f.turns.join(', ')}`),
              ],
            })
          })
    if (data.ledger.length > 0) body.push(hint('↑↓ move · ⏎ jump to the last edit'))
  } else {
    body =
      data.pins.length === 0
        ? [note('No pins yet. Type /pin and a note, or /pin alone to pin the last turn.')]
        : data.pins.map((p, i) =>
            Box({
              key: `entry-pin-${i}`,
              flexDirection: 'column',
              children: [
                Box({
                  flexDirection: 'row',
                  columnGap: 1,
                  children: [
                    Text({ color: style.accent, children: ` ${style.marker} ` }),
                    Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, children: Text({ wrap: 'wrap', children: printable(p.text, 300) }) }),
                  ],
                }),
                Box({
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingLeft: 5,
                  children: [note(p.turn === undefined ? 'pinned' : `pinned at turn ${p.turn}`), Button({ key: `unpin-${i}`, label: 'remove', plain: true, dimColor: true, onPress: () => actions.unpin(i) })],
                }),
              ],
            }),
          )
    if (data.pins.length > 0) body.push(hint('/pin a note to add one'))
  }

  return Box({
    flexDirection: 'column',
    paddingX: 1,
    children: [tabs, tabRule, Box({ flexDirection: 'column', rowGap: 1, paddingTop: 1, children: body })],
  })
}
