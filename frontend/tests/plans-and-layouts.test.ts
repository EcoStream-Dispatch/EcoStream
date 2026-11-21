import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PARAMS, PLANS, availability, monthlyPrice } from '../src/data/plans'
import { AXLE_LAYOUTS, positionName, positionsFor } from '../src/lib/tyreLayout'
import { truckHealth } from '../src/lib/status'
import { leakRate } from '../src/lib/leak'
import { psiToKpa } from '../src/lib/units'
import type { Reading, TruckSummary } from '../src/types'

test('prices from the spec: Lite 299 (list 399), Pro 499, Fleet 899; annual -10%', () => {
  const [lite, pro, fleet] = PLANS
  assert.deepEqual([lite.price, lite.listPrice, pro.price, fleet.price], [299, 399, 499, 899])
  assert.equal(monthlyPrice(pro, true), 449)
})

test('plan tiers: Lite < Pro < Fleet, add-ons never "included"', () => {
  const engine = PARAMS.find((p) => p.key === 'coolant_temp')!
  const payload = PARAMS.find((p) => p.key === 'payload_estimate')!
  const door = PARAMS.find((p) => p.key === 'cargo_door')!
  assert.deepEqual(['lite', 'pro', 'fleet'].map((p) => availability(engine, p as 'lite')), ['no', 'included', 'included'])
  assert.deepEqual(['lite', 'pro', 'fleet'].map((p) => availability(payload, p as 'lite')), ['no', 'no', 'included'])
  assert.equal(availability(door, 'fleet'), 'addon')
  assert.ok(PARAMS.filter((p) => p.group === 'Tyres').every((p) => availability(p, 'lite') === 'included'))
  assert.equal(new Set(PARAMS.map((p) => p.key)).size, PARAMS.length, 'keys are unique')
})

test('wheel layouts have the right number of unique tyre positions', () => {
  for (const [config, n] of [['6W', 6], ['10W', 10], ['12W', 12], ['14W', 14], ['18W', 18]] as const) {
    const pos = positionsFor(config)
    assert.equal(pos.length, n, config)
    assert.equal(new Set(pos).size, n, `${config} unique`)
  }
  assert.deepEqual(positionsFor('6W'), ['FL', 'FR', 'RL-O', 'RL-I', 'RR-I', 'RR-O'])
  assert.equal(AXLE_LAYOUTS['18W'].filter((a) => a.group === 'trailer').length, 2)
  assert.equal(positionName('T2R-I'), 'Trailer axle 2 right, inner')
  assert.equal(positionName('RL-O'), 'Rear left, outer')
})

test('a truck with no data for over 30 min shows Offline', () => {
  const base = { status: 'ok' } as TruckSummary
  const now = Date.now()
  assert.equal(truckHealth({ ...base, last_seen_at: new Date(now - 10 * 60_000).toISOString() }, now), 'ok')
  assert.equal(truckHealth({ ...base, last_seen_at: new Date(now - 31 * 60_000).toISOString() }, now), 'offline')
  assert.equal(truckHealth({ ...base, last_seen_at: null }, now), 'offline')
})

test('leak rate: 3 psi/hour falling is measured as about -3', () => {
  const now = Date.now()
  const rows: Reading[] = Array.from({ length: 30 }, (_, i) => {
    const minAgo = 29 - i
    return { id: i, tyre_id: 't', ts: new Date(now - minAgo * 60_000).toISOString(), pressure_kpa: 0, temp_c: 50, ambient_c: null, lat: null, lon: null, rssi: null,
      corrected_kpa: 830 - psiToKpa(3) * ((29 - minAgo) / 60) }
  })
  assert.ok(Math.abs(leakRate(rows, now)! + 3) < 0.05)
  assert.equal(leakRate(rows.slice(0, 3), now), null)
})
