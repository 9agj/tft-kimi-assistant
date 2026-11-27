import type { FilterGroup } from '@/components'
import type { ItemCategory } from '@/utils/items'
import type { CatalogItem } from '@/utils/catalog'
import { getItems } from 'api-client'
import { useMemo, useState } from 'react'
import { useRequest } from 'react-helper'
import { ScrollArea } from 'ui/components'
import { matchPinyinSearch } from 'utils'
import { DataSkeleton, EmptyState, FilterBar, SearchInput } from '@/components'
import { useGlobalStore } from '@/store/globalStore'
import { compositeSortItems } from '@/utils/compositeSort'
import { getItemCategory } from '@/utils/items'
import { ItemCard } from './components'

type SortField = 'composite' | 'matches' | 'avgPlace'
export default function ItemsPage() {
  const season = useGlobalStore(s => s.curSeason)
  const itemsById = useGlobalStore(s => s.lookupsIndex.itemsById)
  const { data: statistics, loading } = useRequest(async () => (await getItems({ season })).data, {
    refreshDeps: [season], ready: Boolean(season), cacheKey: 'items:' + season, staleTime: 60000,
  })
  const [category, setCategory] = useState<ItemCategory>('core')
  const [sortField, setSortField] = useState<SortField>('composite')
  const [query, setQuery] = useState('')
  const catalog = useMemo<CatalogItem[]>(() => {
    const stats = new Map((statistics ?? []).map(item => [item.itemName, item]))
    return Object.values(itemsById).filter(item => item.apiName).map(item => ({ itemName: item.apiName!, ...stats.get(item.apiName!) }))
  }, [statistics, itemsById])
  const sorted = useMemo(() => {
    const rows = catalog.filter(item => getItemCategory(item.itemName, itemsById) === category && (!query || matchPinyinSearch(itemsById[item.itemName]?.name ?? '', query)))
    let withStats = rows.filter(item => item.avg !== undefined)
    if (sortField === 'composite') withStats = compositeSortItems(withStats)
    else if (sortField === 'matches') withStats.sort((a, b) => (b.pickRate ?? 0) - (a.pickRate ?? 0))
    else withStats.sort((a, b) => a.avg! - b.avg!)
    return [...withStats, ...rows.filter(item => item.avg === undefined)]
  }, [catalog, itemsById, category, query, sortField])
  const groups: FilterGroup[] = [
    { value: category, options: [{ value: 'core', label: '核心' }, { value: 'radiant', label: '光明' }, { value: 'artifact', label: '神器' }, { value: 'emblem', label: '转职' }, { value: 'other', label: '其他' }], onChange: value => setCategory(value as ItemCategory) },
    { value: sortField, options: [{ value: 'composite', label: '综合' }, { value: 'matches', label: '登场' }, { value: 'avgPlace', label: '影响' }], onChange: value => setSortField(value as SortField) },
  ]
  return <div className="flex flex-col h-full min-h-0 gap-1.5 px-2">
    <div className="catalog-search"><SearchInput placeholder="搜索装备 / 拼音…" onSearchChange={setQuery} /></div>
    <p className="kimi-catalog-note">全部 {catalog.length} 件 S19 装备；缺失对局统计的记录保持空缺。</p>
    <FilterBar groups={groups} />
    <ScrollArea className="flex-1 min-h-0" type="scroll">
      <div className="pb-3"><DataSkeleton loading={loading} isEmpty={!sorted.length} empty={<EmptyState message="没有匹配的 S19 装备" />}>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))' }}>
          {sorted.map(item => <ItemCard key={item.itemName} item={item} />)}
        </div>
      </DataSkeleton></div>
    </ScrollArea>
  </div>
}
