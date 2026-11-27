#!/usr/bin/env node
/**
 * datatft-merge.mjs — 把 dataTFT 抓下来的阵容与 MetaTFT 阵容对齐，产出合并稿与核对报告。
 *
 * 只读 dataTFT 抓取结果与当前快照，不修改线上 comps.json；
 * 输出 data/datatft/merged.json（合并后的阵容数组）与 merge-report.json（对齐与字段完整性报告）。
 *
 * 用法：
 *   node server/datatft-merge.mjs
 *   node server/datatft-merge.mjs --write-api   # 额外写 data/current/api/comps-datatft.json
 *   node server/datatft-merge.mjs --into-api    # 额外写 data/current/api/datatft.json（攻略 + 独有阵容）
 *   node server/datatft-merge.mjs --into-comps            # 干跑：产出 data/datatft/comps-merged.json
 *   node server/datatft-merge.mjs --into-comps --apply    # 落盘：先备份 comps.json 再写入合并结果
 *
 * --into-comps 的语义：
 *   - 与某个 MetaTFT 阵容匹配上的 dataTFT 阵容，只“补字段”：挂 guide、并 sources:["metatft","datatft"]，
 *     不覆盖 MetaTFT 的 count/avg/firstRate/top4Rate/pickRate。
 *   - 匹配不上的，作为新条目追加到列表末尾（compId 前缀 datatft_，source: "datatft"）。
 *   - 不加 --apply 时只写 data/datatft/comps-merged.json 与 merge-report.json，绝不动 comps.json。
 *
 * 环境变量：KIMI_ROOT（默认 /opt/tft-kimi）、KIMI_DATATFT_SEASON（默认 19）
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.env.KIMI_ROOT || '/opt/tft-kimi'
const DT = path.join(ROOT, 'data/datatft')
const API = path.join(ROOT, 'data/current/api')
const WRITE_API = process.argv.includes('--write-api')
const INTO_API = process.argv.includes('--into-api')
const INTO_COMPS = process.argv.includes('--into-comps')
const APPLY = INTO_COMPS && process.argv.includes('--apply')

// 赛季后缀与 server/datatft.mjs 的落盘约定保持一致：S19 → ''，其它 → '-s<season>'
const SEASON = String(process.env.KIMI_DATATFT_SEASON || '19')
const seasonSuffix = (s) => (String(s) === '19' ? '' : `-s${s}`)
const SUFFIX = seasonSuffix(SEASON)

const JACCARD_MIN = 0.6
const JACCARD_STRICT = 0.8
const REQUIRED_TEAM = ['id', 'title', 'heros', 'difficulty', 'tags', 'tier', 'score']
const REQUIRED_STRATEGY = ['core', 'open', 'earlyDesc', 'midDesc', 'finalDesc', 'equips', 'playRate', 'top4', 'place']

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const writeJson = (f, o) => {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f + '.tmp', JSON.stringify(o, null, 1) + '\n')
  fs.renameSync(f + '.tmp', f)
}
const key = (s) => String(s || '').trim().toUpperCase()

function jaccard(a, b) {
  const A = new Set(a)
  const B = new Set(b)
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  const union = A.size + B.size - inter
  return union === 0 ? 0 : inter / union
}

function completeness(obj, fields) {
  const miss = fields.filter((f) => {
    const v = obj?.[f]
    if (v === undefined || v === null) return true
    if (Array.isArray(v)) return v.length === 0
    if (typeof v === 'string') return v.trim() === ''
    return false
  })
  return { ok: miss.length === 0, missing: miss }
}

/** 按赛季读攻略目录：strategy/ 或 strategy-s<season>/ */
function loadStrategies(season) {
  const dir = path.join(DT, `strategy${seasonSuffix(season)}`)
  const m = new Map()
  if (!fs.existsSync(dir)) return m
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const j = readJson(path.join(dir, f))
    if (!j?.data) continue
    // 抓取脚本写的是 { id, fetchedAt, data }；原始接口回包没有顶层 id，用 data.id 或文件名兜底
    const id = Number(j.id ?? j.data.id ?? f.replace(/\.json$/, ''))
    if (Number.isFinite(id)) m.set(id, j.data)
  }
  return m
}

/**
 * 读 lookups 图鉴，用于把 dataTFT 的 heros[].key 对齐成 comps.json 的写法。
 * comps.json 的 units 是 unitsById 的 key（即 unit.apiName，区分大小写、带赛季后缀），
 * 前端 CompCard 直接拿它查 unitsById[u]，查不到时 Champion 组件返回 null（图标消失）。
 */
/**
 * 单位名的宽松归一：去掉赛季数字与分隔符。
 * dataTFT 与 MetaTFT 对少数单位的拼法不同（dataTFT `DA_Ahri19` / `DA_SeraphineIndie19`
 * 对 comps `DA_19_Ahri` / `DA_Seraphine19_Indie`），归一后才能对上图鉴。
 */
const normUnit = (s) => String(s || '').toUpperCase().replace(/[\d_]/g, '')

function loadLookups(lkOverride) {
  const unitsByKey = new Map()
  const unitsByNorm = new Map()
  const traitsByName = new Map()
  let d = lkOverride
  if (!d) {
    const f = path.join(API, 'lookups.json')
    if (!fs.existsSync(f)) return { unitsByKey, unitsByNorm, traitsByName }
    d = readJson(f)?.data || {}
  }
  for (const u of d.units || []) {
    const api = String(u?.apiName || '').trim()
    if (!api) continue
    unitsByKey.set(api.toUpperCase(), u)
    const n = normUnit(api)
    if (n) {
      const list = unitsByNorm.get(n) || []
      list.push(u)
      unitsByNorm.set(n, list)
    }
  }
  for (const t of d.traits || []) {
    const api = String(t?.apiName || '').trim()
    if (api) traitsByName.set(api, t)
  }
  return { unitsByKey, unitsByNorm, traitsByName }
}

/** 把 heros[].key 解析成 comps.json 里的 apiName 写法；解析不出来的原样保留并计入 unresolved */
function canonicalUnits(heroKeys, unitsByKey, unitsByNorm, fallbackSet) {
  const out = []
  const unresolved = []
  for (const raw of heroKeys) {
    const s = String(raw || '').trim()
    if (!s) continue
    const exact = unitsByKey.get(s.toUpperCase())
    if (exact?.apiName) {
      out.push(String(exact.apiName))
      continue
    }
    // 归一后唯一命中才采用，避免不同单位被合并
    const loose = unitsByNorm.get(normUnit(s))
    if (loose?.length === 1) {
      out.push(String(loose[0].apiName))
      continue
    }
    if (fallbackSet.has(s)) out.push(s)
    else {
      out.push(s)
      unresolved.push(s)
    }
  }
  return { units: [...new Set(out)], unresolved }
}

/**
 * 由单位反推羁绊：同羁绊至少 2 人、且在图鉴里能查到才写入；
 * 档位用 traits[].effects[].minUnits 的达标个数推算，写成 MetaTFT 的 `<apiName>_<level>` 写法。
 * 顺序按 apiName 字母序，与 comps.json 现有条目的排法一致。
 */
function deriveTraits(unitIds, unitsByKey, traitsByName) {
  const counts = new Map()
  for (const id of unitIds) {
    const u = unitsByKey.get(String(id).toUpperCase())
    for (const t of u?.traitApiNames || []) counts.set(t, (counts.get(t) || 0) + 1)
  }
  const rows = []
  for (const [api, n] of counts) {
    if (n < 2) continue
    if (/_UniqueTrait$/i.test(api)) continue
    const meta = traitsByName.get(api)
    if (!meta) continue
    const effects = Array.isArray(meta.effects) ? meta.effects : []
    let level = 0
    for (let i = 0; i < effects.length; i++) {
      if ((effects[i]?.minUnits ?? Number.POSITIVE_INFINITY) <= n) level = i + 1
    }
    const capped = Math.max(1, Math.min(level || 1, Math.max(1, effects.length)))
    rows.push({ api, label: `${api}_${capped}` })
  }
  rows.sort((a, b) => a.api.localeCompare(b.api))
  return rows.map((r) => r.label)
}

function main() {
  const teamsFile = path.join(DT, `teams${SUFFIX}.json`)
  if (!fs.existsSync(teamsFile)) {
    console.error(`[merge] 缺少 data/datatft/teams${SUFFIX}.json，先跑 server/datatft.mjs`)
    process.exit(1)
  }
  const teams = (readJson(teamsFile).list || []).map((t) => ({ ...t, _season: SEASON }))

  // 兼容并存赛季：跑 S19 时若 S18 抓取结果存在，一并纳入对齐（按 datatftId 去重）
  const teamsAll = [...teams]
  const bySeason = { [SEASON]: teams.length }
  if (SEASON === '19') {
    const s18File = path.join(DT, `teams${seasonSuffix('18')}.json`)
    if (fs.existsSync(s18File)) {
      const s18 = (readJson(s18File).list || []).map((t) => ({ ...t, _season: '18' }))
      bySeason['18'] = s18.length
      const seen = new Set(teamsAll.map((t) => Number(t.id)))
      for (const t of s18) if (!seen.has(Number(t.id))) { seen.add(Number(t.id)); teamsAll.push(t) }
    }
  }

  const compsFile = path.join(API, 'comps.json')
  const metaComps = fs.existsSync(compsFile) ? readJson(compsFile).data || [] : []

  const strategiesBySeason = new Map()
  for (const s of new Set(teamsAll.map((t) => t._season))) strategiesBySeason.set(s, loadStrategies(s))
  const stratFor = (t) => strategiesBySeason.get(t._season)?.get(Number(t.id)) || null
  const strategyCount = [...strategiesBySeason.values()].reduce((n, m) => n + m.size, 0)

  // 字段完整性
  const teamIssues = []
  const stratIssues = []
  for (const t of teamsAll) {
    const c = completeness(t, REQUIRED_TEAM)
    if (!c.ok) teamIssues.push({ id: t.id, title: t.title, missing: c.missing })
    const s = stratFor(t)
    if (!s) stratIssues.push({ id: t.id, title: t.title, missing: ['strategy'] })
    else {
      const cs = completeness(s, REQUIRED_STRATEGY)
      if (!cs.ok) stratIssues.push({ id: t.id, title: t.title, missing: cs.missing })
    }
  }

  // 与 MetaTFT 对齐：单位集合 + 主 C
  const metaIdx = metaComps.map((c) => ({
    comp: c,
    set: (c.units || []).map(key),
    carry: key((c.units || [])[0]),
  }))

  const merged = []
  const pairs = []
  const unmatched = []
  for (const t of teamsAll) {
    const set = (t.heros || []).map((h) => key(h.key))
    const carry = key(t.heroId ? (t.heros || []).find((h) => h.id === t.heroId)?.key || '' : set[0])
    const strat = stratFor(t)

    // 先按单位集合相似度取最优；主 C 一致只作为同分时的加权，不作为硬门槛
    let best = null
    let bestScore = 0
    for (const m of metaIdx) {
      const j = jaccard(set, m.set)
      if (j < JACCARD_MIN) continue
      const weighted = j + (carry && m.carry && carry === m.carry ? 0.05 : 0)
      if (weighted > bestScore) {
        best = m
        bestScore = weighted
      }
    }
    const jaccardScore = best ? jaccard(set, best.set) : 0

    const entry = {
      source: 'datatft',
      datatftId: t.id,
      season: t._season,
      title: t.title,
      titleApi: t.titleApi || [],
      difficulty: t.difficulty,
      tags: t.tags || [],
      tier: t.tier,
      score: t.score,
      units: set,
      heroId: t.heroId,
      strategyId: t.strategyId,
      jccCode: t.jccCode,
      tftCode: t.tftCode,
      playRate: strat?.playRate ?? null,
      top4: strat?.top4 ?? null,
      won: strat?.won ?? null,
      place: strat?.place ?? null,
      guide: strat
        ? {
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
        : null,
      matchedCompId: best ? best.comp.compId || best.comp.id : null,
      matchJaccard: best ? Number(jaccardScore.toFixed(3)) : 0,
    }
    merged.push(entry)
    if (best) pairs.push({ datatftId: t.id, title: t.title, compId: entry.matchedCompId, jaccard: entry.matchJaccard })
    else unmatched.push({ datatftId: t.id, title: t.title, units: set.length })
  }

  const report = {
    generatedAt: new Date().toISOString(),
    snapshot: fs.existsSync(path.join(ROOT, 'data/current/manifest.json'))
      ? readJson(path.join(ROOT, 'data/current/manifest.json')).version
      : null,
    datatft: {
      teams: teamsAll.length,
      bySeason,
      strategies: strategyCount,
      strategyMissing: teamsAll.length - strategyCount,
    },
    metatft: { comps: metaComps.length },
    matching: {
      jaccardMin: JACCARD_MIN,
      jaccardStrict: JACCARD_STRICT,
      matched: pairs.length,
      matchedStrict: pairs.filter((p) => p.jaccard >= JACCARD_STRICT).length,
      unmatched: unmatched.length,
      rate: teamsAll.length ? Number((pairs.length / teamsAll.length).toFixed(3)) : 0,
      pairs,
      unmatchedList: unmatched,
    },
    fieldCompleteness: {
      teamIssues,
      strategyIssues: stratIssues,
    },
  }

  writeJson(path.join(DT, 'merged.json'), { generatedAt: report.generatedAt, count: merged.length, comps: merged })
  if (WRITE_API) writeJson(path.join(API, 'comps-datatft.json'), { success: true, data: merged })

  // 供 App 直接消费的形态：按 compId 索引的攻略 + 未匹配的独有阵容
  if (INTO_API) {
    const guides = {}
    for (const e of merged) {
      if (!e.matchedCompId || !e.guide) continue
      guides[e.matchedCompId] = {
        datatftId: e.datatftId,
        title: e.title,
        tier: e.tier,
        score: e.score,
        difficulty: e.difficulty,
        tags: e.tags,
        playRate: e.playRate,
        top4: e.top4,
        won: e.won,
        place: e.place,
        matchJaccard: e.matchJaccard,
        ...e.guide,
      }
    }
    const extra = merged
      .filter((e) => !e.matchedCompId)
      .map((e) => ({
        compId: `datatft_${e.datatftId}`,
        source: 'datatft',
        name: e.title,
        units: e.units,
        tier: e.tier,
        score: e.score,
        playRate: e.playRate,
        top4: e.top4,
        won: e.won,
        place: e.place,
        guide: e.guide,
      }))
    writeJson(path.join(API, 'datatft.json'), {
      success: true,
      generatedAt: report.generatedAt,
      snapshot: report.snapshot,
      counts: { guides: Object.keys(guides).length, extra: extra.length },
      guides,
      extra,
    })
    console.log(`[merge] 写入 api/datatft.json：攻略 ${Object.keys(guides).length} 条、独有阵容 ${extra.length} 套`)
  }

  // 把 dataTFT 阵容并入 comps.json 的阵容列表（默认干跑）
  if (INTO_COMPS) {
    if (!fs.existsSync(compsFile)) {
      console.error('[merge] 缺少 data/current/api/comps.json，无法 --into-comps')
      process.exit(1)
    }
    const compsDoc = readJson(compsFile)
    const before = Array.isArray(compsDoc.data) ? compsDoc.data : []
    const indexByCompId = new Map(before.map((c, i) => [c.compId ?? `comp_${c.clusterId}_${c.id}`, i]))
    const compUnitSet = new Set(before.flatMap((c) => c.units || []))
    const { unitsByKey, unitsByNorm, traitsByName } = loadLookups()
    const teamById = new Map(teamsAll.map((t) => [Number(t.id), t]))

    const after = before.slice()
    const guideAttached = []
    const appended = []
    const collisions = []
    const unresolvedUnits = new Set()
    const guideOwner = new Map()

    for (const e of merged) {
      const t = teamById.get(Number(e.datatftId))
      if (!t) continue

      // 1) 匹配上：只补字段，不动 MetaTFT 的指标
      if (e.matchedCompId && indexByCompId.has(e.matchedCompId)) {
        if (guideOwner.has(e.matchedCompId)) {
          collisions.push({ compId: e.matchedCompId, datatftId: e.datatftId, kept: guideOwner.get(e.matchedCompId) })
          continue
        }
        guideOwner.set(e.matchedCompId, e.datatftId)
        const i = indexByCompId.get(e.matchedCompId)
        const next = { ...after[i] }
        next.sources = [...new Set([...(next.sources || []), 'metatft', 'datatft'])]
        if (e.guide) next.guide = e.guide
        after[i] = next
        guideAttached.push({ compId: e.matchedCompId, datatftId: e.datatftId, jaccard: e.matchJaccard, guide: !!e.guide })
        continue
      }

      // 2) 匹配不上：追加为新条目（重复 apply 时原地刷新，不重复追加）
      const heroKeys = (t.heros || []).map((h) => h?.key)
      const { units, unresolved } = canonicalUnits(heroKeys, unitsByKey, unitsByNorm, compUnitSet)
      for (const u of unresolved) unresolvedUnits.add(u)
      const traits = deriveTraits(units, unitsByKey, traitsByName)
      const numericId = Number(String(t.id).replace(/[^\d]/g, '')) || 0

      const entry = {
        compId: `datatft_${t.id}`,
        clusterId: null,
        id: numericId,
        units,
        traits,
        name: [{ name: t.title, type: 'datatft', score: t.score ?? null }],
        count: 0,
        avg: e.place,
        firstRate: e.won,
        top4Rate: e.top4,
        pickRate: null,
        datatftPlayRate: e.playRate,
        tier: t.tier ?? null,
        source: 'datatft',
        guide: e.guide ?? null,
      }

      // 已经追加过的（重复 --apply）原地刷新，避免列表里出现重复条目
      const existing = after.findIndex((c) => c?.compId === entry.compId)
      if (existing >= 0) after[existing] = entry
      else after.push(entry)

      appended.push({ compId: entry.compId, datatftId: e.datatftId, title: t.title, units: units.length, traits: traits.length, guide: !!e.guide, refreshed: existing >= 0 })
    }

    const mergedDoc = { ...compsDoc, data: after }
    writeJson(path.join(DT, 'comps-merged.json'), mergedDoc)

    report.intoComps = {
      before: before.length,
      matched: guideAttached.length,
      appended: appended.length,
      after: after.length,
      guideAttached: guideAttached.filter((x) => x.guide).length,
      collisions,
      unresolvedUnits: [...unresolvedUnits],
      appendedList: appended,
      applied: APPLY,
    }

    if (APPLY) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const backup = path.join(DT, `backup-comps-${ts}.json`)
      fs.copyFileSync(compsFile, backup)
      writeJson(compsFile, mergedDoc)
      console.log(`[merge] --apply：备份 ${path.relative(ROOT, backup)}，comps.json ${before.length} → ${after.length}`)
    } else {
      console.log(
        `[merge] --into-comps 干跑：comps.json ${before.length} → ${after.length}（对上 ${guideAttached.length} / 追加 ${appended.length}），未写 comps.json`
      )
    }
    if (collisions.length) console.log(`[merge] 同一 comps 条目被 ${collisions.length} 套 dataTFT 阵容命中，已保留首个`)
    if (unresolvedUnits.size) console.log(`[merge] units 未能在 lookups 解析：${[...unresolvedUnits].join(', ')}`)
  }

  writeJson(path.join(DT, 'merge-report.json'), report)

  console.log(
    `[merge] dataTFT ${teamsAll.length} 套（攻略 ${strategyCount}）/ MetaTFT ${metaComps.length} 套 → 对上 ${pairs.length}，独有 ${unmatched.length}，命中率 ${(report.matching.rate * 100).toFixed(1)}%`
  )
  if (teamIssues.length) console.log(`[merge] 列表字段缺失 ${teamIssues.length} 条`)
  if (stratIssues.length) console.log(`[merge] 攻略缺失/不全 ${stratIssues.length} 条`)
}

export { canonicalUnits, deriveTraits, loadLookups, jaccard, normUnit }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
