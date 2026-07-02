import { useEffect, useMemo, useRef, useState } from 'react'
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
  makeLeadId,
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
const priorityFilterOptions = ['All', ...priorityOptions]
const focusFilterOptions = ['All', 'Needs call', 'Due now', 'Estimate queue', 'Joist cleanup', 'Review/referral']
const closedStatuses = ['Won', 'Lost', 'Complete', 'Receipt Sent']
const estimateQueueStatuses = ['New', 'Contacted', 'Estimate Scheduled']
const joistWorkStatuses = ['Estimate Scheduled', 'Estimate Sent', 'Payment Link Sent', 'Deposit Paid', 'Scheduled', 'In Progress']
const pipelineGroups = [
  { id: 'intake', label: 'Intake', statuses: ['Started', 'New'], helper: 'Call fast, get address/photos.' },
  { id: 'estimate', label: 'Estimate', statuses: ['Contacted', 'Estimate Scheduled'], helper: 'Scope and schedule.' },
  { id: 'followup', label: 'Follow-up', statuses: ['Estimate Sent', 'Follow Up'], helper: 'Recover good jobs.' },
  { id: 'money', label: 'Money', statuses: ['Payment Link Sent', 'Deposit Paid'], helper: 'Deposit and Joist.' },
  { id: 'production', label: 'Production', statuses: ['Scheduled', 'In Progress'], helper: 'Prep, subs, updates.' },
  { id: 'done', label: 'Done', statuses: ['Complete', 'Receipt Sent', 'Won'], helper: 'Receipt, review, referral.' },
]
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

const gmailSetupLinks = {
  gmail: 'https://mail.google.com/',
  twoStep: 'https://support.google.com/accounts/answer/185839',
  appPassword: 'https://support.google.com/accounts/answer/185833',
  smtpSettings: 'https://support.google.com/mail/answer/7126229',
  smtpErrors: 'https://support.google.com/mail/answer/3726730',
  railwayVariables: 'https://railway.com/dashboard',
}

const smtpPasswordEnvKey = ['SMTP', 'PASS'].join('_')
const gmailSmtpHost = ['smtp', 'gmail', 'com'].join('.')
const smtpPasswordPlaceholder = 'paste-value-directly-in-railway'

const smtpEnvKeys = [
  'SMTP_PROVIDER',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  smtpPasswordEnvKey,
  'SMTP_FROM',
  'SMTP_REPLY_TO',
]

const gmailSetupSteps = [
  {
    title: 'Choose the sending inbox',
    copy: 'Use the Gmail account that should appear on customer follow-ups. For now that can be Nick. Later it can become info@yourdomain after Google Workspace is ready.',
    linkLabel: 'Open Gmail',
    href: gmailSetupLinks.gmail,
  },
  {
    title: 'Turn on 2-Step Verification',
    copy: 'Google app passwords only work after 2-Step Verification is enabled on the Google account.',
    linkLabel: '2-Step guide',
    href: gmailSetupLinks.twoStep,
  },
  {
    title: 'Create a Gmail app password',
    copy: 'Create an app password for Mail. Copy it once, paste it into the password field below, and keep it out of normal site content.',
    linkLabel: 'App password guide',
    href: gmailSetupLinks.appPassword,
  },
  {
    title: 'Paste variables into Railway',
    copy: 'Copy the generated environment variables, open Railway, paste them into Variables, save, and redeploy the service.',
    linkLabel: 'Open Railway',
    href: gmailSetupLinks.railwayVariables,
  },
  {
    title: 'Refresh this dashboard',
    copy: 'After Railway redeploys, click Refresh here. The status should change to Outbound email ready.',
    linkLabel: 'SMTP settings help',
    href: gmailSetupLinks.smtpSettings,
  },
]

const dripCampaigns = [
  {
    id: 'new-lead-speed',
    name: 'New lead speed-to-contact',
    audience: 'Fresh website leads',
    goal: 'Get phone contact, address, photos, and estimate timing fast.',
    steps: [
      '0-15 minutes: call once, leave a short voicemail, then send the first email/text.',
      'Same afternoon: ask for photos, address confirmation, and best time to talk.',
      'Next business morning: follow up with one clear next step and no pressure.',
    ],
    subject: 'Quick next step for your Flanagan Construction request',
    body:
      'Hi {name}, thanks for reaching out about {projectType}. I have the address as {address}. Can you send any photos and the best time for a quick call? We will give you a clear next step before we talk price.\n\nThanks,\nNick Flanagan',
  },
  {
    id: 'estimate-recovery',
    name: 'Estimate follow-up and recovery',
    audience: 'Estimate sent, no decision yet',
    goal: 'Bring back good jobs without sounding pushy.',
    steps: [
      'Day 1 after estimate: ask if scope or timing needs adjusting.',
      'Day 3: offer to talk through line items and choices.',
      'Day 7: close the loop politely and keep the door open.',
    ],
    subject: 'Checking in on your Flanagan Construction estimate',
    body:
      'Hi {name}, I wanted to check in on the estimate for {projectType}. If you want to adjust scope, compare options, or talk through timing, I am happy to help. If now is not the right time, no pressure.\n\nThanks,\nNick Flanagan',
  },
  {
    id: 'post-job-review-referral',
    name: 'Post-job review and referral',
    audience: 'Completed and won jobs',
    goal: 'Ask for Google reviews, referrals, and future work.',
    steps: [
      'Completion day: thank them and ask if anything needs attention.',
      'Next business day: ask for Google review if they are happy.',
      'One week later: ask who else needs kitchen, bath, concrete, roofing, siding, or windows.',
    ],
    subject: 'Thank you from Flanagan Construction',
    body:
      'Hi {name}, thanks again for trusting us with {projectType}. If everything looks good, a quick Google review would really help our local business. If you know someone who needs kitchen, bath, concrete, roofing, siding, windows, decks, or repairs, we would appreciate the introduction.\n\nThanks,\nNick Flanagan',
  },
  {
    id: 'partner-referral',
    name: 'Realtor and subcontractor partner',
    audience: 'BNI, realtors, subs, referral partners',
    goal: 'Create repeat business-to-business referral conversations.',
    steps: [
      'Start with a useful intro and the jobs Flanagan wants most.',
      'Ask what jobs or trades they need help with too.',
      'Follow up monthly with a simple project photo or useful contractor tip.',
    ],
    subject: 'Good referral fit for Flanagan Construction',
    body:
      'Hi {name}, Flanagan Construction is looking for steady introductions to homeowners, realtors, and trade partners around New Castle County. Our best-fit work is kitchens and baths, concrete driveways and sidewalks, roofing, siding, windows, decks, and repairs. Who would be a good person for us to meet?\n\nThanks,\nNick Flanagan',
  },
]

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
  return 'Nick'
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

function smtpStatusTone(emailSettings) {
  if (!emailSettings) return 'waiting'
  return emailSettings.configured ? 'ready' : 'needs-setup'
}

function envLineValue(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (/[\s#"=]/.test(text)) return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return text
}

function smtpEnvBlock(values) {
  return smtpEnvKeys
    .map((key) => `${key}=${envLineValue(values[key])}`)
    .join('\n')
}

function smtpChecklistText(values) {
  return [
    'Flanagan Construction Gmail/SMTP setup',
    '',
    '1. Open the Gmail account that will send customer follow-ups.',
    '2. Turn on 2-Step Verification.',
    '3. Create a Google app password for Mail.',
    '4. Paste these variables into Railway Variables.',
    '5. Redeploy Railway, then refresh the admin dashboard.',
    '6. Revoke and recreate the app password if it was ever pasted into GitHub, chat, or email.',
    '',
    smtpEnvBlock(values),
  ].join('\n')
}

function visibleLeadStatus(lead) {
  if (!lead) return ''
  if (lead.leadKind === 'Started funnel' || lead.status === 'Started') return 'Started form'
  return lead.status || 'New'
}

function isClosedLead(lead) {
  return closedStatuses.includes(lead?.status)
}

function isDueNow(lead) {
  const value = lead?.followUpAt || lead?.campaignNextAt
  if (!value || isClosedLead(lead)) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now()
}

function needsFirstCall(lead) {
  if (!lead || isClosedLead(lead)) return false
  return ['Started', 'New'].includes(lead.status) || !lead.lastContactedAt
}

function needsEstimateWork(lead) {
  return Boolean(lead && !isClosedLead(lead) && estimateQueueStatuses.includes(lead.status))
}

function needsJoistWork(lead) {
  return Boolean(
    lead &&
      lead.status !== 'Lost' &&
      (joistWorkStatuses.includes(lead.status) || lead.quoteCustomerPrice || lead.estimateAmount) &&
      (!lead.joistEstimateNumber || !lead.joistStatus),
  )
}

function needsReviewAsk(lead) {
  return Boolean(lead && ['Complete', 'Receipt Sent', 'Won'].includes(lead.status))
}

function leadMatchesFocus(lead, focus) {
  if (focus === 'All') return true
  if (focus === 'Needs call') return needsFirstCall(lead)
  if (focus === 'Due now') return isDueNow(lead)
  if (focus === 'Estimate queue') return needsEstimateWork(lead)
  if (focus === 'Joist cleanup') return needsJoistWork(lead)
  if (focus === 'Review/referral') return needsReviewAsk(lead)
  return true
}

function leadAgeLabel(value) {
  if (!value) return 'No date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No date'
  const diffHours = Math.max(0, (Date.now() - date.getTime()) / 36e5)
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${Math.floor(diffHours)}h old`
  const days = Math.floor(diffHours / 24)
  return `${days}d old`
}

function shortLeadNeed(lead) {
  if (lead?.selectedNeeds?.length) return lead.selectedNeeds.slice(0, 2).join(', ')
  return lead?.projectType || 'Project'
}

function leadCommandStats(leads) {
  const stats = workdayStats(leads)
  const dueNow = leads.filter(isDueNow)
  const needsCall = leads.filter(needsFirstCall)
  const needsEstimate = leads.filter(needsEstimateWork)
  const joistCleanup = leads.filter(needsJoistWork)
  const reviewQueue = leads.filter(needsReviewAsk)
  const topLead = [...stats.openLeads].sort((a, b) => leadSortScore(b) - leadSortScore(a))[0] || leads[0]

  return {
    ...stats,
    dueNow,
    needsCall,
    needsEstimate,
    joistCleanup,
    reviewQueue,
    topLead,
  }
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

function nextBusinessMorningIso(daysFromNow = 1) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  date.setHours(9, 0, 0, 0)
  if (date.getDay() === 0) date.setDate(date.getDate() + 1)
  if (date.getDay() === 6) date.setDate(date.getDate() + 2)
  return date.toISOString()
}

function fillCampaignTemplate(template, lead = {}) {
  return String(template || '')
    .replaceAll('{name}', lead.name || 'there')
    .replaceAll('{address}', lead.address || 'the project address')
    .replaceAll('{projectType}', lead.projectType || 'your project')
    .replaceAll('{selectedNeeds}', lead.selectedNeeds?.length ? lead.selectedNeeds.join(', ') : 'the work you selected')
    .replaceAll('{estimateAmount}', formatMoney(lead.estimateAmount || lead.quoteCustomerPrice))
    .replaceAll('{paymentLink}', lead.paymentLink || '[paste payment link]')
}

function campaignDraftFor(lead, campaign) {
  return {
    subject: fillCampaignTemplate(campaign?.subject || 'Following up from Flanagan Construction', lead),
    body: fillCampaignTemplate(campaign?.body || '', lead),
  }
}

function campaignMailtoFor(lead, campaign) {
  const draft = campaignDraftFor(lead, campaign)
  const params = new URLSearchParams({ subject: draft.subject, body: draft.body })
  return `mailto:${lead.email || ''}?${params.toString()}`
}

function joistPacketForLead(lead = {}) {
  const financials = leadFinancials(lead)
  const estimate = aiEstimateForLead(lead)
  return [
    'Joist entry packet - Flanagan Construction',
    '',
    `Customer: ${lead.joistClientName || lead.name || 'Website lead'}`,
    `Phone: ${lead.phone || 'Not listed'}`,
    `Email: ${lead.email || 'Not listed'}`,
    `Address: ${lead.address || 'Not listed'}`,
    `Project: ${lead.projectType || estimate.profile.label}`,
    lead.selectedNeeds?.length ? `Needs: ${lead.selectedNeeds.join(', ')}` : '',
    '',
    'Scope notes:',
    lead.message || lead.nextStep || 'Add walkthrough notes, measurements, photos, and material choices.',
    '',
    'Pricing check:',
    `Planning range: ${formatCurrency(estimate.low)}-${formatCurrency(estimate.high)}`,
    `Customer price: ${formatCurrency(financials.customerPrice || estimate.suggestedPrice)}`,
    `Deposit target: ${formatCurrency((financials.customerPrice || estimate.suggestedPrice) * ((moneyValue(lead.quoteDepositPercent) || estimate.depositPercent) / 100))}`,
    `Total cost: ${formatCurrency(financials.totalCost || estimate.totalCost)}`,
    `Gross margin: ${Math.round(financials.margin || estimate.profile.markup)}%`,
    '',
    `Joist estimate #: ${lead.joistEstimateNumber || 'Add after creating estimate'}`,
    `Joist invoice #: ${lead.joistInvoiceNumber || 'Add after converting to invoice'}`,
    `Joist status: ${lead.joistStatus || 'Needs Joist entry'}`,
    `Payment link: ${lead.paymentLink || 'Add Joist/Square payment link when ready'}`,
  ].filter(Boolean).join('\n')
}

function dueLabel(value) {
  if (!value) return 'No follow-up date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No follow-up date'
  const diffHours = (date.getTime() - Date.now()) / 36e5
  if (diffHours < -24) return 'Overdue'
  if (diffHours < 0) return 'Due now'
  if (diffHours < 24) return 'Due today'
  return formatDate(value)
}

function followUpScore(lead) {
  const dueBonus = lead.followUpAt && new Date(lead.followUpAt).getTime() <= Date.now() ? 40 : 0
  const staleHours = lead.lastContactedAt
    ? Math.max(0, (Date.now() - new Date(lead.lastContactedAt).getTime()) / 36e5)
    : 36
  return leadSortScore(lead) + dueBonus + Math.min(30, staleHours / 4)
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

function AdminCommandBoard({ leads, selectedLead, setSelectedLeadId, setActiveView, emailSettings, mode }) {
  const stats = leadCommandStats(leads)
  const focusLead = selectedLead || stats.topLead
  const commandTiles = [
    { label: 'Call first', value: stats.needsCall.length, helper: 'New or untouched leads', lead: stats.needsCall[0] },
    { label: 'Due now', value: stats.dueNow.length, helper: 'Follow-ups waiting', lead: stats.dueNow[0] },
    { label: 'Estimates', value: stats.needsEstimate.length, helper: 'Scope and pricing queue', lead: stats.needsEstimate[0] },
    { label: 'Joist cleanup', value: stats.joistCleanup.length, helper: 'Needs IDs/status', lead: stats.joistCleanup[0] },
    { label: 'Review asks', value: stats.reviewQueue.length, helper: 'Completed jobs', lead: stats.reviewQueue[0] },
  ]

  const openLead = (lead) => {
    if (lead?.id) setSelectedLeadId(lead.id)
    setActiveView('leads')
  }

  return (
    <section className="admin-command-board" aria-label="Daily command board">
      <div className="command-board-intro">
        <p className="admin-eyebrow">Office command center</p>
        <h2>{focusLead ? `Next best lead: ${focusLead.name || 'Website lead'}` : 'Ready for the next lead.'}</h2>
        <p>
          {focusLead
            ? `${visibleLeadStatus(focusLead)} / ${shortLeadNeed(focusLead)} / ${dueLabel(focusLead.followUpAt || focusLead.campaignNextAt)}`
            : 'New website requests, phone leads, Joist handoffs, and review follow-ups will queue up here.'}
        </p>
        <div className="command-board-actions">
          <button className="admin-primary-button" type="button" onClick={() => openLead(focusLead)} disabled={!focusLead}>
            <Target size={17} aria-hidden="true" />
            Work next lead
          </button>
          <button className="admin-secondary-button" type="button" onClick={() => setActiveView('email')}>
            <Mail size={17} aria-hidden="true" />
            {emailSettings?.configured ? 'Review sender' : 'Connect Gmail'}
          </button>
          <button className="admin-secondary-button" type="button" onClick={() => setActiveView('growth')}>
            <TrendingUp size={17} aria-hidden="true" />
            Grow reviews
          </button>
        </div>
      </div>

      <div className="command-tile-grid">
        {commandTiles.map((tile) => (
          <button
            className={tile.value ? 'command-tile needs-work' : 'command-tile'}
            key={tile.label}
            type="button"
            onClick={() => openLead(tile.lead)}
            disabled={!tile.lead}
          >
            <span>{tile.label}</span>
            <strong>{tile.value}</strong>
            <small>{tile.helper}</small>
          </button>
        ))}
        <button className={`command-tile command-system-tile ${emailSettings?.configured ? '' : 'needs-work'}`} type="button" onClick={() => setActiveView('email')}>
          <span>System</span>
          <strong>{mode === 'server' ? 'Live' : 'Local'}</strong>
          <small>{smtpStatusLabel(emailSettings)}</small>
        </button>
      </div>
    </section>
  )
}

function ManualLeadPanel({ createLead }) {
  const emptyLead = {
    name: '',
    phone: '',
    email: '',
    address: '',
    projectType: 'Kitchen or bathroom remodel',
    priority: 'Warm',
    message: '',
  }
  const [open, setOpen] = useState(false)
  const [lead, setLead] = useState(emptyLead)

  const update = (field, value) => setLead((current) => ({ ...current, [field]: value }))
  const submitLead = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const submittedLead = {
      ...lead,
      name: String(formData.get('name') || lead.name),
      phone: String(formData.get('phone') || lead.phone),
      email: String(formData.get('email') || lead.email),
      address: String(formData.get('address') || lead.address),
      projectType: String(formData.get('projectType') || lead.projectType),
      priority: String(formData.get('priority') || lead.priority),
      message: String(formData.get('message') || lead.message),
    }
    await createLead({
      ...submittedLead,
      name: submittedLead.name || 'Phone/referral lead',
      projectType: submittedLead.projectType || 'Project',
      leadKind: 'Office-entered lead',
      status: 'New',
      source: 'flanagan-admin',
      nextStep: 'Call back, confirm scope, address, photos, and estimate timing.',
    })
    setLead(emptyLead)
    setOpen(false)
  }

  return (
    <section className={open ? 'admin-panel manual-lead-panel open' : 'admin-panel manual-lead-panel'}>
      <div className="panel-title-row">
        <div>
          <p className="admin-eyebrow">Fast intake</p>
          <strong>Add a phone, referral, BNI, or walk-in lead while it is fresh.</strong>
        </div>
        <button type="button" onClick={() => setOpen((current) => !current)}>
          <Plus size={16} aria-hidden="true" />
          {open ? 'Close intake' : 'Add lead'}
        </button>
      </div>
      {open ? (
        <form className="manual-lead-form" onSubmit={submitLead}>
          <label>
            Name
            <input name="name" value={lead.name} placeholder="Customer name" onChange={(event) => update('name', event.target.value)} />
          </label>
          <label>
            Phone
            <input name="phone" value={lead.phone} placeholder="Best phone" onChange={(event) => update('phone', event.target.value)} />
          </label>
          <label>
            Email
            <input name="email" value={lead.email} placeholder="Email if you have it" onChange={(event) => update('email', event.target.value)} />
          </label>
          <label>
            Priority
            <select name="priority" value={lead.priority} onChange={(event) => update('priority', event.target.value)}>
              {priorityOptions.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          <label>
            Project type
            <input name="projectType" value={lead.projectType} onChange={(event) => update('projectType', event.target.value)} />
          </label>
          <label>
            Address
            <input name="address" value={lead.address} placeholder="Job address if known" onChange={(event) => update('address', event.target.value)} />
          </label>
          <label className="manual-lead-notes">
            Notes
            <textarea name="message" value={lead.message} rows="3" placeholder="What do they need, who referred them, timing..." onChange={(event) => update('message', event.target.value)} />
          </label>
          <button className="admin-primary-button" type="submit" disabled={!lead.phone && !lead.email}>
            <Plus size={17} aria-hidden="true" />
            Create lead
          </button>
        </form>
      ) : null}
    </section>
  )
}

function PipelineBoard({ leads, setSelectedLeadId }) {
  return (
    <section className="admin-panel pipeline-board" aria-label="Pipeline board">
      <div className="panel-title-row">
        <div>
          <p className="admin-eyebrow">Pipeline map</p>
          <strong>See where the work is stuck before opening individual records.</strong>
        </div>
        <span className="crm-pill">{leads.filter((lead) => !isClosedLead(lead)).length} active</span>
      </div>
      <div className="pipeline-lane-grid">
        {pipelineGroups.map((group) => {
          const groupLeads = leads.filter((lead) => group.statuses.includes(lead.status)).slice(0, 4)
          const total = leads.filter((lead) => group.statuses.includes(lead.status)).length
          return (
            <article className="pipeline-lane" key={group.id}>
              <div className="pipeline-lane-head">
                <span>{group.label}</span>
                <strong>{total}</strong>
              </div>
              <small>{group.helper}</small>
              <div className="pipeline-lane-list">
                {groupLeads.length ? groupLeads.map((lead) => (
                  <button type="button" key={lead.id} onClick={() => setSelectedLeadId(lead.id)}>
                    <span className={`lead-priority priority-${lead.priority.toLowerCase()}`}>{lead.priority}</span>
                    <strong>{lead.name || 'Website lead'}</strong>
                    <small>{shortLeadNeed(lead)} / {leadAgeLabel(lead.receivedAt)}</small>
                  </button>
                )) : (
                  <em>Clear</em>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function LeadReadinessChecklist({ lead }) {
  const checks = [
    { label: 'Phone captured', done: Boolean(lead.phone) },
    { label: 'Email captured', done: Boolean(lead.email) },
    { label: 'Job address', done: Boolean(lead.address) },
    { label: 'Scope/photos note', done: Boolean(lead.message || lead.selectedNeeds?.length) },
    { label: 'Follow-up date', done: Boolean(lead.followUpAt || lead.campaignNextAt) },
    { label: 'Joist status', done: Boolean(lead.joistEstimateNumber || lead.joistStatus) },
  ]

  return (
    <div className="lead-readiness-card">
      <div>
        <p className="admin-eyebrow">Lead readiness</p>
        <strong>What the office should collect before Nick prices it.</strong>
      </div>
      <div className="readiness-grid">
        {checks.map((check) => (
          <span className={check.done ? 'done' : ''} key={check.label}>
            <CheckCircle2 size={15} aria-hidden="true" />
            {check.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function CrmCommandCenter({ leads, selectedLead, setSelectedLeadId, updateLead, emailSettings }) {
  const stats = workdayStats(leads)
  const followQueue = [...leads]
    .filter((lead) => !['Lost', 'Complete', 'Receipt Sent'].includes(lead.status))
    .sort((a, b) => followUpScore(b) - followUpScore(a))
    .slice(0, 6)
  const activeLead = selectedLead || followQueue[0] || leads[0]
  const joistNeeds = leads.filter((lead) =>
    !['Lost'].includes(lead.status) &&
    (['Estimate Scheduled', 'Estimate Sent', 'Payment Link Sent', 'Deposit Paid', 'Scheduled', 'In Progress'].includes(lead.status) ||
      lead.quoteCustomerPrice ||
      lead.estimateAmount) &&
    (!lead.joistEstimateNumber || !lead.joistStatus)
  )
  const selectedCampaign = dripCampaigns.find((campaign) => campaign.name === activeLead?.campaignName) || dripCampaigns[0]
  const selectedCampaignDraft = activeLead ? campaignDraftFor(activeLead, selectedCampaign) : null

  const assignCampaign = (campaign) => {
    if (!activeLead) return
    const draft = campaignDraftFor(activeLead, campaign)
    updateLead(activeLead.id, {
      campaignName: campaign.name,
      campaignStep: '1',
      campaignNextAt: nextBusinessMorningIso(1),
      nextStep: campaign.steps[0],
      emailStage: campaign.name,
      emailSubject: draft.subject,
      emailBody: draft.body,
    })
  }

  const markCampaignSent = (lead, campaign) => {
    updateLead(lead.id, {
      campaignName: campaign.name,
      campaignStep: String(Math.min(3, Number(lead.campaignStep || 1) + 1)),
      campaignNextAt: nextBusinessMorningIso(2),
      campaignLastSentAt: new Date().toISOString(),
      lastContactedAt: new Date().toISOString(),
      status: lead.status === 'New' ? 'Contacted' : lead.status,
      nextStep: campaign.steps[Math.min(2, Number(lead.campaignStep || 1))] || campaign.goal,
    })
  }

  return (
    <section className="crm-command-center">
      <div className="admin-panel crm-coach-panel">
        <div>
          <p className="admin-eyebrow">Daily office coach</p>
          <h2>Today: protect the hot leads, send the next touch, keep Joist clean.</h2>
        </div>
        <div className="crm-coach-steps">
          <span><strong>1</strong> Call every new/hot lead before anything else.</span>
          <span><strong>2</strong> Send estimate follow-ups before lunch.</span>
          <span><strong>3</strong> Copy Joist packets for priced jobs and paste Joist IDs back here.</span>
          <span><strong>4</strong> Ask completed happy customers for Google reviews and referrals.</span>
        </div>
      </div>

      <div className="crm-command-grid">
        <section className="admin-panel crm-priority-panel">
          <div className="panel-title-row">
            <div>
              <p className="admin-eyebrow">Priority queue</p>
              <strong>{followQueue.length ? 'Work these from top to bottom.' : 'No active follow-ups yet.'}</strong>
            </div>
            <span className="crm-pill">{stats.openLeads.length} open</span>
          </div>
          <div className="crm-priority-list">
            {followQueue.length ? followQueue.map((lead) => (
              <button type="button" key={lead.id} onClick={() => setSelectedLeadId(lead.id)}>
                <span className={`lead-priority priority-${lead.priority.toLowerCase()}`}>{lead.priority}</span>
                <span>
                  <strong>{lead.name || 'Website lead'}</strong>
                  <small>{visibleLeadStatus(lead)} / {dueLabel(lead.followUpAt || lead.campaignNextAt)}</small>
                </span>
                <em>{lead.campaignName || 'No drip'}</em>
              </button>
            )) : (
              <div className="admin-empty compact-empty">
                <strong>Clear for now.</strong>
                <span>New leads, estimate follow-ups, and active campaigns will appear here.</span>
              </div>
            )}
          </div>
        </section>

        <section className="admin-panel crm-campaign-panel">
          <div className="panel-title-row">
            <div>
              <p className="admin-eyebrow">Drip campaigns</p>
              <strong>{activeLead ? `Selected: ${activeLead.name}` : 'Select a lead to assign a drip.'}</strong>
            </div>
            <span className="crm-pill">{smtpStatusLabel(emailSettings)}</span>
          </div>
          <div className="campaign-grid">
            {dripCampaigns.map((campaign) => (
              <article key={campaign.id} className={activeLead?.campaignName === campaign.name ? 'campaign-card active' : 'campaign-card'}>
                <span>{campaign.audience}</span>
                <h3>{campaign.name}</h3>
                <p>{campaign.goal}</p>
                <ol>
                  {campaign.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
                <div className="campaign-actions">
                  <button type="button" onClick={() => assignCampaign(campaign)} disabled={!activeLead}>
                    <Target size={15} aria-hidden="true" />
                    Assign drip
                  </button>
                  {activeLead?.email ? (
                    <a href={campaignMailtoFor(activeLead, campaign)} onClick={() => markCampaignSent(activeLead, campaign)}>
                      <Mail size={15} aria-hidden="true" />
                      Open email
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-panel crm-email-panel">
          <div className="panel-title-row">
            <div>
              <p className="admin-eyebrow">Selected email campaign</p>
              <strong>{activeLead ? selectedCampaign.name : 'No lead selected'}</strong>
            </div>
            {activeLead ? <span className="crm-pill">Step {activeLead.campaignStep || '1'}</span> : null}
          </div>
          {activeLead && selectedCampaignDraft ? (
            <>
              <pre>{`Subject: ${selectedCampaignDraft.subject}\n\n${selectedCampaignDraft.body}`}</pre>
              <div className="lead-contact-actions">
                <button type="button" onClick={() => copyText(`Subject: ${selectedCampaignDraft.subject}\n\n${selectedCampaignDraft.body}`)}>
                  <Clipboard size={16} aria-hidden="true" />
                  Copy campaign
                </button>
                <button type="button" onClick={() => markCampaignSent(activeLead, selectedCampaign)}>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Mark touch sent
                </button>
              </div>
            </>
          ) : (
            <div className="admin-empty compact-empty">
              <strong>Select a lead to generate campaign copy.</strong>
              <span>The office can copy or open drafts now, then one-click send can be added when SMTP is fully configured.</span>
            </div>
          )}
        </section>

        <section className="admin-panel crm-joist-panel">
          <div className="panel-title-row">
            <div>
              <p className="admin-eyebrow">Joist command center</p>
              <strong>{joistNeeds.length} leads need Joist estimate/status cleanup.</strong>
            </div>
            <a className="admin-primary-link" href="https://www.joist.com/" target="_blank" rel="noreferrer">
              Open Joist
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          </div>
          <p>
            Joist does not expose a public API in the docs I could safely wire here. This bridge keeps Joist official for estimates/invoices while this CRM owns follow-up, margin checks, and CPA reporting.
          </p>
          {activeLead ? (
            <div className="lead-contact-actions">
              <button type="button" onClick={() => copyText(joistPacketForLead(activeLead))}>
                <Clipboard size={16} aria-hidden="true" />
                Copy selected Joist packet
              </button>
              <button
                type="button"
                onClick={() => updateLead(activeLead.id, {
                  joistStatus: activeLead.joistStatus || 'Needs Joist estimate',
                  nextStep: 'Create/update Joist estimate, then paste Joist estimate number and invoice status back into CRM.',
                })}
              >
                <ReceiptText size={16} aria-hidden="true" />
                Flag for Joist
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </section>
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
      followUpAt: lead.followUpAt || nextBusinessMorningIso(1),
      status: ['Started', 'New'].includes(lead.status) ? 'Contacted' : lead.status,
      emailStage: lead.emailStage || 'Estimate Scheduled',
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

  const detailFieldValue = (root, field, fallback = '') => (
    root?.querySelector(`[data-lead-field="${field}"]`)?.value ?? fallback
  )

  const saveNotes = (overrides = {}, sourceElement = null) => {
    const root = sourceElement?.closest?.('.lead-detail-panel')
    updateLead(lead.id, {
      notes: detailFieldValue(root, 'notes', notes),
      nextStep: detailFieldValue(root, 'nextStep', nextStep),
      estimateAmount: detailFieldValue(root, 'estimateAmount', estimateAmount),
      paymentLink: detailFieldValue(root, 'paymentLink', paymentLink),
      followUpAt: fromDateTimeInputValue(detailFieldValue(root, 'followUpAt', followUpAt)),
      quoteLaborCost: detailFieldValue(root, 'quoteLaborCost', quoteLaborCost),
      quoteMaterialCost: detailFieldValue(root, 'quoteMaterialCost', quoteMaterialCost),
      quoteSubCost: detailFieldValue(root, 'quoteSubCost', quoteSubCost),
      quoteOtherCost: detailFieldValue(root, 'quoteOtherCost', quoteOtherCost),
      quoteMarkupPercent: detailFieldValue(root, 'quoteMarkupPercent', quoteMarkupPercent),
      quoteCustomerPrice: detailFieldValue(root, 'quoteCustomerPrice', quoteCustomerPrice),
      quoteDepositPercent: detailFieldValue(root, 'quoteDepositPercent', quoteDepositPercent),
      revenueReceived: detailFieldValue(root, 'revenueReceived', revenueReceived),
      expenseTotal: detailFieldValue(root, 'expenseTotal', expenseTotal),
      joistClientName: detailFieldValue(root, 'joistClientName', joistClientName),
      joistEstimateNumber: detailFieldValue(root, 'joistEstimateNumber', joistEstimateNumber),
      joistInvoiceNumber: detailFieldValue(root, 'joistInvoiceNumber', joistInvoiceNumber),
      joistStatus: detailFieldValue(root, 'joistStatus', joistStatus),
      ...overrides,
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
  const activeCampaign = dripCampaigns.find((campaign) => campaign.name === lead.campaignName)

  const applyAiEstimateToLocal = (patch) => {
    setEstimateAmount(patch.estimateAmount || '')
    setQuoteLaborCost(patch.quoteLaborCost || '')
    setQuoteMaterialCost(patch.quoteMaterialCost || '')
    setQuoteSubCost(patch.quoteSubCost || '')
    setQuoteOtherCost(patch.quoteOtherCost || '')
    setQuoteMarkupPercent(patch.quoteMarkupPercent || '28')
    setQuoteCustomerPrice(patch.quoteCustomerPrice || '')
    setQuoteDepositPercent(patch.quoteDepositPercent || '33')
    if (patch.followUpAt) setFollowUpAt(toDateTimeInputValue(patch.followUpAt))
    setNextStep(patch.nextStep || '')
    setNotes(patch.notes || '')
  }

  const workflowCampaignForStatus = (status) => {
    if (['Estimate Sent', 'Follow Up'].includes(status)) return dripCampaigns.find((campaign) => campaign.id === 'estimate-recovery')
    if (['Complete', 'Receipt Sent', 'Won'].includes(status)) return dripCampaigns.find((campaign) => campaign.id === 'post-job-review-referral')
    if (['Contacted', 'Estimate Scheduled'].includes(status)) return dripCampaigns.find((campaign) => campaign.id === 'new-lead-speed')
    return null
  }

  const followUpForStatus = (status) => {
    if (['Estimate Sent', 'Follow Up'].includes(status)) return nextBusinessMorningIso(2)
    if (['Payment Link Sent', 'Deposit Paid', 'Complete'].includes(status)) return nextBusinessMorningIso(1)
    if (status === 'Scheduled') return nextBusinessMorningIso(2)
    return fromDateTimeInputValue(followUpAt)
  }

  const applyStage = (status) => {
    const play = stagePlaybook.find((item) => item.status === status)
    const draft = emailDraftFor(workingLead, status)
    const campaign = workflowCampaignForStatus(status)
    const nextFollowUp = followUpForStatus(status)
    const nextStepValue = play?.nextStep || nextStep
    if (nextStepValue) setNextStep(nextStepValue)
    if (nextFollowUp) setFollowUpAt(toDateTimeInputValue(nextFollowUp))
    updateLead(lead.id, {
      status,
      nextStep: nextStepValue,
      estimateAmount,
      paymentLink,
      followUpAt: nextFollowUp,
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
      campaignName: campaign?.name || lead.campaignName,
      campaignStep: campaign ? '1' : lead.campaignStep,
      campaignNextAt: campaign ? nextFollowUp || nextBusinessMorningIso(1) : lead.campaignNextAt,
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

  const saveJoistInfo = (event) => {
    saveNotes({}, event.currentTarget)
  }

  const copyJoistHandOff = async (event) => {
    saveNotes({}, event.currentTarget)
    try {
      await navigator.clipboard.writeText(joistHandOffText)
    } catch {
      updateLead(lead.id, {
        notes: `${notes}\n\n${joistHandOffText}`.trim(),
      })
    }
  }

  const markCalledNow = () => {
    const nextFollowUp = nextBusinessMorningIso(1)
    const nextStepValue = nextStep || 'Send photos/address reminder and confirm estimate timing.'
    setFollowUpAt(toDateTimeInputValue(nextFollowUp))
    setNextStep(nextStepValue)
    updateLead(lead.id, {
      status: ['Started', 'New'].includes(lead.status) ? 'Contacted' : lead.status,
      lastContactedAt: new Date().toISOString(),
      followUpAt: nextFollowUp,
      nextStep: nextStepValue,
    })
  }

  const followUpTomorrow = () => {
    const nextFollowUp = nextBusinessMorningIso(1)
    const nextStepValue = 'Follow up tomorrow with one clear next step.'
    setFollowUpAt(toDateTimeInputValue(nextFollowUp))
    setNextStep(nextStepValue)
    updateLead(lead.id, {
      status: lead.status === 'New' ? 'Contacted' : 'Follow Up',
      followUpAt: nextFollowUp,
      nextStep: nextStepValue,
    })
  }

  const copyTextMessage = async () => {
    await copyText(
      `Hi ${lead.name || 'there'}, this is Nick with Flanagan Construction. Thanks for reaching out about ${lead.projectType || 'your project'}. Can you send the job address, a few photos, and the best time for a quick call?`,
    )
    const nextStepValue = nextStep || 'Text copied. Watch for photos/address and schedule estimate.'
    setNextStep(nextStepValue)
    updateLead(lead.id, {
      lastContactedAt: new Date().toISOString(),
      nextStep: nextStepValue,
    })
  }

  const scheduleNextTouchTomorrow = () => {
    const campaign = activeCampaign || dripCampaigns[0]
    const nextCampaignTouch = nextBusinessMorningIso(1)
    const nextStepValue = campaign.steps?.[0] || dripCampaigns[0].steps[0]
    setNextStep(nextStepValue)
    updateLead(lead.id, {
      campaignName: campaign.name,
      campaignStep: lead.campaignStep || '1',
      campaignNextAt: nextCampaignTouch,
      nextStep: nextStepValue,
    })
  }

  const mapsUrl = lead.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address)}` : ''

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

      <div className="lead-quick-action-strip">
        <button type="button" onClick={markCalledNow}>
          <Phone size={16} aria-hidden="true" />
          Log call now
        </button>
        <button type="button" onClick={followUpTomorrow}>
          <Clock3 size={16} aria-hidden="true" />
          Follow up tomorrow
        </button>
        <button type="button" onClick={copyTextMessage}>
          <MessageSquareText size={16} aria-hidden="true" />
          Copy text
        </button>
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noreferrer">
            <MapPin size={16} aria-hidden="true" />
            Open map
          </a>
        ) : null}
        <button type="button" onClick={() => applyStage('Estimate Sent')}>
          <FileText size={16} aria-hidden="true" />
          Estimate sent
        </button>
      </div>

      <LeadReadinessChecklist lead={workingLead} />

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

      <div className="campaign-status-strip">
        <div>
          <p className="admin-eyebrow">Drip status</p>
          <strong>{lead.campaignName || 'No campaign assigned yet'}</strong>
          <span>
            {lead.campaignName
              ? `Step ${lead.campaignStep || '1'} / next touch: ${dueLabel(lead.campaignNextAt || followUpAt)}`
              : 'Assign a campaign from the CRM cockpit above.'}
          </span>
        </div>
        <div className="lead-contact-actions">
          <button
            type="button"
            onClick={scheduleNextTouchTomorrow}
          >
            <Clock3 size={16} aria-hidden="true" />
            Next touch tomorrow
          </button>
          {lead.campaignName ? (
            <button type="button" onClick={() => updateLead(lead.id, { campaignName: '', campaignStep: '', campaignNextAt: '', campaignLastSentAt: '' })}>
              <Trash2 size={16} aria-hidden="true" />
              Clear drip
            </button>
          ) : null}
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
            data-lead-field="estimateAmount"
            inputMode="decimal"
            placeholder="$"
            onBlur={(event) => saveNotes({ estimateAmount: event.currentTarget.value }, event.currentTarget)}
            onChange={(event) => setEstimateAmount(event.target.value)}
          />
        </label>
        <label>
          Payment link
          <input
            value={paymentLink}
            data-lead-field="paymentLink"
            placeholder="https://..."
            onBlur={(event) => saveNotes({ paymentLink: event.currentTarget.value }, event.currentTarget)}
            onChange={(event) => setPaymentLink(event.target.value)}
          />
        </label>
        <label>
          Follow-up date
          <input
            type="datetime-local"
            value={followUpAt}
            data-lead-field="followUpAt"
            onBlur={(event) => saveNotes({ followUpAt: fromDateTimeInputValue(event.currentTarget.value) }, event.currentTarget)}
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
            <input value={quoteLaborCost} data-lead-field="quoteLaborCost" inputMode="decimal" placeholder="$" onBlur={(event) => saveNotes({ quoteLaborCost: event.currentTarget.value }, event.currentTarget)} onChange={(event) => setQuoteLaborCost(event.target.value)} />
          </label>
          <label>
            Materials cost
            <input value={quoteMaterialCost} data-lead-field="quoteMaterialCost" inputMode="decimal" placeholder="$" onBlur={(event) => saveNotes({ quoteMaterialCost: event.currentTarget.value }, event.currentTarget)} onChange={(event) => setQuoteMaterialCost(event.target.value)} />
          </label>
          <label>
            Subcontractors
            <input value={quoteSubCost} data-lead-field="quoteSubCost" inputMode="decimal" placeholder="$" onBlur={(event) => saveNotes({ quoteSubCost: event.currentTarget.value }, event.currentTarget)} onChange={(event) => setQuoteSubCost(event.target.value)} />
          </label>
          <label>
            Other costs
            <input value={quoteOtherCost} data-lead-field="quoteOtherCost" inputMode="decimal" placeholder="$" onBlur={(event) => saveNotes({ quoteOtherCost: event.currentTarget.value }, event.currentTarget)} onChange={(event) => setQuoteOtherCost(event.target.value)} />
          </label>
          <label>
            Markup %
            <input value={quoteMarkupPercent} data-lead-field="quoteMarkupPercent" inputMode="decimal" onBlur={(event) => saveNotes({ quoteMarkupPercent: event.currentTarget.value }, event.currentTarget)} onChange={(event) => setQuoteMarkupPercent(event.target.value)} />
          </label>
          <label>
            Customer quote price
            <input value={quoteCustomerPrice} data-lead-field="quoteCustomerPrice" inputMode="decimal" placeholder="$" onBlur={(event) => saveNotes({ quoteCustomerPrice: event.currentTarget.value }, event.currentTarget)} onChange={(event) => setQuoteCustomerPrice(event.target.value)} />
          </label>
          <label>
            Deposit %
            <input value={quoteDepositPercent} data-lead-field="quoteDepositPercent" inputMode="decimal" onBlur={(event) => saveNotes({ quoteDepositPercent: event.currentTarget.value }, event.currentTarget)} onChange={(event) => setQuoteDepositPercent(event.target.value)} />
          </label>
          <label>
            Deposit target
            <input value={formatCurrency(depositAmount)} readOnly />
          </label>
          <label>
            Revenue received
            <input value={revenueReceived} data-lead-field="revenueReceived" inputMode="decimal" placeholder="$" onBlur={(event) => saveNotes({ revenueReceived: event.currentTarget.value }, event.currentTarget)} onChange={(event) => setRevenueReceived(event.target.value)} />
          </label>
          <label>
            Expense total
            <input value={expenseTotal} data-lead-field="expenseTotal" inputMode="decimal" placeholder="$" onBlur={(event) => saveNotes({ expenseTotal: event.currentTarget.value }, event.currentTarget)} onChange={(event) => setExpenseTotal(event.target.value)} />
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
            <input value={joistClientName} data-lead-field="joistClientName" onBlur={(event) => saveNotes({ joistClientName: event.currentTarget.value }, event.currentTarget)} onChange={(event) => setJoistClientName(event.target.value)} />
          </label>
          <label>
            Joist status
            <input value={joistStatus} data-lead-field="joistStatus" placeholder="Estimate drafted, invoice sent..." onBlur={(event) => saveNotes({ joistStatus: event.currentTarget.value }, event.currentTarget)} onChange={(event) => setJoistStatus(event.target.value)} />
          </label>
          <label>
            Joist estimate #
            <input value={joistEstimateNumber} data-lead-field="joistEstimateNumber" onBlur={(event) => saveNotes({ joistEstimateNumber: event.currentTarget.value }, event.currentTarget)} onChange={(event) => setJoistEstimateNumber(event.target.value)} />
          </label>
          <label>
            Joist invoice #
            <input value={joistInvoiceNumber} data-lead-field="joistInvoiceNumber" onBlur={(event) => saveNotes({ joistInvoiceNumber: event.currentTarget.value }, event.currentTarget)} onChange={(event) => setJoistInvoiceNumber(event.target.value)} />
          </label>
        </div>
        <div className="lead-contact-actions joist-actions">
          <button type="button" onClick={saveJoistInfo}>
            <Save size={16} aria-hidden="true" />
            Save Joist info
          </button>
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
          data-lead-field="nextStep"
          onBlur={(event) => saveNotes({ nextStep: event.currentTarget.value }, event.currentTarget)}
          onChange={(event) => setNextStep(event.target.value)}
        />
      </label>

      <label className="admin-field">
        <span>Office notes</span>
        <textarea
          rows="5"
          value={notes}
          data-lead-field="notes"
          onBlur={(event) => saveNotes({ notes: event.currentTarget.value }, event.currentTarget)}
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
            Add the Gmail SMTP variables in Railway to enable future one-click sending. Keep the app password only in Railway.
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
  const fileInputRef = useRef(null)

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
      <div className="asset-drop-actions">
        <button
          type="button"
          className="asset-upload-button"
          onClick={(event) => {
            event.preventDefault()
            fileInputRef.current?.click()
          }}
        >
          <Image size={16} aria-hidden="true" />
          Upload photo
        </button>
        <span>or paste a hosted image URL below</span>
      </div>
      <input
        ref={fileInputRef}
        className="asset-file-input"
        type="file"
        accept="image/*"
        onChange={(event) => {
          handleFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <input className="asset-url-input" value={value || ''} onChange={(event) => onChange(event.target.value)} />
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
  joist: 'https://www.joist.com/',
  googleBusiness: 'https://developers.google.com/my-business/content/review-data',
  nextdoor: 'https://business.nextdoor.com/en-us/small-business',
  googleAds: 'https://ads.google.com/',
  googleAdsHelp: 'https://support.google.com/google-ads/',
  campaignHelp: 'https://support.google.com/google-ads/topic/3121941',
  keywordPlanner: 'https://support.google.com/google-ads/answer/6325025',
  conversionTracking: 'https://support.google.com/google-ads/answer/1722022',
  googleTag: 'https://support.google.com/google-ads/answer/6331304',
  autoTagging: 'https://support.google.com/google-ads/answer/3095550',
  searchConsole: 'https://search.google.com/search-console/about',
  tagAssistant: 'https://tagassistant.google.com/',
}

const seoChecklist = [
  {
    title: 'Google Business Profile',
    copy: 'Keep services, service area, phone, photos, hours, and review link current. Add job photos every week.',
  },
  {
    title: 'Local pages and sitemap',
    copy: 'Homepage and Our Work are in the sitemap. Keep New Castle County towns and main job types in page copy.',
  },
  {
    title: 'Reviews and replies',
    copy: 'Ask after completed jobs. Reply with the job type and town so local keywords happen naturally.',
  },
  {
    title: 'Conversion tracking',
    copy: 'Track form submits and phone clicks before spending real ad budget. Verify tags with Google Tag Assistant.',
  },
  {
    title: 'Photo proof',
    copy: 'Upload real kitchens, baths, concrete, roofing, siding, windows, decks, and repairs with plain captions.',
  },
  {
    title: 'Weekly Search Console check',
    copy: 'Look for queries, pages gaining impressions, crawl issues, and mobile problems before making site changes.',
  },
]

const googleAdsSteps = [
  {
    title: 'Open Google Ads and set the goal',
    copy: 'Use Leads as the goal. Start with Search only, not Display or Performance Max, so spending goes toward people actively looking for a contractor.',
    action: 'Open Google Ads',
    href: integrationDocs.googleAds,
  },
  {
    title: 'Keep location tight',
    copy: 'Target New Castle County, Delaware. Exclude distant counties unless Nick intentionally wants those calls.',
    action: 'Campaign setup help',
    href: integrationDocs.campaignHelp,
  },
  {
    title: 'Build three starting ad groups',
    copy: 'Kitchen and bath remodeling, concrete driveways and sidewalks, and roofing/siding/windows. Keep decks and additions separate later.',
    action: 'Keyword Planner',
    href: integrationDocs.keywordPlanner,
  },
  {
    title: 'Turn on conversions before budget',
    copy: 'Paste GA4, Google tag, or Google Ads conversion IDs into this page. Test the estimate form and phone buttons before scaling.',
    action: 'Conversion tracking',
    href: integrationDocs.conversionTracking,
  },
  {
    title: 'Use auto-tagging and UTMs',
    copy: 'Auto-tagging helps Google Ads report leads correctly. UTMs help the CRM show where the lead came from later.',
    action: 'Auto-tagging docs',
    href: integrationDocs.autoTagging,
  },
  {
    title: 'Optimize once a week',
    copy: 'Pause wasteful search terms, add negatives, raise bids only on leads that answer, and keep ads pointing to the simple request form.',
    action: 'Google Ads Help',
    href: integrationDocs.googleAdsHelp,
  },
]

const googleAdsKeywordGroups = [
  {
    title: 'Kitchen & bath',
    keywords: [
      'kitchen remodel new castle county',
      'bathroom remodel newark de',
      'bathroom contractor wilmington de',
      'tile shower contractor delaware',
      'kitchen renovation near me',
    ],
  },
  {
    title: 'Concrete',
    keywords: [
      'concrete driveway new castle county',
      'sidewalk repair delaware',
      'driveway replacement newark de',
      'concrete patio contractor near me',
      'paver patio new castle county',
    ],
  },
  {
    title: 'Roofing, siding, windows',
    keywords: [
      'roof repair new castle county',
      'siding contractor delaware',
      'window replacement newark de',
      'gutter guards delaware',
      'exterior repair contractor near me',
    ],
  },
]

const googleAdsNegativeKeywords = [
  'jobs',
  'career',
  'salary',
  'free materials',
  'diy',
  'how to',
  'home depot',
  'lowes',
  'class',
  'training',
  'apartment rental',
  'cheap only',
]

const weeklyAdsRoutine = [
  'Check yesterday and last 7 days for form leads and phone clicks.',
  'Open search terms. Add junk searches to negatives before raising budget.',
  'Listen to which calls became real estimates. Mark bad-fit leads in the CRM.',
  'Add one real project photo or review if a job wrapped up.',
  'Send Nick a short note: spend, leads, booked estimates, and next adjustment.',
]

function fillGrowthTemplate(template, lead = {}, reviewLink = '') {
  return String(template || '')
    .replaceAll('{name}', lead.name || 'there')
    .replaceAll('{address}', lead.address || 'your project')
    .replaceAll('{projectType}', lead.projectType || 'your project')
    .replaceAll('{googleReviewLink}', reviewLink || '[paste Google review link]')
}

function reviewFollowUpMailto(lead, template, reviewLink) {
  const params = new URLSearchParams({
    subject: `Flanagan Construction follow-up: ${template?.title || 'thank you'}`,
    body: fillGrowthTemplate(template?.body, lead, reviewLink),
  })
  return `mailto:${lead.email || ''}?${params.toString()}`
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

function EmailSetupDashboard({ emailSettings, onRefresh, mode }) {
  const [smtpDraft, setSmtpDraft] = useState(() => ({
    SMTP_PROVIDER: emailSettings?.provider || 'gmail',
    SMTP_HOST: emailSettings?.host || gmailSmtpHost,
    SMTP_PORT: emailSettings?.port || '587',
    SMTP_SECURE: emailSettings?.secure || 'false',
    SMTP_USER: emailSettings?.user || '',
    [smtpPasswordEnvKey]: '',
    SMTP_FROM: emailSettings?.from || '',
    SMTP_REPLY_TO: emailSettings?.replyTo || emailSettings?.user || '',
  }))
  const statusTone = smtpStatusTone(emailSettings)
  const missing = emailSettings?.missing || ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', smtpPasswordEnvKey, 'SMTP_FROM']
  const requiredStatus =
    emailSettings?.required ||
    ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', smtpPasswordEnvKey, 'SMTP_FROM'].map((key) => ({ key, configured: false, secret: key === smtpPasswordEnvKey }))
  const envBlock = smtpEnvBlock({
    ...smtpDraft,
    [smtpPasswordEnvKey]: smtpDraft[smtpPasswordEnvKey] || (emailSettings?.passwordConfigured ? '[already set in Railway]' : smtpPasswordPlaceholder),
  })
  const updateDraft = (key, value) => {
    setSmtpDraft((current) => ({
      ...current,
      [key]: value,
      ...(key === 'SMTP_USER' && !current.SMTP_REPLY_TO ? { SMTP_REPLY_TO: value } : {}),
      ...(key === 'SMTP_USER' && !current.SMTP_FROM ? { SMTP_FROM: `Flanagan Construction <${value}>` } : {}),
      ...(key === 'SMTP_PORT' && value === '465' ? { SMTP_SECURE: 'true' } : {}),
      ...(key === 'SMTP_PORT' && value === '587' ? { SMTP_SECURE: 'false' } : {}),
    }))
  }

  return (
    <section className="admin-page email-setup-page">
      <div className="admin-page-head">
        <div>
          <p className="admin-eyebrow">Gmail + SMTP</p>
          <h1>Connect outbound email without guessing</h1>
        </div>
        <div className="admin-page-actions">
          <a className="admin-secondary-button" href={gmailSetupLinks.appPassword} target="_blank" rel="noreferrer">
            <ExternalLink size={17} aria-hidden="true" />
            Gmail app password
          </a>
          <button className="admin-primary-button" type="button" onClick={onRefresh}>
            <RefreshCw size={17} aria-hidden="true" />
            Refresh status
          </button>
        </div>
      </div>

      <section className={`admin-panel email-hero-panel ${statusTone}`}>
        <div>
          <p className="admin-eyebrow">Email readiness</p>
          <h2>{emailSettings?.configured ? 'Outbound email is connected.' : 'Finish Gmail SMTP setup in Railway.'}</h2>
          <p>
            The dashboard can draft follow-ups today. SMTP variables let the server safely send from Gmail later without storing app passwords in the website editor.
          </p>
        </div>
        <div className="email-readiness-card">
          <span>{emailSettings?.configured ? 'Ready' : `${missing.length} missing`}</span>
          <strong>{smtpStatusLabel(emailSettings)}</strong>
          <small>{mode === 'server' ? 'Reading live Railway environment.' : 'Local mode uses this browser only.'}</small>
        </div>
      </section>

      <div className="smtp-readiness-grid">
        {requiredStatus.map((item) => (
          <article className={item.configured ? 'ready' : 'missing'} key={item.key}>
            <CheckCircle2 size={17} aria-hidden="true" />
            <div>
              <strong>{item.key}</strong>
              <span>{item.secret && item.configured ? 'Set and hidden' : item.configured ? 'Set in environment' : 'Missing in Railway'}</span>
            </div>
          </article>
        ))}
      </div>

      <section className="admin-panel full-span-panel">
        <div className="panel-title-row">
          <div>
            <p className="admin-eyebrow">Step-by-step Gmail setup</p>
            <strong>Follow these in order. Do not paste the app password into normal content fields.</strong>
          </div>
          <button className="admin-secondary-button" type="button" onClick={() => copyText(smtpChecklistText({
            ...smtpDraft,
            [smtpPasswordEnvKey]: smtpDraft[smtpPasswordEnvKey] || (emailSettings?.passwordConfigured ? '[already set in Railway]' : smtpPasswordPlaceholder),
          }))}>
            <Clipboard size={16} aria-hidden="true" />
            Copy checklist
          </button>
        </div>
        <div className="email-step-grid">
          {gmailSetupSteps.map((step, index) => (
            <article className="email-step-card" key={step.title}>
              <span>{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
              <a href={step.href} target="_blank" rel="noreferrer">
                {step.linkLabel}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel full-span-panel">
        <div className="panel-title-row">
          <div>
            <p className="admin-eyebrow">Railway variable builder</p>
            <strong>Type the sender details once, copy the block, then paste into Railway Variables.</strong>
          </div>
          <div className="admin-page-actions">
            <button className="admin-secondary-button" type="button" onClick={() => copyText(envBlock)}>
              <Clipboard size={16} aria-hidden="true" />
              Copy env block
            </button>
            <a className="admin-primary-link" href={gmailSetupLinks.railwayVariables} target="_blank" rel="noreferrer">
              Railway dashboard
              <ExternalLink size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="env-builder-layout">
          <div className="admin-form-grid">
            <Field label="SMTP provider" value={smtpDraft.SMTP_PROVIDER} onChange={(value) => updateDraft('SMTP_PROVIDER', value)} />
            <Field label="SMTP host" value={smtpDraft.SMTP_HOST} onChange={(value) => updateDraft('SMTP_HOST', value)} />
            <Field label="SMTP port" value={smtpDraft.SMTP_PORT} onChange={(value) => updateDraft('SMTP_PORT', value)} />
            <Field label="SMTP secure true/false" value={smtpDraft.SMTP_SECURE} onChange={(value) => updateDraft('SMTP_SECURE', value)} />
            <Field label="Gmail address / SMTP user" value={smtpDraft.SMTP_USER} onChange={(value) => updateDraft('SMTP_USER', value)} />
            <Field label="Gmail app password (local helper only)" value={smtpDraft[smtpPasswordEnvKey]} type="password" onChange={(value) => updateDraft(smtpPasswordEnvKey, value)} />
            <Field label="From name and email" value={smtpDraft.SMTP_FROM} onChange={(value) => updateDraft('SMTP_FROM', value)} />
            <Field label="Reply-to email" value={smtpDraft.SMTP_REPLY_TO} onChange={(value) => updateDraft('SMTP_REPLY_TO', value)} />
          </div>
          <div className="env-preview-card">
            <p className="admin-eyebrow">Copy into Railway</p>
            <pre>{envBlock}</pre>
            <p>
              Recommended Gmail SMTP: {gmailSmtpHost}, port 587, STARTTLS, SMTP_SECURE=false. Use port 465 only if you intentionally choose SSL and set secure to true.
            </p>
          </div>
        </div>
      </section>

      <section className="admin-panel full-span-panel smtp-cheat-panel">
        <div>
          <p className="admin-eyebrow">Troubleshooting</p>
          <h2>Common Gmail SMTP issues</h2>
        </div>
        <div className="smtp-cheat-grid">
          <article>
            <strong>Wrong password</strong>
            <p>Use the 16-character app password, not the normal Gmail login password.</p>
          </article>
          <article>
            <strong>App passwords missing</strong>
            <p>Confirm 2-Step Verification is on. Some work/school accounts may need the Google Workspace admin to allow it.</p>
          </article>
          <article>
            <strong>Blocked or rejected</strong>
            <p>Use TLS/SSL, keep volume normal, and later add Workspace/DKIM for info@yourdomain.</p>
          </article>
        </div>
        <div className="email-doc-links">
          <a href={gmailSetupLinks.smtpSettings} target="_blank" rel="noreferrer">Gmail SMTP help <ExternalLink size={14} aria-hidden="true" /></a>
          <a href={gmailSetupLinks.smtpErrors} target="_blank" rel="noreferrer">SMTP error help <ExternalLink size={14} aria-hidden="true" /></a>
          <a href={gmailSetupLinks.twoStep} target="_blank" rel="noreferrer">2-Step Verification <ExternalLink size={14} aria-hidden="true" /></a>
        </div>
      </section>
    </section>
  )
}

function AdsSeoDashboard({ draft, updateSection, saveContent, savingContent }) {
  const integrations = draft.integrations || {}
  const trackingItems = [
    { label: 'GTM', value: integrations.gtmContainerId },
    { label: 'GA4', value: integrations.ga4MeasurementId },
    { label: 'Google Ads ID', value: integrations.googleAdsConversionId },
    { label: 'Lead label', value: integrations.googleAdsLeadConversionLabel },
  ]
  const configuredCount = trackingItems.filter((item) => String(item.value || '').trim()).length
  const keywordCopy = googleAdsKeywordGroups
    .map((group) => `${group.title}\n${group.keywords.map((keyword) => `- ${keyword}`).join('\n')}`)
    .join('\n\n')
  const negativeCopy = googleAdsNegativeKeywords.join('\n')
  const adDraft = [
    'Headline ideas:',
    'New Castle County Remodeler',
    'Kitchen, Bath & Concrete Help',
    'Roofing Siding Windows',
    '',
    'Description ideas:',
    'Licensed and insured local contractor. Send the job address and details for a clear next step.',
    'Kitchens, baths, concrete, roofing, siding, windows, decks, and repairs across New Castle County.',
  ].join('\n')

  return (
    <section className="admin-page ads-page">
      <div className="admin-page-head">
        <div>
          <p className="admin-eyebrow">SEO + Google Ads</p>
          <h1>Office manager growth coach</h1>
        </div>
        <div className="admin-page-actions">
          <a className="admin-secondary-button" href={integrationDocs.googleAds} target="_blank" rel="noreferrer">
            <ExternalLink size={17} aria-hidden="true" />
            Google Ads
          </a>
          <button className="admin-primary-button" type="button" onClick={saveContent} disabled={savingContent}>
            {savingContent ? <RefreshCw size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
            Save SEO / ads settings
          </button>
        </div>
      </div>

      <section className="admin-panel ads-hero-panel">
        <div>
          <p className="admin-eyebrow">Step-by-step setup</p>
          <h2>Start simple: local search ads, real lead tracking, weekly cleanup.</h2>
          <p>
            This page is the playbook for getting Flanagan found on Google without wasting money. Fill in account links and tracking IDs as they are created, then use the weekly checklist to keep campaigns healthy.
          </p>
        </div>
        <div className="ads-score-card" aria-label="Tracking readiness">
          <span>{configuredCount}/4</span>
          <strong>Tracking fields ready</strong>
          <small>Form leads fire Google events once IDs are saved.</small>
        </div>
      </section>

      <section className="admin-panel full-span-panel">
        <div className="panel-title-row">
          <div>
            <p className="admin-eyebrow">Tracking and account links</p>
            <strong>Paste IDs here after Google Ads, GA4, Tag Manager, and Search Console are created.</strong>
          </div>
          <a className="admin-primary-link" href={integrationDocs.tagAssistant} target="_blank" rel="noreferrer">
            Tag Assistant
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
        <div className="tracking-status-grid">
          {trackingItems.map((item) => (
            <span className={String(item.value || '').trim() ? 'done' : ''} key={item.label}>
              <CheckCircle2 size={15} aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </div>
        <div className="admin-form-grid ads-settings-grid">
          <Field label="Google Ads account URL" value={integrations.googleAdsUrl || integrationDocs.googleAds} onChange={(value) => updateSection('integrations', 'googleAdsUrl', value)} />
          <Field label="Google Ads customer ID" value={integrations.googleAdsCustomerId || ''} onChange={(value) => updateSection('integrations', 'googleAdsCustomerId', value)} />
          <Field label="Google Tag Manager ID" value={integrations.gtmContainerId || ''} onChange={(value) => updateSection('integrations', 'gtmContainerId', value)} />
          <Field label="GA4 measurement ID" value={integrations.ga4MeasurementId || ''} onChange={(value) => updateSection('integrations', 'ga4MeasurementId', value)} />
          <Field label="Google Ads conversion ID" value={integrations.googleAdsConversionId || ''} onChange={(value) => updateSection('integrations', 'googleAdsConversionId', value)} />
          <Field label="Lead conversion label" value={integrations.googleAdsLeadConversionLabel || ''} onChange={(value) => updateSection('integrations', 'googleAdsLeadConversionLabel', value)} />
          <Field label="Search Console URL" value={integrations.googleSearchConsoleUrl || integrationDocs.searchConsole} onChange={(value) => updateSection('integrations', 'googleSearchConsoleUrl', value)} />
          <Field label="Ads landing page URL" value={integrations.adsLandingPageUrl || 'https://flanaganconstructionde.com/'} onChange={(value) => updateSection('integrations', 'adsLandingPageUrl', value)} />
          <Field label="Starting monthly budget" value={integrations.adsMonthlyBudget || ''} onChange={(value) => updateSection('integrations', 'adsMonthlyBudget', value)} />
          <Field label="Primary campaign goal" value={integrations.adsPrimaryGoal || ''} textarea rows={3} onChange={(value) => updateSection('integrations', 'adsPrimaryGoal', value)} />
          <Field label="Google Ads notes" value={integrations.adsNotes || ''} textarea rows={4} onChange={(value) => updateSection('integrations', 'adsNotes', value)} />
        </div>
      </section>

      <section className="admin-panel full-span-panel seo-editor-panel">
        <div className="panel-title-row">
          <div>
            <p className="admin-eyebrow">SEO page settings</p>
            <strong>Edit what Google and social previews see for the homepage and Our Work page.</strong>
          </div>
          <a className="admin-secondary-button" href={integrationDocs.searchConsole} target="_blank" rel="noreferrer">
            Search Console
            <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
        <div className="admin-form-grid">
          <Field label="Homepage SEO title" value={draft.seo?.homeTitle || ''} onChange={(value) => updateSection('seo', 'homeTitle', value)} />
          <Field label="Our Work SEO title" value={draft.seo?.ourWorkTitle || ''} onChange={(value) => updateSection('seo', 'ourWorkTitle', value)} />
          <Field label="Homepage description" value={draft.seo?.homeDescription || ''} textarea rows={3} onChange={(value) => updateSection('seo', 'homeDescription', value)} />
          <Field label="Our Work description" value={draft.seo?.ourWorkDescription || ''} textarea rows={3} onChange={(value) => updateSection('seo', 'ourWorkDescription', value)} />
          <Field label="SEO keywords" value={draft.seo?.keywords || ''} textarea rows={3} onChange={(value) => updateSection('seo', 'keywords', value)} />
          <Field label="Social preview image URL" value={draft.seo?.ogImage || ''} onChange={(value) => updateSection('seo', 'ogImage', value)} />
        </div>
      </section>

      <div className="ads-link-grid">
        <a href={integrationDocs.googleAds} target="_blank" rel="noreferrer">
          <Target size={18} aria-hidden="true" />
          Open Google Ads
        </a>
        <a href={integrationDocs.keywordPlanner} target="_blank" rel="noreferrer">
          <Search size={18} aria-hidden="true" />
          Keyword Planner
        </a>
        <a href={integrationDocs.conversionTracking} target="_blank" rel="noreferrer">
          <CheckCircle2 size={18} aria-hidden="true" />
          Conversion tracking
        </a>
        <a href={integrationDocs.googleTag} target="_blank" rel="noreferrer">
          <Settings size={18} aria-hidden="true" />
          Google tag
        </a>
        <a href={integrationDocs.searchConsole} target="_blank" rel="noreferrer">
          <TrendingUp size={18} aria-hidden="true" />
          Search Console
        </a>
      </div>

      <section className="admin-panel full-span-panel">
        <div className="panel-title-row">
          <div>
            <p className="admin-eyebrow">Google Ads tutorial</p>
            <strong>Follow these in order before spending serious budget.</strong>
          </div>
        </div>
        <div className="ads-tutorial-grid">
          {googleAdsSteps.map((step, index) => (
            <article className="ads-step-card" key={step.title}>
              <span className="ads-step-number">{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
              <a href={step.href} target="_blank" rel="noreferrer">
                {step.action}
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel full-span-panel">
        <div className="panel-title-row">
          <div>
            <p className="admin-eyebrow">SEO enhancement checklist</p>
            <strong>Small weekly habits that make the site easier to find and easier to trust.</strong>
          </div>
        </div>
        <div className="seo-check-grid">
          {seoChecklist.map((item) => (
            <article key={item.title}>
              <CheckCircle2 size={18} aria-hidden="true" />
              <div>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel full-span-panel">
        <div className="panel-title-row">
          <div>
            <p className="admin-eyebrow">Starter campaigns</p>
            <strong>Copy these into Google Ads, then refine based on real calls and estimate quality.</strong>
          </div>
          <div className="admin-page-actions">
            <button className="admin-secondary-button" type="button" onClick={() => copyText(keywordCopy)}>
              <Clipboard size={16} aria-hidden="true" />
              Copy keywords
            </button>
            <button className="admin-secondary-button" type="button" onClick={() => copyText(negativeCopy)}>
              <Clipboard size={16} aria-hidden="true" />
              Copy negatives
            </button>
            <button className="admin-secondary-button" type="button" onClick={() => copyText(adDraft)}>
              <Clipboard size={16} aria-hidden="true" />
              Copy ad draft
            </button>
          </div>
        </div>
        <div className="keyword-group-grid">
          {googleAdsKeywordGroups.map((group) => (
            <article className="keyword-group-card" key={group.title}>
              <h3>{group.title}</h3>
              <div className="keyword-chip-list">
                {group.keywords.map((keyword) => (
                  <span key={keyword}>{keyword}</span>
                ))}
              </div>
            </article>
          ))}
          <article className="keyword-group-card negative-card">
            <h3>Negative keywords</h3>
            <div className="keyword-chip-list">
              {googleAdsNegativeKeywords.map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="admin-panel full-span-panel weekly-ads-panel">
        <div>
          <p className="admin-eyebrow">Weekly routine</p>
          <h2>What the office should do every week</h2>
        </div>
        <div className="weekly-checklist">
          {weeklyAdsRoutine.map((item) => (
            <span key={item}>
              <CheckCircle2 size={16} aria-hidden="true" />
              {item}
            </span>
          ))}
        </div>
      </section>
    </section>
  )
}

function GrowthDashboard({ draft, updateSection, saveContent, savingContent, leads }) {
  const integrations = draft.integrations || {}
  const reviewAutomation = draft.reviewAutomation || {}
  const nextdoor = draft.nextdoorPlaybook || {}
  const reviewTemplate = reviewAutomation.templates?.[1] || reviewAutomation.templates?.[0] || {}
  const reviewQueue = leads
    .filter((lead) => ['Complete', 'Completed', 'Receipt Sent', 'Won'].includes(lead.status))
    .slice(0, 8)
  const reviewLead =
    reviewQueue[0] ||
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
        <IntegrationCard
          title="Joist"
          status="Bridge now"
          copy="Keep official estimates and invoices in Joist. Use CRM packets, IDs, status, payment links, and CPA exports here until API access exists."
          href={integrationDocs.joist}
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
          <Field label="Joist login URL" value={integrations.joistLoginUrl || integrationDocs.joist} onChange={(value) => updateSection('integrations', 'joistLoginUrl', value)} />
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
        <div className="review-queue">
          <div className="panel-title-row">
            <div>
              <p className="admin-eyebrow">Review request queue</p>
              <strong>Jobs marked complete or won show here for fast Google-review follow-up.</strong>
            </div>
          </div>
          {reviewQueue.length ? (
            <div className="review-queue-list">
              {reviewQueue.map((lead) => {
                const text = fillGrowthTemplate(reviewTemplate.body, lead, googleReviewLink)
                return (
                  <article className="review-queue-card" key={lead.id}>
                    <div>
                      <strong>{lead.name || 'Unnamed customer'}</strong>
                      <span>{lead.projectType || 'Project'} / {lead.status}</span>
                      <small>{lead.email || 'No email on lead yet'}</small>
                    </div>
                    <div>
                      {lead.email ? (
                        <a className="admin-primary-link" href={reviewFollowUpMailto(lead, reviewTemplate, googleReviewLink)}>
                          <Mail size={15} aria-hidden="true" />
                          Open review email
                        </a>
                      ) : null}
                      <button className="admin-secondary-button" type="button" onClick={() => copyText(text)}>
                        <Clipboard size={15} aria-hidden="true" />
                        Copy review ask
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="admin-empty compact-empty">
              <strong>No completed jobs in the queue yet.</strong>
              <span>When a lead moves to Complete, Completed, Won, or Receipt Sent, the review ask appears here.</span>
            </div>
          )}
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
    'Campaign',
    'Campaign Step',
    'Campaign Next Touch',
    'Campaign Last Sent',
    'Joist Estimate #',
    'Joist Invoice #',
    'Joist Status',
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
    lead.campaignName,
    lead.campaignStep,
    lead.campaignNextAt,
    lead.campaignLastSentAt,
    lead.joistEstimateNumber,
    lead.joistInvoiceNumber,
    lead.joistStatus,
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
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [focusFilter, setFocusFilter] = useState('All')
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
      .filter((lead) => priorityFilter === 'All' || lead.priority === priorityFilter)
      .filter((lead) => leadMatchesFocus(lead, focusFilter))
      .filter((lead) => {
        if (!needle) return true
        return [lead.name, lead.phone, lead.email, lead.address, lead.projectType, lead.message, lead.notes]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      })
      .sort((a, b) => {
        const aTime = new Date(a.receivedAt).getTime() || 0
        const bTime = new Date(b.receivedAt).getTime() || 0
        return bTime - aTime
      })
  }, [leads, query, statusFilter, priorityFilter, focusFilter])

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

  const createLead = async (leadDraft) => {
    const receivedAt = new Date().toISOString()
    const optimisticLead = normalizeLead({
      ...leadDraft,
      id: makeLeadId({ ...leadDraft, receivedAt }),
      receivedAt,
      status: leadDraft.status || 'New',
      priority: leadDraft.priority || 'Warm',
    })
    const optimisticLeads = [optimisticLead, ...leads]
    setLeads(optimisticLeads)
    saveStoredLeads(optimisticLeads)
    setSelectedLeadId(optimisticLead.id)
    setActiveView('leads')
    setMessage(`Added ${optimisticLead.name}. Work it before it cools off.`)

    if (mode !== 'server') return optimisticLead

    try {
      const payload = await adminRequest('/api/admin/leads', {
        method: 'POST',
        token: auth.token,
        body: optimisticLead,
      })
      const savedLead = normalizeLead(payload.lead || optimisticLead)
      const savedLeads = [savedLead, ...leads.filter((lead) => lead.id !== optimisticLead.id)]
      setLeads(savedLeads)
      saveStoredLeads(savedLeads)
      setSelectedLeadId(savedLead.id)
      setMessage(`Added ${savedLead.name} to the live CRM.`)
      return savedLead
    } catch (error) {
      setMessage(error.message || 'Lead saved locally, but server create failed.')
      return optimisticLead
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
          <span className="admin-logo-mark" aria-hidden="true"></span>
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
          <button className={activeView === 'email' ? 'active' : ''} type="button" onClick={() => setActiveView('email')}>
            <Mail size={17} aria-hidden="true" />
            Email
          </button>
          <button className={activeView === 'ads' ? 'active' : ''} type="button" onClick={() => setActiveView('ads')}>
            <TrendingUp size={17} aria-hidden="true" />
            SEO + Ads
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

      <AdminCommandBoard
        leads={leads}
        selectedLead={selectedLead}
        setSelectedLeadId={setSelectedLeadId}
        setActiveView={setActiveView}
        emailSettings={emailSettings}
        mode={mode}
      />

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

          <ManualLeadPanel createLead={createLead} />

          <PipelineBoard leads={leads} setSelectedLeadId={setSelectedLeadId} />

          <CrmCommandCenter
            leads={leads}
            selectedLead={selectedLead}
            setSelectedLeadId={setSelectedLeadId}
            updateLead={updateLead}
            emailSettings={emailSettings}
          />

          <section className="admin-panel smtp-status-card">
            <div>
              <p className="admin-eyebrow">Outbound email</p>
              <strong>{smtpStatusLabel(emailSettings)}</strong>
              <span>
                {emailSettings?.configured
                  ? 'SMTP is configured for future one-click sending.'
                  : `Ready for setup. Missing: ${(emailSettings?.missing || [smtpPasswordEnvKey]).join(', ')}`}
              </span>
            </div>
            <button className="admin-secondary-button" type="button" onClick={() => setActiveView('email')}>
              <Settings size={17} aria-hidden="true" />
              Setup
            </button>
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
                <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                  {priorityFilterOptions.map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </div>
              <div className="lead-focus-tabs" aria-label="Lead focus filters">
                {focusFilterOptions.map((filter) => (
                  <button
                    className={focusFilter === filter ? 'active' : ''}
                    key={filter}
                    type="button"
                    onClick={() => setFocusFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
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

      {activeView === 'email' ? (
        <EmailSetupDashboard
          emailSettings={emailSettings}
          mode={mode}
          onRefresh={() => loadAdminData(auth.token, auth.user)}
        />
      ) : null}

      {activeView === 'ads' ? (
        <AdsSeoDashboard
          draft={draft}
          updateSection={updateSection}
          saveContent={saveContent}
          savingContent={savingContent}
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
