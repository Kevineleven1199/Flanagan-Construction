import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Award,
  Bath,
  BrainCircuit,
  Camera,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Hammer,
  HelpCircle,
  Home,
  Mail,
  MapPin,
  Menu,
  Palette,
  Paintbrush,
  Phone,
  Quote,
  Ruler,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Star,
  WandSparkles,
  X,
} from 'lucide-react'
import { business, faqs, guarantees, proofPoints, services, stats, testimonials } from './content'
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

const phoneHref = `tel:${business.phone.replace(/\D/g, '')}`

const projectTypes = ['Bathroom remodel', 'Shower conversion', 'Kitchen', 'Basement', 'Addition', 'Repair']
const budgetRanges = ['$2k-$10k', '$10k-$25k', '$25k-$50k', '$50k+', 'Not sure yet']
const timelines = ['ASAP', 'This month', '1-3 months', 'Planning ahead']
const icons = [Bath, Sparkles, Home, Hammer]

const heroCredibility = [
  { icon: ShieldCheck, label: 'Licensed & insured' },
  { icon: ClipboardCheck, label: 'Free written estimates' },
  { icon: Clock3, label: 'Fast local scheduling' },
]

const gallery = [
  {
    title: 'Statement Tile',
    copy: 'Floor-to-ceiling drama, clean glass, and fixtures that feel expensive before anyone reads a word.',
  },
  {
    title: 'Walk-In Showers',
    copy: 'Curbless entries, niches, benches, rainfall heads, and proper waterproofing behind the beauty.',
  },
  {
    title: 'Vanity Glow-Ups',
    copy: 'Better storage, stone counters, mirrors, lighting, trim, and paint that make the room feel finished.',
  },
]

const processSteps = [
  { title: 'Free consultation', copy: 'We visit, listen, and measure — no pressure and no obligation.' },
  { title: 'Clear written estimate', copy: 'A detailed scope and price before any demolition begins.' },
  { title: 'Clean, careful build', copy: 'Tidy crews, daily jobsite care, and proper waterproofing.' },
  { title: 'Final walkthrough', copy: 'We review every detail together and handle the punch list.' },
]

const advisorStyles = ['Hotel Spa', 'Black + Brass', 'Coastal Calm', 'Modern Organic']
const advisorScopes = ['Tub-to-shower', 'Full gut remodel', 'Vanity + tile refresh', 'Aging-in-place']
const advisorPriorities = ['Luxury', 'Speed', 'Budget control', 'Resale value']

const styleNotes = {
  'Hotel Spa': 'warm stone, glass, rainfall shower, hidden lighting',
  'Black + Brass': 'dark fixtures, brass accents, high-contrast tile',
  'Coastal Calm': 'soft tile, brushed nickel, light wood, quiet storage',
  'Modern Organic': 'large-format tile, wood vanity, matte fixtures, plants',
}

const scopeBudgets = {
  'Tub-to-shower': '$10k-$25k',
  'Full gut remodel': '$25k-$50k',
  'Vanity + tile refresh': '$10k-$25k',
  'Aging-in-place': '$25k-$50k',
}

function LeadPanel({ form, handleChange, handleSubmit, status, submitting, submitted, onReset }) {
  if (submitted) {
    const firstName = form.name ? form.name.trim().split(' ')[0] : ''
    return (
      <aside className="lead-panel lead-success" id="estimate" aria-label="Request received">
        <div className="panel-heading">
          <span>
            <CheckCircle2 size={20} aria-hidden="true" />
          </span>
          <div>
            <h2>Request received</h2>
            <p>Thanks{firstName ? `, ${firstName}` : ''}! We will reach out within one business day.</p>
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
          <a className="primary-action" href={`tel:${business.phone.replace(/\D/g, '')}`}>
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
    <aside className="lead-panel" id="estimate" aria-label="Request an estimate">
      <div className="panel-heading">
        <span>
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div>
          <h2>Get your free estimate</h2>
          <p>Tell us what you need. We will follow up with next steps.</p>
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

        <label>
          Name
          <input name="name" value={form.name} onChange={handleChange} autoComplete="name" required />
        </label>

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
            <input name="email" type="email" value={form.email} onChange={handleChange} autoComplete="email" />
          </label>
        </div>

        <div className="field-grid">
          <label>
            Project
            <select name="projectType" value={form.projectType} onChange={handleChange}>
              {projectTypes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Budget
            <select name="budget" value={form.budget} onChange={handleChange}>
              {budgetRanges.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Timeline
          <select name="timeline" value={form.timeline} onChange={handleChange}>
            {timelines.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label>
          What should we look at?
          <textarea
            name="message"
            value={form.message}
            onChange={handleChange}
            rows="4"
            placeholder="Example: remove tub, build walk-in shower, add tile niche, glass, vanity, and lighting."
            required
          />
        </label>

        <button className="submit-button" type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send project request'}
          <Mail size={18} aria-hidden="true" />
        </button>
        <p className="form-note" aria-live="polite">
          {status || 'No pressure. Just a simple first step.'}
        </p>
      </form>
    </aside>
  )
}

function SiteHeader({ menuOpen, goHome, goSection, setMenuOpen }) {
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
          Services
        </a>
        <a
          href="#reviews"
          onClick={(event) => {
            event.preventDefault()
            goSection('reviews')
          }}
        >
          Reviews
        </a>
        <a
          href="#work"
          onClick={(event) => {
            event.preventDefault()
            goSection('work')
          }}
        >
          How It Works
        </a>
        <a className="nav-call" href={phoneHref} onClick={() => track('phone_click', { location: 'header' })}>
          <Phone size={16} aria-hidden="true" />
          Call
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

function AdvisorPanel({ advisor, aiPlan, updateAdvisor, addAiPlanToForm }) {
  return (
    <div className="ai-panel" aria-label="Remodel planner">
      <div className="ai-panel-top">
        <span>
          <WandSparkles size={20} aria-hidden="true" />
        </span>
        <div>
          <h3>Remodel planner</h3>
          <p>Tap a few choices. Get a quote-ready plan.</p>
        </div>
      </div>

      <div className="advisor-groups">
        <fieldset>
          <legend>Style</legend>
          <div className="chip-row">
            {advisorStyles.map((style) => (
              <button
                className={advisor.style === style ? 'choice-chip active' : 'choice-chip'}
                key={style}
                type="button"
                aria-pressed={advisor.style === style}
                onClick={() => updateAdvisor('style', style)}
              >
                {style}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Scope</legend>
          <div className="chip-row">
            {advisorScopes.map((scope) => (
              <button
                className={advisor.scope === scope ? 'choice-chip active' : 'choice-chip'}
                key={scope}
                type="button"
                aria-pressed={advisor.scope === scope}
                onClick={() => updateAdvisor('scope', scope)}
              >
                {scope}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Priority</legend>
          <div className="chip-row">
            {advisorPriorities.map((priority) => (
              <button
                className={advisor.priority === priority ? 'choice-chip active' : 'choice-chip'}
                key={priority}
                type="button"
                aria-pressed={advisor.priority === priority}
                onClick={() => updateAdvisor('priority', priority)}
              >
                {priority}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="ai-output">
        <div className="score-ring" style={{ '--score': `${aiPlan.score}%` }}>
          <strong>{aiPlan.score}</strong>
          <span>fit score</span>
        </div>
        <div>
          <h4>{aiPlan.headline}</h4>
          <p>Budget signal: {aiPlan.budget}</p>
          <ul>
            {aiPlan.bullets.map((bullet) => (
              <li key={bullet}>
                <CheckCircle2 size={16} aria-hidden="true" />
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button className="ai-action" type="button" onClick={addAiPlanToForm}>
        Add this plan to my estimate
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

function StatsBand() {
  return (
    <section className="stats-band" aria-label="Company highlights">
      {stats.map((stat) => (
        <div className="stat" key={stat.label}>
          <strong>{stat.value}</strong>
          <span>{stat.label}</span>
        </div>
      ))}
    </section>
  )
}

function Stars({ rating }) {
  return (
    <span className="stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={16}
          aria-hidden="true"
          fill={index < rating ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  )
}

function ReviewsSection() {
  return (
    <section className="reviews-section" id="reviews" aria-label="Customer reviews">
      <div className="section-heading">
        <p className="eyebrow">What homeowners say</p>
        <h2>Reviews from Newark-area remodels.</h2>
      </div>
      <div className="reviews-grid">
        {testimonials.map((item, index) => (
          <article className="review-card" key={index}>
            <Quote className="review-mark" size={26} aria-hidden="true" />
            <Stars rating={item.rating} />
            <p>{item.quote}</p>
            <footer>
              <strong>{item.name}</strong>
              <span>{item.location}</span>
            </footer>
          </article>
        ))}
      </div>
    </section>
  )
}

function GuaranteesSection() {
  return (
    <section className="guarantees-section" aria-label="Our promise">
      <div className="guarantees-copy">
        <p className="eyebrow">
          <Award size={16} aria-hidden="true" />
          Our promise
        </p>
        <h2>Done right behind the tile, not just in front of it.</h2>
        <p>
          The difference between a remodel that lasts and one that leaks is the work you cannot see.
          Here is what every Flanagan project includes.
        </p>
      </div>
      <ul className="guarantees-list">
        {guarantees.map((item) => (
          <li key={item}>
            <CheckCircle2 size={18} aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

function FaqSection() {
  return (
    <section className="faq-section" id="faq" aria-label="Frequently asked questions">
      <div className="section-heading">
        <p className="eyebrow">
          <HelpCircle size={16} aria-hidden="true" />
          FAQ
        </p>
        <h2>Answers before you ask.</h2>
      </div>
      <div className="faq-list">
        {faqs.map((item) => (
          <details className="faq-item" key={item.question}>
            <summary>
              <span>{item.question}</span>
              <ChevronDown className="faq-chevron" size={20} aria-hidden="true" />
            </summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function HomePage({
  advisor,
  aiPlan,
  form,
  handleChange,
  handleSubmit,
  status,
  submitting,
  submitted,
  onReset,
  updateAdvisor,
  addAiPlanToForm,
  goSection,
  reveal,
  setReveal,
}) {
  return (
    <>
      <section id="top" className="hero-section luxury-hero">
        <div className="hero-media luxury-parallax" aria-hidden="true">
          <div className="parallax-photo parallax-main"></div>
          <div className="parallax-photo parallax-detail"></div>
          <div className="parallax-photo parallax-vanity"></div>
          <div className="marble-slab"></div>
          <div className="light-sweep"></div>
        </div>

        <div className="hero-copy">
          <p className="eyebrow">
            <MapPin size={16} aria-hidden="true" />
            Newark, Delaware bathroom & home remodeling
          </p>
          <h1>Luxury bathroom remodels without the contractor chaos.</h1>
          <p className="hero-lede">
            Elegant tile, glass showers, warm lighting, clean waterproofing, and a quote process
            that feels polished from the first click.
          </p>

          <div className="hero-tech-strip" aria-label="Why homeowners choose us">
            {heroCredibility.map(({ icon: Icon, label }) => (
              <span key={label}>
                <Icon size={16} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>

          <div className="hero-actions">
            <a className="primary-action" href="#estimate">
              Get a free estimate
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <button className="secondary-action button-link" type="button" onClick={() => goSection('ai')}>
              <Palette size={18} aria-hidden="true" />
              Design your bathroom
            </button>
          </div>

          <div className="trust-strip" aria-label="Company highlights">
            {proofPoints.slice(0, 3).map((point) => (
              <span key={point}>
                <CheckCircle2 size={16} aria-hidden="true" />
                {point}
              </span>
            ))}
          </div>
        </div>

        <LeadPanel
          form={form}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          status={status}
          submitting={submitting}
          submitted={submitted}
          onReset={onReset}
        />
      </section>

      <section className="quick-band" aria-label="Service area and availability">
        <span>
          <Clock3 size={18} aria-hidden="true" />
          Bathroom-first estimates
        </span>
        <span>
          <ShieldCheck size={18} aria-hidden="true" />
          Waterproofing standards
        </span>
        <span>
          <ClipboardCheck size={18} aria-hidden="true" />
          Written scope before demo
        </span>
      </section>

      <StatsBand />

      <section className="section" id="services">
        <div className="section-heading">
          <p className="eyebrow">What homeowners want most</p>
          <h2>High-end details, handled by a crew that respects the house.</h2>
        </div>
        <div className="service-grid">
          {services.map((service, index) => {
            const Icon = icons[index] || Paintbrush
            return (
              <article className="service-card" key={service.title}>
                <span className="service-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h3>{service.title}</h3>
                <p>{service.copy}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="gallery-section" aria-label="Bathroom remodeling inspiration">
        <div className="gallery-copy">
          <p className="eyebrow">Bathroom inspiration</p>
          <h2>See the dream before you ask the price.</h2>
          <p>
            Premium finishes, walk-in showers, and clean modern vanities — the kind of bathroom
            people actually brag about. Tell us your favorite look and we will price it out.
          </p>
        </div>
        <div className="bathroom-gallery">
          {gallery.map((item, index) => (
            <article className={`bathroom-card bathroom-card-${index + 1}`} key={item.title}>
              <div>
                <span>0{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <ReviewsSection />

      <section className="ai-section" id="ai">
        <div className="ai-copy">
          <p className="eyebrow">
            <BrainCircuit size={16} aria-hidden="true" />
            Plan your remodel
          </p>
          <h2>Design your dream bathroom in under a minute.</h2>
          <p>
            Pick a style, scope, and priority. We will build a quote-ready plan and drop it straight
            into your estimate request — so your first call with us is already a head start.
          </p>
          <div className="ai-metrics" aria-label="Planner features">
            <span>
              <ScanLine size={18} aria-hidden="true" />
              instant scope
            </span>
            <span>
              <Ruler size={18} aria-hidden="true" />
              budget signal
            </span>
            <span>
              <Palette size={18} aria-hidden="true" />
              style direction
            </span>
          </div>
        </div>

        <AdvisorPanel
          advisor={advisor}
          aiPlan={aiPlan}
          updateAdvisor={updateAdvisor}
          addAiPlanToForm={addAiPlanToForm}
        />
      </section>

      <section className="compare-section" aria-label="Interactive before and after bathroom slider">
        <div className="compare-copy">
          <p className="eyebrow">
            <Camera size={16} aria-hidden="true" />
            Before and after
          </p>
          <h2>The transformation, made obvious.</h2>
          <p>
            Drag the control to compare tired, builder-grade energy with the kind of finished
            bathroom people actually brag about.
          </p>
        </div>
        <div className="compare-wrap">
          <div className="compare-stage" style={{ '--reveal': `${reveal}%` }}>
            <div className="compare-image compare-before"></div>
            <div className="compare-image compare-after"></div>
            <div className="compare-label label-before">Before</div>
            <div className="compare-label label-after">After</div>
            <div className="compare-handle" aria-hidden="true"></div>
          </div>
          <input
            className="compare-range"
            type="range"
            min="8"
            max="92"
            value={reveal}
            aria-label="Reveal bathroom remodel after image"
            onChange={(event) => setReveal(event.target.value)}
          />
        </div>
      </section>

      <GuaranteesSection />

      <section className="work-section" id="work">
        <div className="work-copy">
          <p className="eyebrow">How it works</p>
          <h2>A calm, professional process from first call to final walkthrough.</h2>
          <p>
            No pressure and no surprises. You get a clear written scope and price before any
            demolition begins, then a clean, careful build by a crew that respects your home.
          </p>
        </div>
        <div className="process-list">
          {processSteps.map((step, index) => (
            <div className="process-step" key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <FaqSection />

      <section className="cta-band" aria-label="Request your estimate">
        <div>
          <h2>Ready to start your remodel?</h2>
          <p>Get a fast, free estimate from a trusted Newark-area crew.</p>
        </div>
        <div className="cta-band-actions">
          <a className="primary-action" href="#estimate" onClick={() => goSection('estimate')}>
            Get a free estimate
            <ArrowRight size={18} aria-hidden="true" />
          </a>
          <a className="secondary-action" href={`tel:${business.phone.replace(/\D/g, '')}`}>
            <Phone size={18} aria-hidden="true" />
            {business.phone}
          </a>
        </div>
      </section>
    </>
  )
}

function SiteFooter({ goSection }) {
  const year = new Date().getFullYear()
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
          {services.map((service) => (
            <a key={service.title} href="#services" onClick={jump('services')}>
              {service.title}
            </a>
          ))}
        </nav>

        <nav className="footer-col" aria-label="Company">
          <h3>Company</h3>
          <a href="#work" onClick={jump('work')}>
            How it works
          </a>
          <a href="#reviews" onClick={jump('reviews')}>
            Reviews
          </a>
          <a href="#faq" onClick={jump('faq')}>
            FAQ
          </a>
          <a href="#estimate" onClick={jump('estimate')}>
            Free estimate
          </a>
        </nav>

        <div className="footer-col footer-contact">
          <h3>Contact</h3>
          <a href={phoneHref} onClick={() => track('phone_click', { location: 'footer' })}>
            {business.phone}
          </a>
          <a href={`mailto:${business.email}`}>{business.email}</a>
          <p>Mon–Fri, 8am–5pm</p>
          <p className="footer-badge">
            <ShieldCheck size={14} aria-hidden="true" />
            Licensed &amp; insured
          </p>
        </div>
      </div>

      <div className="footer-bottom">
        <span>
          © {year} {business.name}. Newark, Delaware.
        </span>
        <span>Bathroom &amp; home remodeling • Free estimates</span>
      </div>
    </footer>
  )
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [reveal, setReveal] = useState(58)
  const [advisor, setAdvisor] = useState({
    style: advisorStyles[0],
    scope: advisorScopes[0],
    priority: advisorPriorities[0],
  })
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    projectType: projectTypes[0],
    budget: budgetRanges[0],
    timeline: timelines[0],
    message: '',
    company: '',
  })
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const aiPlan = useMemo(() => {
    const score =
      78 +
      advisorStyles.indexOf(advisor.style) * 3 +
      advisorScopes.indexOf(advisor.scope) * 2 +
      advisorPriorities.indexOf(advisor.priority)
    const priorityLine = {
      Luxury: 'lead with the wow shot, premium fixtures, and a glass shower package',
      Speed: 'pre-select materials early and keep the footprint close to existing plumbing',
      'Budget control': 'separate must-haves from nice-to-haves before demo starts',
      'Resale value': 'prioritize timeless tile, storage, lighting, and durable waterproofing',
    }[advisor.priority]

    return {
      score: Math.min(score, 96),
      headline: `${advisor.style} ${advisor.scope.toLowerCase()} plan`,
      budget: scopeBudgets[advisor.scope],
      bullets: [
        styleNotes[advisor.style],
        priorityLine,
        'photo-ready finish schedule for tile, vanity, mirror, glass, lighting, and hardware',
      ],
    }
  }, [advisor])

  const mailtoLink = useMemo(() => {
    const subject = encodeURIComponent(`New project request from ${form.name || 'website lead'}`)
    const body = encodeURIComponent(
      [
        `Name: ${form.name}`,
        `Phone: ${form.phone}`,
        `Email: ${form.email}`,
        `Project type: ${form.projectType}`,
        `Budget: ${form.budget}`,
        `Timeline: ${form.timeline}`,
        '',
        'Project details:',
        form.message,
      ].join('\n'),
    )

    return `mailto:${business.email}?subject=${subject}&body=${body}`
  }, [form])

  const goHome = () => {
    setMenuOpen(false)
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

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setStatus('Sending your request…')

    // Keep a local backup so a lead is never lost to a flaky network.
    try {
      const leads = JSON.parse(window.localStorage.getItem('flanagan-leads') || '[]')
      const lead = { ...form, createdAt: new Date().toISOString() }
      window.localStorage.setItem('flanagan-leads', JSON.stringify([lead, ...leads].slice(0, 50)))
    } catch {
      // localStorage can be unavailable in private mode; ignore.
    }

    try {
      const response = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!response.ok) throw new Error(`Request failed: ${response.status}`)
      setSubmitted(true)
      setStatus('Request received. We will reach out within one business day.')
      track('generate_lead', { projectType: form.projectType, budget: form.budget })
      window.setTimeout(() => {
        document.getElementById('estimate')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 60)
    } catch {
      // Static hosting (e.g. GitHub Pages) has no API — fall back to email.
      setStatus('Opening your email app so you can send the request directly…')
      window.location.href = mailtoLink
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setSubmitted(false)
    setStatus('')
    setForm({
      name: '',
      phone: '',
      email: '',
      projectType: projectTypes[0],
      budget: budgetRanges[0],
      timeline: timelines[0],
      message: '',
      company: '',
    })
  }

  const updateAdvisor = (name, value) => {
    setAdvisor((current) => ({ ...current, [name]: value }))
  }

  const addAiPlanToForm = () => {
    setForm((current) => ({
      ...current,
      projectType: 'Bathroom remodel',
      budget: aiPlan.budget,
      message: [
        `Design direction: ${aiPlan.headline}.`,
        `Style notes: ${aiPlan.bullets[0]}.`,
        `Priority: ${aiPlan.bullets[1]}.`,
        'Please call me to walk through measurements, photos, and next steps.',
      ].join('\n'),
    }))
    setStatus('Design direction added to the estimate form.')
    window.setTimeout(() => {
      document.getElementById('estimate')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  return (
    <main>
      <a className="skip-link" href="#top">
        Skip to content
      </a>
      <SiteHeader menuOpen={menuOpen} goHome={goHome} goSection={goSection} setMenuOpen={setMenuOpen} />

      <HomePage
        advisor={advisor}
        aiPlan={aiPlan}
        form={form}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        status={status}
        submitting={submitting}
        submitted={submitted}
        onReset={resetForm}
        updateAdvisor={updateAdvisor}
        addAiPlanToForm={addAiPlanToForm}
        goSection={goSection}
        reveal={reveal}
        setReveal={setReveal}
      />

      <SiteFooter goSection={goSection} />

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
          Get free estimate
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </main>
  )
}

export default App
