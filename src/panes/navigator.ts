import type { RenderElement } from 'claude-code'

import { formatDuration, printable, splitPath } from '../engine/format'
import type { LedgerEntry, TurnRecord } from '../engine/session-model'
import type { Els, PaneStyle } from '../looks/look'

export const NAVIGATOR_PANE = 'claudinator-navigator'

export type NavigatorTab = 'chapters' | 'ledger' | 'pins'
export type Pin = { text: string; turn?: number }

export type NavigatorData = { tab: NavigatorTab; cwd: string; turns: TurnRecord[]; ledger: LedgerEntry[]; pins: Pin[] }

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

export function navigatorView(els: Els, style: PaneStyle, data: NavigatorData, actions: NavigatorActions): RenderElement {
  const { Box, Button, Text } = els
  const tabs = Box({
    flexDirection: 'row',
    columnGap: 3,
    children: TABS.map(([id, label, hotkey]) =>
      Button({ key: `tab-${id}`, label, hotkey, plain: true, dimColor: data.tab !== id, onPress: () => actions.setTab(id) }),
    ),
  })
  const hint = (text: string): RenderElement => Text({ dimColor: true, children: text })
  let body: RenderElement[]

  if (data.tab === 'chapters') {
    body =
      data.turns.length === 0
        ? [hint('No turns yet. Each prompt you send becomes a chapter.')]
        : data.turns.map((t, i) => {
            const isLast = i === data.turns.length - 1
            const title = printable(t.title ?? capitalized(t.prompt) ?? '', 80) || `Turn ${t.turn}`
            const parts = [t.add > 0 ? `+${t.add}` : '', t.del > 0 ? `−${t.del}` : '', t.durationMs === undefined ? 'running' : formatDuration(t.durationMs)].filter(Boolean)
            return Box({
              flexDirection: 'row',
              columnGap: 1,
              children: [
                Text({ color: isLast ? style.accent : 'inactive', children: `${isLast ? style.current : style.marker} ${String(t.turn).padStart(2)}` }),
                Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, children: Button({ key: `chapter-${t.turn}`, label: title, plain: true, onPress: () => actions.jumpToTurn(t.turn) }) }),
                Text({ color: 'inactive', children: parts.join(' ') }),
              ],
            })
          })
    if (data.turns.length > 0) body.push(hint('Enter jumps to the chapter. Fullscreen only.'))
  } else if (data.tab === 'ledger') {
    body =
      data.ledger.length === 0
        ? [hint('No files changed yet.')]
        : data.ledger.map((f, i) => {
            const { dir, base } = splitPath(f.file, data.cwd)
            return Box({
              flexDirection: 'row',
              columnGap: 1,
              children: [
                Text({ color: style.accent, children: style.marker }),
                Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, children: Button({ key: `file-${i}`, label: printable(dir + base, 120), plain: true, onPress: () => actions.jumpToTool(f.lastToolId) }) }),
                Text({ color: 'success', children: `+${f.add}` }),
                Text({ color: 'error', children: `−${f.del}` }),
                Text({ color: 'inactive', children: `turns ${f.turns.join(', ')}` }),
              ],
            })
          })
  } else {
    body =
      data.pins.length === 0
        ? [hint('No pins yet. Type /pin and a note, or /pin alone to pin the last turn.')]
        : data.pins.map((p, i) =>
            Box({
              flexDirection: 'row',
              columnGap: 1,
              children: [
                Text({ color: style.accent, children: style.marker }),
                Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, children: Text({ wrap: 'wrap', children: printable(p.text, 300) }) }),
                Text({ color: 'inactive', children: p.turn === undefined ? '' : `turn ${p.turn}` }),
                Button({ key: `unpin-${i}`, label: 'remove', plain: true, dimColor: true, onPress: () => actions.unpin(i) }),
              ],
            }),
          )
  }

  return Box({ flexDirection: 'column', rowGap: 1, children: [tabs, Box({ flexDirection: 'column', children: body })] })
}
