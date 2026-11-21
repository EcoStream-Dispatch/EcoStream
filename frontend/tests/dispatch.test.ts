import { test } from 'node:test'
import assert from 'node:assert/strict'
import { suggestTrucks, type Candidate } from '../src/lib/dispatch'
import type { Driver, TruckSummary } from '../src/types'

const truck = (id: string, axle: TruckSummary['axle_config']): TruckSummary => ({
  id, owner_id: 'o', reg_no: id, make: 'M', model: 'X', axle_config: axle, created_at: '', status: 'ok',
  last_seen_at: new Date().toISOString(), lat: 13, lon: 80, open_alerts: 0, tyres: [],
})
const driver = (id: string, availability: Driver['availability']): Driver => ({ id, name: id, phone: '', licence_expiry: '2030-01-01', score: 80, availability, truck_id: null })
const cand = (c: Partial<Candidate> & { truck: TruckSummary }): Candidate => ({ health: 'ok', addOns: [], driver: null, busyUntil: null, startsAt: [13, 80], ...c })
const need = { weight_t: 12, cold_chain: false, pickup_at: new Date(Date.now() + 86_400_000).toISOString(), from: [13, 80] as [number, number] }

test('critical, too small, busy and no-cold-chain trucks are not suggested', () => {
  const out = suggestTrucks({ ...need, cold_chain: true }, [
    cand({ truck: truck('critical', '14W'), health: 'critical', addOns: ['cold_chain'] }),
    cand({ truck: truck('small', '6W'), addOns: ['cold_chain'] }),
    cand({ truck: truck('busy', '14W'), addOns: ['cold_chain'], busyUntil: new Date(Date.now() + 2 * 86_400_000).toISOString() }),
    cand({ truck: truck('nocold', '14W') }),
    cand({ truck: truck('good', '14W'), addOns: ['cold_chain'] }),
  ], [])
  assert.deepEqual(out.filter((s) => s.ok).map((s) => s.truck.id), ['good'])
  assert.ok(out.find((s) => s.truck.id === 'small')!.problems[0].startsWith('Too small'))
})

test('OK health ranks above warning, closer above farther', () => {
  const out = suggestTrucks(need, [
    cand({ truck: truck('warn', '14W'), health: 'warning' }),
    cand({ truck: truck('far', '14W'), startsAt: [12.97, 79.94] }), // ~40 km away
    cand({ truck: truck('near', '14W') }),
  ], [])
  assert.deepEqual(out.map((s) => s.truck.id), ['near', 'far', 'warn'])
})

test('trade-off: health is worth about 200 km, so a very far OK truck ranks below a nearby warning truck', () => {
  const out = suggestTrucks(need, [
    cand({ truck: truck('warn-near', '14W'), health: 'warning' }),
    cand({ truck: truck('ok-290km', '14W'), startsAt: [11.2, 78.1] }),
  ], [])
  assert.deepEqual(out.map((s) => s.truck.id), ['warn-near', 'ok-290km'])
})

test('a free driver is suggested once; off drivers never', () => {
  const free = driver('free', 'available')
  const out = suggestTrucks(need, [
    cand({ truck: truck('a', '14W'), driver: driver('off', 'off') }),
    cand({ truck: truck('b', '14W') }),
  ], [free, driver('off2', 'off')])
  const drivers = out.map((s) => s.driver?.id ?? null)
  assert.equal(drivers.filter((d) => d === 'free').length, 1)
  assert.ok(!drivers.includes('off') && !drivers.includes('off2'))
})
