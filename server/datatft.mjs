#!/usr/bin/env node
/**
 * datatft.mjs — dataTFT（云顶大数据）抓取器
 *
 * 纯 node（>=18），用 curl 做 HTTP 客户端，因此天然支持 http / socks5 代理，
 * 也就能在命中风控时立刻换出口 IP 重试同一条请求。
 *
 * 用法：
 *   node server/datatft.mjs                 # 全量：列表 + 每个阵容攻略
 *   node server/datatft.mjs --list-only     # 只抓列表
 *   node server/datatft.mjs --limit=5       # 只抓前 5 个阵容的攻略（调试）
 *   node server/datatft.mjs --dry-run       # 只打印计划，不发请求
 *
 * 环境变量：
 *   KIMI_ROOT               项目根，默认 /opt/tft-kimi
 *   KIMI_DATATFT_PROXIES    逗号分隔的代理列表，优先级最高，如 http://u:p@1.2.3.4:3129,socks5://5.6.7.8:1080
 *   KIMI_PROXYPOOL_API      ProxyPool 地址，默认 http://127.0.0.1:8789
 *   KIMI_PROXYPOOL_TOKEN    ProxyPool token；有值时会从 /api/proxies 拉可用代理补进池子
 *   KIMI_DATATFT_MAX_TRIES  单条请求最多换几个代理，默认 8
 *
 * 退出码：0 成功（含部分成功）；1 列表失败；2 全部失败
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'

const ROOT = process.env.KIMI_ROOT || '/opt/tft-kimi'
const OUT_DIR = path.join(ROOT, 'data/datatft')
const SITE = 'https://www.datatft.com'
const API = 'https://api.datatft.com'
const SALT = 'koTefnFEdaYDuLFmXyzt'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const LIST_BODY = { version: '19', season: '19', tier: 'all', time: '7' }

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const num = (f, d) => {
  const hit = argv.find((a) => a.startsWith(f + '='))
  return hit ? Number(hit.slice(f.length + 1)) : d
}
const LIST_ONLY = has('--list-only')
const DRY = has('--dry-run')
const LIMIT = num('--limit', 0)
const MAX_TRIES = num('--tries', Number(process.env.KIMI_DATATFT_MAX_TRIES || 8))

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 每次请求都新生成签名头：signature = md5(t + nonce + did + SALT) */
function signedHeaders(did) {
  const t = String(Date.now())
  const nonce = (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + '0000000000000000').slice(0, 16)
  return {
    'Content-Type': 'application/json',
    t,
    did,
    nonce,
    signature: md5(t + nonce + did + SALT),
    'Browser-Language': 'ZH-CN',
    'Accept-Language': 'CN',
    'App-Platform': 'tft',
    'User-Agent': UA,
    Origin: SITE,
    Referer: SITE + '/',
  }
}

/** 一次 curl POST，返回 {http, code, message, data, bytes, ms, error} */
function curlPost(url, body, headers, proxy, timeout = 25) {
  return new Promise((resolve) => {
    const args = ['-sS', '-m', String(timeout), '-X', 'POST', url, '-H', 'Expect:']
    for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`)
    args.push('--data-binary', JSON.stringify(body), '-w', '\n__META__%{http_code}')
    if (proxy) args.push('-x', proxy)
    const started = Date.now()
    execFile('curl', args, { maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
      const ms = Date.now() - started
      if (err && !stdout) {
        resolve({ http: 0, code: null, message: 'network: ' + (err.message || '').slice(0, 120), data: null, bytes: 0, ms })
        return
      }
      const idx = stdout.lastIndexOf('\n__META__')
      const text = idx >= 0 ? stdout.slice(0, idx) : stdout
      const http = idx >= 0 ? Number(stdout.slice(idx + 9)) : 0
      let json = null
      try {
        json = JSON.parse(text)
      } catch {
        /* 非 JSON（Tomcat 错误页等） */
      }
      resolve({
        http,
        code: json?.code ?? null,
        message: json?.message ?? (json ? '' : text.slice(0, 120)),
        data: json?.data ?? null,
        bytes: Buffer.byteLength(text),
        ms,
      })
    })
  })
}

/** 风控判定：42000 / 403 / 429 / 报文里带「系统异常」或当前出口 IP */
function isBlocked(r) {
  if (r.http === 0) return true
  if (r.http === 403 || r.http === 429) return true
  if (r.code === 42000) return true
  return /系统异常|cloudflare|challenge/i.test(String(r.message || ''))
}

/** 代理池：优先环境变量给的固定列表，再补 ProxyPool 里的 https 可用节点 */
async function buildProxyPool(log) {
  const list = []
  const fixed = (process.env.KIMI_DATATFT_PROXIES || '').split(',').map((s) => s.trim()).filter(Boolean)
  list.push(...fixed.map((url) => ({ url, source: 'env' })))

  const api = process.env.KIMI_PROXYPOOL_API || 'http://127.0.0.1:8789'
  const token = process.env.KIMI_PROXYPOOL_TOKEN || ''
  if (token) {
    const r = await curlGetJson(`${api}/api/proxies?token=${encodeURIComponent(token)}&limit=200`)
    const items = Array.isArray(r?.items) ? r.items : []
    const usable = items.filter((x) => x.https_ok === 1 && x.alive !== 0 && x.url)
    for (const x of usable) list.push({ url: x.url, source: 'proxypool', country: x.country, latency: x.latency_ms })
    log(`代理池：固定 ${fixed.length} 个 + ProxyPool 可用 ${usable.length} 个`)
  } else {
    log(`代理池：固定 ${fixed.length} 个（未配置 ProxyPool token）`)
  }
  // 去重，保持顺序
  const seen = new Set()
  return list.filter((p) => (seen.has(p.url) ? false : (seen.add(p.url), true)))
}

function curlGetJson(url) {
  return new Promise((resolve) => {
    execFile('curl', ['-sS', '-m', '15', url], { maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err) return resolve(null)
      try {
        resolve(JSON.parse(stdout))
      } catch {
        resolve(null)
      }
    })
  })
}

/** 带换 IP 的请求：命中风控就换下一个代理重试同一条 */
async function requestWithRotation(pool, state, pathname, body, log) {
  let last = null
  for (let i = 0; i < MAX_TRIES; i++) {
    const p = pool[state.cursor % pool.length]
    state.cursor++
    if (!p) break
    const did = state.did
    const r = await curlPost(API + pathname, body, signedHeaders(did), p.url)
    state.log.push({
      at: new Date().toISOString(),
      path: pathname,
      proxy: p.source,
      proxyHost: p.url.replace(/\/\/[^@]*@/, '//***@'),
      http: r.http,
      code: r.code,
      bytes: r.bytes,
      ms: r.ms,
      blocked: isBlocked(r),
    })
    if (!isBlocked(r)) {
      state.blocks = 0
      return r
    }
    last = r
    state.blocks++
    state.blocked.push({ proxy: p.url.replace(/\/\/[^@]*@/, '//***@'), code: r.code, message: String(r.message || '').slice(0, 80) })
    log(`  ✗ 风控/失败（${r.code ?? r.http}）→ 换 IP 重试 ${pathname}`)
    await sleep(600)
  }
  return last || { http: 0, code: null, message: 'no proxy', data: null, bytes: 0, ms: 0 }
}

function writeJsonAtomic(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1) + '\n')
  fs.renameSync(tmp, file)
}

const log = (m) => console.log(`[datatft] ${m}`)

async function main() {
  const pool = await buildProxyPool(log)
  if (!pool.length) {
    log('没有可用代理，终止（dataTFT 对裸 IP 直接返回 42000）')
    process.exit(2)
  }
  const state = {
    did: 'did_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now(),
    cursor: 0,
    blocks: 0,
    log: [],
    blocked: [],
  }
  log(`代理池 ${pool.length} 个，did=${state.did}`)
  if (DRY) {
    log('dry-run：计划 1 次 /team/list + 每阵容 1 次 /team/strategy，不发送请求')
    return
  }

  // 1) 列表
  const listRes = await requestWithRotation(pool, state, '/team/list', LIST_BODY, log)
  const teams = listRes?.data?.list
  if (!Array.isArray(teams)) {
    log(`列表失败：code=${listRes?.code} http=${listRes?.http} msg=${String(listRes?.message || '').slice(0, 100)}`)
    writeJsonAtomic(path.join(OUT_DIR, 'status.json'), {
      ok: false,
      at: new Date().toISOString(),
      stage: 'list',
      blocked: state.blocked,
      log: state.log,
    })
    process.exit(1)
  }
  log(`列表 OK：${teams.length} 套阵容`)
  writeJsonAtomic(path.join(OUT_DIR, 'teams.json'), {
    fetchedAt: new Date().toISOString(),
    count: teams.length,
    list: teams,
  })

  if (LIST_ONLY) {
    log('仅列表模式，结束')
    writeJsonAtomic(path.join(OUT_DIR, 'status.json'), {
      ok: true,
      at: new Date().toISOString(),
      teams: teams.length,
      strategies: 0,
      blocked: state.blocked,
      log: state.log,
    })
    return
  }

  // 2) 逐个阵容攻略
  const targets = LIMIT > 0 ? teams.slice(0, LIMIT) : teams
  const dir = path.join(OUT_DIR, 'strategy')
  fs.mkdirSync(dir, { recursive: true })
  let ok = 0
  const failed = []
  for (const t of targets) {
    const r = await requestWithRotation(pool, state, '/team/strategy', { id: t.id }, log)
    if (r && !isBlocked(r) && r.data) {
      writeJsonAtomic(path.join(dir, `${t.id}.json`), { id: t.id, fetchedAt: new Date().toISOString(), data: r.data })
      ok++
      log(`  ✓ ${t.id} ${t.title} ${r.bytes}B`)
    } else {
      failed.push({ id: t.id, title: t.title, code: r?.code, http: r?.http, message: String(r?.message || '').slice(0, 80) })
      log(`  ✗ ${t.id} ${t.title} code=${r?.code}`)
    }
    await sleep(800 + Math.random() * 700)
  }

  writeJsonAtomic(path.join(OUT_DIR, 'status.json'), {
    ok: failed.length === 0,
    at: new Date().toISOString(),
    teams: teams.length,
    strategies: ok,
    failed,
    blocked: state.blocked,
    log: state.log,
  })
  log(`完成：阵容 ${teams.length}，攻略 ${ok}/${targets.length}，换 IP ${state.blocked.length} 次`)
  process.exit(failed.length === targets.length && targets.length > 0 ? 2 : 0)
}

main().catch((e) => {
  log('异常：' + e.message)
  process.exit(2)
})
