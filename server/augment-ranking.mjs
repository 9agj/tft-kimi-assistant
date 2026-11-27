export const AUGMENT_GRADES = ['S', 'A', 'B', 'C', 'D']
export const AUGMENT_RANKING_URL = 'https://api-hc.metatft.com/tft-stat-api/augments_tiers?tft_set=TFTSet19'

export function transformAugmentRanking(doc, lookup, fetchedAt = new Date().toISOString()) {
  const sourceGroups = doc?.content?.content?.tierList
  if (!Array.isArray(sourceGroups)) throw new Error('Missing augment tier list')
  const catalogSet = lookup?._metadata?.set
  if (catalogSet !== 'TFTSet19') throw new Error('Expected S19 augment catalog')
  const known = new Set((lookup.augments ?? []).map(a => a.apiName).filter(Boolean))
  const seen = new Set()
  const groups = AUGMENT_GRADES.map(label => ({ label, content: [] }))
  for (const group of groups) {
    for (const source of sourceGroups.filter(row => row.label === group.label)) {
      for (const item of Array.isArray(source.content) ? source.content : []) {
        if (item?.type !== 'augment' || !known.has(item.id) || seen.has(item.id)) continue
        seen.add(item.id)
        group.content.push({ id: item.id, type: 'augment' })
      }
    }
  }
  if (!seen.size) throw new Error('Ranking contains no current-catalog augments')
  // The tier-list set is authoritative; the outer PBE set can differ.
  const rankingSet = typeof doc.tier_list_set === 'string' ? doc.tier_list_set : 'Unknown'
  const updated = Number(doc.updated)
  const contentUpdated = Date.parse(doc.content?.updated_at ?? '')
  return {
    source: 'MetaTFT', sourceUrl: AUGMENT_RANKING_URL, catalogSet, rankingSet, responseSet: doc.tft_set ?? null,
    queue: doc.queue_id ?? null, isCurrentSet: rankingSet === catalogSet,
    fetchedAt, sourceUpdatedAt: Number.isFinite(contentUpdated) ? new Date(contentUpdated).toISOString()
      : Number.isFinite(updated) && updated > 0 ? new Date(updated).toISOString() : null,
    ratedIds: seen.size, unrankedIds: [...known].filter(id => !seen.has(id)).length,
    groups,
  }
}

export function emptyAugmentRanking() {
  return {
    source: 'MetaTFT', catalogSet: 'TFTSet19', rankingSet: 'Unknown',
    isCurrentSet: false, ratedIds: 0,
    groups: AUGMENT_GRADES.map(label => ({ label, content: [] })),
  }
}
