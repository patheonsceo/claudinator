#!/usr/bin/env node
// Writes every demo tape in demos/tapes/ from the list below:
//   node tools/tapes.mjs           write the tapes
//   node tools/tapes.mjs --check   fail if a committed tape is out of date
// Each tape drives a real Claude Code session against demos/fixture; record
// them with demos/record.sh.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ALLOWED_TOOLS, DEFAULT_CODES, RECEIPT } from './codes.mjs'

const LOOKS = ['hairline', 'broadsheet', 'mission', 'prism', 'sumi', 'blueprint']

/** Text each look's receipt shows once turn n has finished; recordings wait for it. */

const FIX = 'Fix total() in src/cart.js so it counts item.qty, then run node --test.'
const SECOND = 'Now add a test for an empty cart and run node --test again.'

function head(name, look) {
  return [`Output demos/out/${name}.gif`, 'Require claude', 'Source demos/tapes/_settings.tape', `Source demos/themes/${look}.tape`, '']
}

// Sessions load the copy of the plugin record.sh makes: Claude Code asks before any edit inside a
// loaded plugin's own folder, and demos/fixture lives inside this one. They may edit the fixture and
// run its tests without asking (ALLOWED_TOOLS); the attention demo keeps every prompt, as it shows one.
function start(look, { asks = false } = {}) {
  const permissions = asks ? '' : ` --permission-mode acceptEdits --allowedTools '${ALLOWED_TOOLS}'`
  return [
    'Hide',
    `Type "cd demos/fixture && CLAUDE_CODE_NO_FLICKER=1 claude --plugin-dir ../.plugin-under-test --model haiku${permissions} --settings ../themes/${look}.settings.json" Enter`,
    'Sleep 6s',
    // Pin the exact setup: the plugin store is shared, so never rely on what an earlier session saved.
    ...slash(`/look use ${DEFAULT_CODES[look]}`),
    'Sleep 1s',
  ]
}

/** Slash commands need a beat before Enter, or autocomplete swallows it. */
function slash(command) {
  return [`Type "${command}"`, 'Sleep 800ms', 'Enter']
}

function turn(prompt, look, n) {
  return [`Type "${prompt}" Enter`, `Wait+Screen@150s /${RECEIPT[look](n)}/`, 'Sleep 1500ms']
}

function picker(keys, pause = '2500ms') {
  return [...slash('/claudinator'), 'Sleep 1500ms', ...keys.flatMap(k => [`Type "${k}"`, `Sleep ${pause}`]), 'Escape', 'Sleep 1s']
}

const end = ['Hide', 'Ctrl+C', 'Ctrl+C', '']

function tape(name, look, body) {
  return { path: `demos/tapes/${name}.tape`, content: [...head(name, look), ...body, ...end].join('\n') }
}

export function tapes() {
  const out = []
  out.push(tape('hero', 'hairline', [...start('hairline'), ...turn(FIX, 'hairline', 1), 'Show', 'Sleep 2s', ...picker(['2', '3', '4', '5', '6', '7', '1'], '2800ms')]))
  for (const look of LOOKS) {
    out.push(tape(`look-${look}`, look, [...start(look), 'Show', `Type "${FIX}"`, 'Sleep 500ms', 'Enter', `Wait+Screen@150s /${RECEIPT[look](1)}/`, 'Sleep 3s']))
  }
  const toggle = (name, key, { before = [], second = false } = {}) =>
    tape(`ingredient-${name}`, 'hairline', [
      ...start('hairline'),
      ...before,
      ...turn(FIX, 'hairline', 1),
      ...(second ? turn(SECOND, 'hairline', 2) : []),
      'Show',
      'Sleep 2s',
      ...picker([key, key]),
    ])
  out.push(toggle('mini-diffs', 'd'))
  out.push(toggle('file-colors', 'f'))
  out.push(toggle('quiet', 'q'))
  out.push(toggle('recency', 'r', { second: true }))
  out.push(toggle('headlines', 'h', { second: true }))
  out.push(toggle('time-strip', 't'))
  out.push(toggle('inator', 'i'))
  out.push(toggle('footnotes', 'n', { before: picker(['n'], '500ms') }))
  out.push(
    tape('attention', 'hairline', [
      ...start('hairline', { asks: true }),
      'Type "Create a file notes.txt containing the word hello." Enter',
      'Wait+Screen@90s /Do you want/',
      'Show',
      'Sleep 4s',
      'Hide',
      'Sleep 24s',
      'Show',
      'Sleep 6s',
      'Escape',
    ]),
  )
  out.push(
    tape('navigator', 'hairline', [
      ...start('hairline'),
      ...turn(FIX, 'hairline', 1),
      ...turn(SECOND, 'hairline', 2),
      ...slash('/pin Quantities belong in total(), not in the callers'),
      'Sleep 1s',
      'Show',
      'Sleep 1500ms',
      ...slash('/chapters'),
      'Sleep 2500ms',
      'Type "l"',
      'Sleep 2500ms',
      'Type "p"',
      'Sleep 2500ms',
      'Type "c"',
      'Sleep 1500ms',
      'Escape',
      'Sleep 1s',
    ]),
  )
  out.push(tape('combos', 'hairline', [...start('hairline'), ...turn(FIX, 'hairline', 1), 'Show', 'Sleep 1500ms', ...picker(['w', 's', 'o', 'x', 'z', 'w'], '3s')]))
  return out
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const isCheck = process.argv.includes('--check')
  const stale = []
  const files = tapes()
  for (const file of files) {
    const path = join(root, file.path)
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null
    if (current === file.content) continue
    if (isCheck) stale.push(file.path)
    else writeFileSync(path, file.content)
  }
  if (isCheck && stale.length > 0) {
    console.error(`Out of date, run node tools/tapes.mjs:\n  ${stale.join('\n  ')}`)
    process.exit(1)
  }
  console.log(isCheck ? `${files.length} tapes up to date` : `Wrote ${files.length} tapes`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
