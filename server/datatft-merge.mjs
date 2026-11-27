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
 *
 * 环境变量：KIMI_ROOT（默认 /opt/tft-kimi）
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.env.KIMI_ROOT || '/opt/tft-kimi'
const DT = path.join(ROOT, 'data/datatft')
const API = path.join(ROOT, 'data/current/api')
const WRITE_API = process.argv.includes('--write-api')

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

function main() {
  const teamsFile = path.join(DT, 'teams.json')
  if (!fs.existsSync(teamsFile)) {
    console.error('[merge] 缺少 data/datatft/teams.json，先跑 server/datatft.mjs')
    process.exit(1)
  }
  const teams = readJson(teamsFile).list || []
  const compsFile = path.join(API, 'comps.json')
  const metaComps = fs.existsSync(compsFile) ? readJson(compsFile).data || [] : []

  const stratDir = path.join(DT, 'strategy')
  const strategies = new Map()
  if (fs.existsSync(stratDir)) {
    for (const f of fs.readdirSync(stratDir)) {
      if (!f.endsWith('.json')) continue
      const j = readJson(path.join(stratDir, f))
      if (j?.data) strategies.set(Number(j.id), j.data)
    }
  }

  // 字段完整性
  const teamIssues = []
  const stratIssues = []
  for (const t of teams) {
    const c = completeness(t, REQUIRED_TEAM)
    if (!c.ok) teamIssues.push({ id: t.id, title: t.title, missing: c.missing })
    const s = strategies.get(Number(t.id))
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
  for (const t of teams) {
    const set = (t.heros || []).map((h) => key(h.key))
    const carry = key(t.heroId ? (t.heros || []).find((h) => h.id === t.heroId)?.key || '' : set[0])
    const strat = strategies.get(Number(t.id)) || null

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
      teams: teams.length,
      strategies: strategies.size,
      strategyMissing: teams.length - strategies.size,
    },
    metatft: { comps: metaComps.length },
    matching: {
      jaccardMin: JACCARD_MIN,
      jaccardStrict: JACCARD_STRICT,
      matched: pairs.length,
      matchedStrict: pairs.filter((p) => p.jaccard >= JACCARD_STRICT).length,
      unmatched: unmatched.length,
      rate: teams.length ? Number((pairs.length / teams.length).toFixed(3)) : 0,
      pairs,
      unmatchedList: unmatched,
    },
    fieldCompleteness: {
      teamIssues,
      strategyIssues: stratIssues,
    },
  }

  writeJson(path.join(DT, 'merged.json'), { generatedAt: report.generatedAt, count: merged.length, comps: merged })
  writeJson(path.join(DT, 'merge-report.json'), report)
  if (WRITE_API) writeJson(path.join(API, 'comps-datatft.json'), { success: true, data: merged })

  console.log(
    `[merge] dataTFT ${teams.length} 套（攻略 ${strategies.size}）/ MetaTFT ${metaComps.length} 套 → 对上 ${pairs.length}，独有 ${unmatched.length}，命中率 ${(report.matching.rate * 100).toFixed(1)}%`
  )
  if (teamIssues.length) console.log(`[merge] 列表字段缺失 ${teamIssues.length} 条`)
  if (stratIssues.length) console.log(`[merge] 攻略缺失/不全 ${stratIssues.length} 条`)
}

main()
