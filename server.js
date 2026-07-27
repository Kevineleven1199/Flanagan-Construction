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
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash, createHmac, pbkdf2Sync, randomUUID, timingSafeEqual } from 'node:crypto'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'
import { buildWebhookPayload } from './lead-delivery.js'
import { defaultSiteContent } from './src/content.js'

const root = fileURLToPath(new URL('.', import.meta.url))
const distDir = resolve(root, 'dist')
const port = Number(process.env.PORT) || 8080
const host = '0.0.0.0'
const leadWebhookUrl = process.env.LEAD_WEBHOOK_URL || ''
const adminPassword = process.env.ADMIN_PASSWORD || ''
const adminSessionSecret = process.env.ADMIN_SESSION_SECRET || adminPassword || randomUUID()
const dataDir = resolve(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || root)
const siteContentPath = join(dataDir, 'site-content.json')
const leadLogPath = join(dataDir, 'leads.log')
const leadCrmPath = join(dataDir, 'lead-crm.json')
const analyticsLogPath = join(dataDir, 'analytics.log')
const smtpPasswordEnvKey = ['SMTP', 'PASS'].join('_')
const gmailSmtpHost = ['smtp', 'gmail', 'com'].join('.')
const leadNotifyTo = process.env.LEAD_NOTIFY_TO || process.env.SMTP_REPLY_TO || process.env.SMTP_USER || ''
const publicGoogleMapsApiKey =
  process.env.PUBLIC_GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_BROWSER_KEY || ''
const serverStartedAt = new Date()
const recoveredRailwayBaseline = {
  label: 'Recovered Railway baseline',
  since: '2026-06-28T00:00:00.000Z',
  until: '2026-07-27T23:59:59.999Z',
  siteRequests: 4130,
  successfulRequests: 2915,
  clientErrorRequests: 1215,
  serverErrorRequests: 0,
  homepageRequests: 586,
  startedFormRequests: 28,
  completedLeadRequests: 1,
  note: 'Aggregate request counters only. Old visitor identities and lead contact details were not retained.',
}

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
// Robots/sitemap are rewritten to the serving origin for technical correctness,
// but HTML keeps canonical/Open Graph URLs branded. Only share-image asset URLs
// are rewritten so previews can still fetch images from the current host.
const canonicalBase = 'https://www.flanaganconstructionllc.com'
const shareAssetPaths = [
  'og.png',
  'brand-mark.svg',
  'favicon.svg',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'flanagan-construction-qr.svg',
  'flanagan-construction-qr.png',
]

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

function signAdminToken(user, remember = false) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + (remember ? 30 * 24 * 60 * 60 : 12 * 60 * 60)
  const payload = base64UrlJson({
    email: user.email,
    role: user.role || 'super_admin',
    remember: Boolean(remember),
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
    const remember = Boolean(data.remember)
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

    const session = signAdminToken(user, remember)
    sendJson(
      res,
      200,
      {
        ok: true,
        token: session.token,
        expiresAt: session.expiresAt,
        remember,
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
  const smtpPassword = process.env[smtpPasswordEnvKey] || ''
  const provider = process.env.SMTP_PROVIDER || 'gmail'
  const gmailPasswordFormatValid =
    String(provider).toLowerCase() !== 'gmail' || normalizeGmailAppPassword(smtpPassword).length === 16
  const settings = {
    provider,
    host: process.env.SMTP_HOST || gmailSmtpHost,
    port: process.env.SMTP_PORT || '587',
    secure: process.env.SMTP_SECURE || 'false',
    user: smtpUser,
    from: process.env.SMTP_FROM || (smtpUser ? `Flanagan Construction <${smtpUser}>` : ''),
    replyTo: process.env.SMTP_REPLY_TO || smtpUser,
    leadNotifyTo: leadNotifyTo || process.env.SMTP_REPLY_TO || smtpUser,
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
    verification: smtpVerificationState,
    passwordConfigured: Boolean(smtpPassword),
    passwordFormatValid: gmailPasswordFormatValid,
    configurationProblems: gmailPasswordFormatValid
      ? []
      : ['SMTP_PASS is not a 16-character Gmail app password. Create a fresh app password in the SMTP_USER Google account and replace it in Railway.'],
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

let smtpVerificationState = {
  status: 'untested',
  checkedAt: '',
  error: '',
}

function updateSmtpVerification(status, error = '') {
  smtpVerificationState = {
    status,
    checkedAt: new Date().toISOString(),
    error,
  }
}

function smtpErrorMessage(error) {
  const response = String(error?.response || error?.message || '')
  if (
    error?.responseCode === 535 ||
    /badcredentials|username and password not accepted|application-specific password required|invalidsecondfactor/i.test(response)
  ) {
    return 'Gmail rejected the login. Create a fresh Google App Password for this exact Gmail account, then replace SMTP_PASS in Railway. Do not use the normal Gmail password.'
  }
  if (/invalid login|authentication/i.test(response)) {
    return 'Gmail authentication failed. Confirm SMTP_USER matches the account that created the Google App Password, then replace SMTP_PASS in Railway.'
  }
  if (/timeout|timed out|etimedout/i.test(response)) {
    return 'Gmail did not answer before the connection timed out. Wait a minute and test again; if it repeats, check Railway networking and Gmail availability.'
  }
  return response || 'Test email failed. Check the Gmail App Password and Railway SMTP variables.'
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

function normalizeGmailAppPassword(value) {
  return String(value || '').replace(/\s/g, '')
}

function emailLooksValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function effectiveSmtpSettings(overrides = {}) {
  const smtpUser = String(overrides.SMTP_USER || process.env.SMTP_USER || '').trim()
  const rawPassword = safeSmtpPassword(overrides[smtpPasswordEnvKey]) || process.env[smtpPasswordEnvKey] || ''
  const provider = String(overrides.SMTP_PROVIDER || process.env.SMTP_PROVIDER || 'gmail').trim()
  const password = provider.toLowerCase() === 'gmail' ? normalizeGmailAppPassword(rawPassword) : rawPassword
  return {
    provider,
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

function cleanAnalyticsValue(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength)
}

async function recordAnalyticsEvent(event = {}) {
  const row = {
    id: randomUUID(),
    event: cleanAnalyticsValue(event.event, 64),
    path: cleanAnalyticsValue(event.path || '/', 300),
    source: cleanAnalyticsValue(event.source || 'direct', 160),
    medium: cleanAnalyticsValue(event.medium, 100),
    campaign: cleanAnalyticsValue(event.campaign, 160),
    referrer: cleanAnalyticsValue(event.referrer, 300),
    sessionId: cleanAnalyticsValue(event.sessionId, 100),
    leadId: cleanAnalyticsValue(event.leadId, 120),
    location: cleanAnalyticsValue(event.location, 100),
    ipHash: cleanAnalyticsValue(event.ipHash, 64),
    userAgent: cleanAnalyticsValue(event.userAgent, 300),
    occurredAt: event.occurredAt || new Date().toISOString(),
  }
  if (!row.event) return null
  await appendDataFile(analyticsLogPath, `${JSON.stringify(row)}\n`)
  return row
}

async function readAnalyticsEvents() {
  const log = await readFile(analyticsLogPath, 'utf8').catch(() => '')
  return log
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
}

function analyticsSummary(events = []) {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recent = events.filter((event) => new Date(event.occurredAt).getTime() >= cutoff)
  const count = (name) => recent.filter((event) => event.event === name).length
  const uniqueLeadCount = (name) =>
    new Set(recent.filter((event) => event.event === name).map((event) => event.leadId).filter(Boolean)).size
  const uniqueSessions = new Set(recent.map((event) => event.sessionId).filter(Boolean)).size
  const groupTop = (field) => {
    const counts = new Map()
    recent
      .filter((event) => event.event === 'page_view')
      .forEach((event) => {
        const value = cleanAnalyticsValue(event[field]) || (field === 'source' ? 'direct' : '/')
        counts.set(value, (counts.get(value) || 0) + 1)
      })
    return [...counts.entries()]
      .map(([value, total]) => ({ value, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
  }
  const pageViews = count('page_view')
  const completedLeads = uniqueLeadCount('lead_submitted')
  return {
    periodDays: 30,
    trackingStartedAt: events[0]?.occurredAt || '',
    lastEventAt: events.at(-1)?.occurredAt || '',
    pageViews,
    uniqueSessions,
    leadStarts: uniqueLeadCount('lead_started'),
    completedLeads,
    phoneClicks: count('phone_click'),
    conversionRate: pageViews ? Number(((completedLeads / pageViews) * 100).toFixed(1)) : 0,
    topPages: groupTop('path'),
    topSources: groupTop('source'),
    recentActivity: recent.slice(-30).reverse().map((event) => ({
      event: event.event,
      path: event.path,
      source: event.source,
      occurredAt: event.occurredAt,
    })),
    historicalBaseline: recoveredRailwayBaseline,
  }
}

async function handleAnalyticsEvent(req, res, gzipOk) {
  if (req.method !== 'POST') {
    send(res, 405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'POST' }, JSON.stringify({ ok: false, error: 'Method not allowed' }))
    return
  }
  try {
    const data = await readJsonBody(req, 24000)
    await recordAnalyticsEvent({
      ...data,
      ipHash: hashForLog(clientIp(req)),
      userAgent: req.headers['user-agent'] || '',
    })
    sendJson(res, 202, { ok: true }, gzipOk)
  } catch {
    sendJson(res, 400, { ok: false, error: 'Invalid analytics event.' }, gzipOk)
  }
}

async function handleAdminAnalytics(req, res, gzipOk) {
  if (!requireAdmin(req, res, gzipOk)) return
  if (req.method !== 'GET') {
    send(res, 405, { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET' }, JSON.stringify({ ok: false, error: 'Method not allowed' }))
    return
  }
  sendJson(res, 200, { ok: true, analytics: analyticsSummary(await readAnalyticsEvents()) }, gzipOk)
}

function leadNotificationText(lead = {}) {
  return [
    'New Flanagan Construction website request',
    '',
    `Name: ${lead.name || 'Not provided'}`,
    `Phone: ${lead.phone || 'Not provided'}`,
    `Email: ${lead.email || 'Not provided'}`,
    `Address: ${lead.address || 'Not provided'}`,
    `Project: ${lead.projectType || lead.funnelGroup || 'Not provided'}`,
    `Priority: ${lead.priority || 'Normal'}`,
    `Score: ${lead.leadScore || 'Not scored'}`,
    `Next step: ${lead.nextStep || 'Call/text and confirm scope.'}`,
    '',
    lead.message ? `Notes:\n${lead.message}` : 'Notes: none',
    '',
    `Received: ${lead.receivedAt || new Date().toISOString()}`,
    `Lead ID: ${lead.id || ''}`,
  ].join('\n')
}

async function notifyLeadByEmail(lead) {
  const settings = effectiveSmtpSettings()
  const to = String(leadNotifyTo || settings.replyTo || settings.user || '').trim()
  if (!emailSettingsStatus().configured || !emailLooksValid(to)) {
    return { sent: false, reason: 'not_configured' }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      requireTLS: !settings.secure,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
      auth: {
        user: settings.user,
        pass: settings.pass,
      },
    })

    await transporter.sendMail({
      from: settings.from,
      to,
      replyTo: lead.email || settings.replyTo || undefined,
      subject: `New website lead: ${lead.projectType || lead.funnelGroup || lead.name || 'Flanagan request'}`,
      text: leadNotificationText(lead),
    })
    updateSmtpVerification('verified')
    return { sent: true }
  } catch (error) {
    updateSmtpVerification('failed', smtpErrorMessage(error))
    console.error('[LEAD] email notification failed:', error?.code || error?.message || 'smtp_error')
    return { sent: false, reason: 'send_failed' }
  }
}

async function acknowledgeLeadByEmail(lead) {
  const settings = effectiveSmtpSettings()
  const to = String(lead.email || '').trim()
  if (!emailSettingsStatus().configured || !emailLooksValid(to)) {
    return { sent: false, reason: emailLooksValid(to) ? 'not_configured' : 'no_customer_email' }
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      requireTLS: !settings.secure,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
      auth: {
        user: settings.user,
        pass: settings.pass,
      },
    })
    const firstName = String(lead.name || '').trim().split(/\s+/)[0] || 'there'
    await transporter.sendMail({
      from: settings.from,
      to,
      replyTo: settings.replyTo || settings.user,
      subject: 'We received your Flanagan Construction request',
      text: [
        `Hi ${firstName},`,
        '',
        'Thanks for contacting Flanagan Construction. We received your project request and will review it within one business day.',
        '',
        `Project: ${lead.projectType || lead.funnelGroup || 'Home improvement project'}`,
        lead.address ? `Address: ${lead.address}` : '',
        lead.selectedNeeds?.length ? `Requested work: ${lead.selectedNeeds.join(', ')}` : '',
        '',
        'If you have photos or more details, reply directly to this email.',
        '',
        'Nick Flanagan',
        'Flanagan Construction',
        '(302) 565-5724',
      ].filter(Boolean).join('\n'),
    })
    return { sent: true }
  } catch (error) {
    console.error('[LEAD] customer acknowledgment failed:', error?.code || error?.message || 'smtp_error')
    return { sent: false, reason: 'send_failed' }
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
    if (settings.provider.toLowerCase() === 'gmail' && settings.pass.length !== 16) {
      sendJson(res, 422, {
        ok: false,
        error: 'SMTP_PASS is not a valid 16-character Gmail app password. Create it in the SMTP_USER Google account, replace SMTP_PASS in Railway, then test again.',
        settings: publicSmtpSettings(settings),
      }, gzipOk)
      return
    }

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      requireTLS: !settings.secure,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 12000,
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

    updateSmtpVerification('verified')

    sendJson(res, 200, {
      ok: true,
      message: `Test email sent to ${to}.`,
      messageId: info.messageId || '',
      accepted: Array.isArray(info.accepted) ? info.accepted : [],
      settings: publicSmtpSettings(settings),
    }, gzipOk)
  } catch (error) {
    securityLog('test_email_failed', req, { user: hashForLog(user.email || user.name), error: String(error?.code || error?.name || 'smtp_error') })
    const message = smtpErrorMessage(error)
      .replace(/AUTH PLAIN [A-Za-z0-9+/=]+/g, 'AUTH PLAIN [hidden]')
      .replace(/pass(word)?=[^\s&]+/gi, 'password=[hidden]')
    updateSmtpVerification('failed', message)
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
      dataDir: dataDir === root ? 'app container' : dataDir,
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
      leadEmailNotificationsConfigured: emailSettingsStatus().configured && emailLooksValid(leadNotifyTo || process.env.SMTP_REPLY_TO || process.env.SMTP_USER),
      leadWebhookConfigured: Boolean(leadWebhookUrl),
      googlePlacesConfigured: Boolean(publicGoogleMapsApiKey),
    },
    checks: [
      { id: 'build', label: 'Production build', ok: distFile.exists, detail: distFile.exists ? 'dist/index.html is present' : 'Run npm run build before start' },
      { id: 'content', label: 'Site content storage', ok: contentFile.exists, detail: contentFile.exists ? `Updated ${contentFile.updatedAt}` : 'Using default content until saved' },
      { id: 'crm', label: 'Lead CRM storage', ok: leadLogFile.exists || leadCrmFile.exists, detail: `${leads.length} lead records available` },
      { id: 'email', label: 'Outbound email', ok: emailSettingsStatus().configured, detail: emailSettingsStatus().configured ? 'SMTP variables are configured' : 'Use Email tab to finish setup' },
      { id: 'lead-email', label: 'Lead email alerts', ok: emailSettingsStatus().configured && emailLooksValid(leadNotifyTo || process.env.SMTP_REPLY_TO || process.env.SMTP_USER), detail: emailSettingsStatus().configured ? `Alerts go to ${leadNotifyTo || process.env.SMTP_REPLY_TO || process.env.SMTP_USER || 'unset'}` : 'Configure SMTP first' },
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

async function ensureParentDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true })
}

async function appendDataFile(filePath, text) {
  await ensureParentDir(filePath)
  await appendFile(filePath, text, 'utf8')
}

async function finalizedLeadAlreadyExists(leadId) {
  if (!leadId) return false
  const log = await readFile(leadLogPath, 'utf8').catch(() => '')
  return log
    .split('\n')
    .filter(Boolean)
    .some((line) => {
      try {
        const existing = JSON.parse(line)
        return String(existing.id || '') === String(leadId) && existing.status !== 'Started'
      } catch {
        return false
      }
    })
}

async function writeJsonFile(filePath, data) {
  await ensureParentDir(filePath)
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
    sourcePath: String(lead.sourcePath || ''),
    sourcePage: String(lead.sourcePage || ''),
    landingPage: String(lead.landingPage || ''),
    serviceRoute: String(lead.serviceRoute || ''),
    utmSource: String(lead.utmSource || ''),
    utmMedium: String(lead.utmMedium || ''),
    utmCampaign: String(lead.utmCampaign || ''),
    utmTerm: String(lead.utmTerm || ''),
    utmContent: String(lead.utmContent || ''),
    gclid: String(lead.gclid || ''),
    gbraid: String(lead.gbraid || ''),
    wbraid: String(lead.wbraid || ''),
    receivedAt,
    status: String(valueFor('status', 'New') || 'New'),
    priority: String(valueFor('priority', 'Warm') || 'Warm'),
    leadScore: String(valueFor('leadScore', lead.leadScore || '')),
    leadScoreReason: String(valueFor('leadScoreReason', lead.leadScoreReason || '')),
    intakeQuality: String(valueFor('intakeQuality', lead.intakeQuality || '')),
    recommendedStage: String(valueFor('recommendedStage', lead.recommendedStage || '')),
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
    'leadScore',
    'leadScoreReason',
    'intakeQuality',
    'recommendedStage',
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
        const existing = leadMap.get(id)
        if (existing && existing.status !== 'Started' && lead.status === 'Started') return
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
      const scoring = scoreLeadData(data, data.status || 'New')

      const lead = normalizeLeadRecord({
        ...data,
        id: String(data.id || randomUUID()),
        name: String(data.name || 'Phone/referral lead').trim(),
        source: 'flanagan-admin',
        leadKind: String(data.leadKind || 'Office-entered lead'),
        receivedAt: data.receivedAt || new Date().toISOString(),
        status: data.status || 'New',
        priority: data.priority || scoring.priority,
        leadScore: data.leadScore || String(scoring.score),
        leadScoreReason: data.leadScoreReason || scoring.reasons.join('; '),
        intakeQuality: data.intakeQuality || scoring.quality,
        recommendedStage: data.recommendedStage || scoring.recommendedStage,
        closeProbability: data.closeProbability || String(scoring.closeProbability),
        nextStep: data.nextStep || scoring.nextStep,
      })

      await appendDataFile(leadLogPath, `${JSON.stringify(lead)}\n`)
      const crm = await readJsonFile(leadCrmPath, {})
      crm[lead.id] = {
        status: lead.status,
        priority: lead.priority,
        leadScore: lead.leadScore,
        leadScoreReason: lead.leadScoreReason,
        intakeQuality: lead.intakeQuality,
        recommendedStage: lead.recommendedStage,
        closeProbability: lead.closeProbability,
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

function withShareAssetOrigin(text, req) {
  const origin = requestOrigin(req)
  if (origin === canonicalBase) return text
  return shareAssetPaths.reduce(
    (nextText, assetPath) => nextText.split(`${canonicalBase}/${assetPath}`).join(`${origin}/${assetPath}`),
    text,
  )
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
  const html = applyServerSeo(withShareAssetOrigin(await readFile(indexPath, 'utf8'), req), req.url || '/')
  send(res, 200, headers, html, gzipOk)
}

function escapeHtmlAttribute(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function serverSeoForPath(rawPath = '/') {
  const pathname = decodeURIComponent(String(rawPath).split('?')[0]).replace(/\/+$/, '') || '/'
  const seo = defaultSiteContent.seo
  const servicePage = defaultSiteContent.localSeo?.servicePages?.find((page) => `/${page.slug}` === pathname)
  if (servicePage) {
    return {
      title: servicePage.seoTitle,
      description: servicePage.seoDescription,
      canonical: `${canonicalBase}/${servicePage.slug}`,
      robots: 'index, follow, max-image-preview:large, max-snippet:-1',
    }
  }
  if (pathname === '/our-work') {
    return {
      title: seo.ourWorkTitle,
      description: seo.ourWorkDescription,
      canonical: `${canonicalBase}/our-work`,
      robots: 'index, follow, max-image-preview:large, max-snippet:-1',
    }
  }
  if (pathname.startsWith('/admin') || pathname === '/qr-code' || pathname === '/business-card') {
    return {
      title: pathname.startsWith('/admin') ? 'Flanagan Admin' : 'Flanagan Construction',
      description: pathname.startsWith('/admin')
        ? 'Private Flanagan Construction admin dashboard.'
        : 'Flanagan Construction customer resource.',
      canonical: `${canonicalBase}${pathname}`,
      robots: 'noindex, follow',
    }
  }
  return {
    title: seo.homeTitle,
    description: seo.homeDescription,
    canonical: `${canonicalBase}/`,
    robots: 'index, follow, max-image-preview:large, max-snippet:-1',
  }
}

function applyServerSeo(html, rawPath) {
  const meta = serverSeoForPath(rawPath)
  const title = escapeHtmlAttribute(meta.title)
  const description = escapeHtmlAttribute(meta.description)
  const canonical = escapeHtmlAttribute(meta.canonical)
  const robots = escapeHtmlAttribute(meta.robots)
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${description}" />`)
    .replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i, `<meta name="robots" content="${robots}" />`)
    .replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${canonical}" />`)
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${description}" />`)
    .replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${canonical}" />`)
    .replace(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${title}" />`)
    .replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${description}" />`)
}

async function serveTextWithOrigin(req, res, filePath, contentType, gzipOk, rewriteOrigin = true) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found')
    return
  }
  const headers = { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=3600' }
  if (req.method === 'HEAD') {
    send(res, 200, headers, null)
    return
  }
  const text = await readFile(filePath, 'utf8')
  const body = rewriteOrigin ? withOrigin(text, req) : text
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
const draftRateHits = new Map()
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

function isDraftRateLimited(ip) {
  return isBucketRateLimited(draftRateHits, ip, 30, rateWindowMs)
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

function cleanLeadString(value) {
  return String(value || '').trim()
}

function selectedNeedsFromData(data = {}) {
  return Array.isArray(data.selectedNeeds)
    ? data.selectedNeeds.map((item) => cleanLeadString(item)).filter(Boolean)
    : []
}

function leadSearchText(data = {}) {
  return [
    data.name,
    data.address,
    data.addressCity,
    data.projectType,
    data.funnelGroup,
    data.serviceRoute,
    data.message,
    ...selectedNeedsFromData(data),
  ].join(' ')
}

function sourceMetaFromLeadData(data = {}) {
  return {
    sourcePath: cleanLeadString(data.sourcePath),
    sourcePage: cleanLeadString(data.sourcePage),
    landingPage: cleanLeadString(data.landingPage),
    serviceRoute: cleanLeadString(data.serviceRoute),
    utmSource: cleanLeadString(data.utmSource),
    utmMedium: cleanLeadString(data.utmMedium),
    utmCampaign: cleanLeadString(data.utmCampaign),
    utmTerm: cleanLeadString(data.utmTerm),
    utmContent: cleanLeadString(data.utmContent),
    gclid: cleanLeadString(data.gclid),
    gbraid: cleanLeadString(data.gbraid),
    wbraid: cleanLeadString(data.wbraid),
  }
}

function scoreLeadData(data = {}, status = 'New') {
  const text = leadSearchText(data)
  const selectedNeeds = selectedNeedsFromData(data)
  const reasons = []
  let score = status === 'Started' ? 18 : 28

  if (cleanLeadString(data.phone).replace(/\D/g, '').length >= 7) {
    score += 16
    reasons.push('phone captured')
  }
  if (emailLooksValid(data.email)) {
    score += 10
    reasons.push('email captured')
  }
  if (cleanLeadString(data.name)) score += 6
  if (cleanLeadString(data.address)) {
    score += 15
    reasons.push('job address')
  }
  if (data.addressPlaceId || data.addressCity || data.addressPostalCode) score += 5
  if (selectedNeeds.length) {
    score += Math.min(14, 7 + selectedNeeds.length * 2)
    reasons.push('work type selected')
  }
  if (/kitchen|bath|concrete|driveway|sidewalk|roof|siding|window/i.test(text)) {
    score += 12
    reasons.push('top service')
  }
  if (/leak|water|damage|fix|bad|ceiling|unsafe|broken|urgent|asap|commercial/i.test(text)) {
    score += 9
    reasons.push('urgent or high-value clue')
  }
  if (data.gclid || data.gbraid || data.wbraid || data.utmCampaign) {
    score += 5
    reasons.push('tracked campaign')
  }
  if (data.addressState && !/^DE$/i.test(cleanLeadString(data.addressState))) {
    score -= 15
    reasons.push('service area check')
  }
  if (/\b(fl|florida|pa|pennsylvania|nj|new jersey|md|maryland)\b/i.test(cleanLeadString(data.address))) {
    score -= 12
    reasons.push('possible out-of-area address')
  }

  const clampedScore = Math.max(8, Math.min(100, Math.round(score)))
  const priority = clampedScore >= 76 ? 'Hot' : clampedScore >= 52 ? 'Warm' : clampedScore >= 34 ? 'Normal' : 'Low'
  const closeProbability = Math.max(12, Math.min(90, Math.round(clampedScore * 0.78)))
  const quality = clampedScore >= 78 ? 'High intent' : clampedScore >= 55 ? 'Good lead' : 'Needs office follow-up'
  let nextStep = 'Call or text to confirm scope, address, photos, and best estimate time.'

  if (status === 'Started') {
    nextStep = cleanLeadString(data.address)
      ? 'Started form: call/text within 15 minutes, confirm scope, and finish the request.'
      : 'Started form: call/text within 15 minutes and collect the project address.'
  } else if (!cleanLeadString(data.address)) {
    nextStep = 'Collect the job address before scheduling or pricing.'
  } else if (!selectedNeeds.length && !cleanLeadString(data.projectType)) {
    nextStep = 'Classify the work type, ask for photos, and schedule the estimate path.'
  } else if (/kitchen|bath/i.test(text)) {
    nextStep = 'Call, ask for photos/measurements, and schedule the kitchen or bath estimate.'
  } else if (/concrete|driveway|sidewalk/i.test(text)) {
    nextStep = 'Confirm access, drainage, square footage, and schedule the concrete estimate.'
  } else if (/roof|siding|window/i.test(text)) {
    nextStep = 'Confirm exterior issue, leak risk, photos, and schedule the exterior estimate.'
  }

  return {
    score: clampedScore,
    priority,
    quality,
    closeProbability,
    recommendedStage: status === 'Started' ? 'New' : 'Contacted',
    nextStep,
    reasons: reasons.length ? reasons : ['basic request'],
  }
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
    const email = String(data.email || '').trim()
    if (!name || (!phone && !email)) {
      sendJson(res, 422, { ok: false, error: 'Name and either phone or email are required.' }, gzipOk)
      return
    }

    const scoring = scoreLeadData(data, 'New')
    const sourceMeta = sourceMetaFromLeadData(data)
    const lead = {
      id: String(data.leadId || data.id || randomUUID()),
      name,
      phone,
      email,
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
      ...sourceMeta,
      receivedAt: new Date().toISOString(),
      status: 'New',
      priority: String(data.priority || scoring.priority),
      leadScore: String(scoring.score),
      leadScoreReason: scoring.reasons.join('; '),
      intakeQuality: scoring.quality,
      recommendedStage: scoring.recommendedStage,
      closeProbability: String(scoring.closeProbability),
      nextStep: String(data.nextStep || scoring.nextStep),
      notes: '',
      ipHash: hashForLog(ip),
    }

    if (await finalizedLeadAlreadyExists(lead.id)) {
      sendJson(res, 200, {
        ok: true,
        leadId: lead.id,
        duplicate: true,
        delivery: { crm: true, officeEmail: false, customerEmail: false },
      }, gzipOk)
      return
    }

    // Always surface the lead in the deploy logs so it is never silently lost.
    console.log('[LEAD]', JSON.stringify(lead))

    // Best-effort durable copy (note: container disks are ephemeral on Railway).
    try {
      await appendDataFile(leadLogPath, `${JSON.stringify(lead)}\n`)
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

    const [officeEmail, customerEmail] = await Promise.all([
      notifyLeadByEmail(lead),
      acknowledgeLeadByEmail(lead),
    ])
    console.log('[LEAD_DELIVERY]', JSON.stringify({
      leadId: lead.id,
      crm: true,
      officeEmail: officeEmail.sent,
      customerEmail: customerEmail.sent,
      customerEmailReason: customerEmail.reason || '',
    }))
    await recordAnalyticsEvent({
      event: 'lead_submitted',
      path: lead.sourcePath || '/',
      source: lead.utmSource || 'direct',
      medium: lead.utmMedium,
      campaign: lead.utmCampaign,
      leadId: lead.id,
      ipHash: lead.ipHash,
    }).catch((error) => console.error('[ANALYTICS] lead event failed:', error?.message))

    sendJson(res, 200, {
      ok: true,
      leadId: lead.id,
      delivery: {
        crm: true,
        officeEmail: officeEmail.sent,
        customerEmail: customerEmail.sent,
      },
    }, gzipOk)
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
  const ip = clientIp(req)
  if (isDraftRateLimited(ip)) {
    sendJson(res, 429, { ok: false, error: 'Too many saved drafts. Please try again later.' }, gzipOk)
    return
  }

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

  const scoring = scoreLeadData(data, 'Started')
  const sourceMeta = sourceMetaFromLeadData(data)
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
    ...sourceMeta,
    receivedAt: new Date().toISOString(),
    status: 'Started',
    priority: String(data.priority || scoring.priority),
    leadScore: String(scoring.score),
    leadScoreReason: scoring.reasons.join('; '),
    intakeQuality: scoring.quality,
    recommendedStage: scoring.recommendedStage,
    closeProbability: String(scoring.closeProbability),
    nextStep: String(data.nextStep || scoring.nextStep),
    notes: '',
    ipHash: hashForLog(ip),
  }

  if (await finalizedLeadAlreadyExists(lead.id)) {
    sendJson(res, 200, { ok: true, leadId: lead.id, duplicate: true, finalized: true }, gzipOk)
    return
  }

  console.log('[LEAD_DRAFT]', JSON.stringify(lead))

  try {
    await appendDataFile(leadLogPath, `${JSON.stringify(lead)}\n`)
    await recordAnalyticsEvent({
      event: 'lead_started',
      path: lead.sourcePath || '/',
      source: lead.utmSource || 'direct',
      medium: lead.utmMedium,
      campaign: lead.utmCampaign,
      leadId: lead.id,
      ipHash: lead.ipHash,
    })
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

  if (pathname === '/api/admin/analytics') {
    await handleAdminAnalytics(req, res, gzipOk)
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

  if (pathname === '/api/analytics') {
    await handleAnalyticsEvent(req, res, gzipOk)
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

  // Always advertise the canonical production domain, even when this service is
  // reached through its Railway fallback hostname.
  if (pathname === '/robots.txt') {
    await serveTextWithOrigin(req, res, join(distDir, 'robots.txt'), 'text/plain; charset=utf-8', gzipOk, false)
    return
  }
  if (pathname === '/sitemap.xml') {
    await serveTextWithOrigin(req, res, join(distDir, 'sitemap.xml'), 'application/xml; charset=utf-8', gzipOk, false)
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
