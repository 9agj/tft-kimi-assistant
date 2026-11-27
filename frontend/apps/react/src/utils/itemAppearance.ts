import type { Item } from 'types'

export function isRadiantItem(item: Item | undefined): boolean {
  if (!item) return false
  const overlays = (item as Item & { overlays?: { id?: string }[] }).overlays
  return Boolean(overlays?.some(frame => frame.id === 'Radiant')
    || item.tags?.some(tag => String(tag) === 'Radiant' || String(tag) === 'Item.Equippable.Item.Radiant'))
}

export const RADIANT_FRAME = './cdn/file/metatft/itemframes/t_item_frame_radiant.png'
