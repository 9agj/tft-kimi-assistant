import type { ItemStat, UnitStat } from 'types'

export type CatalogUnit = Pick<UnitStat, 'unit'> & Partial<Omit<UnitStat, 'unit'>>
export type CatalogItem = Pick<ItemStat, 'itemName'> & Partial<Omit<ItemStat, 'itemName'>>
