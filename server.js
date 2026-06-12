// Production web server for Flanagan Construction.
//
// Why this exists: the site is a static Vite/React build, but Railway (and any
// container host) needs a real process that listens on the injected $PORT and
// binds to 0.0.0.0; otherwise the deploy has nothing to route to and the page
// never goes live. This zero-dependency Node server serves the built `dist/`
// folder with gzip + caching, falls back to index.html for client-side routes,
// exposes a /health check for Railway, and captures rate-limited quote leads at
// POST /api/lead. Security headers (incl. HSTS + CSP) are applied to every
// response.

import http from 'node:http'
import zlib from 'node:zlib'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { createHash, createHmac, pbkdf2Sync, randomUUID, timingSafeEqual } from 'node:crypto'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildWebhookPayload } from './lead-delivery.js'

const root = fileURLToPath(new URL('.', import.meta.url))
const distDir = resolve(root, 'dist')
const port = Number(process.env.PORT) || 8080
const host = '0.0.0.0'
const leadWebhookUrl = process.env.LEAD_WEBHOOK_URL || ''
const adminPassword = process.env.ADMIN_PASSWORD || ''
const adminSessionSecret = process.env.ADMIN_SESSION_SECRET || adminPassword || randomUUID()
const siteContentPath = join(root, 'site-content.json')
const leadLogPath = join(root, 'leads.log')
const leadCrmPath = join(root, 'lead-crm.json')

const builtInSuperAdmins = [
  {
    email: 'nickflanagan73@gmail.com',
    name: 'Nick Flanagan',
    role: 'super_admin',
    passwordHash: 'pbkdf2$210000$iNICwQ74kgvAY3uN5fFoaA$j_uG3bm_GAZOD0BYX9gFHJLds3iTlf1BSwBBOkpur-w',
  },
  {
    email: 'kevin@ndabox.com',
    name: 'Kevin',
    role: 'super_admin',
    passwordHash: 'pbkdf2$210000$etgtn-tg34DgVmOFrcElZQ$7sE9yewvulV5_WjFtImncU9kK4-MfrvKZXLig0IBz54',
  },
]

function loadAdminUsers() {
  if (!process.env.ADMIN_USERS_JSON) return builtInSuperAdmins

  try {
    const users = JSON.parse(process.env.ADMIN_USERS_JSON)
    if (!Array.isArray(users)) return builtInSuperAdmins
    return users
      .filter((user) => user?.email && user?.passwordHash)
      .map((user) => ({
        email: String(user.email).toLowerCase().trim(),
        name: String(user.name || user.email).trim(),
        role: String(user.role || 'super_admin').trim(),
        passwordHash: String(user.passwordHash),
      }))
  } catch (error) {
    console.error('[admin] ADMIN_USERS_JSON is invalid:', error?.message)
    return builtInSuperAdmins
  }
}

const adminUsers = loadAdminUsers()

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
    "img-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' https://maps.googleapis.com https://maps.gstatic.com",
    "connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com",
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

function base64UrlEncode(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value))
  return buffer.toString('base64url')
}

function base64UrlJson(value) {
  return base64UrlEncode(JSON.stringify(value))
}

function timingSafeStringEquals(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  return left.length === right.length && timingSafeEqual(left, right)
}

function publicAdminUser(user) {
  if (!user) return null
  return {
    email: user.email,
    name: user.name || user.email,
    role: user.role || 'super_admin',
  }
}

function verifyPassword(password, storedHash) {
  const [scheme, iterationsText, salt, expectedHash] = String(storedHash || '').split('$')
  if (scheme !== 'pbkdf2') return false
  const iterations = Number(iterationsText)
  if (!Number.isFinite(iterations) || !salt || !expectedHash) return false

  const actual = pbkdf2Sync(String(password), salt, iterations, 32, 'sha256').toString('base64url')
  return timingSafeStringEquals(actual, expectedHash)
}

function signAdminToken(user) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + 12 * 60 * 60
  const payload = base64UrlJson({
    email: user.email,
    role: user.role || 'super_admin',
    iat: issuedAt,
    exp: expiresAt,
  })
  const signature = createHmac('sha256', adminSessionSecret).update(payload).digest('base64url')
  return {
    token: `admin.${payload}.${signature}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  }
}

function verifyAdminToken(token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3 || parts[0] !== 'admin') return null

  const [, payload, signature] = parts
  const expectedSignature = createHmac('sha256', adminSessionSecret).update(payload).digest('base64url')
  if (!timingSafeStringEquals(signature, expectedSignature)) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data.email || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null
    const user = adminUsers.find((adminUser) => adminUser.email === String(data.email).toLowerCase())
    return user ? publicAdminUser(user) : null
  } catch {
    return null
  }
}

function readJsonBody(req, limit = 400000) {
  return new Promise((resolveBody, rejectBody) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > limit) {
        rejectBody(new Error('Request body too large.'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolveBody(JSON.parse(body || '{}'))
      } catch {
        rejectBody(new Error('Invalid JSON.'))
      }
    })
    req.on('error', rejectBody)
  })
}

function requireAdmin(req, res, gzipOk) {
  if (!adminPassword && !adminUsers.length) {
    sendJson(
      res,
      503,
      {
        ok: false,
        error: 'Set ADMIN_PASSWORD or ADMIN_USERS_JSON on the server before using production admin.',
      },
      gzipOk,
    )
    return false
  }

  const header = String(req.headers.authorization || '')
  const token = header.replace(/^Bearer\s+/i, '').trim()

  const user = verifyAdminToken(token)
  if (user) return user

  if (adminPassword && token === adminPassword) {
    return { email: 'shared-admin', name: 'Shared admin', role: 'super_admin' }
  }

  sendJson(res, 401, { ok: false, error: 'Admin login required.' }, gzipOk)
  return false
}

async function handleAdminLogin(req, res, gzipOk) {
  if (req.method !== 'POST') {
    send(res, 405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'POST' }, JSON.stringify({ ok: false, error: 'Method not allowed' }))
    return
  }

  try {
    const data = await readJsonBody(req, 100000)
    const email = String(data.email || '').toLowerCase().trim()
    const password = String(data.password || '')
    const user = adminUsers.find((adminUser) => adminUser.email === email)

    if (!user || !verifyPassword(password, user.passwordHash)) {
      sendJson(res, 401, { ok: false, error: 'Email or password is incorrect.' }, gzipOk)
      return
    }

    const session = signAdminToken(user)
    sendJson(
      res,
      200,
      {
        ok: true,
        token: session.token,
        expiresAt: session.expiresAt,
        user: publicAdminUser(user),
      },
      gzipOk,
    )
  } catch (error) {
    sendJson(res, 400, { ok: false, error: error.message || 'Login failed.' }, gzipOk)
  }
}

function emailSettingsStatus() {
  const settings = {
    provider: process.env.SMTP_PROVIDER || 'gmail',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || '587',
    secure: process.env.SMTP_SECURE || 'false',
    user: process.env.SMTP_USER || 'nickflanagan73@gmail.com',
    from: process.env.SMTP_FROM || `Nick Flanagan <${process.env.SMTP_USER || 'nickflanagan73@gmail.com'}>`,
    replyTo: process.env.SMTP_REPLY_TO || process.env.SMTP_USER || 'nickflanagan73@gmail.com',
  }
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_SECRET_KEY', 'SMTP_FROM']
  return {
    ...settings,
    configured: required.every((key) => Boolean(process.env[key])),
    missing: required.filter((key) => !process.env[key]),
  }
}

async function handleAdminEmailSettings(req, res, gzipOk) {
  if (!requireAdmin(req, res, gzipOk)) return

  if (req.method !== 'GET') {
    send(res, 405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET' }, JSON.stringify({ ok: false, error: 'Method not allowed' }))
    return false
  }

  sendJson(res, 200, { ok: true, emailSettings: emailSettingsStatus() }, gzipOk)
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch {
    return fallback
  }
}

async function writeJsonFile(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function leadIdFor(lead, index = 0) {
  if (lead.id) return String(lead.id)
  const seed = [lead.receivedAt, lead.createdAt, lead.name, lead.phone, lead.email, index].join('|')
  return `lead-${createHash('sha1').update(seed).digest('hex').slice(0, 14)}`
}

function normalizeLeadRecord(lead, index = 0, updates = {}) {
  const receivedAt = lead.receivedAt || lead.createdAt || new Date().toISOString()
  return {
    id: leadIdFor({ ...lead, receivedAt }, index),
    name: String(lead.name || 'Website lead'),
    phone: String(lead.phone || ''),
    email: String(lead.email || ''),
    address: String(lead.address || ''),
    addressPlaceId: String(lead.addressPlaceId || ''),
    addressLat: String(lead.addressLat || ''),
    addressLng: String(lead.addressLng || ''),
    addressCity: String(lead.addressCity || ''),
    addressState: String(lead.addressState || ''),
    addressPostalCode: String(lead.addressPostalCode || ''),
    projectType: String(lead.projectType || 'Project'),
    budget: String(lead.budget || 'Not sure yet'),
    timeline: String(lead.timeline || 'Planning ahead'),
    message: String(lead.message || ''),
    selectedNeeds: Array.isArray(lead.selectedNeeds) ? lead.selectedNeeds : [],
    funnelGroup: String(lead.funnelGroup || ''),
    leadKind: String(lead.leadKind || ''),
    source: String(lead.source || 'flanagan-construction-website'),
    receivedAt,
    status: updates.status || lead.status || 'New',
    priority: updates.priority || lead.priority || 'Warm',
    estimateAmount: updates.estimateAmount || lead.estimateAmount || '',
    paymentLink: updates.paymentLink || lead.paymentLink || '',
    followUpAt: updates.followUpAt || lead.followUpAt || '',
    lastContactedAt: updates.lastContactedAt || lead.lastContactedAt || '',
    emailStage: updates.emailStage || lead.emailStage || '',
    emailSubject: updates.emailSubject || lead.emailSubject || '',
    emailBody: updates.emailBody || lead.emailBody || '',
    closeProbability: updates.closeProbability || lead.closeProbability || '',
    quoteLaborCost: updates.quoteLaborCost || lead.quoteLaborCost || '',
    quoteMaterialCost: updates.quoteMaterialCost || lead.quoteMaterialCost || '',
    quoteSubCost: updates.quoteSubCost || lead.quoteSubCost || '',
    quoteOtherCost: updates.quoteOtherCost || lead.quoteOtherCost || '',
    quoteMarkupPercent: updates.quoteMarkupPercent || lead.quoteMarkupPercent || '',
    quoteCustomerPrice: updates.quoteCustomerPrice || lead.quoteCustomerPrice || '',
    quoteDepositPercent: updates.quoteDepositPercent || lead.quoteDepositPercent || '',
    revenueReceived: updates.revenueReceived || lead.revenueReceived || '',
    expenseTotal: updates.expenseTotal || lead.expenseTotal || '',
    joistClientName: updates.joistClientName || lead.joistClientName || '',
    joistEstimateNumber: updates.joistEstimateNumber || lead.joistEstimateNumber || '',
    joistInvoiceNumber: updates.joistInvoiceNumber || lead.joistInvoiceNumber || '',
    joistStatus: updates.joistStatus || lead.joistStatus || '',
    nextStep: updates.nextStep || lead.nextStep || '',
    notes: updates.notes || lead.notes || '',
    updatedAt: updates.updatedAt || lead.updatedAt || '',
  }
}

async function readLeadsWithCrm() {
  const log = await readFile(leadLogPath, 'utf8').catch(() => '')
  const lines = log.split('\n').filter(Boolean)
  const crm = await readJsonFile(leadCrmPath, {})
  const leadMap = new Map()

  lines.forEach((line, index) => {
      try {
        const lead = JSON.parse(line)
        const id = leadIdFor(lead, index)
        leadMap.set(id, normalizeLeadRecord({ ...lead, id }, index, crm[id] || {}))
      } catch {
        // Ignore malformed log lines.
      }
    })

  return [...leadMap.values()]
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
}

async function handleSiteContent(req, res, gzipOk) {
  if (req.method !== 'GET') {
    send(res, 405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET' }, JSON.stringify({ ok: false, error: 'Method not allowed' }))
    return
  }

  const content = await readJsonFile(siteContentPath, {})
  sendJson(res, 200, { ok: true, content }, gzipOk)
}

async function handleAdminContent(req, res, gzipOk) {
  if (!requireAdmin(req, res, gzipOk)) return

  if (req.method === 'GET') {
    const content = await readJsonFile(siteContentPath, {})
    sendJson(res, 200, { ok: true, content }, gzipOk)
    return
  }

  if (req.method === 'PUT') {
    try {
      const data = await readJsonBody(req, 4_000_000)
      await writeJsonFile(siteContentPath, data.content || data)
      sendJson(res, 200, { ok: true }, gzipOk)
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message || 'Invalid content.' }, gzipOk)
    }
    return
  }

  send(res, 405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET, PUT' }, JSON.stringify({ ok: false, error: 'Method not allowed' }))
}

async function handleAdminLeads(req, res, gzipOk, pathname) {
  if (!requireAdmin(req, res, gzipOk)) return

  if (pathname === '/api/admin/leads' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, leads: await readLeadsWithCrm() }, gzipOk)
    return
  }

  const match = pathname.match(/^\/api\/admin\/leads\/([^/]+)$/)
  if (match && req.method === 'PATCH') {
    try {
      const id = decodeURIComponent(match[1])
      const data = await readJsonBody(req, 100000)
      const crm = await readJsonFile(leadCrmPath, {})
      crm[id] = {
        ...(crm[id] || {}),
        status: data.status,
        priority: data.priority,
        estimateAmount: data.estimateAmount,
        paymentLink: data.paymentLink,
        followUpAt: data.followUpAt,
        lastContactedAt: data.lastContactedAt,
        emailStage: data.emailStage,
        emailSubject: data.emailSubject,
        emailBody: data.emailBody,
        closeProbability: data.closeProbability,
        quoteLaborCost: data.quoteLaborCost,
        quoteMaterialCost: data.quoteMaterialCost,
        quoteSubCost: data.quoteSubCost,
        quoteOtherCost: data.quoteOtherCost,
        quoteMarkupPercent: data.quoteMarkupPercent,
        quoteCustomerPrice: data.quoteCustomerPrice,
        quoteDepositPercent: data.quoteDepositPercent,
        revenueReceived: data.revenueReceived,
        expenseTotal: data.expenseTotal,
        joistClientName: data.joistClientName,
        joistEstimateNumber: data.joistEstimateNumber,
        joistInvoiceNumber: data.joistInvoiceNumber,
        joistStatus: data.joistStatus,
        nextStep: data.nextStep,
        notes: data.notes,
        updatedAt: data.updatedAt || new Date().toISOString(),
      }
      await writeJsonFile(leadCrmPath, crm)
      sendJson(res, 200, { ok: true, lead: crm[id] }, gzipOk)
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message || 'Lead update failed.' }, gzipOk)
    }
    return
  }

  send(res, 405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET, PATCH' }, JSON.stringify({ ok: false, error: 'Method not allowed' }))
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
      id: String(data.leadId || data.id || randomUUID()),
      name,
      phone,
      email: String(data.email || '').trim(),
      address: String(data.address || '').trim(),
      addressPlaceId: String(data.addressPlaceId || '').trim(),
      addressLat: String(data.addressLat || '').trim(),
      addressLng: String(data.addressLng || '').trim(),
      addressCity: String(data.addressCity || '').trim(),
      addressState: String(data.addressState || '').trim(),
      addressPostalCode: String(data.addressPostalCode || '').trim(),
      projectType: String(data.projectType || '').trim(),
      budget: String(data.budget || '').trim(),
      timeline: String(data.timeline || '').trim(),
      message: String(data.message || '').trim(),
      selectedNeeds: Array.isArray(data.selectedNeeds) ? data.selectedNeeds.map(String) : [],
      funnelGroup: String(data.funnelGroup || '').trim(),
      leadKind: String(data.leadKind || 'Final request').trim(),
      source: 'flanagan-construction-website',
      receivedAt: new Date().toISOString(),
      status: 'New',
      priority: String(data.priority || 'Warm'),
      nextStep: '',
      notes: '',
      ip,
    }

    // Always surface the lead in the deploy logs so it is never silently lost.
    console.log('[LEAD]', JSON.stringify(lead))

    // Best-effort durable copy (note: container disks are ephemeral on Railway).
    try {
      await appendFile(leadLogPath, `${JSON.stringify(lead)}\n`)
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

async function handleLeadDraft(req, res, gzipOk) {
  let data
  try {
    data = await readJsonBody(req, 100000)
  } catch {
    sendJson(res, 400, { ok: false, error: 'Invalid request.' }, gzipOk)
    return
  }

  if (data.company) {
    sendJson(res, 200, { ok: true }, gzipOk)
    return
  }

  const phone = String(data.phone || '').trim()
  const email = String(data.email || '').trim()
  if (!phone && !email) {
    sendJson(res, 422, { ok: false, error: 'Phone or email is required.' }, gzipOk)
    return
  }

  const lead = {
    id: String(data.leadId || data.id || randomUUID()),
    name: String(data.name || '').trim() || 'Started website request',
    phone,
    email,
    address: String(data.address || '').trim(),
    addressPlaceId: String(data.addressPlaceId || '').trim(),
    addressLat: String(data.addressLat || '').trim(),
    addressLng: String(data.addressLng || '').trim(),
    addressCity: String(data.addressCity || '').trim(),
    addressState: String(data.addressState || '').trim(),
    addressPostalCode: String(data.addressPostalCode || '').trim(),
    projectType: String(data.projectType || data.funnelGroup || 'Started request').trim(),
    budget: String(data.budget || '').trim(),
    timeline: String(data.timeline || '').trim(),
    message: String(data.message || '').trim(),
    selectedNeeds: Array.isArray(data.selectedNeeds) ? data.selectedNeeds.map(String) : [],
    funnelGroup: String(data.funnelGroup || '').trim(),
    leadKind: 'Started funnel',
    source: 'flanagan-construction-started-funnel',
    receivedAt: new Date().toISOString(),
    status: 'Started',
    priority: String(data.priority || 'Warm'),
    nextStep: '',
    notes: '',
    ip: clientIp(req),
  }

  console.log('[LEAD_DRAFT]', JSON.stringify(lead))

  try {
    await appendFile(leadLogPath, `${JSON.stringify(lead)}\n`)
  } catch (error) {
    console.error('[LEAD_DRAFT] could not write leads.log:', error?.message)
  }

  sendJson(res, 200, { ok: true, leadId: lead.id }, gzipOk)
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

  if (pathname === '/api/site-content') {
    await handleSiteContent(req, res, gzipOk)
    return
  }

  if (pathname === '/api/admin/login') {
    await handleAdminLogin(req, res, gzipOk)
    return
  }

  if (pathname === '/api/admin/email-settings') {
    await handleAdminEmailSettings(req, res, gzipOk)
    return
  }

  if (pathname === '/api/admin/content') {
    await handleAdminContent(req, res, gzipOk)
    return
  }

  if (pathname === '/api/admin/leads' || pathname.startsWith('/api/admin/leads/')) {
    await handleAdminLeads(req, res, gzipOk, pathname)
    return
  }

  if (pathname === '/api/lead-draft') {
    if (method === 'POST') {
      await handleLeadDraft(req, res, gzipOk)
    } else {
      send(res, 405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'POST' }, JSON.stringify({ ok: false, error: 'Method not allowed' }))
    }
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
