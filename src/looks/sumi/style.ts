import type { RenderElement, TextProps } from 'claude-code'

import { SLOW_MS, formatDuration } from '../../engine/format'
import { tone } from '../../engine/palette'
import type { Ctx } from '../look'

/**
 * Sumi draws in three inks and one seal. Tokens first, so the companion theme
 * makes it exact and any stock theme still reads.
 */
export const C = {
  seal: 'suggestion',
  text: 'text',
  dim: 'inactive',
  faint: 'subtle',
  add: 'success',
  err: 'error',
  warn: 'warning',
} as const

/**
 * The faint ink for words, between `inactive` and `subtle`: the theme's
 * `subtle` is a rule color, too pale to read as text. Dark enough to stay apart
 * from `inactive` where a 256-color terminal rounds hex colors.
 */
export const WASH = { dark: '#4c4a46', light: '#9e9a92' } as const

/** Fixed 24-bit colors for the live rasters, which have no theme: each reads on dark and light. */
export const LIVE_INK = { seal: 0x6a86cf, mid: 0x6f7891, wash: 0x75726d } as const

/**
 * Every Sumi row sits this far in. A mark and its words are one space apart
 * (`■ session.ts`); the diff wash starts a column past the words, its code and
 * a failure's detail one further (its padding).
 */
export const INDENT = 3
export const DIFF_INDENT = 6
export const DETAIL_INDENT = 7
/** The space between a mark and its words. */
export const GAP = 1
/** What sets the next part three columns on (`■ session.ts   +38 −9`): the gap plus this. */
export const APART = 2

/** Below this width, Sumi drops slow-call times and caps its traces shorter. */
export const NARROW_COLUMNS = 100

export function wash(ctx: Ctx): string {
  return ctx.isDark ? WASH.dark : WASH.light
}

/** A color at the row's fade. Faint inks go straight to `subtle`, so nothing brightens as it ages. */
export function ink(ctx: Ctx, color: string): string {
  if (ctx.fade === 0) return color
  return color === WASH.dark || color === WASH.light || color === C.faint ? tone(color, 2) : tone(color, ctx.fade)
}

export function txt(ctx: Ctx, color: string, children: string | RenderElement[], extra: Pick<TextProps, 'bold' | 'italic' | 'wrap'> = {}): RenderElement {
  return ctx.els.Text({ color: ink(ctx, color), ...extra, children })
}

/** One Sumi row: indented, its parts a breath apart. */
export function line(ctx: Ctx, children: RenderElement[], gap = GAP): RenderElement {
  return ctx.els.Box({ flexDirection: 'row', paddingLeft: INDENT, columnGap: gap, children })
}

/** A part that keeps its width and gives way only when the row is out of room. */
export function shrink(ctx: Ctx, child: RenderElement): RenderElement {
  return ctx.els.Box({ flexShrink: 1, minWidth: 0, children: child })
}

/** A part that takes the row's spare width. */
export function grow(ctx: Ctx, child: RenderElement): RenderElement {
  return ctx.els.Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, children: child })
}

/** A part set three columns past the one before, keeping its width. */
export function apart(ctx: Ctx, child: RenderElement): RenderElement {
  return ctx.els.Box({ flexShrink: 0, paddingLeft: APART, children: child })
}

/** `+38 −9`, each side in its own ink; a side with nothing to count stays out. */
export function delta(ctx: Ctx, add: number, del: number): RenderElement[] {
  const out: RenderElement[] = []
  if (add > 0) out.push(txt(ctx, C.add, `+${add}`))
  if (del > 0) out.push(txt(ctx, C.err, `${out.length > 0 ? ' ' : ''}−${del}`))
  return out
}

/** What follows a row: `…` while it runs, its time only when it was slow and there is room. */
export function tail(ctx: Ctx, row: { isRunning: boolean; durationMs?: number }): RenderElement[] {
  if (row.durationMs === undefined) return row.isRunning ? [txt(ctx, wash(ctx), '…')] : []
  if (row.durationMs < SLOW_MS || ctx.columns < NARROW_COLUMNS) return []
  return [apart(ctx, txt(ctx, wash(ctx), formatDuration(row.durationMs)))]
}

const CLOSING = /[,.;:!?)\]}’”'"…]/
const OPENING = /[([{‘“'"]/

/** `the refresh race` → `t h e   r e f r e s h   r a c e`. Punctuation stays with its letter. */
export function spaced(text: string): string {
  return spacedWords(text).join('   ')
}

export function spacedWords(text: string): string[] {
  return text
    .split(/\s+/)
    .filter(w => w !== '')
    .map(word => {
      let out = ''
      let prev = ''
      for (const ch of Array.from(word)) {
        out += out === '' || CLOSING.test(ch) || OPENING.test(prev) ? ch : ' ' + ch
        prev = ch
      }
      return out
    })
}

/** Whole spaced words that fit in `width`, with `…` when some were left out. */
export function fitWords(words: string[], width: number): string {
  let out = ''
  for (let i = 0; i < words.length; i++) {
    const next = out === '' ? (words[i] ?? '') : `${out}   ${words[i] ?? ''}`
    const room = i === words.length - 1 ? width : width - 3
    if (next.length > room) return out === '' ? next : `${out}  …`
    out = next
  }
  return out
}
