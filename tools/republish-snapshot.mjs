#!/usr/bin/env node
// 旧内容、新版本号重发：把一个已存在的快照原样复制成新版本号，用于
// 「数据本身没问题，但版本号已被手机端拒绝 / 需要重新触发同步」的场景。
// 默认 dry-run，只报告将要做什么；加 --apply 才落盘。
// 用法：node tools/republish-snapshot.mjs --to 20261127T120000-429 [--from <ver>] [--note "原因"] [--apply]
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const ROOT = process.env.KIMI_ROOT || '/opt/tft-kimi'
const SNAP = path.join(ROOT, 'data/snapshots')
const arg = (k, d = null) => {
  const i = process.argv.indexOf('--' + k)
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const APPLY = process.argv.includes('--apply')
const to = arg('to')
const note = arg('note', '')
let from = arg('from')

const die = m => { console.error('错误: ' + m); process.exit(2) }
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')

if (!to) die('缺少 --to <新版本号>')
if (!/^\d{8}T\d{6}-\d+$/.test(to)) die(`新版本号格式应为 YYYYMMDDTHHMMSS-<build>，收到 ${to}`)
if (!from) {
  try { from = path.basename(fs.readlinkSync(path.join(ROOT, 'data/current'))) }
  catch { die('未指定 --from，且 data/current 不是符号链接') }
}
const srcDir = path.join(SNAP, from)
const dstDir = path.join(SNAP, to)
if (!fs.existsSync(srcDir)) die(`源快照不存在: ${srcDir}`)
if (fs.existsSync(dstDir)) die(`目标快照已存在，拒绝覆盖: ${dstDir}`)
if (from === to) die('新旧版本号相同')

const srcManifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'manifest.json'), 'utf8'))
const newManifest = {
  ...srcManifest,
  version: to,
  republishedFrom: from,
  republishedAt: new Date().toISOString(),
  ...(note ? { republishNote: note } : {}),
}

// 逐文件比对用清单
const walk = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name)
  return e.isDirectory() ? walk(p, base) : [path.relative(base, p)]
})

console.log(JSON.stringify({
  mode: APPLY ? 'apply' : 'dry-run',
  from, to,
  source: { version: srcManifest.version, fetchedAt: srcManifest.fetchedAt, counts: srcManifest.counts },
  note: note || null,
  plan: [
    `复制 ${srcDir} → ${dstDir}`,
    `把 manifest.version 由 ${srcManifest.version} 改写为 ${to}`,
    APPLY ? '原子切换 data/current 指向新快照' : '（dry-run 不落盘、不切换）',
  ],
}, null, 2))

if (!APPLY) { console.log('\n未加 --apply，未做任何改动。'); process.exit(0) }

// 1) 复制
fs.cpSync(srcDir, dstDir, { recursive: true })
// 2) 改写 manifest
fs.writeFileSync(path.join(dstDir, 'manifest.json'), JSON.stringify(newManifest, null, 2) + '\n')
// 3) 校验：除 manifest.json 外，两棵树的文件集合与哈希必须完全一致
const a = walk(srcDir).filter(p => p !== 'manifest.json').sort()
const b = walk(dstDir).filter(p => p !== 'manifest.json').sort()
if (a.join('\n') !== b.join('\n')) die('文件集合不一致，已中止（目标目录保留，请人工检查）')
const diffs = a.filter(p => sha(path.join(srcDir, p)) !== sha(path.join(dstDir, p)))
if (diffs.length) die(`内容不一致 ${diffs.length} 个文件，已中止: ${diffs.slice(0, 5).join(', ')}`)

// 4) 原子切换 current
const tmpLink = path.join(ROOT, 'data/.current.next')
try { fs.unlinkSync(tmpLink) } catch {}
fs.symlinkSync(path.join('snapshots', to), tmpLink)
fs.renameSync(tmpLink, path.join(ROOT, 'data/current'))

console.log(JSON.stringify({
  ok: true, to,
  verifiedFiles: a.length,
  current: fs.readlinkSync(path.join(ROOT, 'data/current')),
  manifest: { version: newManifest.version, republishedFrom: newManifest.republishedFrom, republishedAt: newManifest.republishedAt },
}, null, 2))
