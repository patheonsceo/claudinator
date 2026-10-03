import assert from 'node:assert/strict'
import { test } from 'node:test'

import { total } from '../src/cart.js'

test('quantities count', () => {
  assert.equal(total([{ price: 10, qty: 2 }, { price: 5, qty: 1 }]), 25)
})

test('a discount applies to the whole cart', () => {
  assert.equal(total([{ price: 10, qty: 2 }], 0.1), 18)
})
