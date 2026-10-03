import type { RenderElement, TextProps } from 'claude-code'

import { SLOW_MS, formatDuration, printable, splitPath } from '../../engine/format'
import { fileColor, tone } from '../../engine/palette'
import type { Ctx } from '../look'

/** Prism's text colors are theme tokens; its companion theme makes them exact. */
export const C = {
  accent: 'suggestion',
  text: 'text',
  dim: 'inactive',
  faint: 'subtle',
  ok: 'success',
  err: 'error',
  warn: 'warning',
} as const

/** The hex half of the palette: gradients, chips and file hues, per theme brightness. */
export type Hex = {
  /** The terminal background the companion theme sets. */
  bg: string
  g1: string
  g2: string
  g3: string
  err: string
  /** Text drawn on light chips. */
  ink: string
  /** Text drawn on saturated chips. */
  paper: string
  neutralBg: string
  neutralFg: string
}

const DARK: Hex = { bg: '#0f0d16', g1: '#7c6cff', g2: '#ff6fa8', g3: '#ffb86b', err: '#ff7088', ink: '#0f0d16', paper: '#ffffff', neutralBg: '#2a2640', neutralFg: '#cfcce6' }
const LIGHT: Hex = { bg: '#fbfaff', g1: '#5b4bff', g2: '#e0457f', g3: '#e08a2e', err: '#d0304d', ink: '#0f0d16', paper: '#ffffff', neutralBg: '#e8e4f7', neutralFg: '#3a3654' }

export function hex(ctx: Ctx): Hex {
  return ctx.isDark ? DARK : LIGHT
}

/** Below this width, rows drop secondary parts. */
export const NARROW_COLUMNS = 100

/** Width every tool row's chip slot takes, so paths line up: caps plus " ⌕ SEARCH ". */
export const CHIP_COLUMNS = 12

function rgb(color: string): [number, number, number] {
  const n = parseInt(color.slice(1, 7), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function hexOf([r, g, b]: [number, number, number]): string {
  const c = (v: number): string => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** `a` moved `t` of the way to `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a)
  const y = rgb(b)
  return hexOf([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t])
}

/** The color at `t` (0..1) along evenly spaced stops. */
export function gradientAt(stops: readonly string[], t: number): string {
  if (stops.length === 0) return '#888888'
  if (stops.length === 1) return stops[0] ?? '#888888'
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  return mix(stops[i] ?? '#888888', stops[i + 1] ?? '#888888', x - i)
}

function luminance(color: string): number {
  const lin = (v: number): number => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = rgb(color)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** Whichever of ink or paper reads better on `bg`. */
export function readableOn(ctx: Ctx, bg: string): string {
  const h = hex(ctx)
  return contrast(h.ink, bg) >= contrast(h.paper, bg) ? h.ink : h.paper
}

/**
 * A file's hue in this look: lifted a touch on dark themes so chips glow,
 * deepened on light themes so white chip text and bare names both read.
 */
export function hueOf(ctx: Ctx, path: string): string {
  const { dir, base } = splitPath(path, ctx.cwd)
  const raw = fileColor(dir + base)
  return ctx.isDark ? mix(raw, '#ffffff', 0.1) : mix(raw, '#000000', 0.3)
}

export function txt(ctx: Ctx, color: string, children: string, extra: Pick<TextProps, 'bold' | 'wrap'> = {}): RenderElement {
  return ctx.els.Text({ color: tone(color, ctx.fade), ...extra, children })
}

/**
 * A pill: half-block caps in the chip color around a filled label. Faded
 * rows drop the fill (and the caps, which would read as stray blocks).
 */
export function chip(ctx: Ctx, label: string, bg: string, fg = readableOn(ctx, bg)): RenderElement {
  const { Text } = ctx.els
  if (ctx.fade > 0) return Text({ children: [' ', txt(ctx, bg, label), ' '] })
  return Text({ children: [Text({ color: bg, children: '▐' }), Text({ color: fg, backgroundColor: bg, bold: true, children: label }), Text({ color: bg, children: '▌' })] })
}

/** A pill whose fill flows along the gradient, one letter at a time. */
export function gradientChip(ctx: Ctx, label: string): RenderElement {
  const { Text } = ctx.els
  const h = hex(ctx)
  const stops = [h.g1, h.g2]
  if (ctx.fade > 0) return Text({ children: [' ', txt(ctx, h.g1, label), ' '] })
  const fg = readableOn(ctx, mix(h.g1, h.g2, 0.5))
  const n = Math.max(1, label.length - 1)
  const letters = [...label].map((ch, i) => Text({ color: fg, backgroundColor: gradientAt(stops, i / n), bold: true, children: ch }))
  return Text({ children: [Text({ color: h.g1, children: '▐' }), ...letters, Text({ color: h.g2, children: '▌' })] })
}

/** Text whose letters walk the gradient. Spaces join their neighbor to keep the tree small. */
export function gradientText(ctx: Ctx, text: string, stops: readonly string[], extra: Pick<TextProps, 'bold'> = {}): RenderElement {
  const chars = [...text]
  const n = Math.max(1, chars.length - 1)
  return ctx.els.Text({ ...extra, children: chars.map((ch, i) => ctx.els.Text({ color: tone(gradientAt(stops, i / n), ctx.fade), children: ch })) })
}

/**
 * A run of `glyph` `width` long, colored along the gradient in at most
 * `steps` segments: a rule or a ribbon that reads as one sweep of light.
 */
export function gradientRun(ctx: Ctx, glyph: string, width: number, stops: readonly string[], steps = 24): RenderElement[] {
  const n = Math.max(0, Math.floor(width))
  if (n === 0) return []
  const parts = Math.max(1, Math.min(steps, n))
  const out: RenderElement[] = []
  let start = 0
  for (let s = 0; s < parts; s++) {
    const end = Math.round(((s + 1) / parts) * n)
    if (end > start) out.push(ctx.els.Text({ color: tone(gradientAt(stops, parts === 1 ? 0 : s / (parts - 1)), ctx.fade), children: glyph.repeat(end - start) }))
    start = end
  }
  return out
}

export function delta(ctx: Ctx, add: number, del: number): RenderElement[] {
  const out: RenderElement[] = []
  if (add > 0) out.push(txt(ctx, C.ok, `+${add}`))
  if (del > 0) out.push(txt(ctx, C.err, `−${del}`))
  return out
}

/** The time, right-aligned; slow calls in the warm end of the palette. */
export function timing(ctx: Ctx, ms: number): RenderElement {
  return ctx.els.Box({ flexShrink: 0, children: txt(ctx, ms >= SLOW_MS ? C.warn : C.dim, formatDuration(ms).padStart(5)) })
}

/** A path's folder and file name, safe to draw: escapes and control bytes stripped. */
export function safePath(ctx: Ctx, path: string): { dir: string; base: string } {
  const { dir, base } = splitPath(path, ctx.cwd)
  return { dir: printable(dir, 400), base: printable(base, 200) }
}

/** A path as folder (dim) and file name in its hue, truncated from the start when tight. */
export function pathLabel(ctx: Ctx, path: string): RenderElement {
  const { dir, base } = safePath(ctx, path)
  const color = ctx.settings.ingredients.fileColors ? hueOf(ctx, path) : C.text
  return ctx.els.Text({ wrap: 'truncate-start', children: [txt(ctx, C.dim, dir), txt(ctx, color, base)] })
}

/** A flexible slot that takes the row's spare width and truncates inside it. */
export function grow(ctx: Ctx, child: RenderElement): RenderElement {
  return ctx.els.Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, children: child })
}

/** A full-width rule clipped where the row ends, never wrapped and never ellipsized. */
export function clipped(ctx: Ctx, children: RenderElement[]): RenderElement {
  return ctx.els.Box({ flexGrow: 1, flexShrink: 1, minWidth: 0, height: 1, overflow: 'hidden', children: ctx.els.Text({ children }) })
}
