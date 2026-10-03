import type { RenderElement } from 'claude-code'

import { COMBOS } from '../engine/combos'
import { INGREDIENT_HOTKEYS, INGREDIENT_IDS, INGREDIENT_LABELS, LOOK_IDS, LOOK_LABELS } from '../engine/settings'
import type { IngredientId, LookId, Settings } from '../engine/settings'
import type { Els } from '../looks/look'

export const PICKER_PANE = 'claudinator'

export type PickerInfo = {
  isFullscreen: boolean
  hasProjectFile: boolean
  shareCode: string
  /** Cells across the pane's body; the layout adds taglines and a second column as room allows. */
  columns?: number
  isDark?: boolean
}
export type PickerActions = { setLook: (id: LookId) => void; toggle: (id: IngredientId) => void; applyCombo: (id: string) => void }

/** Letters for combos, chosen to stay clear of the ingredient keys. */
const COMBO_HOTKEYS: Record<string, string> = { daily: 'w', storyteller: 's', showoff: 'o', doof: 'x', zen: 'z' }

const TAGLINES: Record<LookId, string> = {
  hairline: 'Swiss-quiet',
  broadsheet: 'Reads like a story',
  mission: 'A precision instrument',
  prism: 'Every file its color',
  sumi: 'Ink and space',
  blueprint: 'A technical drawing',
  off: "Claude Code's own",
}

/** Three colors from each look's palette, dark and light: its accent, then two it is known by. */
const SWATCHES: Record<Exclude<LookId, 'off'>, { dark: string[]; light: string[] }> = {
  hairline: { dark: ['#a0a3ff', '#7fd1a8', '#f2c66d'], light: ['#5559de', '#1f8a5b', '#a36a00'] },
  broadsheet: { dark: ['#e3b65c', '#d6a3b5', '#8fbfb4'], light: ['#94680f', '#8e4766', '#2f6f68'] },
  mission: { dark: ['#ffb347', '#93d46b', '#6fd6c3'], light: ['#b26a00', '#3a7c1c', '#11796a'] },
  prism: { dark: ['#7c6cff', '#ff6fa8', '#6fd6e8'], light: ['#5b4bff', '#c2185b', '#0f7f95'] },
  sumi: { dark: ['#8aa4e0', '#a9b8a0', '#c9b98e'], light: ['#2d4f9e', '#56704a', '#87692c'] },
  blueprint: { dark: ['#7fd4ff', '#ffffff', '#ffe08a'], light: ['#0e7fa8', '#0f2d5c', '#8a6100'] },
}

const NAME_WIDTH = Math.max(...LOOK_IDS.map(id => LOOK_LABELS[id].length))
const TAGLINE_MIN_COLUMNS = 44
const TWO_COLUMN_MIN_COLUMNS = 40

/**
 * The /claudinator pane: a header naming the setup, the looks with their
 * colors, ingredient switches, combos, and the share code. Colors come from
 * Claude Code's theme tokens, so each look's own theme tints the pane.
 */
export function pickerView(els: Els, settings: Settings, info: PickerInfo, actions: PickerActions): RenderElement {
  const { Box, Button, Text } = els
  const columns = Math.max(24, info.columns ?? 48)
  const ruleWidth = Math.max(4, columns - 2)

  const section = (title: string, body: RenderElement[]): RenderElement =>
    Box({
      flexDirection: 'column',
      children: [
        Box({
          flexDirection: 'row',
          columnGap: 1,
          height: 1,
          overflow: 'hidden',
          children: [
            Box({ flexShrink: 0, children: [Text({ bold: true, color: 'suggestion', children: title.toUpperCase() })] }),
            Box({ flexGrow: 1, height: 1, overflow: 'hidden', children: [Text({ color: 'subtle', children: '─'.repeat(ruleWidth) })] }),
          ],
        }),
        ...body,
      ],
    })

  const onCount = INGREDIENT_IDS.filter(id => settings.ingredients[id]).length
  const header = Box({
    flexDirection: 'column',
    children: [
      Text({ bold: true, color: 'suggestion', children: '◆ Claudinator' }),
      Text({ color: 'inactive', children: `${LOOK_LABELS[settings.look]} · ${onCount} ${onCount === 1 ? 'ingredient' : 'ingredients'} on` }),
    ],
  })

  const showTaglines = columns >= TAGLINE_MIN_COLUMNS
  const looks = LOOK_IDS.map((id, i) => {
    const isCurrent = settings.look === id
    const swatch = id === 'off' ? [] : SWATCHES[id][info.isDark === false ? 'light' : 'dark']
    return Box({
      key: `row-look-${id}`,
      flexDirection: 'row',
      height: 1,
      overflow: 'hidden',
      children: [
        Text({ bold: true, color: 'suggestion', children: isCurrent ? '› ' : '  ' }),
        Button({
          key: `look-${id}`,
          label: LOOK_LABELS[id].padEnd(NAME_WIDTH),
          hotkey: String(i + 1),
          plain: true,
          dimColor: !isCurrent,
          onPress: () => actions.setLook(id),
        }),
        Text({ children: ' ' }),
        ...(swatch.length > 0 ? swatch.map(color => Text({ color, children: '■' })) : [Text({ color: 'subtle', children: '□□□' })]),
        ...(showTaglines ? [Text({ color: 'inactive', children: `  ${TAGLINES[id]}` })] : []),
      ],
    })
  })

  // Two columns where they fit: the left as wide as its longest switch, the right the rest.
  const isTwoColumn = columns >= TWO_COLUMN_MIN_COLUMNS
  const leftWidth = Math.max(...INGREDIENT_IDS.filter((_, i) => i % 2 === 0).map(id => INGREDIENT_LABELS[id].length)) + 5 + 2
  const switchOf = (id: IngredientId, i: number): RenderElement => {
    const isOn = settings.ingredients[id]
    return Box({
      key: `row-ingredient-${id}`,
      flexDirection: 'row',
      width: isTwoColumn ? (i % 2 === 0 ? leftWidth : columns - 2 - leftWidth) : columns - 2,
      height: 1,
      overflow: 'hidden',
      children: [
        Box({ flexShrink: 0, width: 2, children: [Text({ color: isOn ? 'success' : 'subtle', children: isOn ? '● ' : '○ ' })] }),
        Button({
          key: `ingredient-${id}`,
          label: INGREDIENT_LABELS[id],
          hotkey: INGREDIENT_HOTKEYS[id],
          plain: true,
          dimColor: !isOn,
          onPress: () => actions.toggle(id),
        }),
      ],
    })
  }
  const ingredients = Box({ flexDirection: 'row', flexWrap: 'wrap', children: INGREDIENT_IDS.map(switchOf) })

  const combos = Box({
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 3,
    children: COMBOS.map(c => Button({ key: `combo-${c.id}`, label: c.label, hotkey: COMBO_HOTKEYS[c.id] ?? 'w', plain: true, onPress: () => actions.applyCombo(c.id) })),
  })

  const notes: RenderElement[] = [
    Box({
      flexDirection: 'row',
      children: [Text({ color: 'inactive', children: 'Your code  ' }), Text({ bold: true, color: 'suggestion', children: info.shareCode })],
    }),
    Text({ color: 'inactive', children: `Others type /look use ${info.shareCode}` }),
  ]
  if (info.hasProjectFile) {
    notes.push(Text({ color: 'inactive', children: 'This project sets defaults in .claude/claudinator.json. Your choices here take precedence.' }))
  }
  notes.push(
    Text({
      color: 'inactive',
      children: info.isFullscreen
        ? 'Every row in this session follows your choice. Esc closes.'
        : 'Classic layout: new rows follow your choice; rows in your terminal history keep theirs. Set CLAUDE_CODE_NO_FLICKER=1 for fullscreen. Esc closes.',
    }),
  )

  return Box({
    flexDirection: 'column',
    rowGap: 1,
    paddingX: 1,
    children: [header, section('Look', looks), section('Ingredients', [ingredients]), section('Combos', [combos]), section('Share', notes)],
  })
}
