import type { RenderElement } from 'claude-code'

import { INGREDIENT_HOTKEYS, INGREDIENT_IDS, INGREDIENT_LABELS, LOOK_IDS, LOOK_LABELS } from '../engine/settings'
import type { IngredientId, LookId, Settings } from '../engine/settings'
import type { Els } from '../looks/look'

export const PICKER_PANE = 'claudinator'

export type PickerInfo = { isFullscreen: boolean; lockedLook: boolean; lockedIngredients: IngredientId[] }
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
      onPress: () => {
        if (!info.lockedLook) actions.setLook(id)
      },
    }),
  )

  const ingredients = INGREDIENT_IDS.map(id => {
    const isLocked = info.lockedIngredients.includes(id)
    return Button({
      key: `ingredient-${id}`,
      label: `${INGREDIENT_LABELS[id]} · ${settings.ingredients[id] ? 'on' : 'off'}${isLocked ? ' (project)' : ''}`,
      hotkey: INGREDIENT_HOTKEYS[id],
      plain: true,
      dimColor: !settings.ingredients[id],
      onPress: () => {
        if (!isLocked) actions.toggle(id)
      },
    })
  })

  const notes: RenderElement[] = []
  if (info.lockedLook || info.lockedIngredients.length > 0) {
    notes.push(Text({ dimColor: true, children: 'Some choices are set by this project in .claude/claudinator.json.' }))
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
