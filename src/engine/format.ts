/** Calls at or above this many milliseconds count as slow. */
export const SLOW_MS = 3000

/** Splits a path into its folder and file name, relative to `cwd` when inside it. Always printable. */
export function splitPath(path: string, cwd = ''): { dir: string; base: string } {
  const root = cwd === '' ? '' : cwd.endsWith('/') ? cwd : cwd + '/'
  const clean = printable(path, 1000)
  const p = root !== '' && clean.startsWith(root) ? clean.slice(root.length) : clean
  const i = p.lastIndexOf('/')
  return i < 0 ? { dir: '', base: p } : { dir: p.slice(0, i + 1), base: p.slice(i + 1) }
}

/** `0.2s`, `3.8s`, `42s`, `2m 14s`. Empty for a value that is not a duration. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  if (ms < 10_000) return (Math.round(ms / 100) / 10).toFixed(1) + 's'
  const total = Math.round(ms / 1000)
  if (total < 60) return `${total}s`
  const m = Math.floor(total / 60)
  const s = total % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

/** `m:ss`, for the live line's stopwatch. */
export function clockLabel(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Width of the duration hairline, 1 to 8 cells. */
export function durationBarWidth(ms: number): number {
  return Math.min(8, Math.max(1, Math.round(ms / 550)))
}

/** `1 file`, `3 files`. */
export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, Math.max(0, max - 1)) + '…' : text
}

// Terminal escape sequences: OSC (titles, hyperlinks) and CSI (colors, cursor moves).
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g
const CSI = /\x1b\[[0-?]*[ -/]*[@-~]/g
const OTHER_ESC = /\x1b[@-_]?/g

/**
 * Text that is safe to draw: no escape sequences or control characters, tabs
 * as two spaces, at most `max` characters. Claude Code refuses a drawing whose
 * text holds a control character or runs past 10,000 characters.
 */
export function printable(text: string, max: number, options: { keepNewlines?: boolean } = {}): string {
  let out = text.replace(OSC, '').replace(CSI, '').replace(OTHER_ESC, '').replace(/\t/g, '  ').replace(/\r\n?/g, '\n')
  out = options.keepNewlines ? out.replace(/[\x00-\x09\x0b-\x1f\x7f]/g, '') : out.replace(/\n/g, ' ').replace(/[\x00-\x1f\x7f]/g, '')
  return clip(out, max)
}

/** The first non-empty line, made printable and cut to `max` characters. */
export function oneLine(text: string, max: number): string {
  const line = text.split(/\r?\n/).map(l => printable(l, Number.MAX_SAFE_INTEGER).trim()).find(l => l !== '') ?? ''
  return clip(line, max)
}

/** The last non-empty line, made printable and cut to `max` characters. */
export function lastLine(text: string, max: number): string {
  const lines = text.split(/\r?\n/).map(l => printable(l, Number.MAX_SAFE_INTEGER).trim()).filter(l => l !== '')
  return clip(lines[lines.length - 1] ?? '', max)
}
