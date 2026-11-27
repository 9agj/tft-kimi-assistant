export const SET = 'TFTSet19'

export function requireSet(doc) {
  const set = doc?._metadata?.set ?? doc?.tft_set ?? doc?.results?.data?.tft_set
  if (set !== SET) throw new Error(`Expected ${SET}, received ${set}`)
  return doc
}

export function placementStats(places, totalMatches, fallback) {
  const top8 = (places ?? []).slice(0, 8)
  const count = fallback > 0 ? fallback : top8.reduce((a, b) => a + b, 0)
  if (!count) return undefined
  return {
    count,
    avg: top8.reduce((a, b, i) => a + b * (i + 1), 0) / count,
    firstRate: (top8[0] ?? 0) / count * 100,
    top4Rate: top8.slice(0, 4).reduce((a, b) => a + b, 0) / count * 100,
    pickRate: totalMatches > 0 ? count / totalMatches * 100 : undefined,
  }
}

export function transformComps(raw, stats, lookups) {
  requireSet(raw)
  requireSet(stats)
  const valid = new Set(lookups.units.map(u => u.apiName))
  const knownTraits = new Set(lookups.traits.map(t => t.apiName))
  const details = raw.results?.data?.cluster_details ?? {}
  const clusterId = raw.results?.data?.cluster_id
  if (!clusterId || !Object.keys(details).length) throw new Error('Empty S19 comp pool')
  const total = stats.results?.find(s => s.cluster === '')?.places?.[0]
  if (!total) throw new Error('Missing population denominator')
  const byCluster = new Map(stats.results.filter(s => s.cluster).map(s => [String(s.cluster), s]))
  return Object.entries(details).flatMap(([id, d]) => {
    const units = (d.units_string ?? '').split(',').map(s => s.trim()).filter(Boolean)
    if (!units.length || units.some(u => !valid.has(u))) return []
    const row = byCluster.get(id)
    const rates = placementStats(row?.places, total, row?.count)
    if (!rates) return []
    const traits = (d.traits_string ?? '').split(',').map(s => s.trim()).filter(s => knownTraits.has(s.replace(/_\d+$/, '')))
    return [{
      compId: `comp_19_${clusterId}_${id}_pbe`, clusterId, id: Number(id),
      units, traits, name: d.name ?? [], ...rates,
      builds: (d.builds ?? []).filter(b => valid.has(b.unit)),
      stars: (d.stars ?? []).filter(u => valid.has(u)),
      stars_4: (d.stars_4 ?? []).filter(u => valid.has(u)),
      levelling: d.levelling,
      updatedAt: new Date(raw.updated ?? Date.now()).toISOString(),
    }]
  }).sort((a, b) => a.avg - b.avg)
}

export function transformDetail(raw, comp, lookups) {
  requireSet(raw)
  if (Number(raw.cluster_id) !== Number(comp.clusterId)) throw new Error('Stale cluster response')
  const r = raw.results
  if (!r || Number(r.cluster) !== comp.id) throw new Error('Empty or mismatched comp detail')
  const validUnits = new Set(lookups.units.map(u => u.apiName))
  const validItems = new Set(lookups.items.map(i => i.apiName))
  const candidates = Object.fromEntries(comp.units.map(unit => [unit,
    (r.positioning?.units?.[unit]?.positions ?? [])
      .map(p => ({ position: Number(String(p.cell).replace('cell_', '')), count: p.count ?? 0 }))
      .filter(p => p.position >= 1 && p.position <= 28)
      .sort((a, b) => b.count - a.count),
  ]))
  const used = new Set()
  const positioning = []
  const ordered = [...comp.units].sort((a, b) => (candidates[b]?.[0]?.count ?? 0) - (candidates[a]?.[0]?.count ?? 0))
  for (const unit of ordered) {
    const p = candidates[unit]?.find(p => !used.has(p.position))
    if (p) { used.add(p.position); positioning.push({ unit, position: p.position }) }
  }
  // A row belongs to S19 only when every referenced unit is in this lookup.
  const options = (src, late) => Object.fromEntries(Object.entries(src ?? {}).map(([level, rows]) => [level,
    rows.flatMap(row => {
      const names = String(late ? row.units_list : row.unit_list).split('&')
      return names.length && names.every(u => validUnits.has(u))
        ? [{ unit_list: names.join('&'), count: row.count, avg: row.avg, win: row.win }] : []
    }),
  ]))
  const item = (r.itemNames ?? []).filter(i => validItems.has(i.itemNames)).map(i => ({
    ...i, units: (i.units ?? []).filter(u => validUnits.has(u.units)),
  }))
  const trendRows = [...(r.trends ?? [])].sort((a, b) => String(a.day).localeCompare(String(b.day))).slice(-3)
  const change = trendRows.length > 1 ? (trendRows.at(-1).avg - trendRows[0].avg) / (trendRows.length - 1) : 0
  return {
    id: comp.id, final_level: r.final_levels ?? [], item, positioning,
    positioningCandidates: candidates,
    positioningComplete: positioning.length === comp.units.length,
    options: options(r.options, true), early_options: options(r.early_options, false),
    builds: (r.builds ?? []).filter(b => validUnits.has(b.unit) && (b.buildName ?? []).every(i => validItems.has(i))),
    counters: r.counters ?? [], trends: change < -0.1 ? 'up' : change > 0.1 ? 'down' : 'steady',
    sourceUpdatedAt: new Date(raw.updated ?? Date.now()).toISOString(),
  }
}

export function transformCatalog(raw, lookups, kind) {
  requireSet(raw)
  const field = kind === 'units' ? 'unit' : 'itemName'
  const allowed = new Set(lookups[kind].map(x => x.apiName))
  const total = raw.games?.[0]?.count
  return (raw.results ?? []).filter(x => allowed.has(x[field])).flatMap(x => {
    const rates = placementStats(x.places, total)
    return rates ? [{ [field]: x[field], ...rates }] : []
  })
}

export function deriveUnitItems(details) {
  const perUnit = new Map()
  const perItem = new Map()
  for (const d of details) for (const i of d.item ?? []) for (const u of i.units ?? []) {
    const key = `${u.units}|${i.itemNames}`
    const previous = perUnit.get(key)
    if (!previous || (u.count ?? 0) > previous.count) perUnit.set(key, { unit: u.units, itemName: i.itemNames, count: u.count ?? 0 })
  }
  const units = {}
  for (const row of [...perUnit.values()].sort((a, b) => b.count - a.count)) {
    units[row.unit] ??= { unit: row.unit, items: [], source: 'S19 comp_details' }
    units[row.unit].items.push({ itemName: row.itemName })
    perItem.set(row.itemName, [...(perItem.get(row.itemName) ?? []), { unit: row.unit }])
  }
  return { tft_set: SET, queue_id: 'pbe', units,
    itemNames: Object.fromEntries([...perItem].map(([id, units]) => [id, { itemName: id, units }])),
    provenance: 'S19 comp_details itemNames; recommendation ordering, not independent match statistics',
  }
}
