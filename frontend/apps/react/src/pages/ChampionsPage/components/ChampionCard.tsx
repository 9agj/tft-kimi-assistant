import type { CatalogUnit } from '@/utils/catalog'
import { memo } from 'react'
import { Champion, Impact } from '@/components'
import { UnitDetailPopover } from './ChampionDetailPopover'

interface UnitCardProps {
  unit: CatalogUnit
}

export const UnitCard = memo(({ unit }: UnitCardProps) => {
  return (
    <UnitDetailPopover unit={unit}>
      <div data-unit-id={unit.unit} className="group relative overflow-hidden rounded-lg border border-white/5 bg-linear-to-br from-white/[0.07] to-white/2 p-2 transition-all hover:border-white/10 hover:from-white/12 hover:to-white/5 hover:shadow-lg hover:shadow-black/20 cursor-pointer">
        <div className="flex justify-center mb-2">
          <Champion
            wrapperClassName="flex-col gap-1"
            className="size-8"
            id={unit.unit}
            showTooltip={false}
            renderExtra={innerChampion => (
              <div className="flex flex-col items-center justify-center gap-1 w-full">
                <div className="text-center text-xs font-medium text-white truncate w-full">
                  {innerChampion.name}
                </div>
                {unit.avg !== undefined && (
                  <div className="leading-2.5">
                    <span className="text-[10px] text-gray-400">影响: </span>
                    <Impact avgRank={unit.avg} className="text-[10px]" />
                  </div>
                )}
                {unit.avg === undefined && <span className="kimi-catalog-note">暂无统计</span>}
              </div>
            )}
          />
        </div>

        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent" />
        </div>
      </div>
    </UnitDetailPopover>
  )
})

UnitCard.displayName = 'UnitCard'
