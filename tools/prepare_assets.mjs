import fs from 'node:fs/promises'
import path from 'node:path'
const root = process.env.KIMI_ROOT || '/opt/tft-kimi'
const assets = path.join(root, 'android/assets')
const oldApi = path.join(assets, 'api')
async function pruneBackups(prefix, keep) {
  const dir = path.join(root, 'backup')
  const names = (await fs.readdir(dir).catch(() => []))
    .filter((n) => n.startsWith(prefix))
    .sort()
  const drop = names.slice(0, Math.max(0, names.length - keep))
  for (const n of drop) {
    await fs.rm(path.join(dir, n), { recursive: true, force: true })
    console.log('prune backup:', n)
  }
}

await fs.mkdir(path.join(root, 'backup'), { recursive: true })
if (await fs.stat(oldApi).catch(() => null)) await fs.rename(oldApi, path.join(root, 'backup', 'api-seed-' + Date.now()))
await pruneBackups('api-seed-', 3)
const snapshot = await fs.realpath(path.join(root, 'data/current'))
await fs.cp(path.join(snapshot, 'api'), oldApi, { recursive: true })
await fs.copyFile(path.join(snapshot, 'manifest.json'), path.join(oldApi, 'manifest.json'))
const lk = JSON.parse(await fs.readFile(path.join(oldApi, 'lookups.json'), 'utf8')).data
for (const [cat, rows] of [['champions',lk.units],['items',lk.items],['augments',lk.augments]]) {
  const dir = path.join(assets, 'cdn/file/metatft', cat)
  const allowed = new Set()
  const add = (n) => { allowed.add(n); allowed.add(n.replace(/\.png$/, '.webp')) }
  // 组件按 apiName 拼路径（Item/Champion/Trait），数据按 localIcon 引用（Augment），两套都要留
  for (const x of rows) if (x.apiName) add(x.apiName.toLowerCase() + '.png')
  for (const row of rows) if (row.localIcon?.startsWith('/cdn/')) add(path.basename(row.localIcon))
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) if (entry.isFile() && !allowed.has(entry.name)) await fs.rm(path.join(dir, entry.name))
  // apiName 与 localIcon 不同名时，补一份 apiName 命名的副本，避免组件取不到图
  for (const row of rows) {
    const api = (row.apiName || '').toLowerCase()
    if (!api || !row.localIcon?.startsWith('/cdn/')) continue
    const dst = path.join(dir, api + '.webp')
    if (await fs.stat(dst).catch(() => null)) continue
    const srcBase = path.join(assets, row.localIcon.replace(/^\//, '')).replace(/\.png$/, '')
    for (const ext of ['.webp', '.png']) {
      const src = srcBase + ext
      if (await fs.stat(src).catch(() => null)) { await fs.copyFile(src, dst); break }
    }
  }
}
// 抓取时 cdn 里会重新落地 PNG；这里统一转成 WebP 并删掉 PNG，避免 APK 里两份图共存。
// 客户端请求的是 .png，LocalServer 找不到时会自动回落到同名 .webp。
async function toWebp() {
  const cdnDir = path.join(assets, 'cdn/file/metatft')
  const pngs = []
  const walk = async (dir) => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (entry.name.endsWith('.png') && entry.name !== 'placeholder.png') pngs.push(full)
    }
  }
  await walk(cdnDir)
  if (pngs.length === 0) return
  const py = `import sys
from PIL import Image
for p in sys.argv[1:]:
    try:
        Image.open(p).convert('RGBA').save(p[:-4] + '.webp', 'WEBP', quality=88, method=6)
        print('ok')
    except Exception as e:
        print('fail', p, e)
`
  const { spawnSync } = await import('node:child_process')
  const r = spawnSync('python3', ['-c', py, ...pngs], { encoding: 'utf8' })
  if (r.status !== 0) { console.log('webp convert skipped:', (r.stderr || '').slice(0, 200)); return }
  const ok = (r.stdout.match(/^ok$/gm) || []).length
  for (const p of pngs) {
    if (await fs.stat(p.slice(0, -4) + '.webp').then(s => s.size > 100).catch(() => false)) await fs.rm(p, { force: true })
  }
  console.log(`webp: ${ok}/${pngs.length} converted, png removed`)
}
await toWebp()

const dist = path.join(root, 'frontend/apps/react/dist')
const www = path.join(assets,'www')
if (await fs.stat(www).catch(() => null)) await fs.rename(www,path.join(root,'backup','www-' + Date.now()))
await pruneBackups('www-', 3)
await fs.cp(dist,www,{recursive:true})
console.log('Fresh S19 snapshot and web build staged; seed API kept outside APK')
