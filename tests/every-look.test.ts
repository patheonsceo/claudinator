import { describe, expect, test } from 'claude-code/testing'

import { LOOK_IDS } from '../src/engine/settings'
import { LOOKS } from '../src/looks'
import { SESSION, assistantInput, bandInput, spinnerInput, startsSession, textOf, toolGroupInput, toolUseInput, turnDurationInput, userMessageInput } from './fixtures'

const READY = LOOK_IDS.filter(id => LOOKS[id] !== null)

describe('every look on every site', () => {
  for (const look of READY) {
    for (const surface of ['terminal', 'desktop'] as const) {
      test(`${look} draws every site on ${surface} without Claude Code refusing it`, async ($, on) => {
        const { saved } = startsSession(on)
        saved.set('settings', { look, ingredients: { headlines: true, footnotes: false, timeStrip: true, miniDiffs: true, fileColors: true, inator: true } })
        await $.session.start(SESSION)
        const mounts = [
          { component: 'ToolUse', requestId: 'toolu_1', props: toolUseInput('Edit', { file_path: '/work/src/cart.js', old_string: 'a', new_string: 'b' }).props },
          { component: 'ToolUse', requestId: 'toolu_2', props: toolUseInput('Bash', { command: 'printf "\x1b[31m' + 'x'.repeat(400) + '"' }, { isErrored: true }).props },
          { component: 'ToolGroup', requestId: 'g1', props: toolGroupInput([{ tool: 'Read', input: { file_path: '/work/長い/パス.ts' } }, { tool: 'Grep', input: { pattern: 'x' } }]).props },
          { component: 'UserMessage', requestId: 'msg_u1', props: userMessageInput('fix it\nplease').props },
          { component: 'TurnDuration', requestId: 'msg_t1', props: turnDurationInput(9_000).props },
          { component: 'Spinner', requestId: 'main', props: spinnerInput('thinking', surface).props },
          { component: 'AbovePrompt', requestId: 'band', props: bandInput().props },
          { component: 'AssistantMessage', requestId: 'msg_a', props: assistantInput('msg_a', 'Done.').props },
        ] as const
        for (const m of mounts) {
          const ui = await $.ui.mount({ plugin: 'claudinator', surface, component: m.component, requestId: m.requestId, props: m.props as never })
          const drawn = JSON.stringify(await ui.drawn())
          expect(drawn, `${look} ${m.component} on ${surface}`).not.toContain('\u001b')
          if (surface === 'desktop') expect(drawn, `${look} ${m.component} has no Raster on desktop`).not.toContain('"Raster"')
          await ui.unmount()
        }
      })
    }
  }

  test('the registry has a look for every id but Off', async () => {
    expect(LOOK_IDS.filter(id => id !== 'off' && LOOKS[id] === null)).toEqual([])
  })
})
