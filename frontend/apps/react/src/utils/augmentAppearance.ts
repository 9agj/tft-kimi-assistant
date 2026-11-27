import type { AugmentClass } from 'types'
import { getLevelFromIcon } from './getter'

export type AugmentRarity = 'Silver' | 'Gold' | 'Prismatic'
export const AUGMENT_RARITIES: AugmentRarity[] = ['Silver', 'Gold', 'Prismatic']
export const AUGMENT_LABELS: Record<AugmentRarity, string> = { Silver: '银色', Gold: '金色', Prismatic: '棱彩' }

export function augmentRarity(augment: AugmentClass): AugmentRarity {
  const rarity = (augment as AugmentClass & { rarity?: string }).rarity
  return AUGMENT_RARITIES.includes(rarity as AugmentRarity) ? rarity as AugmentRarity : getLevelFromIcon(augment.icon)
}

export function augmentMaterial(rarity: AugmentRarity) {
  if (rarity === 'Silver') return { fill: 'linear-gradient(180deg, #AABACE 20%, #9FB4CE 50%, #6886A5 80%)', glow: '#477DCB' }
  if (rarity === 'Gold') return { fill: 'linear-gradient(180deg, #DEBA31 20%, #E7BA1E 50%, #D69C31 80%)', glow: '#A18E21' }
  const texture = new URL('./cdn/file/metatft/augments/tiers/tier3.png', document.baseURI).href
  return { fill: `linear-gradient(#0000001f,#0000001f),url(${texture})`, glow: '#6838FF' }
}
