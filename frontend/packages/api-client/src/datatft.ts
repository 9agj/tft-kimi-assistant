import type { DatatftResponse } from './types'
import { getApiClient } from './client'

/**
 * dataTFT 攻略数据：按 MetaTFT compId 索引的攻略 + dataTFT 独有阵容。
 * 由 tools 侧 server/datatft-merge.mjs --into-api 生成到快照的 api/datatft.json。
 */
export async function getDatatft(): Promise<DatatftResponse> {
  const response = await getApiClient().get<DatatftResponse>('/datatft')
  return response.data
}
