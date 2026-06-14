import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bot,
  Calculator,
  CheckCircle2,
  Clock3,
  Clipboard,
  DollarSign,
  Download,
  Edit3,
  Eye,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  GripVertical,
  Hammer,
  Home,
  Image,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  ReceiptText,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trash2,
  Users,
  WandSparkles,
} from 'lucide-react'
import { defaultSiteContent } from './content'
import {
  ADMIN_SESSION_KEY,
  cloneSiteContent,
  cssUrl,
  loadStoredLeads,
  mergeSiteContent,
  normalizeLead,
  resetStoredContent,
  saveStoredContent,
  saveStoredLeads,
} from './siteContent'
import './AdminDashboard.css'

const statusOptions = [
  'Started',
  'New',
  'Contacted',
  'Estimate Scheduled',
  'Estimate Sent',
  'Follow Up',
  'Payment Link Sent',
  'Deposit Paid',
  'Scheduled',
  'In Progress',
  'Complete',
  'Receipt Sent',
  'Won',
  'Lost',
]
const priorityOptions = ['Hot', 'Warm', 'Normal', 'Low']
const stagePlaybook = [
  { status: 'Contacted', nextStep: 'Confirm scope, address, and best estimate time.' },
  { status: 'Estimate Scheduled', nextStep: 'Send appointment confirmation and add it to the calendar.' },
  { status: 'Estimate Sent', nextStep: 'Send written estimate and schedule a follow-up call.' },
  { status: 'Follow Up', nextStep: 'Follow up on estimate questions and decision timing.' },
  { status: 'Payment Link Sent', nextStep: 'Send payment link for deposit or invoice.' },
  { status: 'Deposit Paid', nextStep: 'Confirm deposit, schedule work, and prep materials.' },
  { status: 'Scheduled', nextStep: 'Confirm start date, access, and subcontractor needs.' },
  { status: 'Complete', nextStep: 'Send completion note, receipt, and review request.' },
]
const emailTemplates = {
  Contacted: {
    subject: 'Thanks for reaching out to Flanagan Construction',
    body:
      'Hi {name},\n\nThanks for reaching out to Flanagan Construction. I saw your request for {projectType}. I wanted to confirm the best details before we set up the next step.\n\nProject address: {address}\nSelected needs: {selectedNeeds}\n\nWhat is the best time to talk?\n\nThanks,\nNick Flanagan',
  },
  'Estimate Scheduled': {
    subject: 'Your Flanagan Construction estimate appointment',
    body:
      'Hi {name},\n\nYou are on our list for an estimate for {projectType}. I have the project address as {address}. Please reply with the best access instructions and anything you want us to look closely at.\n\nThanks,\nNick Flanagan',
  },
  'Estimate Sent': {
    subject: 'Your Flanagan Construction estimate',
    body:
      'Hi {name},\n\nI am sending over the estimate for {projectType}. Estimated amount: {estimateAmount}.\n\nPlease reply with any questions. If everything looks good, I can send the next step and payment link.\n\nThanks,\nNick Flanagan',
  },
  'Follow Up': {
    subject: 'Checking in on your Flanagan Construction estimate',
    body:
      'Hi {name},\n\nI wanted to check in on the estimate for {projectType}. I am happy to talk through scope, timing, or any questions before you decide.\n\nThanks,\nNick Flanagan',
  },
  'Payment Link Sent': {
    subject: 'Payment link for your Flanagan Construction project',
    body:
      'Hi {name},\n\nHere is the payment link for your project: {paymentLink}\n\nOnce payment is complete, we will confirm scheduling and next steps.\n\nThanks,\nNick Flanagan',
  },
  'Deposit Paid': {
    subject: 'Deposit received - Flanagan Construction',
    body:
      'Hi {name},\n\nWe received the deposit for {projectType}. Thank you. We will confirm scheduling, materials, and any subcontractor coordination needed before work begins.\n\nThanks,\nNick Flanagan',
  },
  Scheduled: {
    subject: 'Your project is scheduled',
    body:
      'Hi {name},\n\nYour Flanagan Construction project is scheduled. We will keep communication clear as we get closer and will confirm access, materials, and any trade coordination.\n\nThanks,\nNick Flanagan',
  },
  Complete: {
    subject: 'Project complete - Flanagan Construction',
    body:
      'Hi {name},\n\nThank you for trusting Flanagan Construction with your project. We appreciate the work and hope everything is looking good.\n\nIf anything needs attention, please reply here.\n\nThanks,\nNick Flanagan',
  },
  'Receipt Sent': {
    subject: 'Receipt for your Flanagan Construction project',
    body:
      'Hi {name},\n\nAttached or linked is your receipt for {projectType}. Thank you again for working with us.\n\nThanks,\nNick Flanagan',
  },
}
const contentTabs = [
  { id: 'overview', label: 'Homepage', icon: Home },
  { id: 'services', label: 'Services', icon: FileText },
  { id: 'photos', label: 'Photos', icon: Image },
  { id: 'workGallery', label: 'Our Work', icon: Hammer },
  { id: 'reviews', label: 'Reviews & FAQ', icon: Sparkles },
  { id: 'builder', label: 'Builder', icon: GripVertical },
  { id: 'ai', label: 'AI-ready', icon: WandSparkles },
]
const estimateProfiles = {
  kitchenBath: {
    label: 'Kitchen and bath remodel',
    base: [8500, 28000],
    labor: 0.36,
    materials: 0.34,
    subs: 0.18,
    other: 0.12,
    markup: 30,
    deposit: 35,
    timeline: '2-6 weeks after scope and material choices',
    tradeNeeds: ['Plumbing coordination', 'Electrical check', 'Tile/layout review', 'Ventilation check'],
    scope: ['Measure room and document fixtures', 'Check plumbing/venting before price is final', 'Confirm tile, vanity, shower, cabinet, and paint choices'],
  },
  concrete: {
    label: 'Concrete driveway or sidewalk',
    base: [4200, 16000],
    labor: 0.28,
    materials: 0.38,
    subs: 0.22,
    other: 0.12,
    markup: 26,
    deposit: 30,
    timeline: '1-3 weeks depending on weather, prep, and concrete schedule',
    tradeNeeds: ['Concrete crew', 'Possible excavation/hauling', 'Permit or utility mark-out if needed'],
    scope: ['Measure square footage', 'Check base, drainage, demo, and haul-away', 'Confirm broom finish, thickness, and edges'],
  },
  exterior: {
    label: 'Roofing, siding, windows, doors, gutters',
    base: [3500, 22000],
    labor: 0.31,
    materials: 0.42,
    subs: 0.16,
    other: 0.11,
    markup: 28,
    deposit: 33,
    timeline: '1-4 weeks depending on materials and weather',
    tradeNeeds: ['Roof/siding crew', 'Window/door supplier', 'Gutter coordination if needed'],
    scope: ['Inspect leak points and exterior damage', 'Confirm materials, color, and measurements', 'Check flashing, trim, gutters, and access'],
  },
  deckAddition: {
    label: 'Deck, porch, addition, or build-out',
    base: [12000, 65000],
    labor: 0.34,
    materials: 0.33,
    subs: 0.22,
    other: 0.11,
    markup: 32,
    deposit: 35,
    timeline: '3-10 weeks depending on permit, foundation, and trade schedule',
    tradeNeeds: ['Foundation/framing crew', 'Electrical/HVAC as needed', 'Permit and inspection planning'],
    scope: ['Confirm drawings or rough dimensions', 'Check foundation, access, and tie-in points', 'Plan subcontractors before committing price'],
  },
  general: {
    label: 'General repair or remodel',
    base: [1800, 9500],
    labor: 0.42,
    materials: 0.28,
    subs: 0.16,
    other: 0.14,
    markup: 28,
    deposit: 30,
    timeline: 'A few days to 3 weeks depending on scope',
    tradeNeeds: ['Right trade by scope', 'Material pickup and site protection', 'Office follow-up'],
    scope: ['Clarify exact room or exterior area', 'Collect photos if available', 'Confirm access, timing, and repair expectations'],
  },
}

function readSessionAuth() {
  try {
    const stored = window.sessionStorage.getItem(ADMIN_SESSION_KEY)
    if (!stored) return { token: '', user: null, expiresAt: '' }
    if (stored.startsWith('{')) return JSON.parse(stored)
    return { token: stored, user: null, expiresAt: '' }
  } catch {
    return { token: '', user: null, expiresAt: '' }
  }
}

function writeSessionAuth(auth) {
  try {
    if (auth?.token) window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(auth))
    else window.sessionStorage.removeItem(ADMIN_SESSION_KEY)
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

async function adminRequest(path, { method = 'GET', token = '', body } = {}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'

  const response = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(payload.error || `Request failed: ${response.status}`)
    error.status = response.status
    throw error
  }

  return payload
}

function formatDate(value) {
  if (!value) return 'No date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No date'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatMoney(value) {
  if (!value) return 'Not entered yet'
  const number = Number(String(value).replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(number) || number <= 0) return String(value)
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(number)
}

function moneyValue(value) {
  const number = Number(String(value ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(moneyValue(value))
}

function leadFinancials(lead) {
  const labor = moneyValue(lead.quoteLaborCost)
  const materials = moneyValue(lead.quoteMaterialCost)
  const subcontractors = moneyValue(lead.quoteSubCost)
  const other = moneyValue(lead.quoteOtherCost)
  const totalCost = labor + materials + subcontractors + other
  const markupPercent = moneyValue(lead.quoteMarkupPercent)
  const suggestedPrice = totalCost * (1 + markupPercent / 100)
  const customerPrice = moneyValue(lead.quoteCustomerPrice) || moneyValue(lead.estimateAmount) || suggestedPrice
  const revenueReceived = moneyValue(lead.revenueReceived)
  const expenseTotal = moneyValue(lead.expenseTotal) || totalCost
  const grossProfit = customerPrice - expenseTotal
  const margin = customerPrice > 0 ? (grossProfit / customerPrice) * 100 : 0

  return {
    labor,
    materials,
    subcontractors,
    other,
    totalCost,
    markupPercent,
    suggestedPrice,
    customerPrice,
    revenueReceived,
    expenseTotal,
    grossProfit,
    margin,
  }
}

function fillTemplate(template, lead) {
  const selectedNeeds = lead.selectedNeeds?.length ? lead.selectedNeeds.join(', ') : 'Not listed yet'
  return String(template || '')
    .replaceAll('{name}', lead.name || 'there')
    .replaceAll('{projectType}', lead.projectType || 'your project')
    .replaceAll('{address}', lead.address || 'Not listed yet')
    .replaceAll('{selectedNeeds}', selectedNeeds)
    .replaceAll('{estimateAmount}', formatMoney(lead.estimateAmount))
    .replaceAll('{paymentLink}', lead.paymentLink || '[paste payment link]')
}

function emailDraftFor(lead, stage = lead?.status) {
  const template = emailTemplates[stage] || emailTemplates.Contacted
  return {
    stage,
    subject: fillTemplate(template.subject, lead),
    body: fillTemplate(template.body, lead),
  }
}

function mailtoFor(lead, draft) {
  const params = new URLSearchParams({
    subject: draft.subject,
    body: draft.body,
  })
  return `mailto:${lead.email || ''}?${params.toString()}`
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    window.prompt('Copy this text', text)
    return false
  }
}

function toDateTimeInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 16)
}

function fromDateTimeInputValue(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function adminFirstName(user) {
  const name = String(user?.name || '').trim()
  if (name) return name.split(/\s+/)[0]
  const email = String(user?.email || '').toLowerCase()
  if (email.includes('nick')) return 'Nick'
  if (email.includes('kevin')) return 'Kevin'
  return 'there'
}

function greetingFor(user) {
  const hour = new Date().getHours()
  const dayPart = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'
  return `Good ${dayPart.toLowerCase()}, ${adminFirstName(user)}.`
}

function smtpStatusLabel(emailSettings) {
  if (!emailSettings) return 'Checking outbound email'
  return emailSettings.configured ? 'Outbound email ready' : 'SMTP setup needed'
}

function visibleLeadStatus(lead) {
  if (!lead) return ''
  if (lead.leadKind === 'Started funnel' || lead.status === 'Started') return 'Started form'
  return lead.status || 'New'
}

function serviceProfileFor(lead = {}) {
  const text = [
    lead.projectType,
    lead.funnelGroup,
    lead.message,
    ...(lead.selectedNeeds || []),
  ].join(' ').toLowerCase()

  if (/kitchen|bath|vanit|shower|tile|plumb|interior/.test(text)) return estimateProfiles.kitchenBath
  if (/concrete|driveway|sidewalk|blacktop|paver|hardscape|retaining|patio|outdoor kitchen/.test(text)) {
    return estimateProfiles.concrete
  }
  if (/roof|siding|window|door|gutter|garage/.test(text)) return estimateProfiles.exterior
  if (/deck|porch|addition|foundation|whole house|build|fence|screen/.test(text)) return estimateProfiles.deckAddition
  return estimateProfiles.general
}

function complexityForLead(lead = {}) {
  const text = [lead.projectType, lead.message, ...(lead.selectedNeeds || [])].join(' ').toLowerCase()
  let score = 1
  if ((lead.selectedNeeds || []).length >= 3) score += 0.14
  if (/commercial|foundation|addition|whole house|custom|structural/.test(text)) score += 0.28
  if (/fix|repair|leak|trash|bad|cheap|failed|wrong|urgent/.test(text)) score += 0.16
  if (/roof|concrete|driveway|kitchen|bath/.test(text)) score += 0.06
  return Math.min(1.62, score)
}

function roundedDollars(value) {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (value < 5000) return Math.round(value / 100) * 100
  return Math.round(value / 500) * 500
}

function aiEstimateForLead(lead = {}) {
  const profile = serviceProfileFor(lead)
  const complexity = complexityForLead(lead)
  const low = roundedDollars(profile.base[0] * complexity)
  const high = roundedDollars(profile.base[1] * complexity)
  const midpoint = roundedDollars((low + high) / 2)
  const laborCost = roundedDollars(midpoint * profile.labor)
  const materialCost = roundedDollars(midpoint * profile.materials)
  const subCost = roundedDollars(midpoint * profile.subs)
  const otherCost = roundedDollars(midpoint * profile.other)
  const totalCost = laborCost + materialCost + subCost + otherCost
  const suggestedPrice = roundedDollars(totalCost * (1 + profile.markup / 100))
  const depositTarget = roundedDollars(suggestedPrice * (profile.deposit / 100))
  const confidence = lead.address && lead.phone && (lead.selectedNeeds?.length || lead.message) ? 'Good first pass' : 'Needs more detail'
  const text = [lead.projectType, lead.message, ...(lead.selectedNeeds || [])].join(' ').toLowerCase()
  const redFlags = [
    !lead.address ? 'Get the project address before scheduling.' : '',
    !lead.message && !lead.selectedNeeds?.length ? 'Ask for photos or a simple scope note.' : '',
    /cheap|bad|trash|fix|leak|failed|wrong/.test(text) ? 'Possible repair-after-bad-work job. Inspect hidden conditions before promising price.' : '',
    /plumb|bath|kitchen|addition|foundation|commercial/.test(text) ? 'May need permits, trade coordination, or inspection timing.' : '',
  ].filter(Boolean)

  return {
    profile,
    confidence,
    low,
    high,
    midpoint,
    laborCost,
    materialCost,
    subCost,
    otherCost,
    totalCost,
    suggestedPrice,
    depositTarget,
    markupPercent: profile.markup,
    depositPercent: profile.deposit,
    timeline: profile.timeline,
    tradeNeeds: profile.tradeNeeds,
    scope: profile.scope,
    redFlags,
    nextStep: `Call ${lead.name || 'the customer'} to verify scope, address, photos, and timing before locking price.`,
    customerSummary:
      `Based on the request, this looks like ${profile.label.toLowerCase()}. A planning range is ${formatCurrency(low)}-${formatCurrency(high)} before an on-site look. Final price depends on measurements, access, materials, and hidden conditions.`,
  }
}

function estimateClipboardText(lead, estimate) {
  return [
    `AI estimate draft for ${lead.name || 'website lead'}`,
    `Project: ${estimate.profile.label}`,
    `Planning range: ${formatCurrency(estimate.low)}-${formatCurrency(estimate.high)}`,
    `Suggested working price: ${formatCurrency(estimate.suggestedPrice)}`,
    `Deposit target: ${formatCurrency(estimate.depositTarget)} (${estimate.depositPercent}%)`,
    `Timeline: ${estimate.timeline}`,
    '',
    'Internal cost buckets:',
    `Labor: ${formatCurrency(estimate.laborCost)}`,
    `Materials: ${formatCurrency(estimate.materialCost)}`,
    `Subcontractors: ${formatCurrency(estimate.subCost)}`,
    `Other: ${formatCurrency(estimate.otherCost)}`,
    '',
    'Scope checklist:',
    ...estimate.scope.map((item) => `- ${item}`),
    '',
    'Trade needs:',
    ...estimate.tradeNeeds.map((item) => `- ${item}`),
    '',
    'Watch-outs:',
    ...(estimate.redFlags.length ? estimate.redFlags : ['- Verify measurements and material choices before final estimate.']),
    '',
    'Customer summary:',
    estimate.customerSummary,
  ].join('\n')
}

function leadSortScore(lead) {
  const statusScore = {
    Started: 95,
    New: 90,
    Contacted: 72,
    'Estimate Scheduled': 66,
    'Estimate Sent': 84,
    'Follow Up': 80,
    'Payment Link Sent': 74,
    'Deposit Paid': 44,
    Scheduled: 34,
    'In Progress': 25,
    Complete: 10,
    Won: 6,
    Lost: 0,
  }[lead.status] ?? 50
  const priorityScore = { Hot: 18, Warm: 10, Normal: 4, Low: 0 }[lead.priority] ?? 6
  const ageHours = Math.max(0, (Date.now() - new Date(lead.receivedAt || Date.now()).getTime()) / 36e5)
  return statusScore + priorityScore + Math.min(14, ageHours / 6)
}

function workdayStats(leads) {
  const openLeads = leads.filter((lead) => !['Won', 'Lost', 'Complete'].includes(lead.status))
  const followUps = leads.filter((lead) => ['Started', 'New', 'Follow Up', 'Estimate Sent'].includes(lead.status))
  const estimateQueue = leads.filter((lead) => ['New', 'Contacted', 'Estimate Scheduled'].includes(lead.status))
  const hotLeads = leads.filter((lead) => lead.priority === 'Hot')
  const totalPipeline = leads.reduce((sum, lead) => sum + moneyValue(lead.quoteCustomerPrice || lead.estimateAmount), 0)
  return { openLeads, followUps, estimateQueue, hotLeads, totalPipeline }
}

function Field({ label, value, onChange, textarea = false, type = 'text', rows = 3 }) {
  const Control = textarea ? 'textarea' : 'input'
  return (
    <label className="admin-field">
      <span>{label}</span>
      <Control
        type={textarea ? undefined : type}
        rows={textarea ? rows : undefined}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function AdminLogin({
  email,
  setEmail,
  password,
  setPassword,
  loginTrap,
  setLoginTrap,
  loading,
  message,
  onSubmit,
  goHome,
}) {
  return (
    <main className="admin-auth">
      <form className="admin-auth-panel" onSubmit={onSubmit}>
        <span className="admin-auth-icon">
          <Lock size={24} aria-hidden="true" />
        </span>
          <h1>Flanagan Admin</h1>
        <p className="admin-auth-help">Use your assigned super-admin email and password.</p>
        <div className="admin-hp-field" aria-hidden="true">
          <label>
            Website
            <input
              name="website"
              value={loginTrap.website}
              onChange={(event) => setLoginTrap((current) => ({ ...current, website: event.target.value }))}
              tabIndex="-1"
              autoComplete="off"
            />
          </label>
          <label>
            Confirm email
            <input
              name="confirmEmail"
              value={loginTrap.confirmEmail}
              onChange={(event) => setLoginTrap((current) => ({ ...current, confirmEmail: event.target.value }))}
              tabIndex="-1"
              autoComplete="off"
            />
          </label>
        </div>
        <label>
          Super admin email
          <input
            type="email"
            value={email}
            autoComplete="username"
            placeholder="Super admin email"
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button className="admin-primary-button" type="submit" disabled={loading}>
          {loading ? <RefreshCw size={18} aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}
          Unlock dashboard
        </button>
        {message ? <p className="admin-auth-message">{message}</p> : null}
        <button className="admin-plain-link" type="button" onClick={goHome}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to site
        </button>
      </form>
    </main>
  )
}

function PipelineStats({ leads }) {
  const total = leads.length
  const hot = leads.filter((lead) => lead.priority === 'Hot').length
  const open = leads.filter((lead) => !['Won', 'Lost'].includes(lead.status)).length
  const won = leads.filter((lead) => lead.status === 'Won').length

  return (
    <div className="admin-metric-grid" aria-label="Lead summary">
      <article>
        <span>Total leads</span>
        <strong>{total}</strong>
      </article>
      <article>
        <span>Open</span>
        <strong>{open}</strong>
      </article>
      <article>
        <span>Hot</span>
        <strong>{hot}</strong>
      </article>
      <article>
        <span>Won</span>
        <strong>{won}</strong>
      </article>
    </div>
  )
}

function AiEstimatePanel({ lead, updateLead, onApplyEstimate, compact = false }) {
  if (!lead) {
    return (
      <section className="admin-panel ai-estimate-panel">
        <div className="admin-empty compact-empty">
          <Bot size={24} aria-hidden="true" />
          <strong>No lead selected</strong>
          <span>Pick a request and the assistant will draft scope, cost buckets, and follow-up.</span>
        </div>
      </section>
    )
  }

  const estimate = aiEstimateForLead(lead)
  const applyEstimate = () => {
    const patch = {
      priority: lead.priority === 'Low' ? 'Warm' : lead.priority,
      quoteLaborCost: String(estimate.laborCost),
      quoteMaterialCost: String(estimate.materialCost),
      quoteSubCost: String(estimate.subCost),
      quoteOtherCost: String(estimate.otherCost),
      quoteMarkupPercent: String(estimate.markupPercent),
      quoteCustomerPrice: String(estimate.suggestedPrice),
      quoteDepositPercent: String(estimate.depositPercent),
      estimateAmount: String(estimate.suggestedPrice),
      nextStep: estimate.nextStep,
      notes: [
        lead.notes,
        '',
        'AI estimate draft:',
        estimate.customerSummary,
        `Planning range: ${formatCurrency(estimate.low)}-${formatCurrency(estimate.high)}`,
        `Likely trades: ${estimate.tradeNeeds.join(', ')}`,
      ].filter(Boolean).join('\n'),
    }
    updateLead(lead.id, patch)
    onApplyEstimate?.(patch, estimate)
  }

  const copyEstimate = async () => {
    const text = estimateClipboardText(lead, estimate)
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      updateLead(lead.id, {
        notes: [lead.notes, '', text].filter(Boolean).join('\n'),
      })
    }
  }

  return (
    <section className={compact ? 'admin-panel ai-estimate-panel compact-ai' : 'admin-panel ai-estimate-panel'}>
      <div className="ai-estimate-head">
        <span>
          <Bot size={22} aria-hidden="true" />
        </span>
        <div>
          <p className="admin-eyebrow">Nick's AI estimate</p>
          <h3>{estimate.profile.label}</h3>
          <small>{estimate.confidence}</small>
        </div>
      </div>

      <div className="ai-range-card">
        <span>Planning range</span>
        <strong>{formatCurrency(estimate.low)}-{formatCurrency(estimate.high)}</strong>
        <small>Working price: {formatCurrency(estimate.suggestedPrice)} / deposit {formatCurrency(estimate.depositTarget)}</small>
      </div>

      <div className="ai-cost-grid">
        <article>
          <span>Labor</span>
          <strong>{formatCurrency(estimate.laborCost)}</strong>
        </article>
        <article>
          <span>Materials</span>
          <strong>{formatCurrency(estimate.materialCost)}</strong>
        </article>
        <article>
          <span>Subs</span>
          <strong>{formatCurrency(estimate.subCost)}</strong>
        </article>
        <article>
          <span>Other</span>
          <strong>{formatCurrency(estimate.otherCost)}</strong>
        </article>
      </div>

      <div className="ai-assistant-grid">
        <div>
          <strong>Ask before pricing</strong>
          <ul>
            {estimate.scope.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <strong>Trades likely needed</strong>
          <ul>
            {estimate.tradeNeeds.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {estimate.redFlags.length ? (
        <div className="ai-red-flags">
          <strong>Watch-outs</strong>
          {estimate.redFlags.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}

      <p className="ai-customer-summary">{estimate.customerSummary}</p>

      <div className="ai-actions">
        <button className="admin-primary-button" type="button" onClick={applyEstimate}>
          <WandSparkles size={17} aria-hidden="true" />
          Apply to quote
        </button>
        <button className="admin-secondary-button" type="button" onClick={copyEstimate}>
          <Clipboard size={17} aria-hidden="true" />
          Copy draft
        </button>
      </div>
    </section>
  )
}

function WorkdayAssistant({ user, leads, selectedLead, setSelectedLeadId, setActiveView, updateLead, emailSettings }) {
  const stats = workdayStats(leads)
  const priorityLeads = [...stats.openLeads].sort((a, b) => leadSortScore(b) - leadSortScore(a)).slice(0, 5)
  const assistantLead = selectedLead || priorityLeads[0] || leads[0]
  const nextName = assistantLead?.name || 'the next lead'
  const topEstimate = assistantLead ? aiEstimateForLead(assistantLead) : null

  const openLead = (lead) => {
    setSelectedLeadId(lead.id)
    setActiveView('leads')
  }

  return (
    <section className="admin-page assistant-page">
      <div className="assistant-hero admin-panel">
        <div className="assistant-hero-copy">
          <p className="admin-eyebrow">AI workbench</p>
          <h1>{greetingFor(user)}</h1>
          <p>
            I am watching new requests, unfinished forms, follow-ups, job-cost math, Joist handoffs, and the next estimate Nick should move.
          </p>
          <div className="assistant-hero-actions">
            <button className="admin-primary-button" type="button" onClick={() => setActiveView('leads')}>
              <Users size={17} aria-hidden="true" />
              Work leads
            </button>
            <button className="admin-secondary-button" type="button" onClick={() => setActiveView('money')}>
              <DollarSign size={17} aria-hidden="true" />
              Check money
            </button>
          </div>
        </div>
        <div className="assistant-focus-card">
          <span>
            <Target size={20} aria-hidden="true" />
            Next best move
          </span>
          <strong>{assistantLead ? `${visibleLeadStatus(assistantLead)}: ${nextName}` : 'No leads yet'}</strong>
          <p>
            {assistantLead
              ? `${topEstimate.customerSummary} Next: ${topEstimate.nextStep}`
              : 'When the first website request lands, this panel will turn it into a call plan, estimate range, and follow-up draft.'}
          </p>
          {assistantLead ? (
            <button type="button" onClick={() => openLead(assistantLead)}>
              Open this lead
              <ExternalLink size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="assistant-metric-grid">
        <article>
          <Clock3 size={18} aria-hidden="true" />
          <span>Follow-ups</span>
          <strong>{stats.followUps.length}</strong>
        </article>
        <article>
          <Hammer size={18} aria-hidden="true" />
          <span>Need estimates</span>
          <strong>{stats.estimateQueue.length}</strong>
        </article>
        <article>
          <TrendingUp size={18} aria-hidden="true" />
          <span>Open pipeline</span>
          <strong>{formatCurrency(stats.totalPipeline)}</strong>
        </article>
        <article>
          <Mail size={18} aria-hidden="true" />
          <span>Email</span>
          <strong>{smtpStatusLabel(emailSettings)}</strong>
        </article>
      </div>

      <div className="assistant-layout">
        <section className="admin-panel assistant-queue">
          <div className="panel-title-row">
            <div>
              <p className="admin-eyebrow">Fastest wins</p>
              <strong>Sorted by lead stage, priority, and age.</strong>
            </div>
            <button type="button" onClick={() => setActiveView('leads')}>
              <Users size={16} aria-hidden="true" />
              Full CRM
            </button>
          </div>

          {priorityLeads.length ? (
            <div className="assistant-lead-stack">
              {priorityLeads.map((lead) => {
                const estimate = aiEstimateForLead(lead)
                return (
                  <button type="button" className="assistant-lead-card" key={lead.id} onClick={() => openLead(lead)}>
                    <span className={`lead-priority priority-${lead.priority.toLowerCase()}`}>{lead.priority}</span>
                    <div>
                      <strong>{lead.name}</strong>
                      <small>{visibleLeadStatus(lead)} / {estimate.profile.label}</small>
                      <em>{formatCurrency(estimate.low)}-{formatCurrency(estimate.high)}</em>
                    </div>
                    <ExternalLink size={16} aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="admin-empty compact-empty">
              <CheckCircle2 size={24} aria-hidden="true" />
              <strong>No open leads</strong>
              <span>The assistant queue is clear.</span>
            </div>
          )}
        </section>

        <AiEstimatePanel lead={assistantLead} updateLead={updateLead} compact />
      </div>

      <div className="assistant-ops-grid">
        <section className="admin-panel assistant-mini-panel">
          <MessageSquareText size={20} aria-hidden="true" />
          <div>
            <p className="admin-eyebrow">Follow-up script</p>
            <strong>Ask for address, photos, timing, and decision maker before promising a price.</strong>
            <span>Use the lead detail page to copy the exact stage email after the call.</span>
          </div>
        </section>
        <section className="admin-panel assistant-mini-panel">
          <ReceiptText size={20} aria-hidden="true" />
          <div>
            <p className="admin-eyebrow">Joist bridge</p>
            <strong>Paste Joist estimate and invoice numbers back into each lead.</strong>
            <span>That keeps CPA exports, revenue, deposits, and follow-up in one place while Joist stays official.</span>
          </div>
        </section>
        <section className="admin-panel assistant-mini-panel">
          <MapPin size={20} aria-hidden="true" />
          <div>
            <p className="admin-eyebrow">Service area</p>
            <strong>New Castle County jobs stay the default filter in the estimate thinking.</strong>
            <span>Address capture feeds scheduling and future route planning.</span>
          </div>
        </section>
      </div>
    </section>
  )
}

function LeadList({ leads, selectedLeadId, setSelectedLeadId }) {
  if (!leads.length) {
    return (
      <div className="admin-empty">
        <Users size={24} aria-hidden="true" />
        <strong>No leads yet</strong>
        <span>New estimate requests will appear here.</span>
      </div>
    )
  }

  return (
    <div className="admin-lead-list">
      {leads.map((lead) => (
        <button
          className={lead.id === selectedLeadId ? 'lead-row active' : 'lead-row'}
          key={lead.id}
          type="button"
          onClick={() => setSelectedLeadId(lead.id)}
        >
          <span className={`lead-priority priority-${lead.priority.toLowerCase()}`}>{lead.priority}</span>
          <span className="lead-row-main">
            <strong>{lead.name}</strong>
            <small>
              {lead.projectType} / {lead.budget}
            </small>
          </span>
          <span className="lead-row-meta">
            <span>{lead.status}</span>
            <small>{formatDate(lead.receivedAt)}</small>
          </span>
        </button>
      ))}
    </div>
  )
}

function LeadDetail({ lead, updateLead, emailSettings }) {
  const [notes, setNotes] = useState(lead?.notes || '')
  const [nextStep, setNextStep] = useState(lead?.nextStep || '')
  const [estimateAmount, setEstimateAmount] = useState(lead?.estimateAmount || '')
  const [paymentLink, setPaymentLink] = useState(lead?.paymentLink || '')
  const [followUpAt, setFollowUpAt] = useState(toDateTimeInputValue(lead?.followUpAt))
  const [quoteLaborCost, setQuoteLaborCost] = useState(lead?.quoteLaborCost || '')
  const [quoteMaterialCost, setQuoteMaterialCost] = useState(lead?.quoteMaterialCost || '')
  const [quoteSubCost, setQuoteSubCost] = useState(lead?.quoteSubCost || '')
  const [quoteOtherCost, setQuoteOtherCost] = useState(lead?.quoteOtherCost || '')
  const [quoteMarkupPercent, setQuoteMarkupPercent] = useState(lead?.quoteMarkupPercent || '25')
  const [quoteCustomerPrice, setQuoteCustomerPrice] = useState(lead?.quoteCustomerPrice || '')
  const [quoteDepositPercent, setQuoteDepositPercent] = useState(lead?.quoteDepositPercent || '33')
  const [revenueReceived, setRevenueReceived] = useState(lead?.revenueReceived || '')
  const [expenseTotal, setExpenseTotal] = useState(lead?.expenseTotal || '')
  const [joistClientName, setJoistClientName] = useState(lead?.joistClientName || '')
  const [joistEstimateNumber, setJoistEstimateNumber] = useState(lead?.joistEstimateNumber || '')
  const [joistInvoiceNumber, setJoistInvoiceNumber] = useState(lead?.joistInvoiceNumber || '')
  const [joistStatus, setJoistStatus] = useState(lead?.joistStatus || '')

  if (!lead) {
    return (
      <section className="admin-panel lead-detail-panel">
        <div className="admin-empty">
          <Eye size={24} aria-hidden="true" />
          <strong>Select a lead</strong>
          <span>Open a request to call, email, and track next steps.</span>
        </div>
      </section>
    )
  }

  const saveNotes = () => {
    updateLead(lead.id, {
      notes,
      nextStep,
      estimateAmount,
      paymentLink,
      followUpAt: fromDateTimeInputValue(followUpAt),
      quoteLaborCost,
      quoteMaterialCost,
      quoteSubCost,
      quoteOtherCost,
      quoteMarkupPercent,
      quoteCustomerPrice,
      quoteDepositPercent,
      revenueReceived,
      expenseTotal,
      joistClientName,
      joistEstimateNumber,
      joistInvoiceNumber,
      joistStatus,
    })
  }

  const workingLead = {
    ...lead,
    notes,
    nextStep,
    estimateAmount,
    paymentLink,
    followUpAt: fromDateTimeInputValue(followUpAt),
    quoteLaborCost,
    quoteMaterialCost,
    quoteSubCost,
    quoteOtherCost,
    quoteMarkupPercent,
    quoteCustomerPrice,
    quoteDepositPercent,
    revenueReceived,
    expenseTotal,
    joistClientName,
    joistEstimateNumber,
    joistInvoiceNumber,
    joistStatus,
  }
  const currentEmailDraft = emailDraftFor(workingLead)
  const financials = leadFinancials(workingLead)
  const depositAmount = financials.customerPrice * (moneyValue(quoteDepositPercent) / 100)

  const applyAiEstimateToLocal = (patch) => {
    setEstimateAmount(patch.estimateAmount || '')
    setQuoteLaborCost(patch.quoteLaborCost || '')
    setQuoteMaterialCost(patch.quoteMaterialCost || '')
    setQuoteSubCost(patch.quoteSubCost || '')
    setQuoteOtherCost(patch.quoteOtherCost || '')
    setQuoteMarkupPercent(patch.quoteMarkupPercent || '28')
    setQuoteCustomerPrice(patch.quoteCustomerPrice || '')
    setQuoteDepositPercent(patch.quoteDepositPercent || '33')
    setNextStep(patch.nextStep || '')
    setNotes(patch.notes || '')
  }

  const applyStage = (status) => {
    const play = stagePlaybook.find((item) => item.status === status)
    const draft = emailDraftFor(workingLead, status)
    if (play?.nextStep) setNextStep(play.nextStep)
    updateLead(lead.id, {
      status,
      nextStep: play?.nextStep || nextStep,
      estimateAmount,
      paymentLink,
      followUpAt: fromDateTimeInputValue(followUpAt),
      quoteLaborCost,
      quoteMaterialCost,
      quoteSubCost,
      quoteOtherCost,
      quoteMarkupPercent,
      quoteCustomerPrice,
      quoteDepositPercent,
      revenueReceived,
      expenseTotal,
      joistClientName,
      joistEstimateNumber,
      joistInvoiceNumber,
      joistStatus,
      emailStage: status,
      emailSubject: draft.subject,
      emailBody: draft.body,
      lastContactedAt: new Date().toISOString(),
    })
  }

  const copyEmailDraft = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${currentEmailDraft.subject}\n\n${currentEmailDraft.body}`)
      updateLead(lead.id, {
        emailStage: currentEmailDraft.stage,
        emailSubject: currentEmailDraft.subject,
        emailBody: currentEmailDraft.body,
        lastContactedAt: new Date().toISOString(),
      })
    } catch {
      updateLead(lead.id, {
        notes: `${notes}\n\nEmail draft:\nSubject: ${currentEmailDraft.subject}\n\n${currentEmailDraft.body}`.trim(),
      })
    }
  }

  const joistHandOffText = [
    'Joist handoff - Flanagan Construction',
    '',
    `Customer: ${joistClientName || lead.name || 'Website lead'}`,
    `Phone: ${lead.phone || 'Not listed'}`,
    `Email: ${lead.email || 'Not listed'}`,
    `Address: ${lead.address || 'Not listed'}`,
    `Project: ${lead.projectType || 'Project'}`,
    lead.selectedNeeds?.length ? `Selected needs: ${lead.selectedNeeds.join(', ')}` : '',
    '',
    'Internal job-cost check:',
    `Labor: ${formatCurrency(quoteLaborCost)}`,
    `Materials: ${formatCurrency(quoteMaterialCost)}`,
    `Subcontractors: ${formatCurrency(quoteSubCost)}`,
    `Other: ${formatCurrency(quoteOtherCost)}`,
    `Total cost: ${formatCurrency(financials.totalCost)}`,
    `Suggested price: ${formatCurrency(financials.suggestedPrice)}`,
    `Customer price: ${formatCurrency(financials.customerPrice)}`,
    `Deposit target: ${formatCurrency(depositAmount)}`,
    `Gross profit: ${formatCurrency(financials.grossProfit)} (${Math.round(financials.margin)}%)`,
    '',
    `Joist estimate #: ${joistEstimateNumber || 'Not entered'}`,
    `Joist invoice #: ${joistInvoiceNumber || 'Not entered'}`,
    `Joist status: ${joistStatus || 'Not started'}`,
    `Payment link: ${paymentLink || 'Not entered'}`,
    '',
    'Notes:',
    notes || lead.message || 'No notes yet.',
  ].filter(Boolean).join('\n')

  const copyJoistHandOff = async () => {
    saveNotes()
    try {
      await navigator.clipboard.writeText(joistHandOffText)
    } catch {
      updateLead(lead.id, {
        notes: `${notes}\n\n${joistHandOffText}`.trim(),
      })
    }
  }

  return (
    <section className="admin-panel lead-detail-panel">
      <div className="lead-detail-head">
        <div>
          <p className="admin-eyebrow">Lead profile</p>
          <h2>{lead.name}</h2>
          <span>{formatDate(lead.receivedAt)}</span>
        </div>
        <div className="lead-contact-actions">
          {lead.phone ? (
            <a href={`tel:${lead.phone}`}>
              <Phone size={16} aria-hidden="true" />
              Call
            </a>
          ) : null}
          {lead.email ? (
            <a href={mailtoFor(workingLead, currentEmailDraft)} onClick={() => updateLead(lead.id, {
              emailStage: currentEmailDraft.stage,
              emailSubject: currentEmailDraft.subject,
              emailBody: currentEmailDraft.body,
              lastContactedAt: new Date().toISOString(),
            })}>
              <Mail size={16} aria-hidden="true" />
              Email
            </a>
          ) : null}
        </div>
      </div>

      <div className="lead-detail-grid">
        <label>
          Status
          <select value={lead.status} onChange={(event) => updateLead(lead.id, { status: event.target.value })}>
            {statusOptions.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select value={lead.priority} onChange={(event) => updateLead(lead.id, { priority: event.target.value })}>
            {priorityOptions.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
        <label>
          Project
          <input value={lead.projectType} readOnly />
        </label>
        <label className="lead-address-field">
          Project address
          <input value={lead.address || 'Not listed yet'} readOnly />
        </label>
        <label>
          Budget
          <input value={lead.budget} readOnly />
        </label>
        <label>
          Timeline
          <input value={lead.timeline} readOnly />
        </label>
        <label>
          Phone
          <input value={lead.phone} readOnly />
        </label>
      </div>

      <div className="stage-playbook">
        <div>
          <p className="admin-eyebrow">Stage shortcuts</p>
          <strong>Move the lead and prep the next follow-up.</strong>
        </div>
        <div className="stage-button-grid">
          {stagePlaybook.map((stage) => (
            <button
              className={lead.status === stage.status ? 'stage-button active' : 'stage-button'}
              key={stage.status}
              type="button"
              onClick={() => applyStage(stage.status)}
            >
              <CheckCircle2 size={15} aria-hidden="true" />
              <span>{stage.status}</span>
            </button>
          ))}
        </div>
      </div>

      {lead.selectedNeeds?.length ? (
        <div className="lead-selected-needs">
          <strong>Selected needs</strong>
          <div>
            {lead.selectedNeeds.map((need) => (
              <span key={need}>{need}</span>
            ))}
          </div>
        </div>
      ) : null}

      <label className="admin-field">
        <span>Project message</span>
        <textarea value={lead.message} readOnly rows="5" />
      </label>

      <AiEstimatePanel
        lead={workingLead}
        updateLead={updateLead}
        onApplyEstimate={applyAiEstimateToLocal}
      />

      <div className="lead-detail-grid">
        <label>
          Estimate amount
          <input
            value={estimateAmount}
            inputMode="decimal"
            placeholder="$"
            onBlur={saveNotes}
            onChange={(event) => setEstimateAmount(event.target.value)}
          />
        </label>
        <label>
          Payment link
          <input
            value={paymentLink}
            placeholder="https://..."
            onBlur={saveNotes}
            onChange={(event) => setPaymentLink(event.target.value)}
          />
        </label>
        <label>
          Follow-up date
          <input
            type="datetime-local"
            value={followUpAt}
            onBlur={saveNotes}
            onChange={(event) => setFollowUpAt(event.target.value)}
          />
        </label>
        <label>
          Last contacted
          <input value={lead.lastContactedAt ? formatDate(lead.lastContactedAt) : 'Not logged yet'} readOnly />
        </label>
      </div>

      <div className="quote-workbench">
        <div className="quote-workbench-head">
          <div>
            <p className="admin-eyebrow">Internal quote check</p>
            <strong>See job cost, customer price, and profit before sending the estimate.</strong>
          </div>
          <Calculator size={22} aria-hidden="true" />
        </div>
        <div className="quote-metric-grid">
          <article>
            <span>Total cost</span>
            <strong>{formatCurrency(financials.totalCost)}</strong>
          </article>
          <article>
            <span>Suggested price</span>
            <strong>{formatCurrency(financials.suggestedPrice)}</strong>
          </article>
          <article>
            <span>Customer price</span>
            <strong>{formatCurrency(financials.customerPrice)}</strong>
          </article>
          <article>
            <span>Gross margin</span>
            <strong>{Math.round(financials.margin)}%</strong>
          </article>
        </div>
        <div className="lead-detail-grid">
          <label>
            Labor cost
            <input value={quoteLaborCost} inputMode="decimal" placeholder="$" onBlur={saveNotes} onChange={(event) => setQuoteLaborCost(event.target.value)} />
          </label>
          <label>
            Materials cost
            <input value={quoteMaterialCost} inputMode="decimal" placeholder="$" onBlur={saveNotes} onChange={(event) => setQuoteMaterialCost(event.target.value)} />
          </label>
          <label>
            Subcontractors
            <input value={quoteSubCost} inputMode="decimal" placeholder="$" onBlur={saveNotes} onChange={(event) => setQuoteSubCost(event.target.value)} />
          </label>
          <label>
            Other costs
            <input value={quoteOtherCost} inputMode="decimal" placeholder="$" onBlur={saveNotes} onChange={(event) => setQuoteOtherCost(event.target.value)} />
          </label>
          <label>
            Markup %
            <input value={quoteMarkupPercent} inputMode="decimal" onBlur={saveNotes} onChange={(event) => setQuoteMarkupPercent(event.target.value)} />
          </label>
          <label>
            Customer quote price
            <input value={quoteCustomerPrice} inputMode="decimal" placeholder="$" onBlur={saveNotes} onChange={(event) => setQuoteCustomerPrice(event.target.value)} />
          </label>
          <label>
            Deposit %
            <input value={quoteDepositPercent} inputMode="decimal" onBlur={saveNotes} onChange={(event) => setQuoteDepositPercent(event.target.value)} />
          </label>
          <label>
            Deposit target
            <input value={formatCurrency(depositAmount)} readOnly />
          </label>
          <label>
            Revenue received
            <input value={revenueReceived} inputMode="decimal" placeholder="$" onBlur={saveNotes} onChange={(event) => setRevenueReceived(event.target.value)} />
          </label>
          <label>
            Expense total
            <input value={expenseTotal} inputMode="decimal" placeholder="$" onBlur={saveNotes} onChange={(event) => setExpenseTotal(event.target.value)} />
          </label>
        </div>
      </div>

      <div className="joist-bridge-panel">
        <div className="quote-workbench-head">
          <div>
            <p className="admin-eyebrow">Joist and Square bridge</p>
            <strong>Keep Joist as the invoice source while this CRM tracks follow-up.</strong>
          </div>
          <ReceiptText size={22} aria-hidden="true" />
        </div>
        <div className="lead-detail-grid">
          <label>
            Joist client name
            <input value={joistClientName} onBlur={saveNotes} onChange={(event) => setJoistClientName(event.target.value)} />
          </label>
          <label>
            Joist status
            <input value={joistStatus} placeholder="Estimate drafted, invoice sent..." onBlur={saveNotes} onChange={(event) => setJoistStatus(event.target.value)} />
          </label>
          <label>
            Joist estimate #
            <input value={joistEstimateNumber} onBlur={saveNotes} onChange={(event) => setJoistEstimateNumber(event.target.value)} />
          </label>
          <label>
            Joist invoice #
            <input value={joistInvoiceNumber} onBlur={saveNotes} onChange={(event) => setJoistInvoiceNumber(event.target.value)} />
          </label>
        </div>
        <div className="lead-contact-actions joist-actions">
          <button type="button" onClick={copyJoistHandOff}>
            <Clipboard size={16} aria-hidden="true" />
            Copy for Joist
          </button>
          {paymentLink ? (
            <a href={paymentLink} target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              Open payment link
            </a>
          ) : (
            <a href="https://www.joist.com/" target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              Open Joist
            </a>
          )}
        </div>
        <p className="bridge-note">
          For now, create/send the official invoice from Joist, then paste the Joist numbers and payment link here. When Square is wired later, this same spot can store or create payment links.
        </p>
      </div>

      <label className="admin-field">
        <span>Next step</span>
        <input
          value={nextStep}
          onBlur={saveNotes}
          onChange={(event) => setNextStep(event.target.value)}
        />
      </label>

      <label className="admin-field">
        <span>Office notes</span>
        <textarea
          rows="5"
          value={notes}
          onBlur={saveNotes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      <div className="email-workbench">
        <div className="email-workbench-head">
          <div>
            <p className="admin-eyebrow">Email follow-up</p>
            <strong>{currentEmailDraft.subject}</strong>
            <span>
              {emailSettings?.configured ? 'Secure sender is configured in Railway.' : 'Sender is not connected yet. Use copy or mailto for now.'}
            </span>
          </div>
          <div className="lead-contact-actions">
            <button type="button" onClick={copyEmailDraft}>
              <Clipboard size={16} aria-hidden="true" />
              Copy
            </button>
            {lead.email ? (
              <a href={mailtoFor(workingLead, currentEmailDraft)} onClick={() => updateLead(lead.id, {
                emailStage: currentEmailDraft.stage,
                emailSubject: currentEmailDraft.subject,
                emailBody: currentEmailDraft.body,
                lastContactedAt: new Date().toISOString(),
              })}>
                <Send size={16} aria-hidden="true" />
                Open email
              </a>
            ) : null}
          </div>
        </div>
        <pre>{currentEmailDraft.body}</pre>
        {!emailSettings?.configured ? (
          <p className="smtp-note">
            Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in Railway to enable future one-click sending.
          </p>
        ) : null}
      </div>
    </section>
  )
}

function ContentToolbar({ activeContentTab, setActiveContentTab }) {
  return (
    <div className="content-tab-row" aria-label="Content sections">
      {contentTabs.map(({ id, label, icon: Icon }) => (
        <button
          className={activeContentTab === id ? 'content-tab active' : 'content-tab'}
          key={id}
          type="button"
          onClick={() => setActiveContentTab(id)}
        >
          <Icon size={16} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}

function ContentPreview({ draft }) {
  const galleryItem = draft.gallery.items[0]

  return (
    <aside className="admin-panel preview-panel">
      <p className="admin-eyebrow">Live draft</p>
      <div className="mini-hero" style={{ '--preview-photo': cssUrl(draft.images.hero) }}>
        <span>{draft.hero.eyebrow}</span>
        <strong>
          {draft.hero.titlePrefix} {draft.hero.highlight}
        </strong>
        <p>{draft.hero.lede}</p>
      </div>
      <div className="mini-gallery-card" style={{ backgroundImage: cssUrl(galleryItem.image) }}>
        <div>
          <span>01</span>
          <strong>{galleryItem.title}</strong>
          <p>{galleryItem.copy}</p>
        </div>
      </div>
    </aside>
  )
}

function OverviewEditor({ draft, updateSection, updateNested }) {
  return (
    <div className="content-editor-grid">
      <section className="admin-panel">
        <p className="admin-eyebrow">Business</p>
        <div className="admin-form-grid">
          <Field label="Business name" value={draft.business.name} onChange={(value) => updateSection('business', 'name', value)} />
          <Field label="Location" value={draft.business.location} onChange={(value) => updateSection('business', 'location', value)} />
          <Field label="Phone" value={draft.business.phone} onChange={(value) => updateSection('business', 'phone', value)} />
          <Field label="Email" value={draft.business.email} onChange={(value) => updateSection('business', 'email', value)} />
          <Field
            label="Service area"
            value={draft.business.serviceArea}
            textarea
            rows={3}
            onChange={(value) => updateSection('business', 'serviceArea', value)}
          />
        </div>
      </section>

      <section className="admin-panel">
        <p className="admin-eyebrow">Hero</p>
        <div className="admin-form-grid">
          <Field label="Eyebrow" value={draft.hero.eyebrow} onChange={(value) => updateSection('hero', 'eyebrow', value)} />
          <Field label="Headline first line" value={draft.hero.titlePrefix} onChange={(value) => updateSection('hero', 'titlePrefix', value)} />
          <Field label="Highlighted city" value={draft.hero.highlight} onChange={(value) => updateSection('hero', 'highlight', value)} />
          <Field label="Lead paragraph" value={draft.hero.lede} textarea rows={4} onChange={(value) => updateSection('hero', 'lede', value)} />
          <Field label="Main button" value={draft.hero.primaryCta} onChange={(value) => updateSection('hero', 'primaryCta', value)} />
          <Field label="Second button" value={draft.hero.secondaryCta} onChange={(value) => updateSection('hero', 'secondaryCta', value)} />
        </div>
      </section>

      <section className="admin-panel">
        <p className="admin-eyebrow">Estimate section</p>
        <div className="admin-form-grid">
          <Field label="Eyebrow" value={draft.estimate.eyebrow} onChange={(value) => updateSection('estimate', 'eyebrow', value)} />
          <Field label="Heading" value={draft.estimate.title} onChange={(value) => updateSection('estimate', 'title', value)} />
          <Field label="Body" value={draft.estimate.copy} textarea rows={3} onChange={(value) => updateSection('estimate', 'copy', value)} />
          <Field label="Form heading" value={draft.estimate.formTitle} onChange={(value) => updateSection('estimate', 'formTitle', value)} />
          <Field label="Form note" value={draft.estimate.formNote} onChange={(value) => updateSection('estimate', 'formNote', value)} />
        </div>
      </section>

      <section className="admin-panel">
        <p className="admin-eyebrow">Final CTA</p>
        <div className="admin-form-grid">
          <Field label="Heading" value={draft.cta.title} onChange={(value) => updateNested('cta', 'title', value)} />
          <Field label="Body" value={draft.cta.copy} textarea rows={3} onChange={(value) => updateNested('cta', 'copy', value)} />
          <Field label="Button" value={draft.cta.primaryCta} onChange={(value) => updateNested('cta', 'primaryCta', value)} />
        </div>
      </section>
    </div>
  )
}

function ServicesEditor({ draft, updateArrayItem, updateStringArray, addArrayItem, removeArrayItem, updateSection }) {
  return (
    <div className="content-editor-grid">
      <section className="admin-panel">
        <div className="panel-title-row">
          <p className="admin-eyebrow">Services</p>
          <button type="button" onClick={() => addArrayItem('services', { title: 'New service', copy: 'Describe the service.' })}>
            <Plus size={16} aria-hidden="true" />
            Add
          </button>
        </div>
        <div className="repeater-list">
          {draft.services.map((service, index) => (
            <article className="repeater-item" key={`${service.title}-${index}`}>
              <div className="repeater-actions">
                <strong>Service {index + 1}</strong>
                <button type="button" onClick={() => removeArrayItem('services', index)}>
                  <Trash2 size={15} aria-hidden="true" />
                  Remove
                </button>
              </div>
              <Field label="Title" value={service.title} onChange={(value) => updateArrayItem('services', index, 'title', value)} />
              <Field label="Copy" value={service.copy} textarea rows={3} onChange={(value) => updateArrayItem('services', index, 'copy', value)} />
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <p className="admin-eyebrow">Proof points</p>
        <div className="admin-stack">
          {draft.proofPoints.map((point, index) => (
            <Field key={index} label={`Point ${index + 1}`} value={point} onChange={(value) => updateStringArray('proofPoints', index, value)} />
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <p className="admin-eyebrow">Stats</p>
        <div className="repeater-list two-col">
          {draft.stats.map((stat, index) => (
            <article className="repeater-item" key={`${stat.label}-${index}`}>
              <Field label="Value" value={stat.value} onChange={(value) => updateArrayItem('stats', index, 'value', value)} />
              <Field label="Label" value={stat.label} onChange={(value) => updateArrayItem('stats', index, 'label', value)} />
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel full-span-panel">
        <p className="admin-eyebrow">Service locations</p>
        <div className="admin-form-grid">
          <Field
            label="Section heading"
            value={draft.serviceLocations?.title || ''}
            onChange={(value) => updateSection('serviceLocations', 'title', value)}
          />
          <Field
            label="Section copy"
            value={draft.serviceLocations?.copy || ''}
            textarea
            rows={3}
            onChange={(value) => updateSection('serviceLocations', 'copy', value)}
          />
          <Field
            label="Places, one per line"
            value={(draft.serviceLocations?.places || []).join('\n')}
            textarea
            rows={10}
            onChange={(value) =>
              updateSection(
                'serviceLocations',
                'places',
                value
                  .split('\n')
                  .map((item) => item.trim())
                  .filter(Boolean),
              )
            }
          />
        </div>
      </section>

      <section className="admin-panel">
        <p className="admin-eyebrow">How it works</p>
        <div className="admin-form-grid">
          <Field label="Heading" value={draft.work.title} onChange={(value) => updateSection('work', 'title', value)} />
          <Field label="Body" value={draft.work.copy} textarea rows={4} onChange={(value) => updateSection('work', 'copy', value)} />
        </div>
        <div className="repeater-list">
          {draft.processSteps.map((step, index) => (
            <article className="repeater-item" key={`${step.title}-${index}`}>
              <strong>Step {index + 1}</strong>
              <Field label="Title" value={step.title} onChange={(value) => updateArrayItem('processSteps', index, 'title', value)} />
              <Field label="Copy" value={step.copy} textarea rows={2} onChange={(value) => updateArrayItem('processSteps', index, 'copy', value)} />
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function PhotosEditor({ draft, updateSection, updateNestedArrayItem }) {
  return (
    <div className="content-editor-grid">
      <section className="admin-panel">
        <p className="admin-eyebrow">Main images</p>
        <div className="admin-form-grid">
          <Field label="Hero photo URL" value={draft.images.hero} onChange={(value) => updateSection('images', 'hero', value)} />
          <Field label="Planner background URL" value={draft.images.aiBackground} onChange={(value) => updateSection('images', 'aiBackground', value)} />
          <Field label="Process background URL" value={draft.images.workBackground} onChange={(value) => updateSection('images', 'workBackground', value)} />
          <Field label="Before photo URL" value={draft.compare.beforeImage} onChange={(value) => updateSection('compare', 'beforeImage', value)} />
          <Field label="After photo URL" value={draft.compare.afterImage} onChange={(value) => updateSection('compare', 'afterImage', value)} />
        </div>
      </section>

      <section className="admin-panel">
        <p className="admin-eyebrow">Gallery copy</p>
        <div className="admin-form-grid">
          <Field label="Heading" value={draft.gallery.title} onChange={(value) => updateSection('gallery', 'title', value)} />
          <Field label="Body" value={draft.gallery.copy} textarea rows={3} onChange={(value) => updateSection('gallery', 'copy', value)} />
        </div>
      </section>

      <section className="admin-panel full-span-panel">
        <p className="admin-eyebrow">Gallery cards</p>
        <div className="repeater-list three-col">
          {draft.gallery.items.map((item, index) => (
            <article className="repeater-item photo-repeater" key={`${item.title}-${index}`}>
              <div className="photo-thumb" style={{ backgroundImage: cssUrl(item.image) }} />
              <Field label="Title" value={item.title} onChange={(value) => updateNestedArrayItem('gallery', 'items', index, 'title', value)} />
              <Field label="Copy" value={item.copy} textarea rows={3} onChange={(value) => updateNestedArrayItem('gallery', 'items', index, 'copy', value)} />
              <Field label="Photo URL" value={item.image} onChange={(value) => updateNestedArrayItem('gallery', 'items', index, 'image', value)} />
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function WorkGalleryEditor({ draft, updateSection, updateNestedArrayItem, addNestedArrayItem, removeNestedArrayItem }) {
  const items = draft.workGallery?.items || []
  const addProject = () =>
    addNestedArrayItem('workGallery', 'items', {
      title: 'New project',
      category: 'Kitchen & bath',
      location: 'New Castle County, DE',
      summary: 'Describe the work, what changed, and why it matters.',
      completedAt: 'Recent project',
      source: 'Uploaded by office',
      image: draft.gallery?.items?.[0]?.image || draft.images?.hero || '',
    })

  return (
    <div className="content-editor-grid">
      <section className="admin-panel full-span-panel">
        <div className="builder-intro">
          <div>
            <p className="admin-eyebrow">Our Work page</p>
            <h2>Post previous job photos without touching code.</h2>
          </div>
          <span>Drop a small image file or paste a hosted URL. Use real job photos when available.</span>
        </div>
        <div className="admin-form-grid">
          <Field label="Page eyebrow" value={draft.workGallery?.eyebrow || ''} onChange={(value) => updateSection('workGallery', 'eyebrow', value)} />
          <Field label="Page headline" value={draft.workGallery?.title || ''} onChange={(value) => updateSection('workGallery', 'title', value)} />
          <Field label="Intro copy" value={draft.workGallery?.copy || ''} textarea rows={3} onChange={(value) => updateSection('workGallery', 'copy', value)} />
          <Field label="CTA headline" value={draft.workGallery?.ctaTitle || ''} onChange={(value) => updateSection('workGallery', 'ctaTitle', value)} />
          <Field label="CTA copy" value={draft.workGallery?.ctaCopy || ''} textarea rows={3} onChange={(value) => updateSection('workGallery', 'ctaCopy', value)} />
        </div>
      </section>

      <section className="admin-panel full-span-panel">
        <div className="panel-title-row">
          <div>
            <p className="admin-eyebrow">Job photo posts</p>
            <strong>{items.length} project cards on the public page.</strong>
          </div>
          <button type="button" onClick={addProject}>
            <Plus size={16} aria-hidden="true" />
            Add project
          </button>
        </div>

        <div className="work-gallery-admin-grid">
          {items.map((item, index) => (
            <article className="repeater-item work-photo-editor" key={`${item.title}-${index}`}>
              <div className="repeater-actions">
                <strong>Project {index + 1}</strong>
                <button type="button" onClick={() => removeNestedArrayItem('workGallery', 'items', index)}>
                  <Trash2 size={15} aria-hidden="true" />
                  Remove
                </button>
              </div>
              <AssetDropField
                label="Upload/drop job photo"
                value={item.image}
                onChange={(value) => updateNestedArrayItem('workGallery', 'items', index, 'image', value)}
              />
              <div className="admin-form-grid">
                <Field label="Title" value={item.title} onChange={(value) => updateNestedArrayItem('workGallery', 'items', index, 'title', value)} />
                <Field label="Category" value={item.category} onChange={(value) => updateNestedArrayItem('workGallery', 'items', index, 'category', value)} />
                <Field label="Location" value={item.location} onChange={(value) => updateNestedArrayItem('workGallery', 'items', index, 'location', value)} />
                <Field label="Completed/date" value={item.completedAt} onChange={(value) => updateNestedArrayItem('workGallery', 'items', index, 'completedAt', value)} />
                <Field label="Source" value={item.source} onChange={(value) => updateNestedArrayItem('workGallery', 'items', index, 'source', value)} />
                <Field label="Summary" value={item.summary} textarea rows={3} onChange={(value) => updateNestedArrayItem('workGallery', 'items', index, 'summary', value)} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function ReviewsEditor({ draft, updateSection, updateArrayItem, addArrayItem, removeArrayItem }) {
  return (
    <div className="content-editor-grid">
      <section className="admin-panel">
        <p className="admin-eyebrow">Reviews section</p>
        <div className="admin-form-grid">
          <Field label="Eyebrow" value={draft.reviews.eyebrow} onChange={(value) => updateSection('reviews', 'eyebrow', value)} />
          <Field label="Heading" value={draft.reviews.title} onChange={(value) => updateSection('reviews', 'title', value)} />
        </div>
      </section>

      <section className="admin-panel">
        <div className="panel-title-row">
          <p className="admin-eyebrow">Testimonials</p>
          <button
            type="button"
            onClick={() =>
              addArrayItem('testimonials', {
                quote: 'Add the customer review here.',
                name: 'Customer name',
                location: 'New Castle County, DE',
                rating: 5,
              })
            }
          >
            <Plus size={16} aria-hidden="true" />
            Add
          </button>
        </div>
        <div className="repeater-list">
          {draft.testimonials.map((review, index) => (
            <article className="repeater-item" key={`${review.name}-${index}`}>
              <div className="repeater-actions">
                <strong>Review {index + 1}</strong>
                <button type="button" onClick={() => removeArrayItem('testimonials', index)}>
                  <Trash2 size={15} aria-hidden="true" />
                  Remove
                </button>
              </div>
              <Field label="Quote" value={review.quote} textarea rows={4} onChange={(value) => updateArrayItem('testimonials', index, 'quote', value)} />
              <Field label="Name" value={review.name} onChange={(value) => updateArrayItem('testimonials', index, 'name', value)} />
              <Field label="Location" value={review.location} onChange={(value) => updateArrayItem('testimonials', index, 'location', value)} />
              <label className="admin-field">
                <span>Rating</span>
                <select value={review.rating} onChange={(event) => updateArrayItem('testimonials', index, 'rating', Number(event.target.value))}>
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel full-span-panel">
        <div className="panel-title-row">
          <p className="admin-eyebrow">FAQ</p>
          <button
            type="button"
            onClick={() => addArrayItem('faqs', { question: 'New question?', answer: 'Add the answer here.' })}
          >
            <Plus size={16} aria-hidden="true" />
            Add
          </button>
        </div>
        <div className="repeater-list two-col">
          {draft.faqs.map((faq, index) => (
            <article className="repeater-item" key={`${faq.question}-${index}`}>
              <div className="repeater-actions">
                <strong>FAQ {index + 1}</strong>
                <button type="button" onClick={() => removeArrayItem('faqs', index)}>
                  <Trash2 size={15} aria-hidden="true" />
                  Remove
                </button>
              </div>
              <Field label="Question" value={faq.question} onChange={(value) => updateArrayItem('faqs', index, 'question', value)} />
              <Field label="Answer" value={faq.answer} textarea rows={4} onChange={(value) => updateArrayItem('faqs', index, 'answer', value)} />
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function AssetDropField({ label, value, onChange }) {
  const [dragging, setDragging] = useState(false)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 900000) {
      window.alert('Please use an image under 900KB for direct drag/drop, or paste a hosted image URL.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => onChange(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    const text = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain')
    if (file) handleFile(file)
    else if (text) onChange(text.trim())
  }

  return (
    <label
      className={dragging ? 'asset-drop-field dragging' : 'asset-drop-field'}
      onDragEnter={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <span>{label}</span>
      <div className="asset-drop-preview" style={{ backgroundImage: cssUrl(value) }}>
        <Image size={20} aria-hidden="true" />
        <strong>Drop image or URL</strong>
      </div>
      <input value={value || ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function SortableCards({ title, items, onMove, renderLabel }) {
  const [dragIndex, setDragIndex] = useState(null)

  return (
    <section className="admin-panel">
      <p className="admin-eyebrow">{title}</p>
      <div className="sortable-list">
        {items.map((item, index) => (
          <article
            className={dragIndex === index ? 'sortable-card dragging' : 'sortable-card'}
            draggable
            key={`${renderLabel(item)}-${index}`}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== index) onMove(dragIndex, index)
              setDragIndex(null)
            }}
            onDragEnd={() => setDragIndex(null)}
          >
            <GripVertical size={17} aria-hidden="true" />
            <strong>{renderLabel(item)}</strong>
            <span>Position {index + 1}</span>
          </article>
        ))}
      </div>
    </section>
  )
}

function BuilderEditor({ draft, updateSection, updateNestedArrayItem, moveArrayItem, moveNestedArrayItem, updateCustomHtml }) {
  return (
    <div className="content-editor-grid">
      <section className="admin-panel full-span-panel">
        <div className="builder-intro">
          <div>
            <p className="admin-eyebrow">Squarespace-style builder</p>
            <h2>Hot-swap photos, reorder cards, and edit HTML blocks without code.</h2>
          </div>
          <span>Drag cards to reorder. Drop a hosted image URL or a small image file on any asset.</span>
        </div>
      </section>

      <SortableCards
        title="Drag services"
        items={draft.services}
        onMove={(from, to) => moveArrayItem('services', from, to)}
        renderLabel={(service) => service.title}
      />

      <SortableCards
        title="Drag gallery cards"
        items={draft.gallery.items}
        onMove={(from, to) => moveNestedArrayItem('gallery', 'items', from, to)}
        renderLabel={(item) => item.title}
      />

      <section className="admin-panel full-span-panel">
        <p className="admin-eyebrow">Asset hot-swap</p>
        <div className="asset-grid">
          <AssetDropField label="Hero image" value={draft.images.hero} onChange={(value) => updateSection('images', 'hero', value)} />
          <AssetDropField label="Planner image" value={draft.images.aiBackground} onChange={(value) => updateSection('images', 'aiBackground', value)} />
          <AssetDropField label="Process image" value={draft.images.workBackground} onChange={(value) => updateSection('images', 'workBackground', value)} />
          <AssetDropField label="Before image" value={draft.compare.beforeImage} onChange={(value) => updateSection('compare', 'beforeImage', value)} />
          <AssetDropField label="After image" value={draft.compare.afterImage} onChange={(value) => updateSection('compare', 'afterImage', value)} />
          {draft.gallery.items.map((item, index) => (
            <AssetDropField
              key={`${item.title}-${index}`}
              label={`Gallery ${index + 1}`}
              value={item.image}
              onChange={(value) => updateNestedArrayItem('gallery', 'items', index, 'image', value)}
            />
          ))}
        </div>
      </section>

      <section className="admin-panel full-span-panel">
        <p className="admin-eyebrow">Optional HTML blocks</p>
        <div className="admin-form-grid">
          <Field
            label="HTML before services"
            value={draft.customHtml?.beforeServices || ''}
            textarea
            rows={5}
            onChange={(value) => updateCustomHtml('beforeServices', value)}
          />
          <Field
            label="HTML after services"
            value={draft.customHtml?.afterServices || ''}
            textarea
            rows={5}
            onChange={(value) => updateCustomHtml('afterServices', value)}
          />
          <Field
            label="HTML before footer"
            value={draft.customHtml?.beforeFooter || ''}
            textarea
            rows={5}
            onChange={(value) => updateCustomHtml('beforeFooter', value)}
          />
        </div>
      </section>
    </div>
  )
}

function AiReadyEditor({ draft, updateSection }) {
  return (
    <div className="content-editor-grid">
      <section className="admin-panel full-span-panel">
        <div className="builder-intro">
          <div>
            <p className="admin-eyebrow">AI-ready upgrades</p>
            <h2>Keep the dashboard ready for future AI writing, lead scoring, and email automation.</h2>
          </div>
          <span>These settings are saved now so a future AI feature has clean instructions and guardrails.</span>
        </div>
      </section>

      <section className="admin-panel">
        <p className="admin-eyebrow">AI writing brief</p>
        <div className="admin-form-grid one-col">
          <Field
            label="Brand voice"
            value={draft.aiUpgrade?.brandVoice || ''}
            textarea
            rows={4}
            onChange={(value) => updateSection('aiUpgrade', 'brandVoice', value)}
          />
          <Field
            label="Content rules"
            value={draft.aiUpgrade?.contentRules || ''}
            textarea
            rows={5}
            onChange={(value) => updateSection('aiUpgrade', 'contentRules', value)}
          />
        </div>
      </section>

      <section className="admin-panel">
        <p className="admin-eyebrow">CRM automation prep</p>
        <div className="admin-form-grid one-col">
          <Field
            label="Lead scoring notes"
            value={draft.aiUpgrade?.leadScoringNotes || ''}
            textarea
            rows={4}
            onChange={(value) => updateSection('aiUpgrade', 'leadScoringNotes', value)}
          />
          <Field
            label="Email automation notes"
            value={draft.aiUpgrade?.emailAutomationNotes || ''}
            textarea
            rows={5}
            onChange={(value) => updateSection('aiUpgrade', 'emailAutomationNotes', value)}
          />
        </div>
      </section>
    </div>
  )
}

const integrationDocs = {
  googlePhotos: 'https://developers.google.com/photos/library/guides/upload-media',
  googleDrive: 'https://developers.google.com/workspace/drive/picker/guides/overview',
  instagram: 'https://developers.facebook.com/docs/instagram-platform/content-publishing/',
  facebook: 'https://developers.facebook.com/docs/pages-api/',
  googleBusiness: 'https://developers.google.com/my-business/content/review-data',
  nextdoor: 'https://business.nextdoor.com/en-us/small-business',
}

function fillGrowthTemplate(template, lead = {}, reviewLink = '') {
  return String(template || '')
    .replaceAll('{name}', lead.name || 'there')
    .replaceAll('{address}', lead.address || 'your project')
    .replaceAll('{projectType}', lead.projectType || 'your project')
    .replaceAll('{googleReviewLink}', reviewLink || '[paste Google review link]')
}

function IntegrationCard({ title, status, copy, href }) {
  return (
    <article className="integration-card">
      <div>
        <span>{status}</span>
        <h3>{title}</h3>
        <p>{copy}</p>
      </div>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          Docs
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      ) : null}
    </article>
  )
}

function GrowthDashboard({ draft, updateSection, saveContent, savingContent, leads }) {
  const integrations = draft.integrations || {}
  const reviewAutomation = draft.reviewAutomation || {}
  const nextdoor = draft.nextdoorPlaybook || {}
  const reviewLead =
    leads.find((lead) => ['Complete', 'Receipt Sent', 'Won'].includes(lead.status)) ||
    leads[0] ||
    { name: 'there', address: 'your project', projectType: 'your project' }
  const googleReviewLink = reviewAutomation.googleReviewLink || integrations.googleBusinessReviewUrl || ''

  return (
    <section className="admin-page growth-page">
      <div className="admin-page-head">
        <div>
          <p className="admin-eyebrow">Growth systems</p>
          <h1>Photos, social, reviews, and Nextdoor</h1>
        </div>
        <button className="admin-primary-button" type="button" onClick={saveContent} disabled={savingContent}>
          {savingContent ? <RefreshCw size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
          Save growth settings
        </button>
      </div>

      <section className="admin-panel growth-hero-panel">
        <div>
          <p className="admin-eyebrow">Photo pipeline</p>
          <h2>Upload here today. Connect cloud sources when accounts are ready.</h2>
          <p>
            Direct uploads publish to the Our Work page now. Google, Drive, iCloud, Instagram, and Facebook fields keep the handoff organized for OAuth and shared-album setup.
          </p>
        </div>
        <button className="admin-secondary-button" type="button" onClick={() => copyText(draft.integrations?.notes || '')}>
          <Clipboard size={16} aria-hidden="true" />
          Copy integration notes
        </button>
      </section>

      <div className="integration-grid">
        <IntegrationCard
          title="Google Photos"
          status="API-ready"
          copy="Best for app-created uploads. Full-library sync needs Google's current Photos rules and OAuth approval."
          href={integrationDocs.googlePhotos}
        />
        <IntegrationCard
          title="Google Drive"
          status="Picker-ready"
          copy="Best near-term path for selecting job folders and uploading files into Drive."
          href={integrationDocs.googleDrive}
        />
        <IntegrationCard
          title="iCloud Shared Albums"
          status="Link intake"
          copy="Apple does not provide a normal public business sync API for Shared Albums, so start with shared album links."
        />
        <IntegrationCard
          title="Instagram and Facebook"
          status="Meta OAuth"
          copy="Use Instagram Graph content publishing and Facebook Pages API after Meta app setup and permissions."
          href={integrationDocs.instagram}
        />
      </div>

      <section className="admin-panel full-span-panel">
        <p className="admin-eyebrow">Source links and account handoff</p>
        <div className="admin-form-grid">
          <Field label="Google Photos album URL" value={integrations.googlePhotosAlbumUrl || ''} onChange={(value) => updateSection('integrations', 'googlePhotosAlbumUrl', value)} />
          <Field label="Google Drive folder URL" value={integrations.googleDriveFolderUrl || ''} onChange={(value) => updateSection('integrations', 'googleDriveFolderUrl', value)} />
          <Field label="iCloud shared album URL" value={integrations.icloudSharedAlbumUrl || ''} onChange={(value) => updateSection('integrations', 'icloudSharedAlbumUrl', value)} />
          <Field label="Instagram profile URL" value={integrations.instagramProfileUrl || ''} onChange={(value) => updateSection('integrations', 'instagramProfileUrl', value)} />
          <Field label="Facebook page URL" value={integrations.facebookPageUrl || ''} onChange={(value) => updateSection('integrations', 'facebookPageUrl', value)} />
          <Field label="Google review link" value={googleReviewLink} onChange={(value) => {
            updateSection('integrations', 'googleBusinessReviewUrl', value)
            updateSection('reviewAutomation', 'googleReviewLink', value)
          }} />
          <Field label="Nextdoor business URL" value={integrations.nextdoorBusinessUrl || ''} onChange={(value) => updateSection('integrations', 'nextdoorBusinessUrl', value)} />
          <Field label="Integration notes" value={integrations.notes || ''} textarea rows={4} onChange={(value) => updateSection('integrations', 'notes', value)} />
        </div>
      </section>

      <section className="admin-panel full-span-panel">
        <div className="panel-title-row">
          <div>
            <p className="admin-eyebrow">Automated review follow-ups</p>
            <strong>Use these now as copy/paste. SMTP automation can send them by stage later.</strong>
          </div>
          <a className="admin-primary-link" href={integrationDocs.googleBusiness} target="_blank" rel="noreferrer">
            Google review API
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
        <div className="review-schedule-grid">
          {(reviewAutomation.schedule || []).map((step) => (
            <span key={step}>
              <CheckCircle2 size={15} aria-hidden="true" />
              {step}
            </span>
          ))}
        </div>
        <div className="template-grid">
          {(reviewAutomation.templates || []).map((template) => {
            const text = fillGrowthTemplate(template.body, reviewLead, googleReviewLink)
            return (
              <article className="template-card" key={template.title}>
                <span>{template.channel}</span>
                <h3>{template.title}</h3>
                <p>{text}</p>
                <button type="button" onClick={() => copyText(text)}>
                  <Clipboard size={15} aria-hidden="true" />
                  Copy follow-up
                </button>
              </article>
            )
          })}
        </div>
      </section>

      <section className="admin-panel full-span-panel nextdoor-panel">
        <div className="panel-title-row">
          <div>
            <p className="admin-eyebrow">Nextdoor playbook</p>
            <strong>{nextdoor.title || 'Nextdoor local reply playbook'}</strong>
          </div>
          <a className="admin-secondary-button" href={integrationDocs.nextdoor} target="_blank" rel="noreferrer">
            Nextdoor business
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
        <p>{nextdoor.copy}</p>
        <div className="nextdoor-coaching">
          {(nextdoor.coaching || []).map((item) => (
            <span key={item}>
              <MessageSquareText size={15} aria-hidden="true" />
              {item}
            </span>
          ))}
        </div>
        <div className="template-grid">
          {(nextdoor.replies || []).map((reply) => (
            <article className="template-card" key={reply.jobType}>
              <span>{reply.jobType}</span>
              <p>{reply.reply}</p>
              <button type="button" onClick={() => copyText(reply.reply)}>
                <Clipboard size={15} aria-hidden="true" />
                Copy reply
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel full-span-panel">
        <p className="admin-eyebrow">Social post starter</p>
        <div className="template-grid">
          {(draft.workGallery?.items || []).slice(0, 6).map((item) => {
            const caption = `${item.title} in ${item.location || 'New Castle County'}: ${item.summary || 'finished project work from Flanagan Construction'}. For kitchens, baths, concrete, roofing, siding, windows, decks, and repairs, start a request on our site.`
            return (
              <article className="template-card social-template-card" key={`${item.title}-${item.image}`}>
                <div className="social-template-photo" style={{ backgroundImage: cssUrl(item.image) }}></div>
                <span>{item.category || 'Project post'}</span>
                <h3>{item.title}</h3>
                <p>{caption}</p>
                <button type="button" onClick={() => copyText(caption)}>
                  <Send size={15} aria-hidden="true" />
                  Copy caption
                </button>
              </article>
            )
          })}
        </div>
      </section>
    </section>
  )
}

function financeSummaryLines(rows, totals) {
  return [
    'Flanagan Construction revenue and expense summary',
    `Report date: ${new Date().toLocaleDateString()}`,
    '',
    `Leads/jobs reviewed: ${rows.length}`,
    `Quoted/customer price: ${formatCurrency(totals.customerPrice)}`,
    `Revenue received: ${formatCurrency(totals.revenueReceived)}`,
    `Expenses/job cost: ${formatCurrency(totals.expenseTotal)}`,
    `Gross profit: ${formatCurrency(totals.grossProfit)}`,
    `Gross margin: ${Math.round(totals.margin)}%`,
    '',
    'Job details:',
    ...rows.map(({ lead, financials }) =>
      [
        `- ${lead.name} | ${lead.projectType} | ${lead.status}`,
        ` customer price ${formatCurrency(financials.customerPrice)}`,
        ` received ${formatCurrency(financials.revenueReceived)}`,
        ` expenses ${formatCurrency(financials.expenseTotal)}`,
        ` profit ${formatCurrency(financials.grossProfit)}`,
        lead.joistInvoiceNumber ? ` Joist invoice ${lead.joistInvoiceNumber}` : '',
      ].join(''),
    ),
  ].join('\n')
}

function exportFinancialCsv(leads) {
  const headers = [
    'Name',
    'Project',
    'Address',
    'Status',
    'Joist Client',
    'Joist Estimate #',
    'Joist Invoice #',
    'Joist Status',
    'Labor Cost',
    'Material Cost',
    'Subcontractor Cost',
    'Other Cost',
    'Total Cost',
    'Markup %',
    'Suggested Price',
    'Customer Price',
    'Revenue Received',
    'Expense Total',
    'Gross Profit',
    'Gross Margin %',
    'Payment Link',
    'Received',
  ]
  const rows = leads.map((lead) => {
    const financials = leadFinancials(lead)
    return [
      lead.name,
      lead.projectType,
      lead.address,
      lead.status,
      lead.joistClientName,
      lead.joistEstimateNumber,
      lead.joistInvoiceNumber,
      lead.joistStatus,
      financials.labor,
      financials.materials,
      financials.subcontractors,
      financials.other,
      financials.totalCost,
      financials.markupPercent,
      financials.suggestedPrice,
      financials.customerPrice,
      financials.revenueReceived,
      financials.expenseTotal,
      financials.grossProfit,
      Math.round(financials.margin),
      lead.paymentLink,
      lead.receivedAt,
    ]
  })
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `flanagan-financial-report-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function FinancialDashboard({ leads, emailSettings }) {
  const rows = useMemo(() => leads.map((lead) => ({ lead, financials: leadFinancials(lead) })), [leads])
  const totals = rows.reduce(
    (sum, row) => ({
      customerPrice: sum.customerPrice + row.financials.customerPrice,
      revenueReceived: sum.revenueReceived + row.financials.revenueReceived,
      expenseTotal: sum.expenseTotal + row.financials.expenseTotal,
      grossProfit: sum.grossProfit + row.financials.grossProfit,
    }),
    { customerPrice: 0, revenueReceived: 0, expenseTotal: 0, grossProfit: 0 },
  )
  totals.margin = totals.customerPrice > 0 ? (totals.grossProfit / totals.customerPrice) * 100 : 0
  const summaryText = financeSummaryLines(rows, totals)
  const cpaMailto = `mailto:?${new URLSearchParams({
    subject: `Flanagan Construction revenue and expense report - ${new Date().toLocaleDateString()}`,
    body: summaryText,
  }).toString()}`

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText)
    } catch {
      // The mailto link still gives the office manager a fallback.
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <p className="admin-eyebrow">Money</p>
          <h1>Reports, margins, Joist and Square</h1>
        </div>
        <div className="admin-page-actions">
          <button className="admin-secondary-button" type="button" onClick={() => exportFinancialCsv(leads)}>
            <FileSpreadsheet size={17} aria-hidden="true" />
            Export CPA CSV
          </button>
          <a className="admin-primary-link" href={cpaMailto} onClick={copySummary}>
            <Mail size={17} aria-hidden="true" />
            Email CPA summary
          </a>
        </div>
      </div>

      <div className="admin-metric-grid finance-metric-grid" aria-label="Financial summary">
        <article>
          <span>Quoted total</span>
          <strong>{formatCurrency(totals.customerPrice)}</strong>
        </article>
        <article>
          <span>Revenue received</span>
          <strong>{formatCurrency(totals.revenueReceived)}</strong>
        </article>
        <article>
          <span>Expenses / cost</span>
          <strong>{formatCurrency(totals.expenseTotal)}</strong>
        </article>
        <article>
          <span>Gross profit</span>
          <strong>{formatCurrency(totals.grossProfit)}</strong>
        </article>
      </div>

      <div className="integration-grid">
        <section className="admin-panel integration-card">
          <ReceiptText size={22} aria-hidden="true" />
          <div>
            <p className="admin-eyebrow">Joist bridge</p>
            <strong>Keep sending official estimates and invoices from Joist for now.</strong>
            <span>Paste the Joist estimate number, invoice number, status, and payment link into each lead so follow-up stays visible here.</span>
          </div>
        </section>
        <section className="admin-panel integration-card">
          <DollarSign size={22} aria-hidden="true" />
          <div>
            <p className="admin-eyebrow">Square payments</p>
            <strong>Ready for payment links first, API later.</strong>
            <span>Use the payment link field today. Later, Square Checkout can create hosted payment links and Square Invoices can publish invoice payments.</span>
          </div>
        </section>
        <section className="admin-panel integration-card">
          <Mail size={22} aria-hidden="true" />
          <div>
            <p className="admin-eyebrow">Outbound email</p>
            <strong>{smtpStatusLabel(emailSettings)}</strong>
            <span>{emailSettings?.configured ? 'SMTP is ready for future one-click sending.' : 'Use mailto drafts now; add Gmail SMTP settings in Railway when ready.'}</span>
          </div>
        </section>
      </div>

      <section className="admin-panel finance-table-panel">
        <div className="panel-title-row">
          <div>
            <p className="admin-eyebrow">Job margin list</p>
            <strong>Use this for quick office review before emailing the CPA.</strong>
          </div>
          <a href="https://developer.squareup.com/docs/checkout-api" target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            Square docs
          </a>
        </div>
        <div className="finance-table-wrap">
          <table className="finance-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Status</th>
                <th>Customer price</th>
                <th>Received</th>
                <th>Cost</th>
                <th>Profit</th>
                <th>Margin</th>
                <th>Joist invoice</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map(({ lead, financials }) => (
                <tr key={lead.id}>
                  <td data-label="Lead">
                    <strong>{lead.name}</strong>
                    <span>{lead.projectType}</span>
                  </td>
                  <td data-label="Status">{lead.status}</td>
                  <td data-label="Customer price">{formatCurrency(financials.customerPrice)}</td>
                  <td data-label="Received">{formatCurrency(financials.revenueReceived)}</td>
                  <td data-label="Cost">{formatCurrency(financials.expenseTotal)}</td>
                  <td data-label="Profit">{formatCurrency(financials.grossProfit)}</td>
                  <td data-label="Margin">{Math.round(financials.margin)}%</td>
                  <td data-label="Joist invoice">{lead.joistInvoiceNumber || 'Not entered'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8">No leads yet. New requests will appear here after the funnel captures them.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

function exportCsv(leads) {
  const headers = [
    'Name',
    'Phone',
    'Email',
    'Address',
    'Project',
    'Budget',
    'Timeline',
    'Status',
    'Priority',
    'Estimate Amount',
    'Payment Link',
    'Follow Up',
    'Last Contacted',
    'Next Step',
    'Notes',
    'Received',
  ]
  const rows = leads.map((lead) => [
    lead.name,
    lead.phone,
    lead.email,
    lead.address,
    lead.projectType,
    lead.budget,
    lead.timeline,
    lead.status,
    lead.priority,
    lead.estimateAmount,
    lead.paymentLink,
    lead.followUpAt,
    lead.lastContactedAt,
    lead.nextStep,
    lead.notes,
    lead.receivedAt,
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `flanagan-leads-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function AdminDashboard({ content, setContent, goHome }) {
  const [activeView, setActiveView] = useState('assistant')
  const [activeContentTab, setActiveContentTab] = useState('overview')
  const [auth, setAuth] = useState(readSessionAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginTrap, setLoginTrap] = useState({ website: '', confirmEmail: '' })
  const [mode, setMode] = useState('checking')
  const [unlocked, setUnlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [leads, setLeads] = useState([])
  const [emailSettings, setEmailSettings] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [draft, setDraft] = useState(() => cloneSiteContent(content))
  const [savingContent, setSavingContent] = useState(false)

  const loadAdminData = async (token = auth.token, sessionUser = auth.user) => {
    setLoading(true)
    setMessage('')

    try {
      const [leadPayload, contentPayload, emailPayload] = await Promise.all([
        adminRequest('/api/admin/leads', { token }),
        adminRequest('/api/admin/content', { token }),
        adminRequest('/api/admin/email-settings', { token }),
      ])
      const nextLeads = (leadPayload.leads || []).map(normalizeLead)
      const nextContent = mergeSiteContent(defaultSiteContent, contentPayload.content || {})
      setLeads(nextLeads)
      setDraft(nextContent)
      setContent(nextContent)
      setEmailSettings(emailPayload.emailSettings || null)
      saveStoredContent(nextContent)
      setMode('server')
      setUnlocked(true)
      setMessage(`Welcome back, ${adminFirstName(sessionUser)}. Your assistant is ready.`)
      const nextSession = { token, user: sessionUser || auth.user, expiresAt: auth.expiresAt || '' }
      setAuth((current) => ({ ...current, ...nextSession }))
      writeSessionAuth(nextSession)
    } catch (error) {
      if (error.status === 401) {
        setMode('locked')
        setUnlocked(false)
        setEmail('')
        setPassword('')
        setMessage('Enter your super admin email and password.')
      } else if (error.status === 503) {
        setMode('setup')
        setUnlocked(true)
        setLeads(loadStoredLeads())
        setMessage(error.message || 'Admin setup needs ADMIN_PASSWORD or ADMIN_USERS_JSON.')
      } else {
        setMode('local')
        setUnlocked(true)
        setLeads(loadStoredLeads())
        setMessage('Local admin mode.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAdminData(auth.token, auth.user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return leads
      .filter((lead) => statusFilter === 'All' || lead.status === statusFilter)
      .filter((lead) => {
        if (!needle) return true
        return [lead.name, lead.phone, lead.email, lead.projectType, lead.message, lead.notes]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      })
      .sort((a, b) => {
        const aTime = new Date(a.receivedAt).getTime() || 0
        const bTime = new Date(b.receivedAt).getTime() || 0
        return bTime - aTime
      })
  }, [leads, query, statusFilter])

  const activeSelectedLeadId =
    selectedLeadId && filteredLeads.some((lead) => lead.id === selectedLeadId)
      ? selectedLeadId
      : filteredLeads[0]?.id || ''
  const selectedLead = leads.find((lead) => lead.id === activeSelectedLeadId)

  const updateLead = async (id, patch) => {
    const normalizedPatch = { ...patch, updatedAt: new Date().toISOString() }
    const nextLeads = leads.map((lead) => (lead.id === id ? normalizeLead({ ...lead, ...normalizedPatch }) : lead))
    setLeads(nextLeads)
    saveStoredLeads(nextLeads)

    if (mode !== 'server') return

    try {
      await adminRequest(`/api/admin/leads/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        token: auth.token,
        body: normalizedPatch,
      })
    } catch (error) {
      setMessage(error.message || 'Lead update failed.')
    }
  }

  const updateSection = (section, field, value) => {
    setDraft((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }))
  }

  const updateArrayItem = (arrayName, index, field, value) => {
    setDraft((current) => ({
      ...current,
      [arrayName]: current[arrayName].map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }))
  }

  const updateNestedArrayItem = (section, arrayName, index, field, value) => {
    setDraft((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [arrayName]: current[section][arrayName].map((item, itemIndex) =>
          itemIndex === index ? { ...item, [field]: value } : item,
        ),
      },
    }))
  }

  const updateStringArray = (arrayName, index, value) => {
    setDraft((current) => ({
      ...current,
      [arrayName]: current[arrayName].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }))
  }

  const addArrayItem = (arrayName, item) => {
    setDraft((current) => ({
      ...current,
      [arrayName]: [...current[arrayName], item],
    }))
  }

  const addNestedArrayItem = (section, arrayName, item) => {
    setDraft((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [arrayName]: [...(current[section]?.[arrayName] || []), item],
      },
    }))
  }

  const removeArrayItem = (arrayName, index) => {
    setDraft((current) => ({
      ...current,
      [arrayName]: current[arrayName].filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const removeNestedArrayItem = (section, arrayName, index) => {
    setDraft((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [arrayName]: (current[section]?.[arrayName] || []).filter((_, itemIndex) => itemIndex !== index),
      },
    }))
  }

  const moveArrayItem = (arrayName, fromIndex, toIndex) => {
    setDraft((current) => {
      const nextItems = [...current[arrayName]]
      const [moved] = nextItems.splice(fromIndex, 1)
      nextItems.splice(toIndex, 0, moved)
      return {
        ...current,
        [arrayName]: nextItems,
      }
    })
  }

  const moveNestedArrayItem = (section, arrayName, fromIndex, toIndex) => {
    setDraft((current) => {
      const nextItems = [...current[section][arrayName]]
      const [moved] = nextItems.splice(fromIndex, 1)
      nextItems.splice(toIndex, 0, moved)
      return {
        ...current,
        [section]: {
          ...current[section],
          [arrayName]: nextItems,
        },
      }
    })
  }

  const saveContent = async () => {
    const nextContent = mergeSiteContent(defaultSiteContent, draft)
    setSavingContent(true)
    setMessage('')

    try {
      if (mode === 'server') {
        await adminRequest('/api/admin/content', {
          method: 'PUT',
          token: auth.token,
          body: { content: nextContent },
        })
      }
      setContent(nextContent)
      setDraft(nextContent)
      saveStoredContent(nextContent)
      setMessage(mode === 'server' ? 'Site content saved.' : 'Saved in this browser.')
    } catch (error) {
      setMessage(error.message || 'Content save failed.')
    } finally {
      setSavingContent(false)
    }
  }

  const resetContent = async () => {
    const nextContent = cloneSiteContent(defaultSiteContent)
    setDraft(nextContent)
    setContent(nextContent)
    resetStoredContent()
    if (mode === 'server') {
      try {
        await adminRequest('/api/admin/content', {
          method: 'PUT',
          token: auth.token,
          body: { content: nextContent },
        })
        setMessage('Site content reset.')
      } catch (error) {
        setMessage(error.message || 'Reset failed.')
      }
    } else {
      setMessage('Local draft reset.')
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const payload = await adminRequest('/api/admin/login', {
        method: 'POST',
        body: { email, password, ...loginTrap },
      })
      const nextAuth = {
        token: payload.token,
        user: payload.user,
        expiresAt: payload.expiresAt,
      }
      setAuth(nextAuth)
      writeSessionAuth(nextAuth)
      setPassword('')
      setLoginTrap({ website: '', confirmEmail: '' })
      await loadAdminData(payload.token, payload.user)
    } catch (error) {
      setMode('locked')
      setUnlocked(false)
      setMessage(error.message || 'Login failed.')
      setLoading(false)
    }
  }

  const signOut = () => {
    writeSessionAuth(null)
    setAuth({ token: '', user: null, expiresAt: '' })
    setEmail('')
    setPassword('')
    setLoginTrap({ website: '', confirmEmail: '' })
    setUnlocked(false)
    setMode('locked')
    setMessage('Signed out.')
  }

  if (!unlocked) {
    return (
      <AdminLogin
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        loginTrap={loginTrap}
        setLoginTrap={setLoginTrap}
        loading={loading}
        message={message}
        onSubmit={handleLogin}
        goHome={goHome}
      />
    )
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <span>
            <Sparkles size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>Flanagan Admin</strong>
            <small>{mode === 'server' ? `${adminFirstName(auth.user)}'s AI workbench` : mode === 'setup' ? 'Setup needed' : 'Local mode'}</small>
          </div>
        </div>

        <nav className="admin-main-tabs" aria-label="Admin sections">
          <button className={activeView === 'assistant' ? 'active' : ''} type="button" onClick={() => setActiveView('assistant')}>
            <Bot size={17} aria-hidden="true" />
            Assistant
          </button>
          <button className={activeView === 'leads' ? 'active' : ''} type="button" onClick={() => setActiveView('leads')}>
            <Users size={17} aria-hidden="true" />
            Leads
          </button>
          <button className={activeView === 'money' ? 'active' : ''} type="button" onClick={() => setActiveView('money')}>
            <DollarSign size={17} aria-hidden="true" />
            Money
          </button>
          <button className={activeView === 'content' ? 'active' : ''} type="button" onClick={() => setActiveView('content')}>
            <Edit3 size={17} aria-hidden="true" />
            Site editor
          </button>
          <button className={activeView === 'growth' ? 'active' : ''} type="button" onClick={() => setActiveView('growth')}>
            <Target size={17} aria-hidden="true" />
            Growth
          </button>
        </nav>

        <div className="admin-topbar-actions">
          <button type="button" onClick={() => loadAdminData(auth.token, auth.user)}>
            <RefreshCw size={17} aria-hidden="true" />
            Refresh
          </button>
          <button type="button" onClick={goHome}>
            <Home size={17} aria-hidden="true" />
            Site
          </button>
          {mode === 'server' ? (
            <button type="button" onClick={signOut}>
              <LogOut size={17} aria-hidden="true" />
              Sign out
            </button>
          ) : null}
        </div>
      </header>

      {message ? (
        <div className={`admin-banner mode-${mode}`}>
          <CheckCircle2 size={17} aria-hidden="true" />
          {message}
        </div>
      ) : null}

      {activeView === 'assistant' ? (
        <WorkdayAssistant
          user={auth.user}
          leads={leads}
          selectedLead={selectedLead}
          setSelectedLeadId={setSelectedLeadId}
          setActiveView={setActiveView}
          updateLead={updateLead}
          emailSettings={emailSettings}
        />
      ) : null}

      {activeView === 'leads' ? (
        <section className="admin-page">
          <div className="admin-page-head">
            <div>
              <p className="admin-eyebrow">CRM</p>
              <h1>Lead pipeline</h1>
            </div>
            <button className="admin-secondary-button" type="button" onClick={() => exportCsv(filteredLeads)}>
              <Download size={17} aria-hidden="true" />
              Export CSV
            </button>
          </div>

          <PipelineStats leads={leads} />

          <section className="admin-panel smtp-status-card">
            <div>
              <p className="admin-eyebrow">Outbound email</p>
              <strong>{smtpStatusLabel(emailSettings)}</strong>
              <span>
                {emailSettings?.configured
                  ? 'SMTP is configured for future one-click sending.'
                  : `Ready for setup. Missing: ${(emailSettings?.missing || ['SMTP_PASS']).join(', ')}`}
              </span>
            </div>
            <Settings size={22} aria-hidden="true" />
          </section>

          <div className="crm-layout">
            <section className="admin-panel lead-list-panel">
              <div className="lead-tools">
                <label className="lead-search">
                  <Search size={17} aria-hidden="true" />
                  <input
                    value={query}
                    placeholder="Search leads"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option>All</option>
                  {statusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>
              <LeadList
                leads={filteredLeads}
                selectedLeadId={activeSelectedLeadId}
                setSelectedLeadId={setSelectedLeadId}
              />
            </section>

            <LeadDetail
              key={activeSelectedLeadId || 'empty-lead'}
              lead={selectedLead}
              updateLead={updateLead}
              emailSettings={emailSettings}
            />
          </div>
        </section>
      ) : null}

      {activeView === 'money' ? (
        <FinancialDashboard leads={leads} emailSettings={emailSettings} />
      ) : null}

      {activeView === 'growth' ? (
        <GrowthDashboard
          draft={draft}
          updateSection={updateSection}
          saveContent={saveContent}
          savingContent={savingContent}
          leads={leads}
        />
      ) : null}

      {activeView === 'content' ? (
        <section className="admin-page">
          <div className="admin-page-head">
            <div>
              <p className="admin-eyebrow">Website</p>
              <h1>Site editor</h1>
            </div>
            <div className="admin-page-actions">
              <button className="admin-secondary-button" type="button" onClick={resetContent}>
                <RefreshCw size={17} aria-hidden="true" />
                Reset
              </button>
              <button className="admin-primary-button" type="button" onClick={saveContent} disabled={savingContent}>
                {savingContent ? <RefreshCw size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
                Save changes
              </button>
            </div>
          </div>

          <ContentToolbar activeContentTab={activeContentTab} setActiveContentTab={setActiveContentTab} />

          <div className="content-layout">
            <div>
              {activeContentTab === 'overview' ? (
                <OverviewEditor
                  draft={draft}
                  updateSection={updateSection}
                  updateNested={(section, field, value) => updateSection(section, field, value)}
                />
              ) : null}
              {activeContentTab === 'services' ? (
                <ServicesEditor
                  draft={draft}
                  updateArrayItem={updateArrayItem}
                  updateStringArray={updateStringArray}
                  addArrayItem={addArrayItem}
                  removeArrayItem={removeArrayItem}
                  updateSection={updateSection}
                />
              ) : null}
              {activeContentTab === 'photos' ? (
                <PhotosEditor
                  draft={draft}
                  updateSection={updateSection}
                  updateNestedArrayItem={updateNestedArrayItem}
                />
              ) : null}
              {activeContentTab === 'workGallery' ? (
                <WorkGalleryEditor
                  draft={draft}
                  updateSection={updateSection}
                  updateNestedArrayItem={updateNestedArrayItem}
                  addNestedArrayItem={addNestedArrayItem}
                  removeNestedArrayItem={removeNestedArrayItem}
                />
              ) : null}
              {activeContentTab === 'reviews' ? (
                <ReviewsEditor
                  draft={draft}
                  updateSection={updateSection}
                  updateArrayItem={updateArrayItem}
                  addArrayItem={addArrayItem}
                  removeArrayItem={removeArrayItem}
                />
              ) : null}
              {activeContentTab === 'builder' ? (
                <BuilderEditor
                  draft={draft}
                  updateSection={updateSection}
                  updateNestedArrayItem={updateNestedArrayItem}
                  moveArrayItem={moveArrayItem}
                  moveNestedArrayItem={moveNestedArrayItem}
                  updateCustomHtml={(field, value) => updateSection('customHtml', field, value)}
                />
              ) : null}
              {activeContentTab === 'ai' ? (
                <AiReadyEditor draft={draft} updateSection={updateSection} />
              ) : null}
            </div>
            <ContentPreview draft={draft} />
          </div>
        </section>
      ) : null}
    </main>
  )
}

export default AdminDashboard
