import fs from 'node:fs/promises'
import path from 'node:path'
const root = process.env.KIMI_ROOT || '/opt/tft-kimi'
const assets = path.join(root, 'android/assets')
const oldApi = path.join(assets, 'api')
await fs.mkdir(path.join(root, 'backup'), { recursive: true })
if (await fs.stat(oldApi).catch(() => null)) await fs.rename(oldApi, path.join(root, 'backup', 'api-seed-' + Date.now()))
const snapshot = await fs.realpath(path.join(root, 'data/current'))
await fs.cp(path.join(snapshot, 'api'), oldApi, { recursive: true })
await fs.copyFile(path.join(snapshot, 'manifest.json'), path.join(oldApi, 'manifest.json'))
const lk = JSON.parse(await fs.readFile(path.join(oldApi, 'lookups.json'), 'utf8')).data
for (const [cat, rows] of [['champions',lk.units],['items',lk.items],['augments',lk.augments]]) {
  const dir = path.join(assets, 'cdn/file/metatft', cat)
  const allowed = new Set(rows.map(x => x.apiName.toLowerCase() + '.png'))
  for (const row of rows) if (row.localIcon?.startsWith('/cdn/')) allowed.add(path.basename(row.localIcon))
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) if (entry.isFile() && !allowed.has(entry.name)) await fs.rm(path.join(dir, entry.name))
}
const dist = path.join(root, 'frontend/apps/react/dist')
const www = path.join(assets,'www')
if (await fs.stat(www).catch(() => null)) await fs.rename(www,path.join(root,'backup','www-' + Date.now()))
await fs.cp(dist,www,{recursive:true})
console.log('Fresh S19 snapshot and web build staged; seed API kept outside APK')
