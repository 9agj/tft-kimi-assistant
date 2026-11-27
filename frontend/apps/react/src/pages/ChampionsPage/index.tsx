import type { ChampionCostFilter, ChampionSortField } from './components'
import type { CatalogUnit } from '@/utils/catalog'
import { getUnits } from 'api-client'
import { useMemo, useState } from 'react'
import { useRequest } from 'react-helper'
import { ScrollArea } from 'ui'
import { matchPinyinSearch } from 'utils'
import { DataSkeleton, EmptyState, SearchInput } from '@/components'
import { useGlobalStore } from '@/store/globalStore'
import { ChampionFilter, UnitCard } from './components'
import { sortChampions } from './helper'

export default function ChampionsPage() {
  const [costFilter, setCostFilter] = useState<ChampionCostFilter>('all')
  const [sortField, setSortField] = useState<ChampionSortField>('composite')
  const [query, setQuery] = useState('')
  const [showSpecial, setShowSpecial] = useState(false)
  const season = useGlobalStore(s => s.curSeason)
  const unitsById = useGlobalStore(s => s.lookupsIndex.unitsById)
  const { data: statistics, loading } = useRequest(async () => (await getUnits({ season })).data, {
    cacheKey: 'units:' + season, staleTime: 60000, refreshDeps: [season], ready: Boolean(season),
  })
  const catalog = useMemo<CatalogUnit[]>(() => {
    const stats = new Map((statistics ?? []).map(unit => [unit.unit, unit]))
    return Object.values(unitsById).filter(unit => unit.apiName).map(unit => ({ unit: unit.apiName!, ...stats.get(unit.apiName!) }))
  }, [statistics, unitsById])
  const filtered = useMemo(() => {
    const rows = catalog.filter(unit => {
      const meta = unitsById[unit.unit] as { shopUnit?: boolean, name?: string, cost?: number, traits?: string[] }
      if (!showSpecial && !meta.shopUnit) return false
      if (costFilter !== 'all' && (costFilter === '5' ? (meta.cost ?? 0) < 5 : meta.cost !== Number(costFilter))) return false
      return !query || [meta.name, ...(meta.traits ?? [])].some(name => matchPinyinSearch(name ?? '', query))
    })
    const withStats = sortChampions(rows.filter(unit => unit.avg !== undefined), sortField)
    const missing = rows.filter(unit => unit.avg === undefined).sort((a, b) => a.unit.localeCompare(b.unit))
    return [...withStats, ...missing]
  }, [catalog, unitsById, costFilter, sortField, query, showSpecial])
  return <div className="flex flex-col h-full min-h-0 gap-1.5 px-2">
    <div className="catalog-search"><SearchInput placeholder="搜索英雄 / 羁绊 / 拼音…" onSearchChange={setQuery} /></div>
    <div className="kimi-catalog-tools"><span>{filtered.length} 条 S19 弈子记录</span><button onClick={() => setShowSpecial(!showSpecial)} aria-pressed={showSpecial}>{showSpecial ? '仅可购买弈子' : '包含特殊单位'}</button></div>
    <ChampionFilter costFilter={costFilter} onCostFilterChange={setCostFilter} sortField={sortField} onSortFieldChange={setSortField} />
    <ScrollArea className="flex-1 min-h-0" type="scroll">
      <div className="pb-3"><DataSkeleton loading={loading} isEmpty={!filtered.length} empty={<EmptyState message="没有匹配的 S19 弈子" />}>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))' }}>
          {filtered.map(unit => <UnitCard key={unit.unit} unit={unit} />)}
        </div>
      </DataSkeleton></div>
    </ScrollArea>
  </div>
}
