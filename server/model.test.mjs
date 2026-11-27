import assert from 'node:assert/strict'
import test from 'node:test'
import { requireSet, placementStats, transformComps, transformDetail, deriveUnitItems } from './model.mjs'

test('rejects S18 and missing metadata', () => {
  assert.throws(() => requireSet({ tft_set: 'TFTSet18' }))
  assert.throws(() => requireSet({}))
  assert.equal(requireSet({ tft_set: 'TFTSet19' }).tft_set, 'TFTSet19')
})
test('rates use the first eight places, not the ninth total twice', () => {
  const s = placementStats([1, 1, 1, 1, 1, 1, 1, 1, 8], 80)
  assert.equal(s.avg, 4.5)
  assert.equal(s.top4Rate, 50)
  assert.equal(s.firstRate, 12.5)
  assert.equal(s.pickRate, 10)
})
const lk = { units: [{ apiName: 'S19_A' }, { apiName: 'S19_B' }], items: [{ apiName: 'ITEM' }], traits: [] }
test('duplicate preferred cells are resolved and old units are filtered', () => {
  const comp = { id: 11, clusterId: 1, units: ['S19_A', 'S19_B'] }
  const d = transformDetail({ tft_set: 'TFTSet19', cluster_id: 1, results: {
    cluster: '11', positioning: { units: {
      S19_A: { positions: [{ cell: 'cell_25', count: 100 }] },
      S19_B: { positions: [{ cell: 'cell_25', count: 50 }, { cell: 'cell_24', count: 40 }] },
    } }, options: { 8: [{ units_list: 'S19_A&S18_X' }, { units_list: 'S19_A&S19_B' }] },
    itemNames: [{ itemNames: 'ITEM', units: [{ units: 'S18_X' }, { units: 'S19_A', count: 3 }] }],
  } }, comp, lk)
  assert.deepEqual(d.positioning.map(p => p.position), [25, 24])
  assert.equal(d.options[8].length, 1)
  assert.equal(d.item[0].units.length, 1)
  assert.equal(deriveUnitItems([d]).units.S19_A.items[0].itemName, 'ITEM')
  assert.equal(deriveUnitItems([d]).units.S18_X, undefined)
})
test('comp pool rejects unsupported units and stale detail clusters', () => {
  const raw = { tft_set: 'TFTSet19', results: { data: { cluster_id: 1, cluster_details: {
    11: { units_string: 'S19_A' }, 12: { units_string: 'S18_X' },
  } } } }
  const stats = { tft_set: 'TFTSet19', results: [{ cluster: '', places: [80] }, { cluster: '11', places: [1,1,1,1,1,1,1,1] }] }
  assert.equal(transformComps(raw, stats, lk).length, 1)
  assert.throws(() => transformDetail({ tft_set: 'TFTSet19', cluster_id: 2, results: {} }, { clusterId: 1 }, lk))
})
