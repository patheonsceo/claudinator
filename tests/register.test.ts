import { describe, expect, test } from 'claude-code/testing'

import { SESSION, commandInput, startsSession } from './fixtures'

describe('register', () => {
  test('the session starts and /claudinator answers', async ($, on) => {
    startsSession(on)
    await $.session.start(SESSION)
    const answer = await $.command.run(commandInput('claudinator'))
    expect(answer).toEqual({})
  })
})
