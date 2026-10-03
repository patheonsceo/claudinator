import type { RenderElement } from 'claude-code'

import { INGREDIENT_HOTKEYS, INGREDIENT_IDS, INGREDIENT_LABELS, LOOK_IDS, LOOK_LABELS } from '../engine/settings'
import type { IngredientId, LookId, Settings } from '../engine/settings'
import type { Els } from '../looks/look'

export const PICKER_PANE = 'claudinator'

export type PickerInfo = { isFullscreen: boolean; hasProjectFile: boolean }
export type PickerActions = { setLook: (id: LookId) => void; toggle: (id: IngredientId) => void }

export function pickerView(els: Els, settings: Settings, info: PickerInfo, actions: PickerActions): RenderElement {
  const { Box, Button, Text } = els
  const heading = (text: string): RenderElement => Text({ bold: true, children: text })

  const looks = LOOK_IDS.map((id, i) =>
    Button({
      key: `look-${id}`,
      label: `${LOOK_LABELS[id]}${settings.look === id ? ' ●' : ''}`,
      hotkey: String(i + 1),
      plain: true,
      dimColor: settings.look !== id,
      onPress: () => actions.setLook(id),
    }),
  )

  const ingredients = INGREDIENT_IDS.map(id =>
    Button({
      key: `ingredient-${id}`,
      label: `${INGREDIENT_LABELS[id]} · ${settings.ingredients[id] ? 'on' : 'off'}`,
      hotkey: INGREDIENT_HOTKEYS[id],
      plain: true,
      dimColor: !settings.ingredients[id],
      onPress: () => actions.toggle(id),
    }),
  )

  const notes: RenderElement[] = []
  if (info.hasProjectFile) {
    notes.push(Text({ dimColor: true, children: 'This project sets defaults in .claude/claudinator.json. Your choices here take precedence.' }))
  }
  notes.push(
    Text({
      dimColor: true,
      children: info.isFullscreen
        ? 'Fullscreen: every row in this session follows your choice.'
        : 'Classic layout: new rows follow your choice; rows in your terminal history keep theirs. Set CLAUDE_CODE_NO_FLICKER=1 for fullscreen.',
    }),
  )
  notes.push(Text({ dimColor: true, children: 'Esc closes. Choices are saved for every session.' }))

  return Box({
    flexDirection: 'column',
    rowGap: 1,
    children: [
      Box({ flexDirection: 'column', children: [heading('Look'), Box({ flexDirection: 'row', columnGap: 3, flexWrap: 'wrap', children: looks })] }),
      Box({ flexDirection: 'column', children: [heading('Ingredients'), Box({ flexDirection: 'row', columnGap: 3, flexWrap: 'wrap', children: ingredients })] }),
      Box({ flexDirection: 'column', children: notes }),
    ],
  })
}
