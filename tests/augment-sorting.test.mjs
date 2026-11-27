import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'

const root = '/root/tft-kimi'
const require = createRequire(root + '/frontend/package.json')
const { build } = require('esbuild')
await fs.mkdir(root + '/tests/generated', { recursive: true })
await build({ entryPoints: [root + '/frontend/apps/react/src/utils/augmentRanking.ts'], bundle: true,
  format: 'esm', platform: 'node', outfile: root + '/tests/generated/augmentRanking.mjs' })
const { groupAugmentsByGrade, matchesAugmentStage } = await import('./generated/augmentRanking.mjs')
const make = (apiName, name, en_name, rarity, rounds = ['2-1']) => ({ apiName, name, en_name, rarity, rounds })
const catalog = [
  make('GOLD', '测试金色', 'Alpha', 'Gold'),
  make('SILVER_Z', '测试白银一', 'Zulu', 'Silver', ['3-2']),
  make('PRISMATIC', '测试棱彩', 'Beta', 'Prismatic', ['4-2']),
  make('SILVER_A', '测试白银二', 'Alpha', 'Silver', ['2-1', '3-2']),
  make('UNRATED', '新增符文', 'New', 'Gold', []),
  make('VARIANT', '变体金色', 'Variant', 'Gold'),
  make('VARIANT', '变体银色', 'Variant', 'Silver', ['4-2']),
]
const ranking = { groups: [
  { label: 'A', content: [{ id: 'GOLD', type: 'augment' }, { id: 'SILVER_A', type: 'augment' }, { id: 'SILVER_Z', type: 'augment' }, { id: 'PRISMATIC', type: 'augment' }] },
  { label: 'S', content: [{ id: 'VARIANT', type: 'augment' }] },
] }
test('grade order is independent of source group order', () => {
  assert.deepEqual(groupAugmentsByGrade(catalog, ranking).map(g => g.grade), ['S', 'A', 'B', 'C', 'D', 'Unrated'])
})
test('within grade follows official rarity and English-name order', () => {
  const group = groupAugmentsByGrade(catalog, ranking).find(g => g.grade === 'A')
  assert.deepEqual(group.content.map(a => a.apiName), ['SILVER_A', 'SILVER_Z', 'GOLD', 'PRISMATIC'])
})
test('same-ID rarity variants are preserved and sorted independently', () => {
  const group = groupAugmentsByGrade(catalog, ranking).find(g => g.grade === 'S')
  assert.deepEqual(group.content.map(a => a.rarity), ['Silver', 'Gold'])
  assert.equal(groupAugmentsByGrade(catalog, ranking).reduce((n, g) => n + g.content.length, 0), catalog.length)
})
test('stage filters honour exact rounds and leave missing rounds only in all', () => {
  assert.equal(matchesAugmentStage(catalog[0], '2-1'), true)
  assert.equal(matchesAugmentStage(catalog[0], '4-2'), false)
  assert.equal(matchesAugmentStage(catalog[3], '3-2'), true)
  assert.equal(matchesAugmentStage(catalog[4], 'all'), true)
  assert.equal(matchesAugmentStage(catalog[4], '2-1'), false)
})
test('no source grade is invented for new augments or an absent list', () => {
  const groups = groupAugmentsByGrade(catalog, ranking)
  assert.deepEqual(groups.find(g => g.grade === 'Unrated').content.map(a => a.apiName), ['UNRATED'])
  assert.equal(groups.find(g => g.grade === 'D').content.length, 0)
  assert.equal(groupAugmentsByGrade(catalog).find(g => g.grade === 'Unrated').content.length, catalog.length)
})
