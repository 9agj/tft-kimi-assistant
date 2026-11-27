import type { Build } from 'types'
import { memo } from 'react'
import { Champion, EmptyState, Item } from '@/components'
import { useGlobalStore } from '@/store/globalStore'

export interface HeroesBuildTabProps {
  builds: Build[]
}

/**
 * dataTFT 阵容的「英雄」页签。
 * dataTFT 只提供「每个英雄穿哪三件」，没有登场率/平均排名这类统计，
 * 所以这里只列英雄与它的成型装备，不编造任何数值。
 */
export const HeroesBuildTab = memo(({ builds }: HeroesBuildTabProps) => {
  const unitsById = useGlobalStore(s => s.lookupsIndex.unitsById)

  const rows = (builds ?? []).filter(b => b?.unit && Array.isArray(b.buildName) && b.buildName.length > 0)

  if (rows.length === 0)
    return <EmptyState message="dataTFT 未提供英雄装备数据" />

  return (
    <div className="flex flex-col gap-2 px-1 py-2">
      <div className="px-2 py-2 bg-white/5 rounded-lg border border-white/10 text-[10px] sm:text-xs text-gray-400 font-medium">
        英雄成型装备（来自 dataTFT 阵容，不含登场率统计）
      </div>
      {rows.map((b) => {
        const unit = unitsById[b.unit as string]
        return (
          <div
            key={b.unit}
            className="flex items-center gap-3 px-2 py-2 rounded-lg bg-white/5 border border-white/10"
          >
            <Champion id={b.unit as string} className="size-9 shrink-0" showTooltip />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-white/90 truncate">{unit?.name ?? b.unit}</div>
              <div className="mt-1 flex items-center gap-1">
                {(b.buildName ?? []).map(itemName => (
                  <Item key={itemName} id={itemName} className="size-6" showTooltip />
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
})
