/**
 * A drawn tree's text as it reads: its strings and button labels, in order.
 */
export function textOf(tree: unknown): string {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree)
  if (Array.isArray(tree)) return tree.map(textOf).join('')
  if (typeof tree !== 'object' || !tree) return ''
  const props: unknown = Reflect.get(tree, 'props')
  const label = typeof props === 'object' && props ? Reflect.get(props, 'label') : undefined
  const lead = typeof label === 'string' ? label : ''
  return lead + textOf(Reflect.get(tree, 'children') ?? (typeof props === 'object' && props ? Reflect.get(props, 'children') : []) ?? [])
}
