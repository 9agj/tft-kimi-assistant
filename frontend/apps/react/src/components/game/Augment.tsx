import type { CSSProperties, ReactNode } from 'react'
import type { AugmentClass } from 'types'
import { memo, useState } from 'react'
import { cn } from 'utils'
import { useGlobalStore } from '@/store/globalStore'
import { augmentMaterial, augmentRarity } from '@/utils/augmentAppearance'
import { getAugmentSizeClasses } from '@/utils/styles'
import { WithTooltip } from '../common/WithTooltip'

interface AugmentProps {
  id: string
  size?: 'tiny' | 'small' | 'medium' | 'large'
  showTooltip?: boolean
  className?: string
  onClick?: (augment: AugmentClass) => void
  wrapperClassName?: string
  renderExtra?: (augment: AugmentClass) => ReactNode
  record?: AugmentClass
}

export const Augment = memo(({ id, size = 'medium', showTooltip = true, className = '', wrapperClassName = '', onClick, renderExtra, record }: AugmentProps) => {
  const indexed = useGlobalStore(s => s.lookupsIndex.augmentsById[id])
  const augment = record ?? indexed
  const [failed, setFailed] = useState(false)
  if (!augment) return null
  const rarity = augmentRarity(augment)
  const material = augmentMaterial(rarity)
  const localIcon = (augment as AugmentClass & { localIcon?: string }).localIcon
  const src = new URL('.' + (localIcon || '/cdn/file/metatft/augments/' + id.toLowerCase() + '.png'), document.baseURI).href
  const style = { '--augment-tier-fill': material.fill, '--augment-tier-glow': material.glow } as CSSProperties
  return <WithTooltip show={showTooltip} content={<span>{augment.name}</span>}>
    <div className={cn('flex items-center justify-center', wrapperClassName)}>
      <span className={cn('kimi-augment-icon', getAugmentSizeClasses(size).container, className)} data-rarity={rarity} onClick={() => onClick?.(augment)}>
        {failed ? <span className="augment-fallback" aria-label={augment.name}>✦</span> : <span className="augment-material" style={style}>
          <img className="augment-glyph" src={src} alt={augment.name} loading="lazy" draggable={false} onError={() => setFailed(true)} />
        </span>}
      </span>
      {renderExtra?.(augment)}
    </div>
  </WithTooltip>
})
Augment.displayName = 'Augment'
