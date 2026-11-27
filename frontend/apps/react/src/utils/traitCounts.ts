import type { LookupsUnit, Trait } from 'types'

interface UnitWithTraits extends LookupsUnit { traitApiNames?: string[] }
export interface CountedTrait {
  id: string
  name: string
  count: number
  threshold: number
  sourceThreshold: boolean
}

export function countCompTraits(ids: string[], rawTraits: string[], units: Record<string, LookupsUnit>, traits: Record<string, Trait>): CountedTrait[] {
  const counts = new Map<string, number>()
  for (const id of new Set(ids)) {
    const unit = units[id] as UnitWithTraits | undefined
    if (!unit) continue
    const membership = unit.traitApiNames?.length ? unit.traitApiNames : Object.values(traits)
      .filter(trait => (trait.name && unit.traits?.includes(trait.name)) || trait.units?.some(member => member.unit === id))
      .map(trait => trait.apiName!)
    for (const traitId of new Set(membership)) counts.set(traitId, (counts.get(traitId) ?? 0) + 1)
  }
  const output = new Map<string, CountedTrait>()
  for (const raw of rawTraits) {
    const match = raw.match(/^(.*)_(\d+)$/)
    const id = match?.[1] ?? raw
    const trait = traits[id]
    if (!trait) continue
    const natural = counts.get(id) ?? 0
    const effects = [...(trait.effects ?? [])].sort((a, b) => (a.minUnits ?? 0) - (b.minUnits ?? 0))
    const sourceEffect = match ? trait.effects?.[Number(match[2]) - 1] : undefined
    const threshold = sourceEffect?.minUnits ?? effects.filter(effect => (effect.minUnits ?? Infinity) <= natural).at(-1)?.minUnits ?? 0
    // Preserve a source activation threshold when emblems or special bonuses are absent from the unit list.
    const count = Math.max(natural, threshold)
    if (count > 0) output.set(id, { id, name: trait.name || id, count, threshold, sourceThreshold: threshold > natural })
  }
  return [...output.values()]
}
