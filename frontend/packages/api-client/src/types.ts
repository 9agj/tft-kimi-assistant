import type { Comp, CompDetail, ItemStat, Lookups, Queue, TierList, UnitItemsProcessed, UnitStat } from 'types'

export interface ApiResponse<T> {
  success: boolean
  data: T
}

export interface SeasonMapping { season: string, queue: Queue }

export interface SeasonQuery { season?: string }
export interface LookupsQuery { season?: string, queue?: Queue }

export type ItemsResponse = ApiResponse<ItemStat[]>
export type UnitsResponse = ApiResponse<UnitStat[]>
export type UnitItemsResponse = ApiResponse<UnitItemsProcessed>
export type AugmentsResponse = ApiResponse<TierList[]>
export type CompsResponse = ApiResponse<Comp[]>
export type CompDetailResponse = ApiResponse<CompDetail>
export type SeasonsResponse = ApiResponse<SeasonMapping[]>
export type LookupsResponse = ApiResponse<Lookups>

export interface DatatftGuide {
  datatftId: number
  title: string
  tier?: string
  score?: number
  difficulty?: number
  tags?: string[]
  playRate?: number | null
  top4?: number | null
  won?: number | null
  place?: number | null
  matchJaccard?: number
  core?: string
  open?: string
  early?: string
  mid?: string
  final?: string
  tips?: string
  conditions?: string
  equips?: { heroId: string, equips: string[][] }[]
  updateTime?: string | null
  teamUrl?: string | null
}

export interface DatatftExtra {
  compId: string
  source: 'datatft'
  name: string
  units: string[]
  tier?: string
  score?: number
  playRate?: number | null
  top4?: number | null
  won?: number | null
  place?: number | null
  guide?: DatatftGuide | null
}

export interface DatatftResponse {
  success: boolean
  generatedAt: string
  snapshot: string | null
  counts: { guides: number, extra: number }
  guides: Record<string, DatatftGuide>
  extra: DatatftExtra[]
}
