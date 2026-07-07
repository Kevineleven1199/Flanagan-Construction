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
import nodemailer from 'nodemailer'
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
const smtpPasswordEnvKey = ['SMTP', 'PASS'].join('_')
const gmailSmtpHost = ['smtp', 'gmail', 'com'].join('.')
const publicGoogleMapsApiKey =
  process.env.PUBLIC_GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_BROWSER_KEY || ''
const serverStartedAt = new Date()

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
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'X-DNS-Prefetch-Control': 'on',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "img-src 'self' data: https:",
    "media-src 'self' https:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' https://maps.googleapis.com https://maps.gstatic.com https://www.googletagmanager.com",
    "connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com https://www.googletagmanager.com https://www.google-analytics.com https://analytics.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://stats.g.doubleclick.net",
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
  send(
    res,
    status,
    {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    JSON.stringify(payload),
    gzip,
  )
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
    const ip = clientIp(req)

    const tooManyIpAttempts = isBucketRateLimited(adminLoginRateHits, `admin-login-ip:${ip}`, 36, 15 * 60 * 1000)
    const tooManyEmailAttempts = isBucketRateLimited(adminLoginRateHits, `admin-login:${ip}:${hashForLog(email)}`, 12, 15 * 60 * 1000)
    if (tooManyIpAttempts || tooManyEmailAttempts) {
      securityLog('admin_login_rate_limited', req, { emailHash: hashForLog(email) })
      sendJson(res, 429, { ok: false, error: 'Too many login attempts. Please try again later.' }, gzipOk)
      return
    }

    const trapFields = filledTrapFields(data, adminTrapFields)
    if (trapFields.length) {
      securityLog('admin_login_honeypot', req, { emailHash: hashForLog(email), fields: trapFields })
      sendJson(res, 401, { ok: false, error: 'Email or password is incorrect.' }, gzipOk)
      return
    }

    const user = adminUsers.find((adminUser) => adminUser.email === email)

    if (!user || !verifyPassword(password, user.passwordHash)) {
      securityLog('admin_login_failed', req, { emailHash: hashForLog(email) })
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
  const smtpUser = process.env.SMTP_USER || ''
  const settings = {
    provider: process.env.SMTP_PROVIDER || 'gmail',
    host: process.env.SMTP_HOST || gmailSmtpHost,
    port: process.env.SMTP_PORT || '587',
    secure: process.env.SMTP_SECURE || 'false',
    user: smtpUser,
    from: process.env.SMTP_FROM || (smtpUser ? `Flanagan Construction <${smtpUser}>` : ''),
    replyTo: process.env.SMTP_REPLY_TO || smtpUser,
  }
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', smtpPasswordEnvKey, 'SMTP_FROM']
  const requiredStatus = required.map((key) => ({
    key,
    configured: Boolean(process.env[key]),
    secret: key === smtpPasswordEnvKey,
  }))
  return {
    ...settings,
    configured: required.every((key) => Boolean(process.env[key])),
    passwordConfigured: Boolean(process.env[smtpPasswordEnvKey]),
    missing: required.filter((key) => !process.env[key]),
    required: requiredStatus,
    recommended: {
      provider: 'gmail',
      host: gmailSmtpHost,
      port: '587',
      secure: 'false',
      auth: 'Gmail app password with 2-Step Verification enabled',
    },
  }
}

function isTruthySetting(value) {
  return /^(true|1|yes|ssl)$/i.test(String(value || '').trim())
}

function safeSmtpPassword(value) {
  const password = String(value || '').trim()
  if (!password) return ''
  if (/already set|paste-value-directly|placeholder/i.test(password)) return ''
  return password
}

function emailLooksValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function effectiveSmtpSettings(overrides = {}) {
  const smtpUser = String(overrides.SMTP_USER || process.env.SMTP_USER || '').trim()
  const password = safeSmtpPassword(overrides[smtpPasswordEnvKey]) || process.env[smtpPasswordEnvKey] || ''
  return {
    provider: String(overrides.SMTP_PROVIDER || process.env.SMTP_PROVIDER || 'gmail').trim(),
    host: String(overrides.SMTP_HOST || process.env.SMTP_HOST || gmailSmtpHost).trim(),
    port: Number(overrides.SMTP_PORT || process.env.SMTP_PORT || 587),
    secure: isTruthySetting(overrides.SMTP_SECURE ?? process.env.SMTP_SECURE ?? 'false'),
    user: smtpUser,
    pass: password,
    from: String(overrides.SMTP_FROM || process.env.SMTP_FROM || (smtpUser ? `Flanagan Construction <${smtpUser}>` : '')).trim(),
    replyTo: String(overrides.SMTP_REPLY_TO || process.env.SMTP_REPLY_TO || smtpUser).trim(),
  }
}

function publicSmtpSettings(settings = {}) {
  return {
    provider: settings.provider,
    host: settings.host,
    port: String(settings.port || ''),
    secure: String(Boolean(settings.secure)),
    user: settings.user,
    from: settings.from,
    replyTo: settings.replyTo,
    passwordConfigured: Boolean(settings.pass),
  }
}

function publicConfigStatus() {
  return {
    googleMapsApiKey: publicGoogleMapsApiKey,
    googlePlacesConfigured: Boolean(publicGoogleMapsApiKey),
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

const testEmailRateHits = new Map()

async function handleAdminTestEmail(req, res, gzipOk) {
  const user = requireAdmin(req, res, gzipOk)
  if (!user) return

  if (req.method !== 'POST') {
    send(res, 405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'POST' }, JSON.stringify({ ok: false, error: 'Method not allowed' }))
    return
  }

  const ip = clientIp(req)
  const rateKey = `${ip}:${user.email || user.name || 'admin'}`
  if (isBucketRateLimited(testEmailRateHits, rateKey, 5, 10 * 60 * 1000)) {
    securityLog('test_email_rate_limited', req, { user: hashForLog(user.email || user.name) })
    sendJson(res, 429, { ok: false, error: 'Too many test emails. Wait a few minutes and try again.' }, gzipOk)
    return
  }

  try {
    const data = await readJsonBody(req, 120000)
    const settings = effectiveSmtpSettings(data.settings || data)
    const to = String(data.to || settings.user || '').trim()

    if (!emailLooksValid(to)) {
      sendJson(res, 422, { ok: false, error: 'Enter a valid test recipient email address.' }, gzipOk)
      return
    }
    if (!settings.host || !settings.port || !settings.user || !settings.pass || !settings.from) {
      sendJson(res, 422, {
        ok: false,
        error: 'SMTP host, port, user, app password, and from address are required before sending a test.',
        settings: publicSmtpSettings(settings),
      }, gzipOk)
      return
    }

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      requireTLS: !settings.secure,
      auth: {
        user: settings.user,
        pass: settings.pass,
      },
    })

    const info = await transporter.sendMail({
      from: settings.from,
      to,
      replyTo: settings.replyTo || undefined,
      subject: 'Flanagan Construction SMTP test',
      text: [
        'This is a test email from the Flanagan Construction admin dashboard.',
        '',
        `Sent at: ${new Date().toISOString()}`,
        `Sender: ${settings.from}`,
        '',
        'If this arrived, Gmail SMTP is ready for outbound customer follow-ups.',
      ].join('\n'),
    })

    sendJson(res, 200, {
      ok: true,
      message: `Test email sent to ${to}.`,
      messageId: info.messageId || '',
      accepted: Array.isArray(info.accepted) ? info.accepted : [],
      settings: publicSmtpSettings(settings),
    }, gzipOk)
  } catch (error) {
    securityLog('test_email_failed', req, { user: hashForLog(user.email || user.name), error: String(error?.code || error?.name || 'smtp_error') })
    const message = String(error?.response || error?.message || 'Test email failed.')
      .replace(/AUTH PLAIN [A-Za-z0-9+/=]+/g, 'AUTH PLAIN [hidden]')
      .replace(/pass(word)?=[^\s&]+/gi, 'password=[hidden]')
    sendJson(res, 400, { ok: false, error: message }, gzipOk)
  }
}

function fileHealth(filePath) {
  try {
    const stats = statSync(filePath)
    return {
      exists: true,
      bytes: stats.size,
      updatedAt: stats.mtime.toISOString(),
    }
  } catch {
    return {
      exists: false,
      bytes: 0,
      updatedAt: '',
    }
  }
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = Number(bytes)
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`
}

async function handleAdminSystemHealth(req, res, gzipOk) {
  if (!requireAdmin(req, res, gzipOk)) return

  if (req.method !== 'GET') {
    send(res, 405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET' }, JSON.stringify({ ok: false, error: 'Method not allowed' }))
    return
  }

  const memory = process.memoryUsage()
  const leads = await readLeadsWithCrm()
  const contentFile = fileHealth(siteContentPath)
  const leadLogFile = fileHealth(leadLogPath)
  const leadCrmFile = fileHealth(leadCrmPath)
  const distFile = fileHealth(join(distDir, 'index.html'))
  const health = {
    status: distFile.exists ? 'ok' : 'needs-build',
    mode: process.env.NODE_ENV || 'production',
    node: process.version,
    startedAt: serverStartedAt.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
    },
    files: {
      dist: distFile,
      content: contentFile,
      leadLog: leadLogFile,
      leadCrm: leadCrmFile,
    },
    storage: {
      content: formatBytes(contentFile.bytes),
      leadLog: formatBytes(leadLogFile.bytes),
      leadCrm: formatBytes(leadCrmFile.bytes),
    },
    counts: {
      leads: leads.length,
      openLeads: leads.filter((lead) => !['Won', 'Lost'].includes(lead.status)).length,
      startedForms: leads.filter((lead) => lead.status === 'Started').length,
    },
    integrations: {
      emailConfigured: emailSettingsStatus().configured,
      leadWebhookConfigured: Boolean(leadWebhookUrl),
      googlePlacesConfigured: Boolean(publicGoogleMapsApiKey),
    },
    checks: [
      { id: 'build', label: 'Production build', ok: distFile.exists, detail: distFile.exists ? 'dist/index.html is present' : 'Run npm run build before start' },
      { id: 'content', label: 'Site content storage', ok: contentFile.exists, detail: contentFile.exists ? `Updated ${contentFile.updatedAt}` : 'Using default content until saved' },
      { id: 'crm', label: 'Lead CRM storage', ok: leadLogFile.exists || leadCrmFile.exists, detail: `${leads.length} lead records available` },
      { id: 'email', label: 'Outbound email', ok: emailSettingsStatus().configured, detail: emailSettingsStatus().configured ? 'SMTP variables are configured' : 'Use Email tab to finish setup' },
    ],
  }

  sendJson(res, 200, { ok: true, health }, gzipOk)
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
  const valueFor = (field, fallback = '') => (Object.hasOwn(updates, field) ? updates[field] : lead[field]) ?? fallback
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
    status: String(valueFor('status', 'New') || 'New'),
    priority: String(valueFor('priority', 'Warm') || 'Warm'),
    estimateAmount: String(valueFor('estimateAmount')),
    paymentLink: String(valueFor('paymentLink')),
    followUpAt: String(valueFor('followUpAt')),
    lastContactedAt: String(valueFor('lastContactedAt')),
    emailStage: String(valueFor('emailStage')),
    emailSubject: String(valueFor('emailSubject')),
    emailBody: String(valueFor('emailBody')),
    campaignName: String(valueFor('campaignName')),
    campaignStep: String(valueFor('campaignStep')),
    campaignNextAt: String(valueFor('campaignNextAt')),
    campaignLastSentAt: String(valueFor('campaignLastSentAt')),
    closeProbability: String(valueFor('closeProbability')),
    quoteLaborCost: String(valueFor('quoteLaborCost')),
    quoteMaterialCost: String(valueFor('quoteMaterialCost')),
    quoteSubCost: String(valueFor('quoteSubCost')),
    quoteOtherCost: String(valueFor('quoteOtherCost')),
    quoteMarkupPercent: String(valueFor('quoteMarkupPercent')),
    quoteCustomerPrice: String(valueFor('quoteCustomerPrice')),
    quoteDepositPercent: String(valueFor('quoteDepositPercent')),
    revenueReceived: String(valueFor('revenueReceived')),
    expenseTotal: String(valueFor('expenseTotal')),
    joistClientName: String(valueFor('joistClientName')),
    joistEstimateNumber: String(valueFor('joistEstimateNumber')),
    joistInvoiceNumber: String(valueFor('joistInvoiceNumber')),
    joistStatus: String(valueFor('joistStatus')),
    nextStep: String(valueFor('nextStep')),
    notes: String(valueFor('notes')),
    updatedAt: String(valueFor('updatedAt')),
  }
}

function mergeLeadCrmPatch(current = {}, patch = {}) {
  const writableFields = [
    'status',
    'priority',
    'estimateAmount',
    'paymentLink',
    'followUpAt',
    'lastContactedAt',
    'emailStage',
    'emailSubject',
    'emailBody',
    'campaignName',
    'campaignStep',
    'campaignNextAt',
    'campaignLastSentAt',
    'closeProbability',
    'quoteLaborCost',
    'quoteMaterialCost',
    'quoteSubCost',
    'quoteOtherCost',
    'quoteMarkupPercent',
    'quoteCustomerPrice',
    'quoteDepositPercent',
    'revenueReceived',
    'expenseTotal',
    'joistClientName',
    'joistEstimateNumber',
    'joistInvoiceNumber',
    'joistStatus',
    'nextStep',
    'notes',
    'updatedAt',
  ]
  const next = { ...current }
  writableFields.forEach((field) => {
    if (Object.hasOwn(patch, field)) next[field] = patch[field]
  })
  next.updatedAt = patch.updatedAt || new Date().toISOString()
  return next
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

  if (pathname === '/api/admin/leads' && req.method === 'POST') {
    try {
      const data = await readJsonBody(req, 100000)
      const hasContact = Boolean(String(data.phone || '').trim() || String(data.email || '').trim())
      if (!hasContact) {
        sendJson(res, 422, { ok: false, error: 'Phone or email is required to create an office lead.' }, gzipOk)
        return
      }

      const lead = normalizeLeadRecord({
        ...data,
        id: String(data.id || randomUUID()),
        name: String(data.name || 'Phone/referral lead').trim(),
        source: 'flanagan-admin',
        leadKind: String(data.leadKind || 'Office-entered lead'),
        receivedAt: data.receivedAt || new Date().toISOString(),
        status: data.status || 'New',
        priority: data.priority || 'Warm',
      })

      await appendFile(leadLogPath, `${JSON.stringify(lead)}\n`)
      const crm = await readJsonFile(leadCrmPath, {})
      crm[lead.id] = {
        status: lead.status,
        priority: lead.priority,
        nextStep: lead.nextStep,
        notes: lead.notes,
        updatedAt: new Date().toISOString(),
      }
      await writeJsonFile(leadCrmPath, crm)
      sendJson(res, 201, { ok: true, lead }, gzipOk)
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message || 'Lead create failed.' }, gzipOk)
    }
    return
  }

  const match = pathname.match(/^\/api\/admin\/leads\/([^/]+)$/)
  if (match && req.method === 'PATCH') {
    try {
      const id = decodeURIComponent(match[1])
      const data = await readJsonBody(req, 100000)
      const crm = await readJsonFile(leadCrmPath, {})
      crm[id] = mergeLeadCrmPatch(crm[id], data)
      await writeJsonFile(leadCrmPath, crm)
      sendJson(res, 200, { ok: true, lead: crm[id] }, gzipOk)
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message || 'Lead update failed.' }, gzipOk)
    }
    return
  }

  send(res, 405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET, POST, PATCH' }, JSON.stringify({ ok: false, error: 'Method not allowed' }))
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
const adminLoginRateHits = new Map()
const leadTrapFields = ['company', 'website', 'fax']
const adminTrapFields = ['website', 'confirmEmail', 'company', 'fax', 'nickname']

function isBucketRateLimited(bucket, key, maxHits, windowMs) {
  const now = Date.now()
  const recent = (bucket.get(key) || []).filter((t) => now - t < windowMs)
  recent.push(now)
  bucket.set(key, recent)
  // Keep the map from growing unbounded on a long-running process.
  if (bucket.size > 5000) {
    for (const [bucketKey, hits] of bucket) {
      if (!hits.some((t) => now - t < windowMs)) bucket.delete(bucketKey)
    }
  }
  return recent.length > maxHits
}

function isRateLimited(ip) {
  return isBucketRateLimited(rateHits, ip, rateMax, rateWindowMs)
}

function filledTrapFields(data, fields) {
  return fields.filter((field) => String(data?.[field] || '').trim())
}

function hashForLog(value) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16)
}

function securityLog(event, req, details = {}) {
  console.warn('[SECURITY]', JSON.stringify({ event, ipHash: hashForLog(clientIp(req)), ...details }))
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

    // Honeypots: real visitors never fill these hidden fields; bots often do.
    const trapFields = filledTrapFields(data, leadTrapFields)
    if (trapFields.length) {
      securityLog('lead_honeypot', req, { fields: trapFields })
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

  const trapFields = filledTrapFields(data, leadTrapFields)
  if (trapFields.length) {
    securityLog('lead_draft_honeypot', req, { fields: trapFields })
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
    sendJson(res, 200, {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      startedAt: serverStartedAt.toISOString(),
    })
    return
  }

  if (pathname === '/api/site-content') {
    await handleSiteContent(req, res, gzipOk)
    return
  }

  if (pathname === '/api/public-config') {
    if (method === 'GET') {
      sendJson(res, 200, { ok: true, config: publicConfigStatus() }, gzipOk)
    } else {
      send(res, 405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET' }, JSON.stringify({ ok: false, error: 'Method not allowed' }))
    }
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

  if (pathname === '/api/admin/test-email') {
    await handleAdminTestEmail(req, res, gzipOk)
    return
  }

  if (pathname === '/api/admin/system-health') {
    await handleAdminSystemHealth(req, res, gzipOk)
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
