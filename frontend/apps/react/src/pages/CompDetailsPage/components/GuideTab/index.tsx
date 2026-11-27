import type { DatatftGuide } from 'api-client'
import { getDatatft } from 'api-client'
import { useRequest } from 'react-helper'
import { EmptyState, SkeletonBase } from '@/components'

export interface GuideTabProps {
  compId: string
}

/** dataTFT 的 conditions 是一段 JSON（筛英雄/装备条件），转成可读中文；解析不了就返回空串 */
function formatConditions(raw?: string): string {
  if (!raw || typeof raw !== 'string')
    return ''
  const text = raw.trim()
  if (!text.startsWith('{'))
    return text
  try {
    const obj = JSON.parse(text) as {
      filterOptionResults?: { name?: string, levelValue?: string, equipValue?: string, attackEquipValue?: string }[]
      exclusionFilterOptionResults?: { name?: string }[]
    }
    const parts: string[] = []
    for (const r of obj.filterOptionResults || []) {
      if (!r?.name)
        continue
      const bits = [r.name]
      if (r.levelValue && r.levelValue !== '任意')
        bits.push(`${r.levelValue} 星`)
      if (r.attackEquipValue && r.attackEquipValue !== '任意')
        bits.push(`${r.attackEquipValue} 件攻击装`)
      else if (r.equipValue && r.equipValue !== '任意')
        bits.push(`${r.equipValue} 件装备`)
      parts.push(bits.join('，'))
    }
    const ex = (obj.exclusionFilterOptionResults || []).map(r => r?.name).filter((n): n is string => !!n)
    const out: string[] = []
    if (parts.length) out.push(`需要：${parts.join('；')}`)
    if (ex.length) out.push(`避免：${ex.join('、')}`)
    return out.join('\n')
  }
  catch {
    return ''
  }
}

const SECTIONS: { key: keyof DatatftGuide, label: string }[] = [
  { key: 'core', label: '核心思路' },
  { key: 'open', label: '开局条件' },
  { key: 'early', label: '前期运营' },
  { key: 'mid', label: '中期节奏' },
  { key: 'final', label: '成型后期' },
  { key: 'conditions', label: '克制与注意' },
  { key: 'tips', label: '补充提示' },
]

export default function GuideTab({ compId }: GuideTabProps) {
  const { data, loading } = useRequest(async () => {
    try {
      return await getDatatft()
    }
    catch {
      return null
    }
  }, {
    cacheKey: 'datatft-guides',
    staleTime: 1000 * 60 * 30,
    throwOnError: false,
  })

  if (loading) {
    return (
      <div className="space-y-2 p-1">
        <SkeletonBase className="h-6 w-32" />
        <SkeletonBase className="h-24 w-full" />
        <SkeletonBase className="h-24 w-full" />
      </div>
    )
  }

  const guide = data?.guides?.[compId]
  if (!guide) {
    return <EmptyState message="该阵容暂无攻略（攻略来自 dataTFT，仅覆盖部分阵容）" />
  }

  const stats: { label: string, value: string }[] = []
  // dataTFT 的 playRate 是「该阵容出现在对局中的比例」，与 MetaTFT 的玩家选取率不同口径
  if (typeof guide.playRate === 'number') stats.push({ label: '对局出现率', value: `${(guide.playRate * 100).toFixed(1)}%` })
  if (typeof guide.top4 === 'number') stats.push({ label: '前四率', value: `${guide.top4.toFixed(1)}%` })
  if (typeof guide.won === 'number') stats.push({ label: '登顶率', value: `${guide.won.toFixed(1)}%` })
  if (typeof guide.place === 'number') stats.push({ label: '平均排名', value: guide.place.toFixed(2) })

  return (
    <div className="kimi-guide-tab space-y-3 overflow-y-auto p-1">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm text-[#F1F5FB]">{guide.title}</strong>
        {guide.tier && <span className="kimi-guide-tier">{guide.tier} 级</span>}
        {(guide.tags || []).map((tag: string) => (
          <span key={tag} className="kimi-guide-tag">{tag}</span>
        ))}
      </div>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map(s => (
            <div key={s.label} className="kimi-guide-stat">
              <span>{s.label}</span>
              <strong>{s.value}</strong>
            </div>
          ))}
        </div>
      )}

      {SECTIONS.map((s) => {
        const raw = guide[s.key]
        if (typeof raw !== 'string')
          return null
        const text = s.key === 'conditions' ? formatConditions(raw) : raw.trim()
        if (!text)
          return null
        return (
          <section key={String(s.key)} className="kimi-guide-section">
            <h4>{s.label}</h4>
            <p className="whitespace-pre-line">{text}</p>
          </section>
        )
      })}

      <p className="text-xs text-[#7A889C]">
        攻略数据来自 dataTFT，仅供参考；与 MetaTFT 战绩数据独立统计。
      </p>
    </div>
  )
}
