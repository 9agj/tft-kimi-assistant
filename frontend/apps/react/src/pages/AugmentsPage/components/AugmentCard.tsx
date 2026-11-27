import { memo } from 'react'
import type { AugmentClass } from 'types'
import { Popover, PopoverContent, PopoverTrigger } from 'ui'
import { Augment } from '@/components'
import { useGlobalStore } from '@/store/globalStore'
import { AUGMENT_LABELS, augmentRarity } from '@/utils/augmentAppearance'
import { resolveDescription } from '@/utils/description'

interface AugmentCardProps { id?: string, rating?: string, record?: AugmentClass, variant?: boolean }
export const AugmentCard = memo(({ id, rating, record, variant }: AugmentCardProps) => {
  const indexed = useGlobalStore(s => id ? s.lookupsIndex.augmentsById[id] : undefined)
  const augment = record ?? indexed
  if (!id || !augment) return null
  const rarity = augmentRarity(augment)
  const rounds = (augment as AugmentClass & { rounds?: string[] }).rounds ?? []
  return <Popover>
    <PopoverTrigger asChild>
      <button type="button" className="kimi-augment-card" data-rarity={rarity} data-grade={rating || 'Unrated'} data-augment-id={id} aria-label={(rating ? rating + '级 ' : '未评级 ') + AUGMENT_LABELS[rarity] + '强化：' + augment.name}>
        <span className="augment-grade-badge comp-tier" data-tier={rating || 'Unrated'}>{rating || '?'}</span>
        <Augment id={id} record={augment} size="large" showTooltip={false} className="augment-card-icon" />
        <span className="augment-card-name">{augment.name}</span>
        {variant && rounds.length > 0 && <span className="augment-variant">{rounds.join(' / ')} 阶段</span>}
        <span className="augment-rarity-badge" data-rarity={rarity}>{AUGMENT_LABELS[rarity]}{rating ? ' · ' + rating : ''}</span>
      </button>
    </PopoverTrigger>
    <PopoverContent className="augment-description" side="bottom" align="center">
      <div className="augment-description-heading"><Augment id={id} record={augment} size="large" showTooltip={false} /><div><strong>{augment.name}</strong><span className="augment-rarity-badge" data-rarity={rarity}>{AUGMENT_LABELS[rarity]}强化</span></div></div>
      {rounds.length > 0 && <p className="augment-variant">出现阶段：{rounds.join(' / ')}</p>}
      <p>{resolveDescription(augment)}</p>
    </PopoverContent>
  </Popover>
})
AugmentCard.displayName = 'AugmentCard'
