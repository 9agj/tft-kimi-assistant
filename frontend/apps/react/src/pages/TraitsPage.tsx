import { useMemo, useState } from 'react'
import { matchPinyinSearch } from 'utils'
import { SearchInput, Trait, Champion } from '@/components'
import { useGlobalStore } from '@/store/globalStore'
import { resolveDescription } from '@/utils/description'

export function TraitsPage() {
  const [query, setQuery] = useState('')
  const lookups = useGlobalStore(s => s.lookups)
  const units = lookups?.units ?? []
  const traits = useMemo(() => (lookups?.traits ?? []).filter(t => matchPinyinSearch(t.name || '', query)), [lookups, query])
  return <div className="kimi-traits-page">
    <div className="kimi-search-panel"><SearchInput placeholder="搜索羁绊 / 拼音…" onSearchChange={setQuery} /></div>
    <div className="kimi-scroll-content">
      {traits.map(t => <details className="kimi-trait-card" key={t.apiName}>
        <summary><span className="kimi-trait-heading"><Trait id={t.apiName || ''} showTooltip={false} />{t.name}</span><span>查看效果与弈子</span></summary>
        <p>{resolveDescription(t)}</p>
        <div className="kimi-breakpoints">{t.effects?.map((effect, index) => <span key={index}>{effect.minUnits} 弈子</span>)}</div>
        <div className="kimi-trait-units">{units.filter(u => u.traits?.includes(t.name || '')).map(u => <Champion key={u.apiName} id={u.apiName || ''} showName className="size-10" />)}</div>
      </details>)}
      {!traits.length && <p className="kimi-empty-note">没有匹配的 S19 羁绊</p>}
    </div>
  </div>
}
