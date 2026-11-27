import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { requireSet, transformComps, transformDetail, transformCatalog, deriveUnitItems } from './model.mjs'
import { transformAugmentRanking, emptyAugmentRanking, AUGMENT_RANKING_URL } from './augment-ranking.mjs'
import { applyDatatft } from './datatft-apply.mjs'

const ROOT = process.env.KIMI_ROOT ?? '/opt/tft-kimi'
const DATA = path.join(ROOT, 'data')
const BASE = 'https://api-hc.metatft.com'
const CDN = path.join(ROOT, 'android/assets/cdn/file/metatft')
const started = Date.now()
const warnings = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
const hash = b => crypto.createHash('sha256').update(b).digest('hex')
const wrap = data => ({ success: true, data })
const stateFile = path.join(DATA, 'scrape-status.json')
async function atomic(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await fs.writeFile(tmp, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data))
  await fs.rename(tmp, file)
}
async function get(url, binary = false) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'tft-kimi-assistant/1.0 (S19 reference data)', Accept: binary ? 'image/*' : 'application/json' }, signal: AbortSignal.timeout(35000) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      if (binary) return Buffer.from(await r.arrayBuffer())
      return await r.json()
    } catch (e) {
      if (attempt >= 2) throw new Error(`${url}: ${e.message}`)
      await sleep(2500 * (attempt + 1))
    }
  }
}
function imageName(value) {
  return String(value ?? '').split('/').at(-1).replace(/\.(?:tex|png).*$/i, '').toLowerCase()
}
async function collectIcons(lk) {
  let downloaded = 0, failed = 0
  const tasks = []
  for (const [cat, records] of [['champions', lk.units], ['items', lk.items], ['traits', lk.traits], ['augments', lk.augments]]) {
    for (const record of records) {
      const canonical = record.apiName.toLowerCase()
      const original = path.join(CDN, cat, `${canonical}.png`)
      const exists = await fs.stat(original).then(s => s.size > 100).catch(() => false)
      const name = exists || cat === 'champions' ? canonical : imageName(record.icon)
      if (!name || !/^[a-z0-9_-]+$/.test(name)) continue
      const file = path.join(CDN, cat, `${name}.png`)
      record.localIcon = `/cdn/file/metatft/${cat}/${name}.png`
      tasks.push(async () => {
        try { if ((await fs.stat(file)).size > 100) return } catch {}
        try {
          const data = await get(`https://cdn.metatft.com/file/metatft/${cat}/${name}.png`, true)
          if (data.length < 100 || !(data[0] === 0x89 && data[1] === 0x50)) throw new Error('Invalid PNG')
          await atomic(file, data)
          downloaded++
        } catch { failed++; record.localIcon = '/art/hachimi.png' }
        await sleep(80)
      })
    }
  }
  const work = async () => { for (;;) { const task = tasks.shift(); if (!task) return; await task() } }
  await Promise.all([work(), work(), work()])
  console.log(`Icons: ${downloaded} downloaded, ${failed} unresolved`)
  if (failed) warnings.push(`${failed} source icons unavailable; local cat fallback used`)
}
async function main() {
  await fs.mkdir(DATA, { recursive: true })
  await atomic(stateFile, { running: true, startedAt: new Date(started).toISOString(), set: 'TFTSet19' })
  const lk = requireSet(await get('https://data.metatft.com/lookups/TFTSet19_latest_zh_cn.json'))
  const rawComps = requireSet(await get(`${BASE}/tft-comps-api/comps_data?queue=PBE`))
  await sleep(1000)
  const stats = requireSet(await get(`${BASE}/tft-comps-api/comps_stats?queue=PBE&patch=current&days=1&permit_filter_adjustment=true`))
  const comps = transformComps(rawComps, stats, lk)
  if (comps.length < 5) throw new Error('Insufficient valid S19 comps')
  const [unitsRaw, itemsRaw] = await Promise.all([
    get(`${BASE}/tft-stat-api/units?queue=PBE&patch=current&days=1&permit_filter_adjustment=true`),
    get(`${BASE}/tft-stat-api/items?queue=PBE&patch=current&days=1&permit_filter_adjustment=true`),
  ])
  const units = transformCatalog(unitsRaw, lk, 'units')
  const items = transformCatalog(itemsRaw, lk, 'items')
  const previousLink = await fs.readlink(path.join(DATA, 'current')).catch(() => null)
  let augmentRanking
  try {
    augmentRanking = transformAugmentRanking(await get(AUGMENT_RANKING_URL), lk)
  } catch (error) {
    const cached = previousLink && await fs.readFile(path.join(DATA, previousLink, 'api/augmentRanking.json'), 'utf8').catch(() => null)
    try {
      const old = cached ? JSON.parse(cached).data : null
      augmentRanking = old?.catalogSet === 'TFTSet19' && old?.groups?.some(g => g.content?.length)
        ? { ...old, cached: true } : emptyAugmentRanking()
    } catch { augmentRanking = emptyAugmentRanking() }
    warnings.push('Augment ranking fallback: ' + error.message)
  }
  const details = new Map()
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i]
    try {
      const raw = await get(`${BASE}/tft-comps-api/comp_details?queue=PBE&cluster_id=${c.clusterId}&comp=${c.id}`)
      details.set(c.compId, transformDetail(raw, c, lk))
      console.log(`Detail ${i + 1}/${comps.length}: ${c.compId}`)
    } catch (e) {
      const old = previousLink && await fs.readFile(path.join(DATA, previousLink, `api/comps/${c.compId}.json`), 'utf8').catch(() => null)
      if (!old) throw e
      const doc = JSON.parse(old)
      details.set(c.compId, doc.data)
      warnings.push(`Cached detail retained: ${c.compId}`)
    }
    await sleep(1100)
  }
  // dataTFT 增强：挂攻略 + 追加独有阵容。属于可选增强，失败不影响主抓取。
  let datatft = null
  try {
    const applied = applyDatatft({ comps, details, lk, root: ROOT })
    if (applied) {
      datatft = applied.doc
      console.log(`dataTFT: 攻略 ${applied.guided} 套 / 独有阵容 ${applied.added} 套`)
      if (typeof applied.ageDays === 'number' && applied.ageDays > 7)
        warnings.push(`dataTFT 攻略已 ${applied.ageDays} 天未更新`)
    }
  } catch (e) {
    warnings.push('dataTFT 合并跳过: ' + e.message)
  }
  await collectIcons(lk)
  // The global unit_items endpoint serves S18. Derive recommendations exclusively from S19 details.
  const unitItems = deriveUnitItems([...details.values()])
  const groups = ['Silver', 'Gold', 'Prismatic'].map((rarity, i) => ({
    label: ['银色强化', '金色强化', '棱彩强化'][i], color: ['#9a9996', '#b38a35', '#967aaa'][i],
    content: lk.augments.filter(a => a.rarity === rarity).map(a => ({ id: a.apiName, type: 'augment' })),
  }))
  const version = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}-${rawComps.results.data.cluster_id}`
  const snapshot = path.join(DATA, 'snapshots', version)
  const api = path.join(snapshot, 'api')
  await fs.mkdir(path.join(api, 'comps'), { recursive: true })
  const docs = new Map([
    ['seasons.json', wrap([{ season: 'S19', queue: 'PBE' }])], ['lookups.json', wrap(lk)],
    ['comps.json', wrap(comps)], ['units.json', wrap(units)], ['items.json', wrap(items)],
    ['augments.json', wrap(groups)], ['augmentRanking.json', wrap(augmentRanking)], ['unitItems.json', wrap(unitItems)],
    ['meta.json', { set: 'TFTSet19', season: 'S19', queue: 'PBE', patch: lk._metadata.patch, source: 'MetaTFT', fetchedAt: new Date().toISOString(), refreshHours: 4, augmentRankingAvailable: augmentRanking.isCurrentSet, augmentRankingReferenceAvailable: augmentRanking.ratedIds > 0, augmentRankingSet: augmentRanking.rankingSet }],
  ])
  if (datatft) docs.set('datatft.json', datatft)
  for (const [id, d] of details) docs.set(`comps/${id}.json`, wrap(d))
  const files = []
  for (const [name, doc] of docs) {
    const bytes = Buffer.from(JSON.stringify(doc))
    await fs.writeFile(path.join(api, name), bytes)
    files.push({ path: `api/${name}`, size: bytes.length, sha256: hash(bytes) })
  }
  execFileSync('zip', ['-q', '-r', '-9', 'data.zip', 'api'], { cwd: snapshot })
  const zip = await fs.readFile(path.join(snapshot, 'data.zip'))
  const manifest = {
    version, set: 'TFTSet19', season: 'S19', queue: 'PBE', patch: lk._metadata.patch,
    source: 'MetaTFT', fetchedAt: new Date().toISOString(),
    sourceUpdatedAt: new Date(rawComps.updated).toISOString(),
    refreshHours: 4, schedule: '00:05,04:05,08:05,12:05,16:05,20:05 Asia/Shanghai',
    durationSeconds: Math.round((Date.now() - started) / 1000),
    counts: { comps: comps.length, details: details.size, units: lk.units.filter(u => u.shopUnit).length, unitRecords: lk.units.length, unitStats: units.length, items: lk.items.length, itemStats: items.length, traits: lk.traits.length, augments: lk.augments.length },
    detailCoverage: { positioningComplete: [...details.values()].filter(d => d.positioningComplete).length, items: [...details.values()].filter(d => d.item.length).length, transition: [...details.values()].filter(d => Object.values(d.early_options).some(x => x.length)).length, variants: [...details.values()].filter(d => Object.values(d.options).some(x => x.length)).length },
    augmentRankingAvailable: augmentRanking.isCurrentSet,
    augmentRankingReferenceAvailable: augmentRanking.ratedIds > 0,
    augmentRankingSet: augmentRanking.rankingSet, warnings, files,
    bundle: { path: `snapshots/${version}/data.zip`, size: zip.length, sha256: hash(zip) },
  }
  await atomic(path.join(snapshot, 'manifest.json'), manifest)
  await fs.symlink(`snapshots/${version}`, path.join(DATA, 'current.next'))
  await fs.rename(path.join(DATA, 'current.next'), path.join(DATA, 'current'))
  await atomic(stateFile, { running: false, ok: true, ...manifest, files: undefined, bundle: undefined })
  const saved = (await fs.readdir(path.join(DATA, 'snapshots'))).sort().reverse()
  for (const old of saved.slice(4)) await fs.rm(path.join(DATA, 'snapshots', old), { recursive: true, force: true })
  console.log(JSON.stringify({ version, counts: manifest.counts, detailCoverage: manifest.detailCoverage, durationSeconds: manifest.durationSeconds, zipBytes: zip.length, warnings }, null, 2))
}
main().catch(async e => {
  console.error(e.stack)
  await atomic(stateFile, { running: false, ok: false, set: 'TFTSet19', failedAt: new Date().toISOString(), error: e.message, durationSeconds: Math.round((Date.now() - started) / 1000) })
  process.exitCode = 1
})
