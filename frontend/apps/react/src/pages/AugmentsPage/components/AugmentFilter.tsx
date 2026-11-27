import { memo } from 'react'
import { AUGMENT_LABELS, AUGMENT_RARITIES } from '@/utils/augmentAppearance'
export type AugmentLevelFilter = 'all' | 'Silver' | 'Gold' | 'Prismatic'
interface AugmentFilterProps {
  levelFilter: AugmentLevelFilter
  onLevelFilterChange: (level: AugmentLevelFilter) => void
  counts?: Record<string, number>
}
export const AugmentFilter = memo(({ levelFilter, onLevelFilterChange, counts }: AugmentFilterProps) => <div className="augment-tier-filter" role="tablist" aria-label="强化阶位">
  {(['all', ...AUGMENT_RARITIES] as AugmentLevelFilter[]).map(rarity => <button type="button" role="tab" key={rarity} data-rarity={rarity} aria-selected={levelFilter === rarity} onClick={() => onLevelFilterChange(rarity)}>
    <span className="rarity-dot" aria-hidden="true" />{rarity === 'all' ? '全部' : AUGMENT_LABELS[rarity]}<span className="rarity-count">{counts?.[rarity] ?? ''}</span>
  </button>)}
</div>)
AugmentFilter.displayName = 'AugmentFilter'
