// Production web server for Flanagan Construction.
//
// Why this exists: the site is a static Vite/React build, but Railway (and any
// container host) needs a real process that listens on the injected $PORT and
// binds to 0.0.0.0 — otherwise the deploy has nothing to route to and the page
// never goes live. This zero-dependency Node server serves the built `dist/`
// folder with gzip + caching, falls back to index.html for client-side routes,
// exposes a /health check for Railway, and captures rate-limited quote leads at
// POST /api/lead. Security headers (incl. HSTS + CSP) are applied to every
// response.

import http from 'node:http'
import zlib from 'node:zlib'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { appendFile, readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildWebhookPayload } from './lead-delivery.js'

const root = fileURLToPath(new URL('.', import.meta.url))
const distDir = resolve(root, 'dist')
const port = Number(process.env.PORT) || 8080
const host = '0.0.0.0'
const leadWebhookUrl = process.env.LEAD_WEBHOOK_URL || ''

// The canonical domain baked into index.html / robots / sitemap at build time.
// At request time it is rewritten to the actual serving origin (see withOrigin)
// so canonical + Open Graph URLs are correct on the Railway URL or a custom domain.
const canonicalBase = 'https://flanaganconstructionde.com'

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

const compressibleExt = new Set([
  '.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml', '.webmanifest', '.map',
])

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "img-src 'self' data: https://images.unsplash.com",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    'upgrade-insecure-requests',
  ].join('; '),
}

const notFoundHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found | Flanagan Construction</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#161616;color:#fff;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px}h1{font-size:clamp(2rem,6vw,3rem);margin:0 0 8px}a{color:#f2b84b;font-weight:800}</style></head><body><div><h1>404</h1><p>That page moved or never existed.</p><p><a href="/">&larr; Back to Flanagan Construction</a></p></div></body></html>`

function acceptsGzip(req) {
  return /\bgzip\b/.test(req.headers['accept-encoding'] || '')
}

function send(res, status, headers, body, gzip = false) {
  const finalHeaders = { ...securityHeaders, ...headers }

  if (body && typeof body.pipe === 'function') {
    if (gzip) {
      finalHeaders['Content-Encoding'] = 'gzip'
      finalHeaders['Vary'] = 'Accept-Encoding'
      res.writeHead(status, finalHeaders)
      body.pipe(zlib.createGzip()).pipe(res)
    } else {
      res.writeHead(status, finalHeaders)
      body.pipe(res)
    }
    return
  }

  if (gzip && body && (typeof body === 'string' || Buffer.isBuffer(body))) {
    const compressed = zlib.gzipSync(body)
    finalHeaders['Content-Encoding'] = 'gzip'
    finalHeaders['Vary'] = 'Accept-Encoding'
    finalHeaders['Content-Length'] = Buffer.byteLength(compressed)
    res.writeHead(status, finalHeaders)
    res.end(compressed)
    return
  }

  res.writeHead(status, finalHeaders)
  res.end(body)
}

function sendJson(res, status, payload, gzip = false) {
  send(res, status, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(payload), gzip)
}

// Vite emits content-hashed asset names (e.g. index-DiNKpkIN.js). Those can be
// cached forever; everything else (especially index.html) must revalidate.
function cacheControlFor(ext, filePath) {
  if (ext === '.html') return 'no-cache'
  if (/-[A-Za-z0-9_-]{8,}\.\w+$/.test(filePath)) return 'public, max-age=31536000, immutable'
  return 'public, max-age=3600'
}

function requestOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https'
  const hostHeader = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim()
  return hostHeader ? `${proto}://${hostHeader}` : canonicalBase
}

function withOrigin(text, req) {
  const origin = requestOrigin(req)
  return origin === canonicalBase ? text : text.split(canonicalBase).join(origin)
}

async function serveIndex(req, res, gzipOk) {
  const indexPath = join(distDir, 'index.html')
  if (!existsSync(indexPath)) {
    send(res, 404, { 'Content-Type': 'text/html; charset=utf-8' }, notFoundHtml, gzipOk)
    return
  }
  const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }
  if (req.method === 'HEAD') {
    send(res, 200, headers, null)
    return
  }
  const html = withOrigin(await readFile(indexPath, 'utf8'), req)
  send(res, 200, headers, html, gzipOk)
}

async function serveTextWithOrigin(req, res, filePath, contentType, gzipOk) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found')
    return
  }
  const headers = { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' }
  if (req.method === 'HEAD') {
    send(res, 200, headers, null)
    return
  }
  const body = withOrigin(await readFile(filePath, 'utf8'), req)
  send(res, 200, headers, body, gzipOk)
}

function tryServeFile(res, filePath, method, gzipOk) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false
  const ext = extname(filePath).toLowerCase()
  const headers = {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Cache-Control': cacheControlFor(ext, filePath),
  }
  if (method === 'HEAD') {
    send(res, 200, headers, null)
    return true
  }
  send(res, 200, headers, createReadStream(filePath), gzipOk && compressibleExt.has(ext))
  return true
}

function pathLooksLikeFile(pathname) {
  const last = pathname.split('/').pop() || ''
  return last.includes('.')
}

function clientIp(req) {
  return (
    String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    ''
  )
}

// Simple in-memory sliding-window rate limiter for the lead endpoint.
const rateWindowMs = 10 * 60 * 1000
const rateMax = 6
const rateHits = new Map()

function isRateLimited(ip) {
  const now = Date.now()
  const recent = (rateHits.get(ip) || []).filter((t) => now - t < rateWindowMs)
  recent.push(now)
  rateHits.set(ip, recent)
  // Keep the map from growing unbounded on a long-running process.
  if (rateHits.size > 5000) {
    for (const [key, hits] of rateHits) {
      if (!hits.some((t) => now - t < rateWindowMs)) rateHits.delete(key)
    }
  }
  return recent.length > rateMax
}

async function handleLead(req, res, gzipOk) {
  const ip = clientIp(req)
  if (isRateLimited(ip)) {
    sendJson(res, 429, { ok: false, error: 'Too many requests. Please try again later.' }, gzipOk)
    return
  }

  let body = ''
  let aborted = false
  req.on('data', (chunk) => {
    body += chunk
    if (body.length > 100000) {
      aborted = true
      req.destroy()
    }
  })
  req.on('end', async () => {
    if (aborted) return
    let data
    try {
      data = JSON.parse(body || '{}')
    } catch {
      sendJson(res, 400, { ok: false, error: 'Invalid request.' }, gzipOk)
      return
    }

    // Honeypot: real visitors never fill the hidden "company" field; bots do.
    if (data.company) {
      sendJson(res, 200, { ok: true }, gzipOk)
      return
    }

    const name = String(data.name || '').trim()
    const phone = String(data.phone || '').trim()
    if (!name || !phone) {
      sendJson(res, 422, { ok: false, error: 'Name and phone are required.' }, gzipOk)
      return
    }

    const lead = {
      name,
      phone,
      email: String(data.email || '').trim(),
      projectType: String(data.projectType || '').trim(),
      budget: String(data.budget || '').trim(),
      timeline: String(data.timeline || '').trim(),
      message: String(data.message || '').trim(),
      source: 'flanagan-construction-website',
      receivedAt: new Date().toISOString(),
      ip,
    }

    // Always surface the lead in the deploy logs so it is never silently lost.
    console.log('[LEAD]', JSON.stringify(lead))

    // Best-effort durable copy (note: container disks are ephemeral on Railway).
    try {
      await appendFile(join(root, 'leads.log'), `${JSON.stringify(lead)}\n`)
    } catch (error) {
      console.error('[LEAD] could not write leads.log:', error?.message)
    }

    // Optional fan-out to a CRM / Zapier / Make / Slack / Discord webhook.
    if (leadWebhookUrl) {
      try {
        await fetch(leadWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildWebhookPayload(leadWebhookUrl, lead)),
        })
      } catch (error) {
        console.error('[LEAD] webhook delivery failed:', error?.message)
      }
    }

    sendJson(res, 200, { ok: true }, gzipOk)
  })
  req.on('error', () => {
    try {
      sendJson(res, 400, { ok: false, error: 'Request error.' }, gzipOk)
    } catch {
      /* response already sent */
    }
  })
}

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET'
  const pathname = decodeURIComponent((req.url || '/').split('?')[0])
  const gzipOk = acceptsGzip(req)

  // Health check for Railway / uptime monitors.
  if (pathname === '/health' || pathname === '/healthz') {
    sendJson(res, 200, { status: 'ok' })
    return
  }

  // Lead capture endpoint.
  if (pathname === '/api/lead') {
    if (method === 'POST') {
      await handleLead(req, res, gzipOk)
    } else {
      send(res, 405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'POST' }, JSON.stringify({ ok: false, error: 'Method not allowed' }))
    }
    return
  }

  if (method !== 'GET' && method !== 'HEAD') {
    send(res, 405, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Method not allowed')
    return
  }

  // robots.txt and sitemap.xml: rewrite the canonical domain to the serving
  // origin so they are correct on the Railway URL or any custom domain.
  if (pathname === '/robots.txt') {
    await serveTextWithOrigin(req, res, join(distDir, 'robots.txt'), 'text/plain; charset=utf-8', gzipOk)
    return
  }
  if (pathname === '/sitemap.xml') {
    await serveTextWithOrigin(req, res, join(distDir, 'sitemap.xml'), 'application/xml; charset=utf-8', gzipOk)
    return
  }

  // The SPA shell: canonical + Open Graph URLs are rewritten to the serving
  // origin so links and social share previews resolve on whatever domain is used.
  if (pathname === '/' || pathname === '/index.html') {
    await serveIndex(req, res, gzipOk)
    return
  }

  // Resolve the request to a real file inside dist/, guarding against traversal.
  let relativePath = pathname
  if (relativePath.endsWith('/')) relativePath += 'index.html'
  const filePath = normalize(join(distDir, relativePath))
  if (!filePath.startsWith(distDir)) {
    send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Forbidden')
    return
  }

  if (tryServeFile(res, filePath, method, gzipOk)) return

  // A request for something with an extension is a genuine 404; anything else
  // is a client-side route, so serve the SPA shell.
  if (pathLooksLikeFile(pathname)) {
    send(res, 404, { 'Content-Type': 'text/html; charset=utf-8' }, method === 'HEAD' ? null : notFoundHtml, gzipOk && method !== 'HEAD')
    return
  }

  await serveIndex(req, res, gzipOk)
})

if (!existsSync(distDir)) {
  console.error(`[server] dist/ not found at ${distDir}. Run "npm run build" before starting.`)
}

server.listen(port, host, () => {
  console.log(`[server] Flanagan Construction listening on http://${host}:${port}`)
  if (leadWebhookUrl) console.log('[server] Lead webhook forwarding is enabled.')
})
