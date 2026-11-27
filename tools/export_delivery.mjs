import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const root = process.env.KIMI_ROOT || '/opt/tft-kimi'
const apkName = 'tft基米助手-v1.2.1.apk'
const archiveName = 'tft-kimi-source-v1.2.1.tar.gz'
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const apk = await fs.readFile(path.join(root, 'out', apkName))
const acceptance = JSON.parse(await fs.readFile(path.join(root, 'docs/acceptance-results.json'), 'utf8'))
const visual = JSON.parse(await fs.readFile(path.join(root, 'docs/visual-results.json'), 'utf8'))
if (!acceptance.ok || !visual.ok) throw new Error('Acceptance must pass before delivery')
const bundled = JSON.parse(await fs.readFile(path.join(root, 'android/assets/api/manifest.json'), 'utf8'))
const current = JSON.parse(await fs.readFile(path.join(root, 'data/current/manifest.json'), 'utf8'))
const release = {
  app: 'tft基米助手', package: 'com.kimi.tft', version: '1.2.1', versionCode: 4,
  generatedAt: new Date().toISOString(),
  apk: { file: apkName, size: apk.length, sha256: sha(apk) },
  certificateSha256: '5a5e99f2f6b7c2d273f2507cea33380ef41675f8ff45a9cc135afb27757ffd0d',
  tests: { acceptance: acceptance.checks.length, visual: visual.checks.length },
  bundled: { version: bundled.version, counts: bundled.counts, detailCoverage: bundled.detailCoverage },
  cloud: { version: current.version, durationSeconds: current.durationSeconds, schedule: current.schedule },
}
await fs.writeFile(path.join(root, 'docs/release-info.json'), JSON.stringify(release, null, 2))
await fs.writeFile(path.join(root, 'out/release.json'), JSON.stringify({ ...release, apkUrl: (process.env.KIMI_PUBLIC_BASE || 'https://example.com/tft-kimi/') + 'apk/' + encodeURIComponent(apkName) }, null, 2))
await fs.writeFile(path.join(root, 'out', apkName + '.sha256'), sha(apk) + '  ' + apkName + '\n')
execFileSync('tar', [
  '--exclude=node_modules', '--exclude=.git', '--exclude=.env', '--exclude=.env.*',
  '--exclude=*.tsbuildinfo', '--exclude=*.bak', '--exclude=*.idsig',
  '--exclude=frontend/apps/react/dist', '--exclude=frontend/packages/*/dist',
  '--exclude=tests/generated', '--exclude=docs/nginx-before.conf',
  '--exclude=tools/apply_patch',
  '--exclude=docs/screenshots/acceptance-failure.png',
  // 公开归档白名单：交接/过程类内部件一律不进交付包
  '--exclude=docs/交接文档_*', '--exclude=docs/交接辅助',
  '--exclude=docs/基线对齐_*', '--exclude=docs/内部*',
  '--exclude=*.idsig', '--exclude=*.jks', '--exclude=*.p12', '--exclude=signing.env',
  '-czf', path.join(root, 'out', archiveName), '-C', root,
  'frontend', 'android', 'server', 'tests', 'tools', 'docs',
])
const archive = await fs.readFile(path.join(root, 'out', archiveName))
const info = { file: archiveName, size: archive.length, sha256: sha(archive), apkSha256: sha(apk) }
await fs.writeFile(path.join(root, 'out/source-info.json'), JSON.stringify(info, null, 2))
await fs.writeFile(path.join(root, 'out', archiveName + '.sha256'), info.sha256 + '  ' + archiveName + '\n')
console.log(JSON.stringify({ release, archive: info }, null, 2))
