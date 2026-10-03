import { describe, expect, test } from 'claude-code/testing'

import { NAVIGATOR_PROPS, PICKER_PROPS, SESSION, assistantInput, commandInput, promptInput, startsSession, textOf, toolUseInput, turnDurationInput, userMessageInput } from './fixtures'

describe('register: the full suite', () => {
  test('footnotes fold reads into marks on the reply and notes on the receipt', async ($, on) => {
    const { saved } = startsSession(on)
    saved.set('settings', { ingredients: { footnotes: true } })
    let id = ''
    on('tool.call', ($, e) => {
      id = e.tool_use_id
      return { result: 'ok' }
    })
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: '' }))
    await $.session.start(SESSION)
    await $.turn.start({ turnId: 't1', text: 'look' })
    await $.ui.render(assistantInput('msg-a', 'Looking at the cart.'))
    await $.tool.call({ tool: 'Read', file_path: '/work/src/cart.js' })
    expect(textOf(await $.ui.render(assistantInput('msg-a', 'Looking at the cart.')))).toBe('Looking at the cart. ¹')
    expect(textOf(await $.ui.render(toolUseInput('Read', { file_path: '/work/src/cart.js' }, { tool_use_id: id })))).toBe('')
    await $.turn.complete({ turnId: 't1', durationMs: 4_000, answer: 'Done.', isAborted: false, reason: 'answer' })
    const receipt = textOf(await $.ui.render(turnDurationInput(4_000)))
    expect(receipt).toContain('¹')
    expect(receipt).toContain('Read src/cart.js')
  })

  test('a finished turn gets a headline above its prompt', async ($, on) => {
    const { saved } = startsSession(on)
    saved.set('settings', { ingredients: { headlines: true } })
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: '' }))
    await $.session.start(SESSION)
    await $.prompt.submit(promptInput('fix the cart total'))
    await $.ui.render(userMessageInput('fix the cart total'))
    await $.turn.start({ turnId: 't1', text: 'fix the cart total' })
    await $.turn.complete({ turnId: 't1', durationMs: 4_000, answer: 'Fixed the cart total. It counts quantities now.', isAborted: false, reason: 'answer' })
    const text = textOf(await $.ui.render(userMessageInput('fix the cart total')))
    expect(text).toContain('Turn 1')
    expect(text).toContain('Fixed the cart total')
    expect(text).toContain('fix the cart total')
  })

  test('the time strip shows where the turn went', async ($, on) => {
    const { saved, clock } = startsSession(on)
    saved.set('settings', { ingredients: { timeStrip: true } })
    on('tool.call', async () => {
      await clock.advance(2_000)
      return { result: 'ok' }
    })
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: '' }))
    await $.session.start(SESSION)
    await $.turn.start({ turnId: 't1', text: 'x' })
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    await clock.advance(3_000)
    await $.turn.complete({ turnId: 't1', durationMs: 5_000, answer: 'ok', isAborted: false, reason: 'answer' })
    const text = textOf(await $.ui.render(turnDurationInput(5_000)))
    expect(text).toContain('thinking 0:03')
    expect(text).toContain('tools 0:02')
  })

  test('/chapters opens the navigator, and a chapter jumps to its prompt', async ($, on) => {
    startsSession(on)
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: '' }))
    await $.session.start(SESSION)
    await $.prompt.submit(promptInput('fix the cart'))
    await $.ui.render(userMessageInput('fix the cart'))
    await $.turn.start({ turnId: 't1', text: 'fix the cart' })
    await $.turn.complete({ turnId: 't1', durationMs: 4_000, answer: 'Fixed the cart.', isAborted: false, reason: 'answer' })
    expect(await $.command.run(commandInput('chapters'))).toEqual({})
    const pane = await $.ui.mount({ plugin: 'claudinator', surface: 'terminal', component: 'Pane', requestId: 'claudinator-navigator', props: NAVIGATOR_PROPS })
    expect(textOf(await pane.drawn())).toContain('Fixed the cart')
    // The test kit cannot scroll a transcript; pressing must not throw. The jump itself is checked live.
    await pane.press({ key: 'chapter-1' })
    await pane.unmount()
  })

  test('/pin keeps a note across sessions, and the pane removes it', async ($, on) => {
    const { saved } = startsSession(on)
    await $.session.start(SESSION)
    await $.command.run(commandInput('pin', 'Use BroadcastChannel for the lock'))
    expect(saved.get('pins')).toEqual([{ text: 'Use BroadcastChannel for the lock' }])
    await $.command.run(commandInput('pins'))
    const pane = await $.ui.mount({ plugin: 'claudinator', surface: 'terminal', component: 'Pane', requestId: 'claudinator-navigator', props: NAVIGATOR_PROPS })
    expect(textOf(await pane.drawn())).toContain('BroadcastChannel')
    await pane.press({ key: 'unpin-0' })
    expect(saved.get('pins')).toEqual([])
    await pane.unmount()
  })

  test('/look takes combos and share codes, and /look share prints the code', async ($, on) => {
    const { saved, toasts } = startsSession(on)
    await $.session.start(SESSION)
    await $.command.run(commandInput('look', 'zen'))
    expect(saved.get('settings')).toMatchObject({ look: 'sumi', ingredients: { footnotes: true, recency: true } })
    await $.command.run(commandInput('look', 'share'))
    const code = toasts.at(-1)?.match(/[A-Z]{2}-[0-9A-Z]{3}/)?.[0] ?? ''
    expect(code).toMatch(/^SU-/)
    await $.command.run(commandInput('look', 'hairline'))
    await $.command.run(commandInput('look', `use ${code.toLowerCase()}`))
    expect(saved.get('settings')).toMatchObject({ look: 'sumi' })
    await $.command.run(commandInput('look', 'use XX-000'))
    expect(toasts.at(-1)).toContain('XX')
  })

  test('the picker applies a combo and shows the share code', async ($, on) => {
    const { saved } = startsSession(on)
    await $.session.start(SESSION)
    const pane = await $.ui.mount({ plugin: 'claudinator', surface: 'terminal', component: 'Pane', requestId: 'claudinator', props: PICKER_PROPS })
    expect(textOf(await pane.drawn())).toMatch(/HL-[0-9A-Z]{3}/)
    await pane.press({ key: 'combo-doof' })
    expect(saved.get('settings')).toMatchObject({ look: 'blueprint', ingredients: { inator: true } })
    await pane.unmount()
  })
})
