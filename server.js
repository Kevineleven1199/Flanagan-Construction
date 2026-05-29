// Production web server for Flanagan Construction.
//
// Why this exists: the site is a static Vite/React build, but Railway (and any
// container host) needs a real process that listens on the injected $PORT and
// binds to 0.0.0.0 — otherwise the deploy has nothing to route to and the page
// never goes live. This zero-dependency Node server serves the built `dist/`
// folder, falls back to index.html for client-side routes (so deep links like
// /design-your-dream-bathroom work on refresh), exposes a /health check for
// Railway, and captures quote leads at POST /api/lead.

import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { appendFile, readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const distDir = resolve(root, 'dist')
const port = Number(process.env.PORT) || 8080
const host = '0.0.0.0'
const leadWebhookUrl = process.env.LEAD_WEBHOOK_URL || ''

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

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
}

function send(res, status, headers, body) {
  res.writeHead(status, { ...securityHeaders, ...headers })
  if (body && typeof body.pipe === 'function') body.pipe(res)
  else res.end(body)
}

function sendJson(res, status, payload) {
  send(res, status, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(payload))
}

// Vite emits content-hashed asset names (e.g. index-DiNKpkIN.js). Those can be
// cached forever; everything else (especially index.html) must revalidate.
function cacheControlFor(ext, filePath) {
  if (ext === '.html') return 'no-cache'
  if (/-[A-Za-z0-9_-]{8,}\.\w+$/.test(filePath)) return 'public, max-age=31536000, immutable'
  return 'public, max-age=3600'
}

function tryServeFile(res, filePath, method) {
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
  send(res, 200, headers, createReadStream(filePath))
  return true
}

function pathLooksLikeFile(pathname) {
  const last = pathname.split('/').pop() || ''
  return last.includes('.')
}

async function handleLead(req, res) {
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
      sendJson(res, 400, { ok: false, error: 'Invalid request.' })
      return
    }

    // Honeypot: real visitors never fill the hidden "company" field; bots do.
    if (data.company) {
      sendJson(res, 200, { ok: true })
      return
    }

    const name = String(data.name || '').trim()
    const phone = String(data.phone || '').trim()
    if (!name || !phone) {
      sendJson(res, 422, { ok: false, error: 'Name and phone are required.' })
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
      ip: (String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '',
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
          body: JSON.stringify(lead),
        })
      } catch (error) {
        console.error('[LEAD] webhook delivery failed:', error?.message)
      }
    }

    sendJson(res, 200, { ok: true })
  })
  req.on('error', () => {
    try {
      sendJson(res, 400, { ok: false, error: 'Request error.' })
    } catch {
      /* response already sent */
    }
  })
}

const server = http.createServer(async (req, res) => {
  const method = req.method || 'GET'
  const pathname = decodeURIComponent((req.url || '/').split('?')[0])

  // Health check for Railway / uptime monitors.
  if (pathname === '/health' || pathname === '/healthz') {
    sendJson(res, 200, { status: 'ok' })
    return
  }

  // Lead capture endpoint.
  if (pathname === '/api/lead') {
    if (method === 'POST') {
      await handleLead(req, res)
    } else {
      send(res, 405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'POST' }, JSON.stringify({ ok: false, error: 'Method not allowed' }))
    }
    return
  }

  if (method !== 'GET' && method !== 'HEAD') {
    send(res, 405, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Method not allowed')
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

  if (tryServeFile(res, filePath, method)) return

  // No matching file. A request for something with an extension is a genuine
  // 404; anything else is a client-side route, so serve the SPA shell.
  if (pathLooksLikeFile(pathname)) {
    send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found')
    return
  }

  const indexPath = join(distDir, 'index.html')
  if (existsSync(indexPath)) {
    const html = await readFile(indexPath)
    send(res, 200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }, method === 'HEAD' ? null : html)
    return
  }

  send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found')
})

if (!existsSync(distDir)) {
  console.error(`[server] dist/ not found at ${distDir}. Run "npm run build" before starting.`)
}

server.listen(port, host, () => {
  console.log(`[server] Flanagan Construction listening on http://${host}:${port}`)
  if (leadWebhookUrl) console.log('[server] Lead webhook forwarding is enabled.')
})
