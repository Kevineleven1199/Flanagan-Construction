import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileText,
  Home,
  Image,
  Lock,
  LogOut,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
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

const statusOptions = ['Started', 'New', 'Contacted', 'Estimate Scheduled', 'Proposal Sent', 'Won', 'Lost']
const priorityOptions = ['Hot', 'Warm', 'Normal', 'Low']
const contentTabs = [
  { id: 'overview', label: 'Homepage', icon: Home },
  { id: 'services', label: 'Services', icon: FileText },
  { id: 'photos', label: 'Photos', icon: Image },
  { id: 'reviews', label: 'Reviews & FAQ', icon: Sparkles },
]

function readSessionPasscode() {
  try {
    return window.sessionStorage.getItem(ADMIN_SESSION_KEY) || ''
  } catch {
    return ''
  }
}

function writeSessionPasscode(passcode) {
  try {
    if (passcode) window.sessionStorage.setItem(ADMIN_SESSION_KEY, passcode)
    else window.sessionStorage.removeItem(ADMIN_SESSION_KEY)
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

async function adminRequest(path, { method = 'GET', passcode = '', body } = {}) {
  const headers = { Accept: 'application/json' }
  if (passcode) headers.Authorization = `Bearer ${passcode}`
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

function AdminLogin({ passcode, setPasscode, loading, message, onSubmit, goHome }) {
  return (
    <main className="admin-auth">
      <form className="admin-auth-panel" onSubmit={onSubmit}>
        <span className="admin-auth-icon">
          <Lock size={24} aria-hidden="true" />
        </span>
        <h1>Flanagan Admin</h1>
        <label>
          Admin passcode
          <input
            type="password"
            value={passcode}
            autoComplete="current-password"
            onChange={(event) => setPasscode(event.target.value)}
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

function LeadDetail({ lead, updateLead }) {
  const [notes, setNotes] = useState(lead?.notes || '')
  const [nextStep, setNextStep] = useState(lead?.nextStep || '')

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
    })
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
            <a href={`mailto:${lead.email}`}>
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

function exportCsv(leads) {
  const headers = ['Name', 'Phone', 'Email', 'Project', 'Budget', 'Timeline', 'Status', 'Priority', 'Next Step', 'Notes', 'Received']
  const rows = leads.map((lead) => [
    lead.name,
    lead.phone,
    lead.email,
    lead.projectType,
    lead.budget,
    lead.timeline,
    lead.status,
    lead.priority,
    lead.nextStep,
    lead.notes,
    lead.receivedAt,
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
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
  const [passcode, setPasscode] = useState(readSessionPasscode)
  const [mode, setMode] = useState('checking')
  const [unlocked, setUnlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [leads, setLeads] = useState([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [draft, setDraft] = useState(() => cloneSiteContent(content))
  const [savingContent, setSavingContent] = useState(false)

  const loadAdminData = async (code = passcode) => {
    setLoading(true)
    setMessage('')

    try {
      const [leadPayload, contentPayload] = await Promise.all([
        adminRequest('/api/admin/leads', { passcode: code }),
        adminRequest('/api/admin/content', { passcode: code }),
      ])
      const nextLeads = (leadPayload.leads || []).map(normalizeLead)
      const nextContent = mergeSiteContent(defaultSiteContent, contentPayload.content || {})
      setLeads(nextLeads)
      setDraft(nextContent)
      setContent(nextContent)
      saveStoredContent(nextContent)
      setMode('server')
      setUnlocked(true)
      setMessage('Connected to production admin.')
      writeSessionPasscode(code)
    } catch (error) {
      if (error.status === 401) {
        setMode('locked')
        setUnlocked(false)
        setMessage('Enter the admin passcode.')
      } else if (error.status === 503) {
        setMode('setup')
        setUnlocked(true)
        setLeads(loadStoredLeads())
        setMessage(error.message || 'Set ADMIN_PASSWORD on the server to save production changes.')
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
    loadAdminData(passcode)
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
        passcode,
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

  const saveContent = async () => {
    const nextContent = mergeSiteContent(defaultSiteContent, draft)
    setSavingContent(true)
    setMessage('')

    try {
      if (mode === 'server') {
        await adminRequest('/api/admin/content', {
          method: 'PUT',
          passcode,
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
          passcode,
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

  const handleLogin = (event) => {
    event.preventDefault()
    loadAdminData(passcode)
  }

  const signOut = () => {
    writeSessionPasscode('')
    setPasscode('')
    setUnlocked(false)
    setMode('locked')
    setMessage('Signed out.')
  }

  if (!unlocked) {
    return (
      <AdminLogin
        passcode={passcode}
        setPasscode={setPasscode}
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
            <small>{mode === 'server' ? 'Production' : mode === 'setup' ? 'Setup needed' : 'Local'}</small>
          </div>
        </div>

        <nav className="admin-main-tabs" aria-label="Admin sections">
          <button className={activeView === 'leads' ? 'active' : ''} type="button" onClick={() => setActiveView('leads')}>
            <Users size={17} aria-hidden="true" />
            Leads
          </button>
          <button className={activeView === 'content' ? 'active' : ''} type="button" onClick={() => setActiveView('content')}>
            <Edit3 size={17} aria-hidden="true" />
            Site editor
          </button>
        </nav>

        <div className="admin-topbar-actions">
          <button type="button" onClick={() => loadAdminData(passcode)}>
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

            <LeadDetail key={activeSelectedLeadId || 'empty-lead'} lead={selectedLead} updateLead={updateLead} />
          </div>
        </section>
      ) : (
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
            </div>
            <ContentPreview draft={draft} />
          </div>
        </section>
      )}
    </main>
  )
}

export default AdminDashboard
