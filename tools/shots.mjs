// Screenshots every look in a real Claude Code session, for reviewing polish.
//   node tools/shots.mjs            # write the tapes
//   node tools/shots.mjs --run      # write them, then record (sequential, ~3 min per look)
//   node tools/shots.mjs --run sumi # one look
// Each look gets: done (two finished turns), working (mid-turn), chapters and picker
// (panes docked), and progress (a run where Claude keeps a task list).
// Output: .superpowers/screens/<look>-<shot>.png. Projects: demos/sessions/<look>-<run>,
// copied fresh from demos/fixture into demos/sessions/ (inside the repo, so Claude Code trusts the
// folder; not under a hidden folder, which Claude Code treats as sensitive and asks about every edit).
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { RECEIPT, SHOWCASE_CODES } from './codes.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, '.superpowers', 'screens')
const tapes = join(root, '.superpowers', 'screen-tapes')
const LOOKS = Object.keys(SHOWCASE_CODES)
// The sessions load a fresh copy of the plugin: Claude Code asks before any edit inside a loaded
// plugin's own folder, and the throwaway projects live inside this repository.
const plugin = join(root, '.superpowers', 'plugin-under-test')

// What the recorded sessions may do without asking: edit files in the throwaway project, keep a
// task list, and run the fixture's tests or look around. Anything else stops at a permission prompt.
const ALLOWED = 'Read,Edit,Write,Glob,Grep,TaskCreate,TaskUpdate,TaskList,TaskGet,TodoWrite,ToolSearch,Bash(node --test:*),Bash(find:*),Bash(ls:*),Bash(cat:*)'

const FIX = 'Fix total() in src/cart.js so it counts item.qty, then run node --test.'
const SECOND = 'Now add a test for an empty cart, then run node --test again.'
const TASKS = 'Use the task tools first to plan 4 steps, and keep them updated as you go: read src/cart.js, fix total() to count item.qty, add a test for an empty cart, run node --test.'

function start(look, project) {
  return [
    `Output "${join(tapes, `${look}-${project}.gif`)}"`,
    'Require claude',
    `Source "${join(root, 'demos/tapes/_settings.tape')}"`,
    `Source "${join(root, `demos/themes/${look}.tape`)}"`,
    'Set Width 1300',
    'Set Height 900',
    'Hide',
    `Type "cd ${join(root, 'demos/sessions', `${look}-${project}`)} && CLAUDE_CODE_NO_FLICKER=1 claude --plugin-dir ${plugin} --model haiku --permission-mode acceptEdits --allowedTools '${ALLOWED}' --settings ${join(root, `demos/themes/${look}.settings.json`)}" Enter`,
    'Sleep 7s',
    `Type "/look use ${SHOWCASE_CODES[look]}"`,
    'Sleep 800ms',
    'Enter',
    'Sleep 1500ms',
  ]
}

const shot = name => ['Show', 'Sleep 1500ms', `Screenshot "${join(out, name)}"`, 'Sleep 500ms', 'Hide']
const command = text => [`Type "${text}"`, 'Sleep 800ms', 'Enter', 'Sleep 2s']
const end = ['Ctrl+C', 'Ctrl+C']

function turnsTape(look) {
  const receipt = RECEIPT[look]
  return [
    ...start(look, 'turns'),
    `Type "${FIX}" Enter`,
    `Wait+Screen@150s /${receipt(1)}/`,
    'Sleep 1500ms',
    `Type "${SECOND}" Enter`,
    'Sleep 3s',
    ...shot(`${look}-working.png`),
    `Wait+Screen@150s /(?s)${receipt(1)}.*${receipt(2)}/`,
    'Sleep 2s',
    ...shot(`${look}-done.png`),
    ...command('/chapters'),
    ...shot(`${look}-chapters.png`),
    'Escape',
    'Sleep 800ms',
    ...command('/claudinator'),
    ...shot(`${look}-picker.png`),
    ...end,
  ]
}

function progressTape(look) {
  return [
    ...start(look, 'progress'),
    `Type "${TASKS}" Enter`,
    'Sleep 12s',
    ...shot(`${look}-progress-1.png`),
    'Sleep 7s',
    ...shot(`${look}-progress-2.png`),
    `Wait+Screen@180s /${RECEIPT[look](1)}/`,
    'Sleep 2s',
    ...shot(`${look}-progress-done.png`),
    ...end,
  ]
}

mkdirSync(out, { recursive: true })
mkdirSync(tapes, { recursive: true })
const wanted = process.argv.slice(2).filter(a => !a.startsWith('--'))
const looks = wanted.length > 0 ? LOOKS.filter(l => wanted.includes(l)) : LOOKS
for (const look of looks) {
  writeFileSync(join(tapes, `${look}-turns.tape`), turnsTape(look).join('\n') + '\n')
  writeFileSync(join(tapes, `${look}-progress.tape`), progressTape(look).join('\n') + '\n')
}
console.log(`Wrote ${looks.length * 2} tapes to ${tapes}`)

if (process.argv.includes('--run')) {
  rmSync(plugin, { recursive: true, force: true })
  for (const part of ['.claude-plugin', 'hooks', 'src', 'themes', 'types']) cpSync(join(root, part), join(plugin, part), { recursive: true })
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE')))
  env.COLORTERM = 'truecolor'
  for (const look of looks) {
    for (const project of ['turns', 'progress']) {
      const dir = join(root, 'demos/sessions', `${look}-${project}`)
      rmSync(dir, { recursive: true, force: true })
      cpSync(join(root, 'demos/fixture'), dir, { recursive: true })
      console.log(`▶ ${look} ${project}`)
      try {
        execFileSync('vhs', [join(tapes, `${look}-${project}.tape`)], { cwd: root, env, stdio: 'ignore' })
      } catch {
        console.log(`  ✗ ${look} ${project} failed`)
      }
    }
  }
}
