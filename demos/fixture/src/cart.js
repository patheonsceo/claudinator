// A tiny cart with a planted bug: quantities are ignored.
export function total(items, discount = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  return Math.round(subtotal * (1 - discount) * 100) / 100
}
