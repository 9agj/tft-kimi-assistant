#!/usr/bin/env node
// 最小告警检查：抓取陈旧 / 证书临期 / 磁盘水位
// 用法：node tools/alert-check.mjs [--dry-run] [--json]
// 退出码：0 无告警，1 有告警，2 检查自身出错
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = process.env.KIMI_ROOT || '/root/tft-kimi'
const CONF = process.env.KIMI_ALERT_CONF || path.join(ROOT, 'config/alert.json')
const STATE = path.join(ROOT, 'logs/alert-state.json')
const OUTBOX = path.join(ROOT, 'logs/outbox')
const DRY = process.argv.includes('--dry-run')
const AS_JSON = process.argv.includes('--json')

const DEFAULTS = {
  to: null,
  smtp: null,                      // { host, port, user, pass } —— 未配置时只落 outbox
  scrapeStaleHours: 12,            // 4 小时一轮 × 3 轮未成功即告警
  certMinDays: 14,
  diskMaxPercent: 85,
  certPath: '/etc/letsencrypt/live/panel.13-184-199-233.sslip.io/cert.pem',
}

function loadConf() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONF, 'utf8')) } }
  catch { return { ...DEFAULTS } }
}
function readJson(p, fb = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return fb }
}
function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

const conf = loadConf()
const alerts = []
const facts = {}

// ---- 1. 抓取健康 ----
const status = readJson(path.join(ROOT, 'data/scrape-status.json'))
const state = readJson(STATE, { consecutiveFailures: 0 }) || { consecutiveFailures: 0 }
if (!status) {
  alerts.push({ id: 'scrape-status-missing', level: 'critical', title: '抓取状态文件缺失',
    detail: `找不到 ${path.join(ROOT, 'data/scrape-status.json')}，无法判断抓取健康度` })
  facts.scrape = null
} else {
  const fetchedAt = Date.parse(status.fetchedAt || '')
  const ageHours = Number.isFinite(fetchedAt) ? (Date.now() - fetchedAt) / 3.6e6 : Infinity
  const bad = status.ok !== true || status.running === true && ageHours > 6 || ageHours > conf.scrapeStaleHours
  state.consecutiveFailures = bad ? (state.consecutiveFailures || 0) + 1 : 0
  state.lastCheckAt = new Date().toISOString()
  state.lastVersion = status.version || null
  facts.scrape = { ok: status.ok, version: status.version, fetchedAt: status.fetchedAt,
    ageHours: Number(ageHours.toFixed(2)), consecutiveFailures: state.consecutiveFailures }
  if (state.consecutiveFailures >= 2) {
    alerts.push({ id: 'scrape-stale', level: 'critical', title: `抓取连续 ${state.consecutiveFailures} 轮异常`,
      detail: `最新快照 ${status.version || '未知'}，抓取于 ${status.fetchedAt || '未知'}，已 ${ageHours.toFixed(1)} 小时未成功（阈值 ${conf.scrapeStaleHours}h，连续 2 轮）` })
  }
}

// ---- 2. 证书临期 ----
try {
  const end = sh('openssl', ['x509', '-enddate', '-noout', '-in', conf.certPath]).replace('notAfter=', '')
  const days = (Date.parse(end) - Date.now()) / 8.64e7
  facts.cert = { notAfter: end, daysLeft: Number(days.toFixed(1)) }
  if (days < conf.certMinDays) {
    alerts.push({ id: 'cert-expiry', level: days < 3 ? 'critical' : 'warning',
      title: `HTTPS 证书剩余 ${days.toFixed(1)} 天`,
      detail: `${conf.certPath} 到期 ${end}，低于阈值 ${conf.certMinDays} 天；请确认 certbot.timer 正常并执行 renew --dry-run` })
  }
} catch (e) {
  alerts.push({ id: 'cert-unreadable', level: 'warning', title: '证书无法读取', detail: String(e.message || e) })
  facts.cert = null
}

// ---- 3. 磁盘水位 ----
try {
  const line = sh('df', ['-P', '/']).split('\n')[1].split(/\s+/)
  const pct = parseInt(line[4], 10)
  facts.disk = { mount: '/', usedPercent: pct, avail: line[3] }
  if (pct > conf.diskMaxPercent) {
    alerts.push({ id: 'disk-usage', level: pct > 92 ? 'critical' : 'warning',
      title: `根分区已用 ${pct}%`,
      detail: `阈值 ${conf.diskMaxPercent}%，剩余 ${line[3]}；优先清理 ${ROOT}/backup 与旧快照` })
  }
} catch (e) {
  alerts.push({ id: 'disk-unreadable', level: 'warning', title: '磁盘信息无法读取', detail: String(e.message || e) })
  facts.disk = null
}

// ---- 4. 输出 ----
if (!DRY) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true })
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2))
}

const stamp = new Date().toISOString()
if (alerts.length) {
  const rec = { at: stamp, host: 'tft-kimi', alerts, facts }
  if (!DRY) fs.appendFileSync(path.join(ROOT, 'logs/alerts.jsonl'), JSON.stringify(rec) + '\n')
  const body = [
    `tft基米助手 告警 ${stamp}`,
    '',
    ...alerts.map(a => `[${a.level}] ${a.title}\n  ${a.detail}`),
    '',
    '--- 现状 ---',
    JSON.stringify(facts, null, 2),
  ].join('\n')
  if (!DRY && conf.smtp && conf.to) {
    try {
      fs.mkdirSync(OUTBOX, { recursive: true })
      const eml = path.join(OUTBOX, `alert-${Date.now()}.eml`)
      fs.writeFileSync(eml, [
        `To: ${conf.to}`, 'From: tft-kimi@localhost',
        `Subject: [tft-kimi] ${alerts.map(a => a.title).join(' / ')}`,
        `Date: ${new Date().toUTCString()}`, 'Content-Type: text/plain; charset=utf-8', '', body,
      ].join('\r\n'))
      execFileSync('curl', ['-sS', '--url', `smtps://${conf.smtp.host}:${conf.smtp.port || 465}`,
        '--mail-from', conf.smtp.user, '--mail-rcpt', conf.to, '--upload-file', eml,
        '--user', `${conf.smtp.user}:${conf.smtp.pass}`, '--ssl-reqd'], { stdio: 'pipe' })
      fs.unlinkSync(eml)
      rec.delivered = 'smtp'
    } catch (e) { rec.delivered = 'failed: ' + (e.message || e) }
  } else {
    if (!DRY) {
      fs.mkdirSync(OUTBOX, { recursive: true })
      fs.writeFileSync(path.join(OUTBOX, `alert-${Date.now()}.txt`), body)
    }
    rec.delivered = conf.smtp ? 'no-recipient' : 'pending-smtp-config'
  }
  if (AS_JSON) console.log(JSON.stringify(rec, null, 2)); else console.log(body)
  process.exit(1)
}

if (AS_JSON) console.log(JSON.stringify({ at: stamp, alerts: [], facts }, null, 2))
else console.log(`[ok] 无告警 ${stamp}\n` + JSON.stringify(facts, null, 2))
process.exit(0)
