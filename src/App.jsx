import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Bath,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Hammer,
  Home,
  Mail,
  Menu,
  Phone,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import AdminDashboard from './AdminDashboard'
import { defaultSiteContent } from './content'
import {
  cssUrl,
  fetchPublishedContent,
  loadStoredContent,
  makeLeadId,
  mergeSiteContent,
  normalizeLead,
  saveStoredContent,
  saveStoredLeads,
} from './siteContent'
import './App.css'

// Best-effort analytics: pushes events to a GTM/GA4-style dataLayer if one
// exists. No-ops (and never throws) until a tag manager is installed.
function track(event, data = {}) {
  try {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event, ...data })
  } catch {
    // analytics must never break the page
  }
}

const phoneHrefFor = (phone) => `tel:${String(phone || '').replace(/\D/g, '')}`

const icons = [Bath, Hammer, Home]

const heroCredibilityIcons = [ShieldCheck, ClipboardCheck, Clock3]
const quickBandIcons = [Clock3, ShieldCheck, ClipboardCheck]
const splashServices = ['Kitchens & baths', 'Concrete work', 'Roofing & siding']

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function googleMapsApiKey() {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || window.__GOOGLE_MAPS_API_KEY__ || ''
}

function loadGooglePlaces() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.google?.maps?.places?.Autocomplete) return Promise.resolve(true)
  if (window.__flanaganGooglePlacesPromise) return window.__flanaganGooglePlacesPromise

  const key = googleMapsApiKey()
  if (!key) return Promise.resolve(false)

  window.__flanaganGooglePlacesPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[data-flanagan-google-places="true"]')
    const finish = () => resolve(Boolean(window.google?.maps?.places?.Autocomplete))

    if (existing) {
      existing.addEventListener('load', finish, { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })
      return
    }

    const script = document.createElement('script')
    script.async = true
    script.defer = true
    script.dataset.flanaganGooglePlaces = 'true'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&libraries=places`
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', () => resolve(false), { once: true })
    document.head.appendChild(script)
  })

  return window.__flanaganGooglePlacesPromise
}

function addressComponent(place, type, useShortName = false) {
  const component = place?.address_components?.find((item) => item.types?.includes(type))
  if (!component) return ''
  return useShortName ? component.short_name || component.long_name || '' : component.long_name || component.short_name || ''
}

function SplashIntro({ business, heroImage, onDone }) {
  return (
    <div className="splash-intro" role="status" aria-live="polite">
      <div className="splash-photo" style={{ '--splash-photo': cssUrl(heroImage) }} aria-hidden="true"></div>
      <div className="splash-card">
        <span className="brand-mark splash-mark">
          <Hammer size={30} aria-hidden="true" />
        </span>
        <p>New Castle County</p>
        <h2>{business.name}</h2>
        <div className="splash-service-track" aria-label="Main work">
          {splashServices.map((service) => (
            <span key={service}>{service}</span>
          ))}
        </div>
        <div className="splash-progress" aria-hidden="true">
          <span></span>
        </div>
      </div>
      <button className="splash-skip" type="button" onClick={onDone}>
        Skip
      </button>
    </div>
  )
}

function LeadPanel({
  business,
  estimateContent,
  leadFunnel,
  form,
  handleChange,
  handleSubmit,
  status,
  submitting,
  submitted,
  onReset,
  selectedNeeds,
  toggleNeed,
  draftSaving,
  lastSavedAt,
  onAddressSelect = () => {},
}) {
  const addressInputRef = useRef(null)
  const [addressAssist, setAddressAssist] = useState('manual')
  const simpleNeeds = leadFunnel.simpleNeeds?.length
    ? leadFunnel.simpleNeeds
    : [...new Set(leadFunnel.groups.flatMap((group) => group.needs))].slice(0, 14)

  useEffect(() => {
    let autocomplete
    let listener
    let cancelled = false

    loadGooglePlaces().then((ready) => {
      if (cancelled) return
      const input = addressInputRef.current
      if (!ready || !input || !window.google?.maps?.places?.Autocomplete) {
        setAddressAssist('manual')
        return
      }

      const bounds = new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(39.29, -75.84),
        new window.google.maps.LatLng(39.84, -75.35),
      )

      autocomplete = new window.google.maps.places.Autocomplete(input, {
        bounds,
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'place_id', 'geometry', 'address_components'],
        strictBounds: false,
        types: ['address'],
      })

      listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        const location = place?.geometry?.location
        onAddressSelect({
          address: place?.formatted_address || input.value,
          addressPlaceId: place?.place_id || '',
          addressLat: location?.lat ? String(location.lat()) : '',
          addressLng: location?.lng ? String(location.lng()) : '',
          addressCity:
            addressComponent(place, 'locality') ||
            addressComponent(place, 'postal_town') ||
            addressComponent(place, 'sublocality_level_1'),
          addressState: addressComponent(place, 'administrative_area_level_1', true),
          addressPostalCode: addressComponent(place, 'postal_code'),
        })
      })

      setAddressAssist('google')
    })

    return () => {
      cancelled = true
      if (listener?.remove) listener.remove()
      if (autocomplete) window.google?.maps?.event?.clearInstanceListeners?.(autocomplete)
    }
  }, [onAddressSelect])

  if (submitted) {
    const firstName = form.name ? form.name.trim().split(' ')[0] : ''
    return (
    <aside className="lead-panel lead-success" id="estimate" aria-label="Request received" data-reveal="lift">
        <div className="panel-heading">
          <span>
            <CheckCircle2 size={20} aria-hidden="true" />
          </span>
          <div>
            <h2>{estimateContent.successTitle}</h2>
            <p>Thanks{firstName ? `, ${firstName}` : ''}! {estimateContent.successCopy}</p>
          </div>
        </div>
        <ul className="success-steps">
          <li>
            <CheckCircle2 size={16} aria-hidden="true" />
            We review your project details.
          </li>
          <li>
            <CheckCircle2 size={16} aria-hidden="true" />
            We call or email to confirm scope and timeline.
          </li>
          <li>
            <CheckCircle2 size={16} aria-hidden="true" />
            You get a clear written estimate before any demo.
          </li>
        </ul>
        <div className="success-actions">
          <a className="primary-action" href={phoneHrefFor(business.phone)}>
            <Phone size={18} aria-hidden="true" />
            Call now
          </a>
          <button className="secondary-action button-link" type="button" onClick={onReset}>
            Send another request
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="lead-panel" id="estimate" aria-label="Request an estimate" data-reveal="lift">
      <div className="panel-heading">
        <span>
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div>
          <h2>{estimateContent.formTitle}</h2>
          <p>{estimateContent.formCopy}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="hp-field" aria-hidden="true">
          <label>
            Company
            <input
              name="company"
              value={form.company}
              onChange={handleChange}
              tabIndex="-1"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="field-grid">
          <label>
            Phone
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              autoComplete="tel"
              inputMode="tel"
              required
            />
          </label>
          <label>
            Email
            <input name="email" type="email" value={form.email} onChange={handleChange} autoComplete="email" required />
          </label>
        </div>

        <label>
          Name
          <input name="name" value={form.name} onChange={handleChange} autoComplete="name" required />
        </label>

        <label className="address-field">
          Project address
          <input
            ref={addressInputRef}
            name="address"
            value={form.address}
            onChange={(event) => {
              handleChange(event)
              if (form.addressPlaceId || form.addressLat || form.addressLng) {
                onAddressSelect({
                  addressPlaceId: '',
                  addressLat: '',
                  addressLng: '',
                  addressCity: '',
                  addressState: '',
                  addressPostalCode: '',
                })
              }
            }}
            autoComplete="street-address"
            placeholder="Start typing the job address"
            required
          />
          <span className="address-helper">
            {addressAssist === 'google'
              ? 'Pick the matching address when it appears.'
              : 'Type the job address so we know where to schedule.'}
          </span>
        </label>

        <div className="funnel-save-note" aria-live="polite">
          <CheckCircle2 size={16} aria-hidden="true" />
          {draftSaving
            ? 'Saving your started request...'
            : lastSavedAt
              ? `Started request saved at ${lastSavedAt}`
              : leadFunnel.contactNudge}
        </div>

        <fieldset className="funnel-needs">
          <legend>What do you want help with?</legend>
          <div className="need-chip-grid">
            {simpleNeeds.map((need) => {
              const selected = selectedNeeds.includes(need)
              return (
                <button
                  className={selected ? 'need-chip active' : 'need-chip'}
                  key={need}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleNeed(need)}
                >
                  {selected ? <CheckCircle2 size={16} aria-hidden="true" /> : <span aria-hidden="true">+</span>}
                  {need}
                </button>
              )
            })}
          </div>
        </fieldset>

        {selectedNeeds.length ? (
          <div className="selected-needs-box">
            <strong>Selected work</strong>
            <div>
              {selectedNeeds.map((need) => (
                <button key={need} type="button" onClick={() => toggleNeed(need)}>
                  {need}
                  <X size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label>
          Anything else? Photos can come later.
          <textarea
            name="message"
            value={form.message}
            onChange={handleChange}
            rows="3"
            placeholder="Example: kitchen estimate, sidewalk repair, roof leak, new windows."
          />
        </label>

        <button className="submit-button" type="submit" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send project request'}
          <Mail size={18} aria-hidden="true" />
        </button>
        <p className="form-note" aria-live="polite">
          {status || estimateContent.formNote}
        </p>
      </form>
    </aside>
  )
}

function SiteHeader({ business, menuOpen, goHome, goSection, setMenuOpen }) {
  const phoneHref = phoneHrefFor(business.phone)

  return (
    <header className="site-header">
      <a
        className="brand"
        href="/"
        aria-label="Flanagan Construction home"
        onClick={(event) => {
          event.preventDefault()
          goHome()
        }}
      >
        <span className="brand-mark">
          <Hammer size={20} aria-hidden="true" />
        </span>
        <span>
          <strong>{business.name}</strong>
          <small>{business.location}</small>
        </span>
      </a>

      <nav className={menuOpen ? 'nav open' : 'nav'} aria-label="Primary navigation">
        <a
          href="#services"
          onClick={(event) => {
            event.preventDefault()
            goSection('services')
          }}
        >
          Work
        </a>
        <a className="nav-call" href={phoneHref} onClick={() => track('phone_click', { location: 'header' })}>
          <Phone size={16} aria-hidden="true" />
          Call
        </a>
        <a
          className="nav-cta"
          href="#estimate"
          onClick={(event) => {
            event.preventDefault()
            goSection('estimate')
          }}
        >
          Free estimate
        </a>
      </nav>

      <button
        className="menu-button"
        type="button"
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
      </button>
    </header>
  )
}

function SimpleServicesSection({ business, gallery, goSection, quickBand, services, servicesIntro }) {
  const topServices = services.slice(0, 3)
  const galleryItems = gallery.items.slice(0, 3)

  return (
    <section className="simple-services" id="services" aria-label="Main services">
      <div className="simple-services-head" data-reveal="lift">
        <div>
          <p className="eyebrow">{servicesIntro.eyebrow}</p>
          <h2>{servicesIntro.title}</h2>
        </div>
        <p>{servicesIntro.copy || gallery.copy}</p>
      </div>

      <div className="simple-service-grid">
        {topServices.map((service, index) => {
          const Icon = icons[index] || Hammer
          const image = galleryItems[index]?.image || galleryItems[0]?.image
          return (
            <article className="simple-service-card" key={service.title} data-reveal="card" style={{ '--reveal-order': index }}>
              <div className="simple-service-photo" style={{ backgroundImage: cssUrl(image) }}></div>
              <div>
                <span className="service-icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3>{service.title.replace(/^#\d+\s*/, '')}</h3>
                <p>{service.copy}</p>
              </div>
            </article>
          )
        })}
      </div>

      <div className="simple-proof-row" data-reveal="lift">
        {quickBand.map((item, index) => {
          const Icon = quickBandIcons[index] || CheckCircle2
          return (
            <span key={item}>
              <Icon size={17} aria-hidden="true" />
              {item}
            </span>
          )
        })}
      </div>

      <div className="simple-close" data-reveal="lift">
        <div>
          <strong>Serving New Castle County</strong>
          <p>{business.serviceArea}</p>
        </div>
        <button className="primary-action button-link" type="button" onClick={() => goSection('estimate')}>
          Start my request
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}

function HomePage({
  content,
  form,
  handleChange,
  handleSubmit,
  status,
  submitting,
  submitted,
  onReset,
  goSection,
  selectedNeeds,
  toggleNeed,
  draftSaving,
  lastSavedAt,
  onAddressSelect,
}) {
  const {
    business,
    estimate,
    gallery,
    hero,
    heroCredibility,
    images,
    leadFunnel,
    quickBand,
    services,
    servicesIntro,
  } = content

  return (
    <>
      <section id="top" className="hero-section simple-home-hero" style={{ '--hero-photo': cssUrl(images.hero) }}>
        <div className="hero-inner">
          <p className="hero-eyebrow">
            <span className="eyebrow-rule" aria-hidden="true"></span>
            {hero.eyebrow}
            <span className="eyebrow-rule" aria-hidden="true"></span>
          </p>
          <h1>
            {hero.titlePrefix}{' '}
            <span className="hl">
              {hero.highlight}
              <svg className="swoosh" viewBox="0 0 320 26" preserveAspectRatio="none" aria-hidden="true">
                <path d="M6 18 Q 160 30 314 9" stroke="#f2b84b" strokeWidth="6" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="hero-lede">{hero.lede}</p>
          <div className="hero-actions">
            <a
              className="primary-action"
              href="#estimate"
              onClick={(event) => {
                event.preventDefault()
                goSection('estimate')
              }}
            >
              {hero.primaryCta}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a
              className="secondary-action"
              href="#services"
              onClick={(event) => {
                event.preventDefault()
                goSection('services')
              }}
            >
            {hero.secondaryCta}
          </a>
        </div>
          <div className="hero-tech-strip" aria-label="Why homeowners start here">
            {heroCredibility.map((label, index) => {
              const Icon = heroCredibilityIcons[index] || ShieldCheck
              return (
                <span key={label}>
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </span>
              )
            })}
          </div>
        </div>

        <LeadPanel
          business={business}
          estimateContent={estimate}
          leadFunnel={leadFunnel}
          form={form}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          status={status}
          submitting={submitting}
          submitted={submitted}
          onReset={onReset}
          selectedNeeds={selectedNeeds}
          toggleNeed={toggleNeed}
          draftSaving={draftSaving}
          lastSavedAt={lastSavedAt}
          onAddressSelect={onAddressSelect}
        />
      </section>

      <SimpleServicesSection
        business={business}
        gallery={gallery}
        goSection={goSection}
        quickBand={quickBand}
        services={services}
        servicesIntro={servicesIntro}
      />
    </>
  )
}

function SiteFooter({ business, services, goSection }) {
  const year = new Date().getFullYear()
  const phoneHref = phoneHrefFor(business.phone)
  const topServices = services.slice(0, 3)
  const jump = (id) => (event) => {
    event.preventDefault()
    goSection(id)
  }
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <span className="brand-mark">
            <Hammer size={20} aria-hidden="true" />
          </span>
          <strong>{business.name}</strong>
          <p>{business.serviceArea}</p>
        </div>

        <nav className="footer-col" aria-label="Services">
          <h3>Services</h3>
          {topServices.map((service) => (
            <a key={service.title} href="#services" onClick={jump('services')}>
              {service.title.replace(/^#\d+\s*/, '')}
            </a>
          ))}
        </nav>

        <nav className="footer-col" aria-label="Company">
          <h3>Start</h3>
          <a href="#estimate" onClick={jump('estimate')}>
            Free estimate
          </a>
          <a href={phoneHref} onClick={() => track('phone_click', { location: 'footer_quick' })}>
            Call now
          </a>
        </nav>

        <div className="footer-col footer-contact">
          <h3>Contact</h3>
          <a href={phoneHref} onClick={() => track('phone_click', { location: 'footer' })}>
            {business.phone}
          </a>
          <a href={`mailto:${business.email}`}>{business.email}</a>
          <p>Mon-Fri, 8am-5pm</p>
          <p className="footer-badge">
            <ShieldCheck size={14} aria-hidden="true" />
            Licensed &amp; insured
          </p>
        </div>
      </div>

      <div className="footer-bottom">
        <span>
          Copyright {year} {business.name}. {business.location}.
        </span>
        <span>Home remodeling, concrete, roofing, siding, and windows</span>
      </div>
    </footer>
  )
}

function App() {
  const [siteContent, setSiteContent] = useState(() => mergeSiteContent(defaultSiteContent, loadStoredContent()))
  const [routePath, setRoutePath] = useState(() => window.location.pathname)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSplash, setShowSplash] = useState(() => {
    if (window.location.pathname.startsWith('/admin')) return false
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.has('splash')) return true
      if (prefersReducedMotion()) return false
      return !window.sessionStorage.getItem('flanagan-splash-seen')
    } catch {
      return !prefersReducedMotion()
    }
  })
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    addressPlaceId: '',
    addressLat: '',
    addressLng: '',
    addressCity: '',
    addressState: '',
    addressPostalCode: '',
    projectType: 'Project',
    budget: 'Not sure yet',
    timeline: 'Not sure yet',
    message: '',
    company: '',
  })
  const [selectedGroupId, setSelectedGroupId] = useState(defaultSiteContent.leadFunnel.groups[0].id)
  const [selectedNeeds, setSelectedNeeds] = useState([])
  const [draftSaving, setDraftSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState('')
  const leadIdRef = useRef(makeLeadId({ createdAt: new Date().toISOString(), source: 'funnel' }))
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const business = siteContent.business
  const phoneHref = phoneHrefFor(business.phone)

  const dismissSplash = useCallback(() => {
    try {
      window.sessionStorage.setItem('flanagan-splash-seen', 'true')
    } catch {
      // Session storage is optional; animation can still dismiss normally.
    }
    setShowSplash(false)
  }, [])

  useEffect(() => {
    let ignore = false
    fetchPublishedContent()
      .then((publishedContent) => {
        if (ignore) return
        setSiteContent(publishedContent)
        saveStoredContent(publishedContent)
      })
      .catch(() => {
        // Static hosting or local Vite dev can run without the production API.
      })

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!showSplash) return undefined
    const timeout = window.setTimeout(dismissSplash, 2700)
    return () => window.clearTimeout(timeout)
  }, [dismissSplash, showSplash])

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('motion-ready')

    const revealItems = [...document.querySelectorAll('[data-reveal]')]
    if (!revealItems.length) return undefined

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      revealItems.forEach((item) => item.classList.add('is-visible'))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.14 },
    )

    revealItems.forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [routePath, siteContent.contentVersion, showSplash])

  useEffect(() => {
    const handleRoute = () => setRoutePath(window.location.pathname)
    window.addEventListener('popstate', handleRoute)
    return () => window.removeEventListener('popstate', handleRoute)
  }, [])

  const mailtoLink = useMemo(() => {
    const subject = encodeURIComponent(`New project request from ${form.name || 'website lead'}`)
    const body = encodeURIComponent(
      [
        `Name: ${form.name}`,
        `Phone: ${form.phone}`,
        `Email: ${form.email}`,
        `Address: ${form.address}`,
        `Project type: ${selectedNeeds.length ? selectedNeeds.join(', ') : 'Not selected yet'}`,
        '',
        'Project details:',
        form.message,
      ].join('\n'),
    )

    return `mailto:${business.email}?subject=${subject}&body=${body}`
  }, [business.email, form, selectedNeeds])

  const goHome = () => {
    setMenuOpen(false)
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/')
      setRoutePath('/')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goSection = (id) => {
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleAddressSelect = useCallback((addressData) => {
    setForm((current) => ({ ...current, ...addressData }))
  }, [])

  const toggleNeed = (need) => {
    const matchingGroup = siteContent.leadFunnel.groups.find((group) => group.needs.includes(need))
    if (matchingGroup) setSelectedGroupId(matchingGroup.id)
    setSelectedNeeds((current) =>
      current.includes(need) ? current.filter((item) => item !== need) : [...current, need],
    )
  }

  const leadPayload = (statusOverride = 'Started') => {
    const activeGroup =
      siteContent.leadFunnel.groups.find((group) => group.id === selectedGroupId) ||
      siteContent.leadFunnel.groups[0]
    const projectType = selectedNeeds.length ? selectedNeeds.join(', ') : activeGroup.label
    const summaryLines = [
      selectedNeeds.length ? `Selected needs: ${selectedNeeds.join(', ')}` : `Selected lane: ${activeGroup.label}`,
      form.address ? `Project address: ${form.address}` : '',
      form.message ? `Notes: ${form.message}` : '',
    ].filter(Boolean)

    return {
      ...form,
      id: leadIdRef.current,
      leadId: leadIdRef.current,
      leadKind: statusOverride === 'Started' ? 'Started funnel' : 'Final request',
      funnelGroup: activeGroup.label,
      selectedNeeds,
      projectType,
      message: summaryLines.join('\n'),
      status: statusOverride,
      priority: selectedNeeds.some((need) => /fix|bad|commercial|addition|foundation/i.test(need))
        ? 'Hot'
        : 'Warm',
    }
  }

  const saveLocalLeadBackup = (lead) => {
    try {
      const leads = JSON.parse(window.localStorage.getItem('flanagan-leads') || '[]').map(normalizeLead)
      const nextLead = normalizeLead({
        ...lead,
        createdAt: lead.createdAt || new Date().toISOString(),
        receivedAt: lead.receivedAt || new Date().toISOString(),
      })
      const deduped = [nextLead, ...leads.filter((item) => item.id !== nextLead.id)]
      saveStoredLeads(deduped.slice(0, 200))
    } catch {
      // localStorage can be unavailable in private mode; ignore.
    }
  }

  useEffect(() => {
    const hasPhone = form.phone.replace(/\D/g, '').length >= 7
    const hasEmail = /\S+@\S+\.\S+/.test(form.email)
    if (submitted || form.company || (!hasPhone && !hasEmail)) return

    const timeout = window.setTimeout(async () => {
      setDraftSaving(true)
      const draft = {
        ...leadPayload('Started'),
        receivedAt: new Date().toISOString(),
      }
      saveLocalLeadBackup(draft)

      try {
        await fetch('/api/lead-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        })
      } catch {
        // Static hosting can still keep the local backup.
      } finally {
        setLastSavedAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
        setDraftSaving(false)
      }
    }, 800)

    return () => {
      window.clearTimeout(timeout)
    }
  // leadPayload reads the same fields listed here; keeping the dependency list
  // explicit prevents the autosave timer from resetting on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.name,
    form.phone,
    form.email,
    form.address,
    form.addressPlaceId,
    form.addressLat,
    form.addressLng,
    form.addressCity,
    form.addressState,
    form.addressPostalCode,
    form.budget,
    form.timeline,
    form.message,
    form.company,
    selectedGroupId,
    selectedNeeds,
    submitted,
  ])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setStatus('Sending your request...')

    // Keep a local backup so a lead is never lost to a flaky network.
    const finalLead = {
      ...leadPayload('New'),
      receivedAt: new Date().toISOString(),
    }
    saveLocalLeadBackup(finalLead)

    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalLead),
      })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      setSubmitted(true)
      setStatus('Request received. We will reach out within one business day.')
      track('generate_lead', { projectType: finalLead.projectType, budget: form.budget })
      window.setTimeout(() => {
        document.getElementById('estimate')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 60)
    } catch {
      // Static hosting (e.g. GitHub Pages) has no API, so fall back to email.
      setStatus('Opening your email app so you can send the request directly...')
      window.location.href = mailtoLink
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setSubmitted(false)
    setStatus('')
    setSelectedGroupId(defaultSiteContent.leadFunnel.groups[0].id)
    setSelectedNeeds([])
    setLastSavedAt('')
    leadIdRef.current = makeLeadId({ createdAt: new Date().toISOString(), source: 'funnel' })
    setForm({
      name: '',
      phone: '',
      email: '',
      address: '',
      addressPlaceId: '',
      addressLat: '',
      addressLng: '',
      addressCity: '',
      addressState: '',
      addressPostalCode: '',
      projectType: 'Project',
      budget: 'Not sure yet',
      timeline: 'Not sure yet',
      message: '',
      company: '',
    })
  }

  if (routePath.startsWith('/admin')) {
    return <AdminDashboard content={siteContent} setContent={setSiteContent} goHome={goHome} />
  }

  return (
    <main>
      {showSplash ? (
        <SplashIntro business={business} heroImage={siteContent.images.hero} onDone={dismissSplash} />
      ) : null}
      <a className="skip-link" href="#top">
        Skip to content
      </a>
      <SiteHeader
        business={business}
        menuOpen={menuOpen}
        goHome={goHome}
        goSection={goSection}
        setMenuOpen={setMenuOpen}
      />

      <HomePage
        content={siteContent}
        form={form}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        status={status}
        submitting={submitting}
        submitted={submitted}
        onReset={resetForm}
        goSection={goSection}
        selectedNeeds={selectedNeeds}
        toggleNeed={toggleNeed}
        draftSaving={draftSaving}
        lastSavedAt={lastSavedAt}
        onAddressSelect={handleAddressSelect}
      />

      <SiteFooter business={business} services={siteContent.services} goSection={goSection} />

      <div className="mobile-cta" aria-label="Quick contact">
        <a
          className="mobile-cta-call"
          href={phoneHref}
          onClick={() => track('phone_click', { location: 'mobile_bar' })}
        >
          <Phone size={18} aria-hidden="true" />
          Call
        </a>
        <button className="mobile-cta-quote" type="button" onClick={() => goSection('estimate')}>
          {siteContent.cta.primaryCta}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </main>
  )
}

export default App
