import type { AugmentClass } from 'types'
import { AUGMENT_RARITIES, augmentRarity } from './augmentAppearance'
export const AUGMENT_GRADES = ['S', 'A', 'B', 'C', 'D'] as const
export type AugmentGrade = typeof AUGMENT_GRADES[number]
export type AugmentStage = 'all' | '2-1' | '3-2' | '4-2'
export interface AugmentRanking {
  source: string
  sourceUrl?: string
  catalogSet: string
  rankingSet: string
  isCurrentSet: boolean
  ratedIds: number
  sourceUpdatedAt?: string | null
  cached?: boolean
  groups: { label: string, content: { id: string, type?: string }[] }[]
}
export function matchesAugmentStage(record: AugmentClass, stage: AugmentStage): boolean {
  return stage === 'all' || Boolean((record as AugmentClass & { rounds?: string[] }).rounds?.includes(stage))
}
function compareWebsiteOrder(a: AugmentClass, b: AugmentClass): number {
  const rarity = AUGMENT_RARITIES.indexOf(augmentRarity(a)) - AUGMENT_RARITIES.indexOf(augmentRarity(b))
  if (rarity) return rarity
  // The official view sorts the English source names before browser translation.
  const sourceName = (record: AugmentClass) => (record as AugmentClass & { en_name?: string }).en_name || record.name || record.apiName || ''
  return sourceName(a).localeCompare(sourceName(b), 'en')
}
export function groupAugmentsByGrade(all: AugmentClass[], ranking?: AugmentRanking | null) {
  const order = new Map<string, { grade: AugmentGrade, index: number }>()
  for (const grade of AUGMENT_GRADES) {
    for (const [index, item] of (ranking?.groups.find(g => g.label === grade)?.content ?? []).entries()) {
      if (item.type === 'augment' && !order.has(item.id)) order.set(item.id, { grade, index })
    }
  }
  return [...AUGMENT_GRADES, 'Unrated' as const].map(grade => ({
    grade, content: all.map((record, position) => ({ record, position, rank: order.get(record.apiName ?? '') }))
      .filter(row => (row.rank?.grade ?? 'Unrated') === grade)
      .sort((a, b) => compareWebsiteOrder(a.record, b.record) || a.position - b.position)
      .map(row => row.record),
  }))
}
