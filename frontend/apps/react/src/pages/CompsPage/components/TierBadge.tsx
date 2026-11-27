import { memo } from 'react'

interface TierBadgeProps {
  tier: string
}

/**
 * Tier 等级徽章组件
 */
export const TierBadge = memo(({ tier }: TierBadgeProps) => {
  return (
    <div className="comp-tier" data-tier={tier} aria-label={'阵容等级 ' + tier}>
      {tier}
    </div>
  )
})

TierBadge.displayName = 'TierBadge'
