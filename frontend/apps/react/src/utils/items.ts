import type { Item } from 'types'
import { ItemTag } from 'types'

export type ItemCategory = 'core' | 'radiant' | 'artifact' | 'emblem' | 'other'

export function getItemCategory(id: string, lookupsIndex: Record<string, Item>): ItemCategory | undefined {
  const meta = lookupsIndex[id]
  if (!meta)
    return undefined
  const name = String(meta.name ?? '')
  const tags = meta.tags ?? []
  if (id.includes('Radiant') || tags.some(t => String(t).includes('Radiant')) || name.includes('光明'))
    return 'radiant'
  if (id.includes('Artifact') || tags.some(t => /Artifact|Support/.test(String(t))) || tags.includes(ItemTag.Artifact) || tags.includes(ItemTag.Support))
    return 'artifact'
  if (id.includes('Emblem') || name.includes('纹章'))
    return 'emblem'
  if ((meta.composition ?? []).length === 2)
    return 'core'
  return 'other'
}
