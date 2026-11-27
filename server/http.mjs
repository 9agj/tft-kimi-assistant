import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createReadStream } from 'node:fs'

const ROOT = process.env.KIMI_ROOT ?? '/root/tft-kimi'
const mime = { '.json': 'application/json', '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.zip': 'application/zip', '.apk': 'application/vnd.android.package-archive' }
const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return }
    const p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    if (p.includes('..') || p.includes('\\') || p.includes('\0')) { res.writeHead(400); res.end(); return }
    let file
    if (p === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, set: 'TFTSet19' })); return }
    if (p === '/api/manifest.json') file = path.join(ROOT, 'data/current/manifest.json')
    else if (p === '/manifest.json' || p === '/data.zip') file = path.join(ROOT, 'data/current', p)
    else if (/^\/snapshots\/[0-9A-Za-z-]+\/(data.zip|manifest.json)$/.test(p)) file = path.join(ROOT, 'data', p)
    else if (p === '/status.json') file = path.join(ROOT, 'data/scrape-status.json')
    else if (p === '/release.json') file = path.join(ROOT, 'out/release.json')
    else if (p.startsWith('/apk/')) file = path.join(ROOT, 'out', path.basename(p))
    else if (p.startsWith('/api/')) {
      const name = p.slice(5).replace(/\/unit-items$/, '/unitItems')
      file = path.join(ROOT, 'data/current/api', name === 'unit-items' ? 'unitItems.json' : /\.json$/.test(name) ? name : `${name}.json`)
    }
    else if (p.startsWith('/cdn/') || p.startsWith('/art/')) file = path.join(ROOT, 'android/assets', p)
    else file = path.join(ROOT, 'frontend/apps/react/dist', p === '/' ? 'index.html' : p)
    const stat = await fs.stat(file)
    if (!stat.isFile()) throw new Error('Not a file')
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': stat.size,
      'Cache-Control': p.startsWith('/snapshots/') ? 'public, max-age=604800, immutable' : 'no-store',
      'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff',
    })
    if (req.method === 'HEAD') res.end()
    else createReadStream(file).pipe(res)
  } catch { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, message: 'Resource not found' })) }
})
server.listen(Number(process.env.PORT ?? 8798), '127.0.0.1', () => console.log('tft-kimi read-only data server listening'))
