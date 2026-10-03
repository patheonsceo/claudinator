// SPDX-License-Identifier: MIT
// Claudinator's only hooks module. Claude Code reads on(...) and $.noun.method(...)
// from source, so every call is spelled literally, and helpers that take $ are
// top-level functions in this file. Everything else lives in ../src as pure code.
import type { Register } from 'claude-code'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'claudinator', description: 'Pick a Claudinator look and ingredients', immediate: true })
    return next(e)
  })

  on('command.run', { command: 'claudinator' }, async $ => {
    $.ui.toast('Claudinator is being set up.')
    return {}
  })
}
