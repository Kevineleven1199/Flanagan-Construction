import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Image,
  MapPin,
  Mail,
  Menu,
  Phone,
  ShieldCheck,
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
    if (typeof window.gtag === 'function') {
      window.gtag('event', event, data)
    }
  } catch {
    // analytics must never break the page
  }
}

function cleanTrackingId(value) {
  return String(value || '').trim()
}

function loadTrackingScript(id, src) {
  if (typeof document === 'undefined' || !id || !src) return
  if (document.getElementById(id)) return
  const script = document.createElement('script')
  script.id = id
  script.async = true
  script.src = src
  document.head.appendChild(script)
}

function configureGoogleTracking(integrations = {}) {
  if (typeof window === 'undefined') return

  const gtmId = cleanTrackingId(integrations.gtmContainerId)
  if (gtmId) {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    loadTrackingScript(
      'flanagan-gtm',
      `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`,
    )
  }

  const tagIds = [
    cleanTrackingId(integrations.ga4MeasurementId),
    cleanTrackingId(integrations.googleAdsConversionId),
  ].filter(Boolean)
  if (!tagIds.length) return

  window.dataLayer = window.dataLayer || []
  window.gtag =
    window.gtag ||
    function gtag(...args) {
      window.dataLayer.push(args)
    }

  loadTrackingScript(
    'flanagan-gtag',
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagIds[0])}`,
  )
  window.gtag('js', new Date())
  tagIds.forEach((tagId) => window.gtag('config', tagId))
}

function sendLeadConversion(integrations = {}, lead = {}) {
  const conversionId = cleanTrackingId(integrations.googleAdsConversionId)
  const conversionLabel = cleanTrackingId(integrations.googleAdsLeadConversionLabel)
  track('generate_lead', {
    projectType: lead.projectType,
    service_area: lead.addressCity || 'New Castle County',
  })
  if (!conversionId || !conversionLabel || typeof window.gtag !== 'function') return
  window.gtag('event', 'conversion', {
    send_to: `${conversionId}/${conversionLabel}`,
    value: 1.0,
    currency: 'USD',
  })
}

function setMetaAttribute(selector, attribute, value) {
  if (typeof document === 'undefined' || !value) return
  const element = document.head.querySelector(selector)
  if (element) element.setAttribute(attribute, value)
}

function setCanonicalUrl(value) {
  if (typeof document === 'undefined' || !value) return
  const element = document.head.querySelector('link[rel="canonical"]')
  if (element) element.setAttribute('href', value)
}

function normalizePathname(routePath = '/') {
  const path = String(routePath || '/').split('?')[0].replace(/^\/+/, '').replace(/\/+$/, '')
  return path || ''
}

function serviceLandingPages(content = defaultSiteContent) {
  return content.localSeo?.servicePages?.length
    ? content.localSeo.servicePages
    : defaultSiteContent.localSeo.servicePages
}

function findServiceLandingPage(content = defaultSiteContent, routePath = '/') {
  const slug = normalizePathname(routePath)
  if (!slug || slug === 'admin' || slug === 'our-work') return null
  return serviceLandingPages(content).find((page) => page.slug === slug) || null
}

function setManagedJsonLd(data) {
  if (typeof document === 'undefined') return
  const id = 'flanagan-managed-jsonld'
  let script = document.getElementById(id)
  if (!data) {
    script?.remove()
    return
  }
  if (!script) {
    script = document.createElement('script')
    script.id = id
    script.type = 'application/ld+json'
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(data)
}

function applyManagedStructuredData(content, routePath, pageUrl, title, description) {
  if (typeof document === 'undefined') return
  if (routePath.startsWith('/admin')) {
    setManagedJsonLd(null)
    return
  }

  const baseUrl = 'https://flanaganconstructionde.com'
  const activeServicePage = findServiceLandingPage(content, routePath)
  const business = content.business || defaultSiteContent.business
  const locations = content.serviceLocations?.places?.length
    ? content.serviceLocations.places
    : defaultSiteContent.serviceLocations.places
  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${baseUrl}/#website`,
      url: `${baseUrl}/`,
      name: business.name,
      inLanguage: 'en-US',
      publisher: { '@id': `${baseUrl}/#business` },
    },
    {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: title,
      description,
      inLanguage: 'en-US',
      isPartOf: { '@id': `${baseUrl}/#website` },
      about: { '@id': `${baseUrl}/#business` },
      primaryImageOfPage: content.seo?.ogImage || defaultSiteContent.seo.ogImage,
    },
  ]

  if (activeServicePage) {
    graph.push(
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumbs`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: activeServicePage.serviceType, item: pageUrl },
        ],
      },
      {
        '@type': 'Service',
        '@id': `${pageUrl}#service`,
        name: activeServicePage.serviceType,
        serviceType: activeServicePage.serviceType,
        description: activeServicePage.summary || description,
        provider: { '@id': `${baseUrl}/#business` },
        areaServed: [
          { '@type': 'AdministrativeArea', name: 'New Castle County, Delaware' },
          ...(activeServicePage.focusTowns || locations.slice(0, 8)).map((name) => ({
            '@type': 'City',
            name: `${name}, Delaware`,
          })),
        ],
        offers: {
          '@type': 'Offer',
          availability: 'https://schema.org/InStock',
          price: '0',
          priceCurrency: 'USD',
          description: 'Free estimate request',
          url: pageUrl,
        },
      },
    )
  } else {
    graph.push({
      '@type': 'ItemList',
      '@id': `${pageUrl}#top-services`,
      name: 'Top New Castle County remodeling services',
      itemListElement: (content.localSeo?.priorityServices || defaultSiteContent.localSeo.priorityServices).map(
        (service, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: service.title,
          url: `${baseUrl}/${service.slug}`,
        }),
      ),
    })
  }

  setManagedJsonLd({ '@context': 'https://schema.org', '@graph': graph })
}

function applyDocumentSeo(content = defaultSiteContent, routePath = '/') {
  const seo = content.seo || defaultSiteContent.seo
  const baseUrl = 'https://flanaganconstructionde.com'
  const isAdmin = routePath.startsWith('/admin')
  const isWork = routePath.startsWith('/our-work')
  const activeServicePage = findServiceLandingPage(content, routePath)
  const title = isAdmin
    ? 'Flanagan Admin'
    : activeServicePage
      ? activeServicePage.seoTitle
      : isWork
        ? seo.ourWorkTitle
        : seo.homeTitle
  const description = isAdmin
    ? 'Private Flanagan Construction admin dashboard.'
    : activeServicePage
      ? activeServicePage.seoDescription
      : isWork
        ? seo.ourWorkDescription
        : seo.homeDescription
  const path = activeServicePage ? `/${activeServicePage.slug}` : isWork ? '/our-work' : '/'
  const url = `${baseUrl}${path}`

  document.title = title
  setMetaAttribute('meta[name="description"]', 'content', description)
  setMetaAttribute('meta[name="keywords"]', 'content', seo.keywords || defaultSiteContent.seo.keywords)
  setMetaAttribute('meta[name="robots"]', 'content', isAdmin ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1')
  setMetaAttribute('meta[property="og:title"]', 'content', title)
  setMetaAttribute('meta[property="og:description"]', 'content', description)
  setMetaAttribute('meta[property="og:url"]', 'content', url)
  setMetaAttribute('meta[property="og:image"]', 'content', seo.ogImage || defaultSiteContent.seo.ogImage)
  setMetaAttribute('meta[name="twitter:title"]', 'content', title)
  setMetaAttribute('meta[name="twitter:description"]', 'content', description)
  setMetaAttribute('meta[name="twitter:image"]', 'content', seo.ogImage || defaultSiteContent.seo.ogImage)
  setCanonicalUrl(url)
  applyManagedStructuredData(content, routePath, url, title, description)
}

const phoneHrefFor = (phone) => `tel:${String(phone || '').replace(/\D/g, '')}`
const leadHoneypotFields = ['company', 'website', 'fax']

function hasLeadHoneypot(form) {
  return leadHoneypotFields.some((field) => String(form?.[field] || '').trim())
}

const splashServices = ['Kitchens & baths', 'Concrete work', 'Roofing & siding']
const heroPathSteps = ['Start request', 'Scope the work', 'Get a call back']
const projectVisuals = [
  {
    match: /kitchen|bath|tile|interior|paint|plumb|door|trim|window/i,
    image: 'https://images.unsplash.com/photo-1556912173-3bb406ef7e77?auto=format&fit=crop&w=900&q=84',
  },
  {
    match: /concrete|driveway|sidewalk|blacktop|paver|hardscape|patio|retaining|outdoor/i,
    image: 'https://images.pexels.com/photos/221027/pexels-photo-221027.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    match: /roof|siding|gutter|garage|exterior/i,
    image: 'https://images.pexels.com/photos/209274/pexels-photo-209274.jpeg?auto=compress&cs=tinysrgb&w=900',
  },
  {
    match: /deck|porch|fence|addition|foundation|build/i,
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=84',
  },
]
const brandVisual = '/brand-mark.svg'
const proofVisuals = [
  'https://images.unsplash.com/photo-1581092160607-ee22731c00f6?auto=format&fit=crop&w=500&q=82',
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=500&q=82',
  'https://images.unsplash.com/photo-1523413363574-c30aa1c2a516?auto=format&fit=crop&w=500&q=82',
]
const heroProjectCards = [
  {
    label: 'Kitchen & bath',
    detail: 'Tile, layout, plumbing, ventilation',
    image: projectVisuals[0].image,
  },
  {
    label: 'Concrete',
    detail: 'Driveways, sidewalks, pavers, patios',
    image: projectVisuals[1].image,
  },
  {
    label: 'Roof, siding, windows',
    detail: 'Exterior repairs that protect the house',
    image: projectVisuals[2].image,
  },
]
const serviceFocusConfigs = [
  {
    match: /kitchen|bath/i,
    label: 'Kitchen and bath fast lane',
    cta: 'Select kitchen/bath',
    submit: 'Send kitchen/bath request',
    needs: ['Kitchen', 'Bathroom'],
    note: 'Great for remodels, tile, layout fixes, ventilation, and repairs from old work.',
  },
  {
    match: /concrete|driveway|sidewalk|paver|patio/i,
    label: 'Concrete fast lane',
    cta: 'Select concrete',
    submit: 'Send concrete request',
    needs: ['Concrete'],
    note: 'Great for driveways, sidewalks, repairs, pavers, patios, drainage, and access notes.',
  },
  {
    match: /roof|siding|window|exterior/i,
    label: 'Exterior fast lane',
    cta: 'Select exterior work',
    submit: 'Send exterior request',
    needs: ['Roofing', 'Siding', 'Windows'],
    note: 'Great for roof leaks, siding, windows, doors, gutters, flashing, and exterior repairs.',
  },
]
const addressFallbackCities = [
  'Wilmington, DE',
  'Newark, DE',
  'New Castle, DE',
  'Middletown, DE',
  'Bear, DE',
  'Hockessin, DE',
  'Pike Creek, DE',
  'Claymont, DE',
  'Elsmere, DE',
  'Newport, DE',
  'Glasgow, DE',
  'Christiana, DE',
  'Delaware City, DE',
  'Townsend, DE',
  'Odessa, DE',
  'Wilmington Manor, DE',
]
const newCastleCountyPattern = /\b(new castle|wilmington|newark|middletown|bear|hockessin|pike creek|claymont|elsmere|newport|glasgow|christiana|delaware city|townsend|odessa|wilmington manor|de|delaware)\b/i

function visualForText(text, fallback = projectVisuals[0].image) {
  const visual = projectVisuals.find((item) => item.match.test(String(text || '')))
  return visual?.image || fallback
}

function serviceFocusForPage(activeServicePage) {
  if (!activeServicePage) return null
  const haystack = [
    activeServicePage.slug,
    activeServicePage.serviceType,
    activeServicePage.heroTitle,
    activeServicePage.heroLede,
  ].join(' ')
  return serviceFocusConfigs.find((config) => config.match.test(haystack)) || null
}

function orderNeedsForFocus(needs, focusNeeds = []) {
  const uniqueNeeds = [...new Set(needs)]
  const focus = focusNeeds.filter((need) => uniqueNeeds.includes(need))
  return [...focus, ...uniqueNeeds.filter((need) => !focus.includes(need))]
}

function leadTrackingFields(activeServicePage) {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search || '')
  const value = (key) => params.get(key) || ''
  return {
    sourcePath: window.location.pathname || '/',
    sourcePage: document.title || '',
    landingPage: activeServicePage?.slug || 'home',
    serviceRoute: activeServicePage?.serviceType || '',
    utmSource: value('utm_source'),
    utmMedium: value('utm_medium'),
    utmCampaign: value('utm_campaign'),
    utmTerm: value('utm_term'),
    utmContent: value('utm_content'),
    gclid: value('gclid'),
    gbraid: value('gbraid'),
    wbraid: value('wbraid'),
  }
}

function scoreLeadForFunnel(form, selectedNeeds = [], activeServicePage = null) {
  const text = [
    form?.message,
    form?.projectType,
    form?.address,
    activeServicePage?.serviceType,
    ...selectedNeeds,
  ].join(' ')
  const reasons = []
  let score = 24

  if (String(form?.phone || '').replace(/\D/g, '').length >= 7) {
    score += 16
    reasons.push('phone')
  }
  if (/\S+@\S+\.\S+/.test(String(form?.email || ''))) {
    score += 11
    reasons.push('email')
  }
  if (String(form?.name || '').trim()) score += 6
  if (String(form?.address || '').trim()) {
    score += 16
    reasons.push('address')
  }
  if (form?.addressPlaceId || form?.addressCity || form?.addressPostalCode) score += 5
  if (selectedNeeds.length) {
    score += Math.min(14, 7 + selectedNeeds.length * 2)
    reasons.push('work type')
  }
  if (/kitchen|bath|concrete|driveway|sidewalk|roof|siding|window/i.test(text)) {
    score += 12
    reasons.push('top service')
  }
  if (/leak|water|damage|fix|bad|ceiling|unsafe|broken|urgent|asap/i.test(text)) {
    score += 8
    reasons.push('urgent repair')
  }
  if (addressNeedsServiceCheck(form)) {
    score -= 15
    reasons.push('service area check')
  }

  const clampedScore = Math.max(10, Math.min(100, Math.round(score)))
  return {
    score: clampedScore,
    quality: clampedScore >= 78 ? 'High intent' : clampedScore >= 55 ? 'Good lead' : 'Needs office follow-up',
    reason: reasons.join(', ') || 'basic request',
  }
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function isTypingTarget(target) {
  const element = target instanceof HTMLElement ? target : null
  if (!element) return false
  return Boolean(element.closest('input, textarea, select, [contenteditable="true"]'))
}

function googleMapsApiKey() {
  return (
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    window.__GOOGLE_MAPS_API_KEY__ ||
    window.__flanaganPublicConfig?.googleMapsApiKey ||
    ''
  )
}

function loadPublicConfig() {
  if (typeof window === 'undefined') return Promise.resolve({})
  if (window.__flanaganPublicConfig) return Promise.resolve(window.__flanaganPublicConfig)
  if (window.__flanaganPublicConfigPromise) return window.__flanaganPublicConfigPromise

  window.__flanaganPublicConfigPromise = fetch('/api/public-config', {
    headers: { Accept: 'application/json' },
  })
    .then((response) => (response.ok ? response.json() : {}))
    .then((payload) => {
      const config = payload?.config || {}
      window.__flanaganPublicConfig = config
      return config
    })
    .catch(() => ({}))

  return window.__flanaganPublicConfigPromise
}

async function postJsonWithTimeout(path, payload, timeoutMs = 12000) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Request failed: ${response.status}`)
    return response
  } finally {
    window.clearTimeout(timeout)
  }
}

function loadGooglePlaces() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.google?.maps?.places?.AutocompleteService) return Promise.resolve(true)
  if (window.__flanaganGooglePlacesPromise) return window.__flanaganGooglePlacesPromise

  window.__flanaganGooglePlacesPromise = new Promise((resolve) => {
    const start = async () => {
      let key = googleMapsApiKey()
      if (!key) {
        const config = await loadPublicConfig()
        key = config.googleMapsApiKey || ''
      }
      if (!key) {
        resolve(false)
        return
      }

      const existing = document.querySelector('script[data-flanagan-google-places="true"]')
      const finish = () => resolve(Boolean(window.google?.maps?.places?.AutocompleteService))

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
    }

    start()
  })

  return window.__flanaganGooglePlacesPromise
}

function addressComponent(place, type, useShortName = false) {
  const component = place?.address_components?.find((item) => item.types?.includes(type))
  if (!component) return ''
  return useShortName ? component.short_name || component.long_name || '' : component.long_name || component.short_name || ''
}

function newPlacesSessionToken() {
  const Token = window.google?.maps?.places?.AutocompleteSessionToken
  return Token ? new Token() : null
}

function formatPhoneInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function normalizeEmailInput(value) {
  return String(value || '').trim().toLowerCase()
}

function formatNameInput(value) {
  return String(value || '')
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
}

function titleCaseName(value) {
  return formatNameInput(value).trim().replace(/\s+/g, ' ')
}

function addressFallbackSuggestions(value) {
  const query = String(value || '').trim()
  if (query.length < 3) return []
  const lower = query.toLowerCase()
  const looksOutOfArea = /\b(fl|florida|pa|pennsylvania|nj|new jersey|md|maryland)\b/i.test(query)
  const cityMatches = addressFallbackCities.filter(
    (city) => city.toLowerCase().includes(lower) || lower.includes(city.split(',')[0].toLowerCase()),
  )
  const matchingCities = (cityMatches.length || looksOutOfArea ? cityMatches : addressFallbackCities.slice(0, 5))
    .slice(0, 4)
    .map((city) => ({
      id: `city-${city}`,
      label: lower.includes(city.split(',')[0].toLowerCase()) ? query : `${query}, ${city}`,
      detail: 'Use this with a New Castle County town',
      source: 'fallback',
      city: city.replace(/, DE$/i, ''),
      state: 'DE',
    }))
  return [
    ...matchingCities,
    {
      id: 'typed-address',
      label: query,
      detail: newCastleCountyPattern.test(query)
        ? 'Use this typed address'
        : 'Use typed address - we will confirm service area',
      source: 'typed',
    },
  ]
}

function addressNeedsServiceCheck(form) {
  const address = String(form?.address || '')
  if (!address.trim()) return false
  if (form?.addressState && !/^DE$/i.test(form.addressState)) return true
  return /\b(fl|florida|pa|pennsylvania|nj|new jersey|md|maryland)\b/i.test(address)
}

function SplashIntro({ business, heroImage, onDone }) {
  return (
    <div className="splash-intro paint-splash" role="status" aria-live="polite">
      <div className="splash-raw-wall" aria-hidden="true"></div>
      <div className="splash-site-preview" style={{ '--splash-photo': cssUrl(heroImage) }} aria-hidden="true"></div>
      <div className="splash-paint-curtain" aria-hidden="true">
        <span className="splash-stroke splash-stroke-one"></span>
        <span className="splash-stroke splash-stroke-two"></span>
        <span className="splash-stroke splash-stroke-three"></span>
      </div>
      <div className="splash-roller-sweep" aria-hidden="true">
        <span className="css-paint-roller splash-roller"></span>
        <span className="splash-roller-label">Painting the page</span>
      </div>
      <div className="splash-flash" aria-hidden="true"></div>
      <div className="splash-card paint-splash-card">
        <span className="brand-mark splash-mark photo-mark" style={{ backgroundImage: cssUrl(brandVisual) }}></span>
        <p>Welcome to</p>
        <h2>{business.name}</h2>
        <strong className="splash-greeting">New Castle County contractor help</strong>
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

function PaintCursor() {
  return (
    <div className="paint-cursor" aria-hidden="true">
      <span className="paint-cursor-trail"></span>
      <span className="paint-cursor-roller">
        <span className="roller-head"></span>
        <span className="roller-arm"></span>
        <span className="roller-grip"></span>
      </span>
    </div>
  )
}

function HeroMotionLayer() {
  return (
    <div className="hero-motion-layer" aria-hidden="true">
      <div className="hero-spotlight"></div>
      <div className="blueprint-grid"></div>
      <div className="hero-paint-bursts">
        <span style={{ '--burst-x': '24%', '--burst-y': '33%', '--burst-delay': '0ms' }}></span>
        <span style={{ '--burst-x': '57%', '--burst-y': '16%', '--burst-delay': '420ms' }}></span>
        <span style={{ '--burst-x': '82%', '--burst-y': '64%', '--burst-delay': '760ms' }}></span>
      </div>
      <div className="measure-rail measure-rail-one"></div>
      <div className="measure-rail measure-rail-two"></div>
      <div className="hero-path">
        {heroPathSteps.map((step, index) => (
          <span
            key={step}
            style={{
              '--path-order': index,
              '--path-rise-delay': `${1050 + index * 120}ms`,
              '--path-loop-delay': `${1900 + index * 360}ms`,
            }}
          >
            {step}
          </span>
        ))}
      </div>
      <div className="floating-job-stack">
        {heroProjectCards.map((card, index) => {
          return (
            <div
              className="floating-job-card"
              key={card.label}
              style={{
                '--float-order': index,
                '--float-rise-delay': `${280 + index * 120}ms`,
                '--float-loop-delay': `${1300 - index * 1100}ms`,
              }}
            >
              <span className="job-card-photo" style={{ backgroundImage: cssUrl(card.image) }}></span>
              <strong>{card.label}</strong>
              <small>{card.detail}</small>
            </div>
          )
        })}
      </div>
      <div className="county-location-tag">
        <MapPin size={15} />
        New Castle County
      </div>
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
  activeServicePage = null,
}) {
  const addressInputRef = useRef(null)
  const addressListRef = useRef(null)
  const [addressAssist, setAddressAssist] = useState('manual')
  const [addressFocused, setAddressFocused] = useState(false)
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [activeAddressIndex, setActiveAddressIndex] = useState(0)
  const googleServicesRef = useRef({ autocomplete: null, places: null, token: null })
  const baseSimpleNeeds = leadFunnel.simpleNeeds?.length
    ? leadFunnel.simpleNeeds
    : [...new Set(leadFunnel.groups.flatMap((group) => group.needs))].slice(0, 14)
  const serviceFocus = serviceFocusForPage(activeServicePage)
  const focusNeeds = serviceFocus?.needs?.filter((need) => baseSimpleNeeds.includes(need)) || []
  const simpleNeeds = orderNeedsForFocus(baseSimpleNeeds, focusNeeds)
  const focusNeedsSelected = focusNeeds.length > 0 && focusNeeds.every((need) => selectedNeeds.includes(need))
  const selectFocusNeeds = () => {
    focusNeeds.filter((need) => !selectedNeeds.includes(need)).forEach((need) => toggleNeed(need))
  }

  useEffect(() => {
    let cancelled = false

    loadGooglePlaces().then((ready) => {
      if (cancelled) return
      if (!ready || !window.google?.maps?.places?.AutocompleteService) {
        setAddressAssist('manual')
        return
      }

      googleServicesRef.current = {
        autocomplete: new window.google.maps.places.AutocompleteService(),
        places: new window.google.maps.places.PlacesService(document.createElement('div')),
        token: newPlacesSessionToken(),
      }
      setAddressAssist('google')
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const query = form.address.trim()
    let ignore = false
    const timeout = window.setTimeout(() => {
      const updateSuggestions = (nextSuggestions) => {
        if (ignore) return
        setActiveAddressIndex(0)
        setAddressSuggestions(nextSuggestions)
      }

      if (!addressFocused || query.length < 3) {
        updateSuggestions([])
        return
      }

      if (addressAssist !== 'google' || !googleServicesRef.current.autocomplete) {
        updateSuggestions(addressFallbackSuggestions(query))
        return
      }

      googleServicesRef.current.autocomplete.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'us' },
          bounds: new window.google.maps.LatLngBounds(
            new window.google.maps.LatLng(39.29, -75.84),
            new window.google.maps.LatLng(39.84, -75.35),
          ),
          sessionToken: googleServicesRef.current.token,
          types: ['address'],
        },
        (predictions, serviceStatus) => {
          if (ignore) return
          if (serviceStatus !== window.google.maps.places.PlacesServiceStatus.OK || !predictions?.length) {
            updateSuggestions(addressFallbackSuggestions(query))
            return
          }
          updateSuggestions([
            ...predictions.slice(0, 5).map((prediction) => ({
              id: prediction.place_id,
              label: prediction.structured_formatting?.main_text || prediction.description,
              detail: prediction.structured_formatting?.secondary_text || prediction.description,
              description: prediction.description,
              placeId: prediction.place_id,
              source: 'google',
            })),
            {
              id: 'typed-address',
              label: query,
              detail: 'Use typed address instead',
              source: 'typed',
            },
          ])
        },
      )
    }, 180)

    return () => {
      ignore = true
      window.clearTimeout(timeout)
    }
  }, [addressAssist, addressFocused, form.address])

  const clearAddressMeta = () => {
    if (form.addressPlaceId || form.addressLat || form.addressLng || form.addressCity || form.addressState || form.addressPostalCode) {
      onAddressSelect({
        addressPlaceId: '',
        addressLat: '',
        addressLng: '',
        addressCity: '',
        addressState: '',
        addressPostalCode: '',
      })
    }
  }

  const selectAddressSuggestion = (suggestion) => {
    if (!suggestion) return
    if (suggestion.source === 'google' && suggestion.placeId && googleServicesRef.current.places) {
      googleServicesRef.current.places.getDetails(
        {
          placeId: suggestion.placeId,
          fields: ['formatted_address', 'place_id', 'geometry', 'address_components'],
          sessionToken: googleServicesRef.current.token,
        },
        (place, serviceStatus) => {
          if (serviceStatus !== window.google.maps.places.PlacesServiceStatus.OK || !place) {
            onAddressSelect({ address: suggestion.description || suggestion.label })
            return
          }
          const location = place?.geometry?.location
          onAddressSelect({
            address: place?.formatted_address || suggestion.description || suggestion.label,
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
          googleServicesRef.current.token = window.google?.maps?.places?.AutocompleteSessionToken
            ? new window.google.maps.places.AutocompleteSessionToken()
            : null
        },
      )
    } else {
      onAddressSelect({
        address: suggestion.label,
        addressPlaceId: '',
        addressLat: '',
        addressLng: '',
        addressCity: suggestion.city || '',
        addressState: suggestion.state || '',
        addressPostalCode: '',
      })
    }
    setAddressSuggestions([])
    setAddressFocused(false)
    window.setTimeout(() => addressInputRef.current?.blur(), 0)
  }

  const handleAddressKeyDown = (event) => {
    if (!addressSuggestions.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveAddressIndex((current) => (current + 1) % addressSuggestions.length)
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveAddressIndex((current) => (current - 1 + addressSuggestions.length) % addressSuggestions.length)
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      selectAddressSuggestion(addressSuggestions[activeAddressIndex])
    }
    if (event.key === 'Escape') {
      setAddressSuggestions([])
    }
  }

  const hasContact = form.phone.replace(/\D/g, '').length >= 7 && /\S+@\S+\.\S+/.test(form.email)
  const hasAddress = Boolean(form.address.trim())
  const hasNeed = selectedNeeds.length > 0
  const serviceCheckNeeded = addressNeedsServiceCheck(form)
  const addressSelected = Boolean(form.addressPlaceId || form.addressCity || form.addressPostalCode)
  const addressHelperText = addressSelected
    ? 'Address selected. Location details are saved with the lead.'
    : addressAssist === 'google'
      ? 'Start typing and pick the matching address when it appears.'
      : 'Start typing. We will suggest local towns and confirm the exact address.'

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
        <span className="panel-photo-mark" style={{ backgroundImage: cssUrl(projectVisuals[0].image) }}></span>
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
          <label>
            Website
            <input
              name="website"
              value={form.website}
              onChange={handleChange}
              tabIndex="-1"
              autoComplete="off"
            />
          </label>
          <label>
            Fax
            <input
              name="fax"
              value={form.fax}
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
              onChange={(event) => {
                handleChange({ target: { name: 'phone', value: formatPhoneInput(event.target.value) } })
              }}
              autoComplete="tel"
              inputMode="tel"
              placeholder="(302) 555-0123"
              required
            />
          </label>
          <label>
            Email
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              onBlur={(event) => {
                handleChange({ target: { name: 'email', value: normalizeEmailInput(event.target.value) } })
              }}
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              required
            />
          </label>
        </div>

        <label>
          Name
          <input
            name="name"
            value={form.name}
            onChange={(event) => {
              handleChange({ target: { name: 'name', value: formatNameInput(event.target.value) } })
            }}
            onBlur={(event) => {
              handleChange({ target: { name: 'name', value: titleCaseName(event.target.value) } })
            }}
            autoComplete="name"
            placeholder="First and last name"
            required
          />
        </label>

        <div className="address-field">
          <div className="address-label-row">
            <label htmlFor="project-address">Project address</label>
            {form.address ? (
              <button
                className="address-clear"
                type="button"
                onClick={() => {
                  onAddressSelect({
                    address: '',
                    addressPlaceId: '',
                    addressLat: '',
                    addressLng: '',
                    addressCity: '',
                    addressState: '',
                    addressPostalCode: '',
                  })
                  setAddressSuggestions([])
                  window.setTimeout(() => addressInputRef.current?.focus(), 0)
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="address-input-wrap">
            <input
              id="project-address"
              ref={addressInputRef}
              name="address"
              value={form.address}
              onChange={(event) => {
                handleChange(event)
                clearAddressMeta()
              }}
              onFocus={() => setAddressFocused(true)}
              onBlur={() => window.setTimeout(() => setAddressFocused(false), 140)}
              onKeyDown={handleAddressKeyDown}
              aria-autocomplete="list"
              aria-controls="address-suggestions"
              aria-expanded={addressSuggestions.length > 0}
              autoComplete="street-address"
              placeholder="Start typing the job address"
              required
            />
            {addressSuggestions.length ? (
              <div
                className="address-suggestions"
                id="address-suggestions"
                role="listbox"
                ref={addressListRef}
                aria-label="Address suggestions"
              >
                {addressSuggestions.map((suggestion, index) => (
                  <button
                    className={[
                      'address-suggestion',
                      index === activeAddressIndex ? 'active' : '',
                      suggestion.source === 'typed' ? 'typed' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={suggestion.id}
                    type="button"
                    role="option"
                    aria-selected={index === activeAddressIndex}
                    onMouseEnter={() => setActiveAddressIndex(index)}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      selectAddressSuggestion(suggestion)
                    }}
                  >
                    <MapPin size={17} aria-hidden="true" />
                    <span>
                      <strong>{suggestion.label}</strong>
                      <small>{suggestion.detail}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <span className="address-helper">{addressHelperText}</span>
          {serviceCheckNeeded ? (
            <span className="address-warning">
              This looks outside New Castle County. You can still send it and the office will confirm.
            </span>
          ) : null}
        </div>

        <div className="form-progress-steps" aria-label="Request progress">
          <span className={hasContact ? 'done' : ''}>
            <CheckCircle2 size={14} aria-hidden="true" />
            Contact
          </span>
          <span className={hasAddress ? 'done' : ''}>
            <MapPin size={14} aria-hidden="true" />
            Address
          </span>
          <span className={hasNeed ? 'done' : ''}>
            <CheckCircle2 size={14} aria-hidden="true" />
            Work type
          </span>
        </div>

        <div className="funnel-save-note" aria-live="polite">
          <CheckCircle2 size={16} aria-hidden="true" />
          {draftSaving
            ? 'Saving your started request...'
            : lastSavedAt
              ? `Started request saved at ${lastSavedAt}`
              : leadFunnel.contactNudge}
        </div>

        {serviceFocus ? (
          <div className="lead-focus-card">
            <span className="lead-focus-photo" style={{ backgroundImage: cssUrl(visualForText(serviceFocus.label)) }} aria-hidden="true"></span>
            <div>
              <strong>{serviceFocus.label}</strong>
              <small>{serviceFocus.note}</small>
            </div>
            <button type="button" onClick={selectFocusNeeds} disabled={focusNeedsSelected}>
              {focusNeedsSelected ? 'Selected' : serviceFocus.cta}
            </button>
          </div>
        ) : null}

        <fieldset className="funnel-needs">
          <legend>What do you want help with?</legend>
          <div className="need-chip-grid">
            {simpleNeeds.map((need, index) => {
              const selected = selectedNeeds.includes(need)
              const needVisual = visualForText(need)
              return (
                <button
                  className={selected ? 'need-chip active' : 'need-chip'}
                  key={need}
                  type="button"
                  style={{ '--need-order': index, '--need-delay': `${index * 52}ms` }}
                  aria-pressed={selected}
                  onClick={() => toggleNeed(need)}
                >
                  <span className="need-chip-photo" style={{ backgroundImage: cssUrl(needVisual) }} aria-hidden="true"></span>
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
          {submitting ? 'Sending...' : serviceFocus?.submit || 'Send project request'}
          <Mail size={18} aria-hidden="true" />
        </button>
        <p className="form-note" aria-live="polite">
          {status || estimateContent.formNote}
        </p>
      </form>
    </aside>
  )
}

function SiteHeader({ business, menuOpen, goHome, goSection, goPath, setMenuOpen }) {
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
        <span className="brand-mark photo-mark" style={{ backgroundImage: cssUrl(brandVisual) }}></span>
        <span>
          <strong>{business.name}</strong>
          <small>{business.location}</small>
        </span>
      </a>

      <nav className={menuOpen ? 'nav open' : 'nav'} aria-label="Primary navigation">
        <a
          href="/"
          onClick={(event) => {
            event.preventDefault()
            goHome()
          }}
        >
          Home
        </a>
        <a
          href="/our-work"
          onClick={(event) => {
            event.preventDefault()
            goPath('/our-work')
          }}
        >
          Our Work
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
  const handleCardTilt = (event) => {
    if (prefersReducedMotion()) return
    const card = event.currentTarget
    const rect = card.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    card.style.setProperty('--card-tilt-x', `${(-y * 5).toFixed(2)}deg`)
    card.style.setProperty('--card-tilt-y', `${(x * 5).toFixed(2)}deg`)
    card.style.setProperty('--card-glow-x', `${((x + 1) * 50).toFixed(1)}%`)
    card.style.setProperty('--card-glow-y', `${((y + 1) * 50).toFixed(1)}%`)
  }
  const resetCardTilt = (event) => {
    const card = event.currentTarget
    card.style.removeProperty('--card-tilt-x')
    card.style.removeProperty('--card-tilt-y')
    card.style.removeProperty('--card-glow-x')
    card.style.removeProperty('--card-glow-y')
  }

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
          const image = galleryItems[index]?.image || galleryItems[0]?.image
          return (
            <article
              className="simple-service-card"
              key={service.title}
              data-reveal="card"
              onPointerMove={handleCardTilt}
              onPointerLeave={resetCardTilt}
              style={{ '--reveal-order': index }}
            >
              <div className="simple-service-photo" style={{ backgroundImage: cssUrl(image) }}></div>
              <div>
                <span className="service-photo-badge" style={{ backgroundImage: cssUrl(image) }}></span>
                <h3>{service.title.replace(/^#\d+\s*/, '')}</h3>
                <p>{service.copy}</p>
              </div>
            </article>
          )
        })}
      </div>

      <div className="simple-proof-row" data-reveal="lift">
        {quickBand.map((item, index) => {
          return (
            <span key={item}>
              <i style={{ backgroundImage: cssUrl(proofVisuals[index] || brandVisual) }} aria-hidden="true"></i>
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

function LocalLeadSection({ activeServicePage, business, goPath, goSection, localSeo, serviceLocations }) {
  const priorityServices = localSeo?.priorityServices?.length
    ? localSeo.priorityServices
    : defaultSiteContent.localSeo.priorityServices
  const places = serviceLocations?.places?.length
    ? serviceLocations.places
    : defaultSiteContent.serviceLocations.places
  const featuredPlaces = activeServicePage?.focusTowns?.length ? activeServicePage.focusTowns : places.slice(0, 18)
  const handlePageClick = (slug) => (event) => {
    if (!goPath) return
    event.preventDefault()
    goPath(`/${slug}`)
  }
  const title = activeServicePage
    ? `${activeServicePage.serviceType} across New Castle County`
    : localSeo?.title || defaultSiteContent.localSeo.title
  const copy = activeServicePage?.summary || localSeo?.copy || defaultSiteContent.localSeo.copy

  return (
    <section
      className={`local-lead-section${activeServicePage ? ' local-service-page' : ''}`}
      id="service-area"
      aria-label="New Castle County service area"
    >
      <div className="local-lead-copy" data-reveal="lift">
        <p className="eyebrow">{localSeo?.eyebrow || 'Local contractor help'}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
        <div className="local-conversion-steps" aria-label="How the estimate process works">
          {(localSeo?.conversionSteps || defaultSiteContent.localSeo.conversionSteps).map((step, index) => (
            <span key={step}>
              <strong>{String(index + 1).padStart(2, '0')}</strong>
              {step}
            </span>
          ))}
        </div>
        <div className="local-actions">
          <button className="primary-action button-link" type="button" onClick={() => goSection('estimate')}>
            Start a local estimate
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <a className="secondary-action" href={phoneHrefFor(business.phone)} onClick={() => track('phone_click', { location: 'local_seo_section' })}>
            <Phone size={18} aria-hidden="true" />
            Call {business.phone}
          </a>
        </div>
      </div>

      <div className="local-intent-panel" data-reveal="card">
        <div className="local-intent-head">
          <span>{activeServicePage ? 'Current landing page' : 'Best-fit searches'}</span>
          <strong>{localSeo?.promise || defaultSiteContent.localSeo.promise}</strong>
        </div>
        <div className="local-intent-grid">
          {priorityServices.map((service, index) => {
            const isActive = activeServicePage?.slug === service.slug
            return (
              <article className={`local-intent-card${isActive ? ' is-active' : ''}`} key={service.slug}>
                <span className="local-rank">0{index + 1}</span>
                <h3>
                  <a href={`/${service.slug}`} onClick={handlePageClick(service.slug)}>
                    {service.title}
                  </a>
                </h3>
                <p>{service.copy}</p>
                <small>{service.searchLabel}</small>
                <div className="local-town-line" aria-label={`${service.title} service towns`}>
                  {service.towns.map((town) => (
                    <span key={town}>{town}</span>
                  ))}
                </div>
                <button className="text-action button-link" type="button" onClick={() => goSection('estimate')}>
                  {service.cta}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </article>
            )
          })}
        </div>
      </div>

      <div className="local-county-strip" data-reveal="lift">
        <div>
          <MapPin size={18} aria-hidden="true" />
          <strong>{serviceLocations?.title || defaultSiteContent.serviceLocations.title}</strong>
          <p>{serviceLocations?.copy || defaultSiteContent.serviceLocations.copy}</p>
        </div>
        <div className="location-chip-grid">
          {featuredPlaces.map((place) => (
            <span key={place}>{place}</span>
          ))}
        </div>
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
  goPath,
  routePath,
}) {
  const {
    business,
    estimate,
    gallery,
    hero,
    heroCredibility,
    images,
    leadFunnel,
    localSeo,
    quickBand,
    services,
    servicesIntro,
    serviceLocations,
  } = content
  const heroVideo = images.heroVideo || defaultSiteContent.images.heroVideo
  const activeServicePage = findServiceLandingPage(content, routePath)
  const heroTitlePrefix = activeServicePage?.heroTitle || hero.titlePrefix
  const heroHighlight = activeServicePage?.heroHighlight || hero.highlight
  const heroLede = activeServicePage?.heroLede || hero.lede
  const [loadHeroVideo, setLoadHeroVideo] = useState(false)

  useEffect(() => {
    if (!heroVideo || prefersReducedMotion()) return undefined
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches) return undefined
    if (typeof navigator !== 'undefined' && navigator.connection?.saveData) return undefined
    const timer = window.setTimeout(() => setLoadHeroVideo(true), 950)
    return () => window.clearTimeout(timer)
  }, [heroVideo, images.hero])

  return (
    <>
      <section id="top" className="hero-section simple-home-hero" style={{ '--hero-photo': cssUrl(images.hero) }}>
        {heroVideo && loadHeroVideo ? (
          <video
            className="hero-video"
            src={heroVideo}
            poster={images.hero}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          ></video>
        ) : null}
        <div className="hero-video-scrim" aria-hidden="true"></div>
        <HeroMotionLayer />
        <div className="hero-inner">
          <p className="hero-eyebrow">
            <span className="eyebrow-rule" aria-hidden="true"></span>
            {hero.eyebrow}
            <span className="eyebrow-rule" aria-hidden="true"></span>
          </p>
          <h1>
            <span className="hero-title-piece hero-title-one">{heroTitlePrefix}</span>{' '}
            <span className="hl">
              {heroHighlight}
              <svg className="swoosh" viewBox="0 0 320 26" preserveAspectRatio="none" aria-hidden="true">
                <path d="M6 18 Q 160 30 314 9" stroke="#f2b84b" strokeWidth="6" fill="none" strokeLinecap="round" />
              </svg>
            </span>
          </h1>
          <p className="hero-lede">{heroLede}</p>
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
              return (
                <span key={label}>
                  <i style={{ backgroundImage: cssUrl(proofVisuals[index] || brandVisual) }} aria-hidden="true"></i>
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
          activeServicePage={activeServicePage}
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
      <LocalLeadSection
        activeServicePage={activeServicePage}
        business={business}
        goPath={goPath}
        goSection={goSection}
        localSeo={localSeo}
        serviceLocations={serviceLocations}
      />
    </>
  )
}

function OurWorkPage({ content, goSection }) {
  const { business, gallery, workGallery } = content
  const items = workGallery?.items?.length
    ? workGallery.items
    : (gallery.items || []).map((item) => ({
        ...item,
        category: item.title,
        location: business.location,
        summary: item.copy,
        completedAt: 'Recent project',
        source: 'Site gallery',
      }))

  return (
    <>
      <section className="our-work-hero" id="top">
        <div>
          <p className="eyebrow">{workGallery?.eyebrow || 'Our work'}</p>
          <h1>{workGallery?.title || 'Projects and job photos from New Castle County.'}</h1>
          <p>{workGallery?.copy || 'Browse kitchens, baths, concrete, exterior work, decks, repairs, and additions.'}</p>
          <button className="primary-action button-link" type="button" onClick={() => goSection('estimate')}>
            Start a similar request
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="our-work-feature">
          {(items[0]?.image || gallery.items?.[0]?.image) ? (
            <img src={items[0]?.image || gallery.items?.[0]?.image} alt={items[0]?.title || 'Recent Flanagan Construction project'} />
          ) : null}
          <span>{items[0]?.category || 'Recent work'}</span>
        </div>
      </section>

      <section className="our-work-gallery" aria-label="Previous jobs">
        {items.length ? (
          <div className="our-work-grid">
            {items.map((item, index) => (
              <article className="our-work-card" key={`${item.title}-${index}`} data-reveal="card">
                <div className="our-work-photo">
                  {item.image ? <img src={item.image} alt={item.title || `${item.category || 'Project'} photo`} /> : null}
                </div>
                <div>
                  <span>{item.category || 'Project'}</span>
                  <h3>{item.title}</h3>
                  <p>{item.summary || item.copy}</p>
                  <small>
                    <MapPin size={14} aria-hidden="true" />
                    {item.location || business.location}
                    {item.completedAt ? ` / ${item.completedAt}` : ''}
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="our-work-empty">
            <Image size={28} aria-hidden="true" />
            <strong>{workGallery?.emptyTitle || 'Job photos are coming soon.'}</strong>
            <p>{workGallery?.emptyCopy || 'The office can add finished work from the admin dashboard.'}</p>
          </div>
        )}
      </section>

      <section className="our-work-cta">
        <div>
          <h2>{workGallery?.ctaTitle || 'See something like your project?'}</h2>
          <p>{workGallery?.ctaCopy || 'Start a request and we will follow up with the next step.'}</p>
        </div>
        <button className="primary-action button-link" type="button" onClick={() => goSection('estimate')}>
          Free estimate
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </section>
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
          <span className="brand-mark photo-mark" style={{ backgroundImage: cssUrl(brandVisual) }}></span>
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
      if (params.has('nosplash')) return false
      if (params.has('splash')) return true
      return window.sessionStorage.getItem('flanagan-splash-seen') !== 'true'
    } catch {
      return true
    }
  })
  const [online, setOnline] = useState(() => navigator.onLine)
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
    website: '',
    fax: '',
  })
  const [selectedGroupId, setSelectedGroupId] = useState(defaultSiteContent.leadFunnel.groups[0].id)
  const [selectedNeeds, setSelectedNeeds] = useState([])
  const [draftSaving, setDraftSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState('')
  const leadIdRef = useRef(makeLeadId({ createdAt: new Date().toISOString(), source: 'funnel' }))
  const adminHotkeyRef = useRef({ armed: false, timeoutId: 0 })
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const business = siteContent.business
  const phoneHref = phoneHrefFor(business.phone)

  useEffect(() => {
    configureGoogleTracking(siteContent.integrations || {})
  }, [siteContent.integrations])

  useEffect(() => {
    applyDocumentSeo(siteContent, routePath)
  }, [routePath, siteContent])

  const dismissSplash = useCallback(() => {
    try {
      window.sessionStorage.setItem('flanagan-splash-seen', 'true')
    } catch {
      // Session storage can be unavailable.
    }
    setShowSplash(false)
  }, [])

  const goAdminLogin = useCallback(() => {
    dismissSplash()
    setMenuOpen(false)
    if (window.location.pathname !== '/admin') {
      window.history.pushState({}, '', '/admin')
      setRoutePath('/admin')
    } else {
      setRoutePath('/admin')
    }
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [dismissSplash])

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
    const timeout = window.setTimeout(dismissSplash, 2300)
    return () => window.clearTimeout(timeout)
  }, [dismissSplash, showSplash])

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const updateScrollProgress = () => {
      const maxScroll = root.scrollHeight - window.innerHeight
      const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0
      root.style.setProperty('--scroll-progress', String(Math.min(1, Math.max(0, progress))))
    }

    updateScrollProgress()
    window.addEventListener('scroll', updateScrollProgress, { passive: true })
    window.addEventListener('resize', updateScrollProgress)
    return () => {
      window.removeEventListener('scroll', updateScrollProgress)
      window.removeEventListener('resize', updateScrollProgress)
    }
  }, [])

  useEffect(() => {
    if (routePath.startsWith('/admin')) {
      document.body.classList.remove('paint-cursor-active')
      return undefined
    }
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return undefined
    document.body.classList.add('paint-cursor-active')

    const handlePointerMove = (event) => {
      const root = document.documentElement
      root.style.setProperty('--pointer-x', `${event.clientX}px`)
      root.style.setProperty('--pointer-y', `${event.clientY}px`)
      root.style.setProperty('--hero-drift-x', `${((event.clientX / window.innerWidth - 0.5) * 5).toFixed(2)}px`)
      root.style.setProperty('--hero-drift-y', `${((event.clientY / window.innerHeight - 0.5) * 4).toFixed(2)}px`)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => {
      document.body.classList.remove('paint-cursor-active')
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [routePath])

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

  useEffect(() => {
    const clearHotkey = () => {
      window.clearTimeout(adminHotkeyRef.current.timeoutId)
      adminHotkeyRef.current = { armed: false, timeoutId: 0 }
    }

    const handleKeyDown = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return

      const key = event.key.toLowerCase()
      if (key === 'g') {
        window.clearTimeout(adminHotkeyRef.current.timeoutId)
        adminHotkeyRef.current = {
          armed: true,
          timeoutId: window.setTimeout(clearHotkey, 1200),
        }
        return
      }

      if (key === 'a' && adminHotkeyRef.current.armed) {
        event.preventDefault()
        clearHotkey()
        goAdminLogin()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearHotkey()
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [goAdminLogin])

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

  const goPath = (path) => {
    setMenuOpen(false)
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
      setRoutePath(path)
    }
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const goSection = (id) => {
    setMenuOpen(false)
    const scrollToSection = () => {
      document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    }
    const isHomeLikeRoute = window.location.pathname === '/' || findServiceLandingPage(siteContent, window.location.pathname)
    if (!isHomeLikeRoute) {
      window.history.pushState({}, '', '/')
      setRoutePath('/')
      window.setTimeout(scrollToSection, 80)
      return
    }
    scrollToSection()
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

  const leadPayload = (statusOverride = 'Started', formOverride = form, selectedNeedsOverride = selectedNeeds) => {
    const activeGroup =
      siteContent.leadFunnel.groups.find((group) => group.id === selectedGroupId) ||
      siteContent.leadFunnel.groups[0]
    const activeServicePage = findServiceLandingPage(siteContent, routePath)
    const projectType = selectedNeedsOverride.length ? selectedNeedsOverride.join(', ') : activeGroup.label
    const summaryLines = [
      selectedNeedsOverride.length ? `Selected needs: ${selectedNeedsOverride.join(', ')}` : `Selected lane: ${activeGroup.label}`,
      formOverride.address ? `Project address: ${formOverride.address}` : '',
      formOverride.message ? `Notes: ${formOverride.message}` : '',
    ].filter(Boolean)
    const leadScore = scoreLeadForFunnel(formOverride, selectedNeedsOverride, activeServicePage)

    return {
      ...formOverride,
      id: leadIdRef.current,
      leadId: leadIdRef.current,
      leadKind: statusOverride === 'Started' ? 'Started funnel' : 'Final request',
      funnelGroup: activeGroup.label,
      selectedNeeds: selectedNeedsOverride,
      projectType,
      message: summaryLines.join('\n'),
      status: statusOverride,
      ...leadTrackingFields(activeServicePage),
      leadScore: String(leadScore.score),
      leadScoreReason: leadScore.reason,
      intakeQuality: leadScore.quality,
      priority: selectedNeedsOverride.some((need) => /fix|bad|commercial|addition|foundation/i.test(need))
        ? 'Hot'
        : leadScore.score >= 74
          ? 'Hot'
          : leadScore.score >= 48
            ? 'Warm'
            : 'Normal',
    }
  }

  const formValuesFromElement = (formElement) => {
    if (!formElement) return form
    const formData = new FormData(formElement)
    return {
      ...form,
      name: String(formData.get('name') || form.name),
      phone: String(formData.get('phone') || form.phone),
      email: String(formData.get('email') || form.email),
      address: String(formData.get('address') || form.address),
      message: String(formData.get('message') || form.message),
      company: String(formData.get('company') || form.company),
      website: String(formData.get('website') || form.website),
      fax: String(formData.get('fax') || form.fax),
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
    if (submitted || hasLeadHoneypot(form) || (!hasPhone && !hasEmail)) return

    const timeout = window.setTimeout(async () => {
      setDraftSaving(true)
      const draft = {
        ...leadPayload('Started'),
        receivedAt: new Date().toISOString(),
      }
      saveLocalLeadBackup(draft)

      try {
        await postJsonWithTimeout('/api/lead-draft', draft, 8000)
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
    form.website,
    form.fax,
    routePath,
    selectedGroupId,
    selectedNeeds,
    submitted,
  ])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return
    const submittedForm = formValuesFromElement(event.currentTarget)
    setSubmitting(true)
    setStatus('Sending your request...')

    if (hasLeadHoneypot(submittedForm)) {
      setSubmitted(true)
      setStatus('Request received. We will reach out within one business day.')
      setSubmitting(false)
      return
    }

    // Keep a local backup so a lead is never lost to a flaky network.
    const finalLead = {
      ...leadPayload('New', submittedForm),
      receivedAt: new Date().toISOString(),
    }
    saveLocalLeadBackup(finalLead)

    try {
      await postJsonWithTimeout('/api/lead', finalLead, 14000)
      setSubmitted(true)
      setStatus('Request received. We will reach out within one business day.')
      sendLeadConversion(siteContent.integrations || {}, finalLead)
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
      website: '',
      fax: '',
    })
  }

  if (routePath.startsWith('/admin')) {
    return <AdminDashboard content={siteContent} setContent={setSiteContent} goHome={goHome} />
  }

  return (
    <main className={showSplash ? 'site-loading' : 'site-ready'}>
      <div className="scroll-progress" aria-hidden="true"></div>
      {!showSplash ? <PaintCursor /> : null}
      {showSplash ? (
        <SplashIntro business={business} heroImage={siteContent.images.hero} onDone={dismissSplash} />
      ) : null}
      <a className="skip-link" href="#top">
        Skip to content
      </a>
      {!online ? (
        <div className="connection-banner" role="status">
          You appear offline. Your request is still backed up in this browser, and email fallback will open if sending fails.
        </div>
      ) : null}
      <SiteHeader
        business={business}
        menuOpen={menuOpen}
        goHome={goHome}
        goSection={goSection}
        goPath={goPath}
        setMenuOpen={setMenuOpen}
      />

      {routePath.startsWith('/our-work') ? (
        <OurWorkPage content={siteContent} goSection={goSection} />
      ) : (
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
          goPath={goPath}
          routePath={routePath}
        />
      )}

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
