import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CORRIDOR, kmAlong, placeName, plannedRoute, pointAtKm, routeLengthKm, townsOnRoute } from '../src/lib/route'

const at = (name: string) => CORRIDOR.find((c) => c.name === name)!.at

test('route Chennai -> Salem passes the corridor towns in order', () => {
  const r = plannedRoute(at('Chennai'), at('Salem'))
  assert.deepEqual(townsOnRoute(r), ['Chennai', 'Sriperumbudur', 'Vellore', 'Vaniyambadi', 'Krishnagiri', 'Dharmapuri', 'Salem'])
})

test('route works in the other direction too', () => {
  const r = plannedRoute(at('Namakkal'), at('Vellore'))
  assert.deepEqual(townsOnRoute(r), ['Namakkal', 'Salem', 'Dharmapuri', 'Krishnagiri', 'Vaniyambadi', 'Vellore'])
})

test('route length is straight-line legs between towns (sane range)', () => {
  const km = routeLengthKm(plannedRoute(at('Chennai'), at('Salem')))
  assert.ok(km > 280 && km < 340, `got ${km}`)
})

test('kmAlong and pointAtKm agree', () => {
  const r = plannedRoute(at('Chennai'), at('Namakkal'))
  const p = pointAtKm(r, 150)
  assert.ok(Math.abs(kmAlong(r, p) - 150) < 1)
})

test('placeName says "near" a town, or the distance from it', () => {
  assert.equal(placeName(at('Salem')), 'near Salem')
  assert.match(placeName([12.0, 78.15]), /km from Dharmapuri/)
})
