#!/usr/bin/env node
// 快照只读校验：核对 manifest 与磁盘上的文件、以及 data.zip 是否一致。
// 只读——不写任何文件、不改 current 指向、不联网。
//
// 用法：
//   node tools/verify_snapshot_readonly.mjs                  # 校验 data/current
//   node tools/verify_snapshot_readonly.mjs --snapshot 20261127T040648-429
//   node tools/verify_snapshot_readonly.mjs --snapshot /path/to/snapshots/xxx
//   node tools/verify_snapshot_readonly.mjs --quiet           # 只输出结论
//
// 退出码：0 通过 / 1 校验失败 / 2 参数或环境错误

import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'

const root = process.env.KIMI_ROOT || '/opt/tft-kimi'

// 客户端强制要求的核心文档；augmentRanking 不在其中，缺失只告警
const CORE = [
  'api/seasons.json',
  'api/lookups.json',
  'api/comps.json',
  'api/units.json',
  'api/items.json',
  'api/augments.json',
  'api/unitItems.json',
  'api/meta.json',
]
const OPTIONAL = ['api/augmentRanking.json']

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const quiet = process.argv.includes('--quiet')
const log = (...a) => { if (!quiet) console.log(...a) }

function sha256(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256')
    createReadStream(file)
      .on('data', (c) => h.update(c))
      .on('end', () => resolve(h.digest('hex')))
      .on('error', reject)
  })
}

async function main() {
  const snapArg = arg('snapshot', null)
  let dir
  if (!snapArg) {
    dir = path.join(root, 'data/current')
  } else if (snapArg.includes('/')) {
    dir = snapArg
  } else {
    dir = path.join(root, 'data/snapshots', snapArg)
  }

  let real
  try {
    real = await fs.realpath(dir)
  } catch {
    console.error(`找不到快照目录：${dir}`)
    process.exit(2)
  }

  const manifestPath = path.join(real, 'manifest.json')
  let manifest
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  } catch (e) {
    console.error(`读取 manifest 失败：${manifestPath}（${e.message}）`)
    process.exit(2)
  }

  const errors = []
  const warnings = []
  const files = Array.isArray(manifest.files) ? manifest.files : []

  log(`快照目录  ${real}`)
  log(`版本      ${manifest.version || '(缺失)'}`)
  log(`数据源    ${manifest.set || '(缺失)'}  抓取于 ${manifest.fetchedAt || '(缺失)'}`)
  log(`文件数    ${files.length}`)
  log('')

  if (!manifest.version) errors.push('manifest 缺少 version')
  if (!files.length) errors.push('manifest.files 为空')

  // 1) 逐文件核对大小与哈希
  let sizeBad = 0
  let hashBad = 0
  for (const f of files) {
    if (!f || typeof f.path !== 'string') { errors.push('manifest.files 含非法条目'); continue }
    const p = path.join(real, f.path)
    let st
    try {
      st = await fs.stat(p)
    } catch {
      errors.push(`缺文件 ${f.path}`)
      continue
    }
    if (typeof f.size === 'number' && st.size !== f.size) {
      sizeBad++
      errors.push(`大小不符 ${f.path}：manifest ${f.size} / 磁盘 ${st.size}`)
      continue
    }
    if (f.sha256) {
      const got = await sha256(p)
      if (got !== f.sha256) {
        hashBad++
        errors.push(`哈希不符 ${f.path}：manifest ${f.sha256.slice(0, 16)}… / 磁盘 ${got.slice(0, 16)}…`)
      }
    }
  }
  log(`逐文件核对  通过 ${files.length - sizeBad - hashBad} / 大小错 ${sizeBad} / 哈希错 ${hashBad}`)

  // 2) 核心文档必须在
  const have = new Set(files.map((f) => f && f.path))
  for (const c of CORE) if (!have.has(c)) errors.push(`缺少核心文档 ${c}`)
  for (const o of OPTIONAL) if (!have.has(o)) warnings.push(`可选文档缺失 ${o}（客户端不强制）`)

  // 3) data.zip 与 manifest 记录一致
  const bundle = manifest.bundle
  if (bundle && bundle.path) {
    const zipPath = path.join(root, 'data', bundle.path.replace(/^data\//, ''))
    try {
      const st = await fs.stat(zipPath)
      if (typeof bundle.size === 'number' && st.size !== bundle.size) {
        errors.push(`data.zip 大小不符：manifest ${bundle.size} / 磁盘 ${st.size}`)
      }
      if (bundle.sha256) {
        const got = await sha256(zipPath)
        if (got !== bundle.sha256) errors.push(`data.zip 哈希不符：manifest ${bundle.sha256.slice(0, 16)}… / 磁盘 ${got.slice(0, 16)}…`)
      }
      log(`data.zip    ${st.size} 字节，哈希${bundle.sha256 ? '已核对' : '未记录'}`)
    } catch {
      errors.push(`data.zip 不存在：${zipPath}`)
    }
  } else {
    warnings.push('manifest 未记录 bundle，跳过 data.zip 核对')
  }

  // 4) 抓取告警透传
  if (Array.isArray(manifest.warnings) && manifest.warnings.length) {
    warnings.push(`manifest.warnings：${manifest.warnings.join(' / ')}`)
  }

  log('')
  if (warnings.length) {
    log('告警：')
    for (const w of warnings) log(`  - ${w}`)
    log('')
  }
  if (errors.length) {
    console.error(`校验失败，${errors.length} 项问题：`)
    for (const e of errors.slice(0, 40)) console.error(`  - ${e}`)
    if (errors.length > 40) console.error(`  …另有 ${errors.length - 40} 项`)
    process.exit(1)
  }
  console.log(`校验通过：${files.length} 个文件、版本 ${manifest.version}`)
}

main().catch((e) => {
  console.error(`内部错误：${e.stack || e.message}`)
  process.exit(2)
})
