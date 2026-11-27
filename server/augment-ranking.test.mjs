import assert from 'node:assert/strict'
import test from 'node:test'
import { transformAugmentRanking, emptyAugmentRanking, AUGMENT_RANKING_URL } from './augment-ranking.mjs'

const lookup = { _metadata: { set: 'TFTSet19' }, augments: [{ apiName: 'ONE' }, { apiName: 'TWO' }, { apiName: 'NEW' }, { apiName: 'ONE' }] }
const document = { tft_set: 'TFTSet19', tier_list_set: 'TFTSet18', queue_id: 'pbe', updated: 1000,
  content: { content: { tierList: [
    { label: 'B', content: [{ id: 'ONE', type: 'augment' }, { id: 'OLD', type: 'augment' }] },
    { label: 'S', content: [{ id: 'TWO', type: 'augment' }, { id: 'ONE', type: 'augment' }, { id: 'TWO', type: 'augment' }] },
  ] } } }

test('actual ranking set overrides outer PBE set', () => {
  const result = transformAugmentRanking(document, lookup)
  assert.equal(result.rankingSet, 'TFTSet18')
  assert.equal(result.isCurrentSet, false)
  assert.equal(result.sourceUpdatedAt, '1970-01-01T00:00:01.000Z')
})
test('official selected-set endpoint and actual list update time are retained', () => {
  const result = transformAugmentRanking({ ...document, content: { ...document.content, updated_at: '2026-11-06T12:16:08.107Z' } }, lookup)
  assert.equal(result.sourceUrl, 'https://api-hc.metatft.com/tft-stat-api/augments_tiers?tft_set=TFTSet19')
  assert.equal(result.sourceUrl, AUGMENT_RANKING_URL)
  assert.equal(result.sourceUpdatedAt, '2026-11-06T12:16:08.107Z')
})
test('grades are canonical, unknown IDs removed and duplicates keep highest grade', () => {
  const result = transformAugmentRanking(document, lookup)
  assert.deepEqual(result.groups.map(g => g.label), ['S', 'A', 'B', 'C', 'D'])
  assert.deepEqual(result.groups[0].content.map(item => item.id), ['TWO', 'ONE'])
  assert.equal(result.ratedIds, 2)
  assert.equal(result.unrankedIds, 1)
  assert.equal(result.groups[2].content.length, 0)
})
test('current set is recognised only with explicit source ranking set', () => {
  assert.equal(transformAugmentRanking({ ...document, tier_list_set: 'TFTSet19' }, lookup).isCurrentSet, true)
  assert.equal(transformAugmentRanking({ ...document, tier_list_set: undefined }, lookup).rankingSet, 'Unknown')
})
test('malformed data and wrong catalogs do not become rankings', () => {
  assert.throws(() => transformAugmentRanking({}, lookup))
  assert.throws(() => transformAugmentRanking(document, { ...lookup, _metadata: { set: 'TFTSet18' } }))
  assert.throws(() => transformAugmentRanking({ content: { content: { tierList: [] } } }, lookup))
  assert.equal(emptyAugmentRanking().ratedIds, 0)
  assert.deepEqual(emptyAugmentRanking().groups.map(g => g.label), ['S', 'A', 'B', 'C', 'D'])
})
