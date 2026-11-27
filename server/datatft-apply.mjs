/**
 * datatft-apply.mjs — 把 dataTFT 的抓取结果并进一次快照构建。
 *
 * 由 server/scrape.mjs 在生成快照时调用：给匹配上的 MetaTFT 阵容挂攻略，
 * 把 dataTFT 独有阵容追加进阵容列表，并生成它们的详情文件与 datatft.json。
 *
 * 设计约束：
 *   - 只读 data/datatft/ 下的抓取产物；文件缺失时静默跳过（dataTFT 是可选增强）。
 *   - 任何异常都不应让主抓取失败：调用方负责 try/catch，这里只返回 null。
 *   - 追加阵容的 pickRate 写 null（dataTFT 的 playRate 与 MetaTFT 的 pickRate 不同分母，
 *     不能直接映射），原始值另存 datatftPlayRate 供攻略页展示。
 */

import fs from 'node:fs'
import path from 'node:path'
import { canonicalUnits, deriveTraits, jaccard, loadLookups, normUnit } from './datatft-merge.mjs'
import { mapEquipId } from './datatft-equips.mjs'

const JACCARD_MIN = 0.6
const key = s => String(s || '').trim().toUpperCase()

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))

/** 读一份抓取产物；缺失或损坏都返回 null，不抛错 */
function tryRead(file) {
  try {
    return fs.existsSync(file) ? readJson(file) : null
  } catch {
    return null
  }
}

/** 读某个赛季的阵容列表 + 攻略，返回 [{ team, strategy }] */
function loadSeason(dtDir, season) {
  const suffix = String(season) === '19' ? '' : `-s${season}`
  const teams = tryRead(path.join(dtDir, `teams${suffix}.json`))?.list
  if (!Array.isArray(teams) || teams.length === 0) return []
  const stratDir = path.join(dtDir, `strategy${suffix}`)
  return teams.map((team) => {
    const doc = tryRead(path.join(stratDir, `${team.id}.json`))
    return { team, strategy: doc?.data ?? doc ?? null }
  })
}

/** 从攻略里取出要展示的字段，保持与 datatft.json 的既有结构一致 */
function toGuide(strat) {
  if (!strat) return null
  return {
    core: strat.core || '',
    open: strat.open || '',
    early: strat.earlyDesc || '',
    mid: strat.midDesc || '',
    final: strat.finalDesc || '',
    tips: strat.tips || '',
    conditions: strat.conditions || '',
    equips: strat.equips || [],
    updateTime: strat.updateTime || null,
    teamUrl: strat.teamUrl || null,
  }
}

/** 读 positions.json（按 teamId 索引）；缺失返回空对象 */
function loadPositions(dtDir) {
  return tryRead(path.join(dtDir, 'positions.json'))?.teams ?? {}
}

/** 把解码出的 unitKey 归一成 comps.json 的 apiName（解码用 DA_SeraphineIndie19，图鉴用 DA_Seraphine19_Indie） */
function makeUnitResolver(unitsByKey, unitsByNorm) {
  const cache = new Map()
  return (raw) => {
    const s = String(raw || '').trim()
    if (!s) return s
    if (cache.has(s)) return cache.get(s)
    let out = s
    const exact = unitsByKey.get(s.toUpperCase())
    if (exact?.apiName) out = String(exact.apiName)
    else {
      const loose = unitsByNorm.get(normUnit(s))
      if (loose?.length === 1) out = String(loose[0].apiName)
    }
    cache.set(s, out)
    return out
  }
}

/**
 * dataTFT 的 index = row*7+col（row 0 = 最上一排/前排），
 * 前端 getRowCol(n) 的 n 是「position 1..28」，row = 4-floor((n-1)/7)-1。
 * 换算：position = (3 - row) * 7 + col + 1（不能简单用 28-index，会镜像错列）。
 */
function toPositioning(entry, resolve = x => x, unitSet = null) {
  const out = []
  for (const p of entry?.positions || []) {
    if (typeof p.index !== 'number') continue
    const row = Math.floor(p.index / 7)
    const col = p.index % 7
    if (row < 0 || row > 3) continue
    const unit = resolve(p.unitKey)
    // 召唤物（亚托克斯/魔像等）在图鉴里没有 apiName，也不是阵容成员，跳过以免棋盘多画空格
    if (unitSet && !unitSet.has(unit)) continue
    out.push({ unit, position: (3 - row) * 7 + col + 1 })
  }
  return out
}

/** 把每格上的装备按 apiName 归并成 CompItem[] */
function toItems(entry, resolve = x => x) {
  const byItem = new Map()
  for (const p of entry?.positions || []) {
    for (const it of p.items || []) {
      const apiName = it.equipKey || mapEquipId(it.equipId, '19')
      if (!apiName) continue
      if (!byItem.has(apiName))
        byItem.set(apiName, { itemNames: apiName, count: 0, avg: null, units: [] })
      const row = byItem.get(apiName)
      row.count += 1
      row.units.push({ units: resolve(p.unitKey), count: 1, avg: null })
    }
  }
  return [...byItem.values()]
}

/** 三星单位（本批 key 的 stars 恒为 1，留着给将来用） */
function starsOf(entry, resolve = x => x) {
  return (entry?.positions || []).filter(p => Number(p.stars) >= 3).map(p => resolve(p.unitKey))
}

/**
 * 生成 dataTFT 独有阵容的详情文件内容。
 * 站位与装备来自 team-builder key 的解码结果（positions.json）；
 * 过渡/变阵/克制 dataTFT 不提供，如实留空。
 */
// dataTFT 的 playRate = 该阵容出现在多少比例的对局里（一局 8 名玩家，可能多人同阵容）。
// MetaTFT 的 pickRate = 玩这套阵容的玩家占比。换算：p = 1-(1-q)^8 → q = 1-(1-p)^(1/8)。
// 用 26 对配对样本验算：p=0.51 → 8.7%（MetaTFT 9.75%）、p=0.31 → 4.5%（MetaTFT 5.84%），同量级。
function toPickRate(playRate) {
  const p = Number(playRate)
  if (!Number.isFinite(p) || p <= 0) return null
  if (p >= 1) return 100
  return (1 - (1 - p) ** (1 / 8)) * 100
}

function toBuilds(entry, resolve = x => x) {
  const list = entry?.positions ?? []
  return list
    .filter((p) => (p.items ?? []).length > 0)
    .map((p) => ({
      unit: resolve(p.unitKey),
      buildName: p.items.map((it) => it.equipKey || mapEquipId(it.equipId, '19')).filter(Boolean),
      count: 1,
      avg: null,
    }))
}

function buildDetail(team, strat, units, traits, entry, resolve = x => x) {
  const unitSet = new Set(units)
  return {
    id: String(team.id),
    units,
    traits,
    positioning: toPositioning(entry, resolve, unitSet),
    positioningCandidates: {},
    positioningComplete: toPositioning(entry, resolve, unitSet).length === units.length,
    final_level: [],
    item: toItems(entry, resolve, unitSet),
    // MetaTFT 概览页签的棋盘装备来自 builds（find(builds, {unit}).buildName），
    // dataTFT 没有 builds，这里按站位里的每格装备派生一份，棋盘才能显示装备图标。
    builds: toBuilds(entry, resolve),
    counters: [],
    options: {},
    early_options: {},
    trends: null,
    datatftOnly: true,
    sourceUpdatedAt: strat?.updateTime || null,
  }
}

/**
 * @param {object} opts
 * @param {Array} opts.comps      MetaTFT 阵容数组（会被就地追加）
 * @param {Map}   opts.details    compId -> 详情对象（会被就地追加）
 * @param {object} opts.lk        MetaTFT lookups
 * @param {string} opts.root      项目根（默认 KIMI_ROOT）
 * @returns {{doc: object, added: number, guided: number}|null}
 */
export function applyDatatft({ comps, details, lk, root }) {
  const ROOT = root || process.env.KIMI_ROOT || '/opt/tft-kimi'
  const dtDir = path.join(ROOT, 'data/datatft')
  if (!fs.existsSync(dtDir)) return null

  // 只并 S19：S18 的单位/羁绊与当前 lookups 不是同一套，混进来会渲染成空图标
  const rows = loadSeason(dtDir, '19')
  if (rows.length === 0) return null

  const positions = loadPositions(dtDir)
  const { unitsByKey, unitsByNorm, traitsByName } = loadLookups(lk)
  const resolve = makeUnitResolver(unitsByKey, unitsByNorm)
  const compUnitSet = new Set(comps.flatMap(c => c.units || []))
  const metaIdx = comps.map(c => ({ comp: c, set: (c.units || []).map(key) }))

  const guides = {}
  const extra = []
  let added = 0
  let guided = 0

  for (const { team, strategy } of rows) {
    const set = (team.heros || []).map(h => key(h.key))
    const guide = toGuide(strategy)

    // 找最相似的 MetaTFT 阵容
    let best = null
    let bestScore = 0
    for (const m of metaIdx) {
      const j = jaccard(set, m.set)
      if (j < JACCARD_MIN) continue
      const carry = key(team.heros?.find(h => h.id === team.heroId)?.key || set[0])
      const weighted = j + (carry && m.set[0] === carry ? 0.05 : 0)
      if (weighted > bestScore) {
        best = m
        bestScore = weighted
      }
    }

    const compId = best ? (best.comp.compId || `comp_${best.comp.clusterId}_${best.comp.id}`) : null

    if (compId && !guides[compId]) {
      best.comp.sources = [...new Set([...(best.comp.sources || []), 'metatft', 'datatft'])]
      // 站点有档位就跟着站点走，避免我们自己按百分位另算一套（用户要求：不擅自分级）
      if (team.tier) {
        best.comp.datatftTier = team.tier
        best.comp.tierSource = 'datatft'
      }
      if (guide) {
        guides[compId] = {
          datatftId: team.id,
          title: team.title,
          tier: team.tier ?? null,
      datatftTier: team.tier ?? null,
      tierSource: 'datatft',
          score: team.score ?? null,
          difficulty: team.difficulty ?? null,
          tags: team.tags || [],
          playRate: strategy?.playRate ?? null,
          top4: strategy?.top4 ?? null,
          won: strategy?.won ?? null,
          place: strategy?.place ?? null,
          matchJaccard: Number(bestScore.toFixed(3)),
          ...guide,
        }
        best.comp.guide = true
        guided++
      }
      continue
    }
    // compId 已被别的 dataTFT 阵容占用（同一 MetaTFT 阵容对上多套 dataTFT）：
    // 不丢弃，继续走下面的追加逻辑，保证站点 40 套在我们这里都能看到。


    // 匹配不上：作为独立阵容追加
    const { units } = canonicalUnits(set, unitsByKey, unitsByNorm, compUnitSet)
    const traits = deriveTraits(units, unitsByKey, traitsByName)
    const newId = `datatft_${team.id}`
    if (comps.some(c => c.compId === newId)) continue

    const posEntry = positions[String(team.id)]
    comps.push({
      compId: newId,
      clusterId: null,
      id: Number(String(team.id).replace(/\D/g, '')) || 0,
      units,
      traits,
      name: [{ name: team.title, type: 'datatft', score: team.score ?? null }],
      count: 0,
      avg: strategy?.place ?? null,
      firstRate: strategy?.won ?? null,
      top4Rate: strategy?.top4 ?? null,
      pickRate: toPickRate(strategy?.playRate),
      datatftPlayRate: strategy?.playRate ?? null,
      tier: team.tier ?? null,
      source: 'datatft',
      stars: starsOf(posEntry, resolve, new Set(units)),
      levelling: null,
    })
    details.set(newId, buildDetail(team, strategy, units, traits, posEntry, resolve))
    // 独有阵容的攻略也进 guides：详情页按 compId 查攻略，不查 extra
    if (guide) {
      guides[newId] = {
        datatftId: team.id,
        title: team.title,
        tier: team.tier ?? null,
        score: team.score ?? null,
        difficulty: team.difficulty ?? null,
        tags: team.tags || [],
        playRate: strategy?.playRate ?? null,
        top4: strategy?.top4 ?? null,
        won: strategy?.won ?? null,
        place: strategy?.place ?? null,
        matchJaccard: 0,
        ...guide,
      }
    }
    extra.push({
      compId: newId,
      source: 'datatft',
      name: team.title,
      units,
      tier: team.tier ?? null,
      score: team.score ?? null,
      playRate: strategy?.playRate ?? null,
      top4: strategy?.top4 ?? null,
      won: strategy?.won ?? null,
      place: strategy?.place ?? null,
      guide,
    })
    added++
  }

  // 攻略超过 7 天没更新就标记出来，让抓取日志能看见，不静默吃旧数据
  const newest = Object.values(guides)
    .map(g => Number(new Date(g.updateTime || 0)))
    .filter(n => Number.isFinite(n) && n > 0)
  const ageDays = newest.length ? Math.floor((Date.now() - Math.max(...newest)) / 86400000) : null

  const doc = {
    success: true,
    generatedAt: new Date().toISOString(),
    guideAgeDays: ageDays,
    counts: { guides: Object.keys(guides).length, extra: extra.length },
    guides,
    extra,
  }
  return { doc, added, guided, ageDays }
}
