import type { AugmentLevelFilter } from './components'
import type { AugmentRanking, AugmentStage } from '@/utils/augmentRanking'
import { useEffect, useMemo, useState } from 'react'
import { ScrollArea } from 'ui/components'
import { matchPinyinSearch } from 'utils'
import { EmptyState, SearchInput } from '@/components'
import { useGlobalStore } from '@/store/globalStore'
import { AUGMENT_RARITIES, augmentRarity } from '@/utils/augmentAppearance'
import { groupAugmentsByGrade, matchesAugmentStage } from '@/utils/augmentRanking'
import { AugmentCard, AugmentFilter } from './components'

export default function AugmentsPage() {
  const [query, setQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<AugmentLevelFilter>('all')
  const [stage, setStage] = useState<AugmentStage>('all')
  const [ranking, setRanking] = useState<AugmentRanking | null>(null)
  const [loading, setLoading] = useState(true)
  const source = useGlobalStore(s => s.lookups?.augments)
  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => { controller.abort(); setLoading(false) }, 10000)
    fetch(new URL('./api/augmentRanking', document.baseURI), { cache: 'no-store', signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json() })
      .then(doc => {
        if (!doc.success || !Array.isArray(doc.data?.groups)) throw new Error('Invalid ranking')
        if (!controller.signal.aborted) setRanking(doc.data)
      })
      .catch(() => {})
      .finally(() => { window.clearTimeout(timeout); if (!controller.signal.aborted) setLoading(false) })
    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [])
  const all = useMemo(() => (source ?? []).filter(augment => augment.apiName), [source])
  const duplicates = useMemo(() => {
    const counts = new Map<string, number>()
    for (const augment of all) counts.set(augment.apiName!, (counts.get(augment.apiName!) ?? 0) + 1)
    return new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id))
  }, [all])
  const stageRecords = useMemo(() => all.filter(augment => matchesAugmentStage(augment, stage)), [all, stage])
  const counts = useMemo(() => Object.fromEntries([['all', stageRecords.length], ...AUGMENT_RARITIES.map(rarity => [rarity, stageRecords.filter(augment => augmentRarity(augment) === rarity).length])]), [stageRecords])
  const groups = useMemo(() => groupAugmentsByGrade(stageRecords.filter(augment =>
    (levelFilter === 'all' || augmentRarity(augment) === levelFilter) && (!query || matchPinyinSearch(augment.name || '', query))), ranking), [stageRecords, levelFilter, query, ranking])
  const matches = groups.reduce((count, group) => count + group.content.length, 0)
  const season = ranking?.rankingSet.replace('TFTSet', 'S')
  return <div className="kimi-augments-page flex flex-col h-full min-h-0 gap-2 px-2">
    <p className="augment-source-note">MetaTFT · S → A → B → C → D 分组排序</p>
    <p className="augment-ranking-note">{loading ? '正在读取评级…' : ranking?.ratedIds
      ? ranking.isCurrentSet ? 'S19 评级 · 未收录的符文单列未评级'
        : `与官网一致：S19 暂显示 ${season} 榜单；未收录符文单列未评级。`
      : '当前快照暂无评级，全部符文列入未评级。'}</p>
    <div className="catalog-search"><SearchInput placeholder="搜索符文..." onSearchChange={setQuery} /></div>
    <div className="augment-stage-filter" role="group" aria-label="强化出现阶段">
      {(['all', '2-1', '3-2', '4-2'] as AugmentStage[]).map(value => <button type="button" key={value}
        aria-pressed={stage === value} onClick={() => setStage(value)}>{value === 'all' ? '全部阶段' : value}</button>)}
    </div>
    <AugmentFilter levelFilter={levelFilter} onLevelFilterChange={setLevelFilter} counts={counts} />
    <ScrollArea className="flex-1 min-h-0" type="scroll">
      {!matches && <EmptyState message="没有匹配的 S19 强化符文" />}
      <div className="augment-groups">{groups.filter(group => group.content.length || (!query && levelFilter === 'all')).map(({ grade, content }) =>
        <section key={grade} className="augment-grade-group" data-grade={grade}>
          <h2 className="augment-group-heading"><span className="comp-tier" data-tier={grade}>{grade === 'Unrated' ? '?' : grade}</span>
            {grade === 'Unrated' ? '未评级' : grade + ' 级'}<span className="group-count">{content.length}</span></h2>
          {!content.length && <p className="augment-ranking-note">该档暂无匹配符文</p>}
          <div className="augment-card-grid">{content.map((augment, index) =>
            <AugmentCard key={augment.apiName + '-' + grade + '-' + index} id={augment.apiName} record={augment}
              rating={grade === 'Unrated' ? undefined : grade} variant={duplicates.has(augment.apiName!)} />)}</div>
        </section>)}</div>
    </ScrollArea>
  </div>
}
