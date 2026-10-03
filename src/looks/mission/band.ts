import type { RenderElement } from 'claude-code'

import { clockLabel, printable, splitPath } from '../../engine/format'
import { factsOf } from '../../engine/tool-facts'
import type { BandData, Ctx, UsageData, WaitingData } from '../look'
import { C, NARROW_COLUMNS, TAGS, fixed, gauge, percentLabel, shrinks, txt } from './style'

const WINDOW_LABELS: Record<string, string> = { five_hour: '5H', seven_day: '7D', spend_limit: 'LIMIT' }

/** `16:40`, in the local time of the machine Claude Code runs on; empty for a missing or bad time. */
export function resetLabel(resetsAt: number | undefined): string {
  if (resetsAt === undefined || !Number.isFinite(resetsAt)) return ''
  const d = new Date(resetsAt)
  const h = d.getHours()
  const m = d.getMinutes()
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function windowLabel(kind: string): string {
  return WINDOW_LABELS[kind] ?? (printable(kind, 40).replace(/[^a-z0-9]/gi, '').slice(0, 5).toUpperCase() || 'RATE')
}

/** Each reading as its own group of cells; the band joins them with rails. */
function telemetry(ctx: Ctx, usage: UsageData): RenderElement[][] {
  const wide = ctx.columns >= NARROW_COLUMNS
  const groups: RenderElement[][] = []
  const reading = (label: string, percent: number, extra: RenderElement[] = []): RenderElement[] => [
    txt(ctx, C.teal, label),
    ...(wide ? [gauge(ctx, percent)] : []),
    txt(ctx, percent >= 90 ? C.err : C.text, percentLabel(percent)),
    ...extra,
  ]
  if (usage.contextPercent !== undefined && Number.isFinite(usage.contextPercent)) groups.push(reading('CTX', usage.contextPercent))
  for (const limit of usage.rateLimits) {
    if (!Number.isFinite(limit.percentUsed)) continue
    const reset = resetLabel(limit.resetsAt)
    groups.push(reading(windowLabel(limit.kind), limit.percentUsed, reset === '' ? [] : [txt(ctx, C.dim, `↻ ${reset}`)]))
  }
  if (usage.costUsd !== undefined && Number.isFinite(usage.costUsd)) groups.push([txt(ctx, C.teal, 'SPEND'), txt(ctx, C.text, `$${usage.costUsd.toFixed(2)}`)])
  return groups
}

/** `◉ HOLD AWAITING OPERATOR · EXEC rm -rf build · 0:14`. */
function hold(ctx: Ctx, waiting: WaitingData): RenderElement {
  const facts = factsOf(waiting.tool, waiting.input)
  const { dir, base } = facts.isPath ? splitPath(facts.target, ctx.cwd) : { dir: '', base: facts.target }
  const what = facts.glyph === 'other' ? `${facts.verb} ${base}`.trim() : `${dir}${base}`
  return ctx.els.Box({
    flexDirection: 'row',
    columnGap: 1,
    children: [
      fixed(ctx, [txt(ctx, C.amber, '◉', { bold: true })]),
      fixed(ctx, [txt(ctx, C.amber, 'HOLD', { bold: true })]),
      fixed(ctx, [txt(ctx, C.amber, ctx.settings.ingredients.inator ? 'YOUR MOVE, EVIL GENIUS' : 'AWAITING OPERATOR')]),
      fixed(ctx, [txt(ctx, C.faint, '·')]),
      shrinks(ctx, ctx.els.Text({ wrap: 'truncate-end', children: [txt(ctx, C.teal, TAGS[facts.glyph]), txt(ctx, C.text, what === '' ? '' : ' ' + what)] })),
      fixed(ctx, [txt(ctx, C.faint, '·')]),
      fixed(ctx, [txt(ctx, C.amber, clockLabel(waiting.waitedMs))]),
    ],
  })
}

/** Mission Control owns the band: one line of telemetry, or a hold while a call waits on you. */
export function band(data: BandData, ctx: Ctx): RenderElement | null {
  if (data.waiting) return hold(ctx, data.waiting)
  if (!data.usage) return null
  const groups = telemetry(ctx, data.usage)
  if (groups.length === 0) return null
  const children: RenderElement[] = []
  groups.forEach((g, i) => {
    if (i > 0) children.push(txt(ctx, C.faint, '│'))
    children.push(...g)
  })
  // One line, always: a narrow body clips the last readings rather than wrapping.
  return ctx.els.Box({ flexDirection: 'row', columnGap: 1, height: 1, overflow: 'hidden', children })
}
