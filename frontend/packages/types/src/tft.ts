export enum Queue {
  PBE = 'PBE',
  FORMAL = '1100',
}

export type TFTSetString = `TFTSet${number}_latest_zh_cn`

export enum Levelling {
  Fast8 = 'Fast 8',
  Fast9 = 'Fast 9',
  Lvl5 = 'lvl 5',
  Lvl6 = 'lvl 6',
  Lvl7 = 'lvl 7',
  Standard = 'Standard',
}

export enum Trend {
  Up = 'up',
  Down = 'down',
  Steady = 'steady',
}

export interface Build {
  /** 阵容构建匹配次数 */
  count?: number
  /** 阵容构建平均排名 */
  avg?: number
  /** 阵容构建单位 */
  unit?: string
  /** 阵容构建装备 */
  buildName?: string[]
}

export enum NameType {
  Trait = 'trait',
  Unit = 'unit',
}

export interface Name {
  name?: string
  type?: NameType
  score?: number
}

export interface Comp {
  /** 阵容ID */
  compId?: string
  /** 阵容所属集群ID */
  clusterId: number
  /** 阵容ID */
  id: number
  /** 阵容单位 */
  units?: string[]
  /** 阵容羁绊 */
  traits?: string[]
  /** 阵容名称 */
  name?: Name[]

  /** 阵容选取率 */
  pickRate?: number
  /** 阵容平均排名 */
  avg?: number
  /** 阵容第一率 */
  firstRate?: number
  /** 阵容前四率 */
  top4Rate?: number

  /** 阵容3星单位 */
  stars?: string[]
  /** 阵容4星单位 */
  stars_4?: string[]

  /** 阵容构建 */
  builds?: Build[]

  /** 阵容等级 */
  levelling?: Levelling

  /** 更新时间 */
  updatedAt?: Date

  /** 数据来源：metatft / datatft（dataTFT 独有阵容为 'datatft'） */
  source?: string
  /** 数据来源列表（MetaTFT 阵容被 dataTFT 攻略覆盖时为 ['metatft','datatft']） */
  sources?: string[]
  /** dataTFT 原始登场率（与 pickRate 不同分母，仅用于攻略页展示） */
  datatftPlayRate?: number | null
  /** dataTFT 自己的分档（S/A/B/C/D） */
  tier?: string | null
  /** dataTFT 站点给的档位（S/A/B/C/D），有则优先展示 */
  datatftTier?: string | null
  /** 档位来源：datatft = 站点档位，metatft = 本地百分位计算 */
  tierSource?: string | null
}

export interface Counter {
  against?: number
  place_change?: number
  similarity?: number
}

export interface FinalLevel {
  level?: string
  count?: number
  avg?: number
}

export interface Unit {
  count?: number
  avg?: number
  units?: string
  place_change?: number
  unit_pick?: number
  item_pick?: number
}

export interface CompItem {
  itemNames: string
  count?: number
  avg?: number
  pcnt?: number
  units?: Unit[]
}

export interface Positioning {
  unit?: string
  position?: number
}

export interface Option {
  unit_list?: string
  count?: number
  avg?: number
  win?: number
}

export interface CompDetail {
  /** 阵容ID */
  id?: number
  /** 克制关系 */
  counters?: Counter[]
  /** 阵容最终等级 */
  final_level?: FinalLevel[]
  /** 阵容装备 */
  item?: CompItem[]
  /** 阵容趋势 */
  trends?: Trend
  /** 阵容站位 */
  positioning?: Positioning[]
  /** 阵容早期选项 */
  early_options?: Record<string, Option[]>
  /** 阵容后期选项 */
  options?: Record<string, Option[]>
  /** dataTFT 独有阵容：只有阵容构成与攻略，没有站位/装备统计 */
  datatftOnly?: boolean
  /** 每个英雄的成型装备（dataTFT 用，MetaTFT 的装备统计在 item/builds 接口里） */
  builds?: Build[]
  /** dataTFT 攻略更新时间 */
  sourceUpdatedAt?: string | null
}

export interface ItemStat {
  itemName: string
  avg: number
  firstRate: number
  pickRate: number
  top4Rate: number
}

export interface UnitStat {
  unit: string
  avg: number
  firstRate: number
  pickRate: number
  top4Rate: number
}

export interface TierList {
  content?: ContentElement[]
  label?: string
  color?: string
}

export interface ContentElement {
  id?: string
  type?: Type
}

export enum Type {
  Augment = 'augment',
}
