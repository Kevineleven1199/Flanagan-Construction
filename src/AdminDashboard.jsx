import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Clipboard,
  DollarSign,
  Download,
  Edit3,
  Eye,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  GripVertical,
  Home,
  Image,
  Lock,
  LogOut,
  Mail,
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
      'Hi {name},\n\nThanks for reaching out to Flanagan Construction. I saw your request for {projectType}. I wanted to confirm the best details before we set up the next step.\n\nSelected needs: {selectedNeeds}\n\nWhat is the best time to talk?\n\nThanks,\nNick Flanagan',
  },
  'Estimate Scheduled': {
    subject: 'Your Flanagan Construction estimate appointment',
    body:
      'Hi {name},\n\nYou are on our list for an estimate for {projectType}. Please reply with the project address, best access instructions, and anything you want us to look closely at.\n\nThanks,\nNick Flanagan',
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
  { id: 'reviews', label: 'Reviews & FAQ', icon: Sparkles },
  { id: 'builder', label: 'Builder', icon: GripVertical },
  { id: 'ai', label: 'AI-ready', icon: WandSparkles },
]

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

function AdminLogin({ email, setEmail, password, setPassword, loading, message, onSubmit, goHome }) {
  return (
    <main className="admin-auth">
      <form className="admin-auth-panel" onSubmit={onSubmit}>
        <span className="admin-auth-icon">
          <Lock size={24} aria-hidden="true" />
        </span>
          <h1>Flanagan Admin</h1>
        <p className="admin-auth-help">Sign in as Nick or Kevin. Passwords can be rotated later with ADMIN_USERS_JSON.</p>
        <label>
          Super admin email
          <input
            type="email"
            value={email}
            autoComplete="username"
            placeholder="nickflanagan73@gmail.com"
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
              SMTP sender: {emailSettings?.from || 'Nick Flanagan <nickflanagan73@gmail.com>'}
              {emailSettings?.configured ? ' ready' : ' needs Railway settings'}
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
                location: 'Newark, DE',
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
            <strong>{emailSettings?.from || 'Nick Flanagan <nickflanagan73@gmail.com>'}</strong>
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
  const [activeView, setActiveView] = useState('leads')
  const [activeContentTab, setActiveContentTab] = useState('overview')
  const [auth, setAuth] = useState(readSessionAuth)
  const [email, setEmail] = useState(() => readSessionAuth().user?.email || '')
  const [password, setPassword] = useState('')
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
      setMessage(`Connected as ${sessionUser?.email || 'super admin'}.`)
      const nextSession = { token, user: sessionUser || auth.user, expiresAt: auth.expiresAt || '' }
      setAuth((current) => ({ ...current, ...nextSession }))
      writeSessionAuth(nextSession)
    } catch (error) {
      if (error.status === 401) {
        setMode('locked')
        setUnlocked(false)
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

  const removeArrayItem = (arrayName, index) => {
    setDraft((current) => ({
      ...current,
      [arrayName]: current[arrayName].filter((_, itemIndex) => itemIndex !== index),
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
        body: { email, password },
      })
      const nextAuth = {
        token: payload.token,
        user: payload.user,
        expiresAt: payload.expiresAt,
      }
      setAuth(nextAuth)
      writeSessionAuth(nextAuth)
      setPassword('')
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
    setPassword('')
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
            <small>
              {mode === 'server'
                ? auth.user?.email || 'Production'
                : mode === 'setup'
                  ? 'Setup needed'
                  : 'Local'}
            </small>
          </div>
        </div>

        <nav className="admin-main-tabs" aria-label="Admin sections">
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
              <strong>{emailSettings?.from || 'Nick Flanagan <nickflanagan73@gmail.com>'}</strong>
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
