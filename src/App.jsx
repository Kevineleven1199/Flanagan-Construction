import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bath,
  BrainCircuit,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Hammer,
  Home,
  Layers3,
  Mail,
  MapPin,
  Menu,
  Palette,
  Paintbrush,
  Phone,
  Ruler,
  ScanLine,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react'
import { adminNotes, business, proofPoints, services } from './content'
import './App.css'

const ThreeBathroomShowroom = lazy(() => import('./ThreeBathroomShowroom'))

const projectTypes = ['Bathroom remodel', 'Shower conversion', 'Kitchen', 'Basement', 'Addition', 'Repair']
const budgetRanges = ['$2k-$10k', '$10k-$25k', '$25k-$50k', '$50k+', 'Not sure yet']
const timelines = ['ASAP', 'This month', '1-3 months', 'Planning ahead']
const icons = [Bath, Sparkles, Home, Hammer]

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

const dreamFinishes = [
  'Large-format porcelain walls',
  'Brushed brass or matte black fixtures',
  'Frameless glass shower enclosure',
  'Backlit mirror and layered warm lighting',
]

function currentRoute() {
  if (window.location.pathname.includes('design-your-dream-bathroom')) return 'dream'
  if (window.location.hash.includes('design-your-dream-bathroom')) return 'dream'
  return 'home'
}

function LeadPanel({ form, handleChange, handleSubmit, status }) {
  return (
    <aside className="lead-panel" id="estimate" aria-label="Request an estimate">
      <div className="panel-heading">
        <span>
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div>
          <h2>Start your estimate</h2>
          <p>Tell us what you need. We will follow up with next steps.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
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

        <button className="submit-button" type="submit">
          Send project request
          <Mail size={18} aria-hidden="true" />
        </button>
        <p className="form-note" aria-live="polite">
          {status || 'No pressure. Just a simple first step.'}
        </p>
      </form>
    </aside>
  )
}

function SiteHeader({ menuOpen, route, goHome, goSection, goDream, setMenuOpen }) {
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
          href="/#services"
          onClick={(event) => {
            event.preventDefault()
            goSection('services')
          }}
        >
          Services
        </a>
        <a
          href="/#work"
          onClick={(event) => {
            event.preventDefault()
            goSection('work')
          }}
        >
          Work
        </a>
        <a
          className={route === 'dream' ? 'active-link' : ''}
          href="/design-your-dream-bathroom"
          onClick={(event) => {
            event.preventDefault()
            goDream()
          }}
        >
          Design
        </a>
        <a className="nav-call" href={`tel:${business.phone.replace(/\D/g, '')}`}>
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
    <div className="ai-panel" aria-label="AI remodel advisor">
      <div className="ai-panel-top">
        <span>
          <WandSparkles size={20} aria-hidden="true" />
        </span>
        <div>
          <h3>Remodel Intelligence</h3>
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

function HomePage({
  advisor,
  aiPlan,
  form,
  handleChange,
  handleSubmit,
  status,
  updateAdvisor,
  addAiPlanToForm,
  goDream,
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
            Newark bathroom remodeling
          </p>
          <h1>Luxury bathroom remodels without the contractor chaos.</h1>
          <p className="hero-lede">
            Elegant tile, glass showers, warm lighting, clean waterproofing, and a quote process
            that feels polished from the first click.
          </p>

          <div className="hero-tech-strip" aria-label="Homepage experience features">
            <span>
              <Layers3 size={16} aria-hidden="true" />
              Subtle parallax visuals
            </span>
            <span>
              <BrainCircuit size={16} aria-hidden="true" />
              AI design brief
            </span>
            <span>
              <Camera size={16} aria-hidden="true" />
              Photo-led remodel story
            </span>
          </div>

          <div className="hero-actions">
            <a className="primary-action" href="#estimate">
              Get a fast estimate
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <button className="secondary-action button-link" type="button" onClick={goDream}>
              <Palette size={18} aria-hidden="true" />
              Design your dream bathroom
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

        <LeadPanel form={form} handleChange={handleChange} handleSubmit={handleSubmit} status={status} />
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
          <h2>Show the dream before they ask the price.</h2>
          <p>
            Premium visuals set the expectation instantly. Then the form turns that inspiration
            into a real project conversation.
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

      <section className="ai-section" id="ai">
        <div className="ai-copy">
          <p className="eyebrow">
            <BrainCircuit size={16} aria-hidden="true" />
            AI-powered project flow
          </p>
          <h2>A remodel concierge that turns taste into a smarter lead.</h2>
          <p>
            Visitors can choose a look, scope, and priority, then the site creates a polished
            project brief and drops it straight into the estimate form.
          </p>
          <div className="ai-metrics" aria-label="AI experience features">
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
          <h2>Make the transformation feel obvious before the call.</h2>
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

      <section className="work-section" id="work">
        <div className="work-copy">
          <p className="eyebrow">Built to convert</p>
          <h2>The homepage does the heavy lifting before the phone rings.</h2>
          <p>
            The first screen sells the bathroom transformation, the form captures the project
            details, and the rest of the page answers the questions homeowners usually ask out loud.
          </p>
        </div>
        <div className="process-list">
          {['Show the dream', 'Capture the lead', 'Scope the remodel', 'Build the upgrade'].map((step, index) => (
            <div className="process-step" key={step}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-section" id="admin">
        <div>
          <p className="eyebrow">Admin friendly</p>
          <h2>Change the basics without digging through the whole app.</h2>
        </div>
        <ul>
          {adminNotes.map((note) => (
            <li key={note}>
              <CheckCircle2 size={18} aria-hidden="true" />
              {note}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function DreamBathroomPage({ advisor, aiPlan, updateAdvisor, addAiPlanToForm, goHome }) {
  return (
    <>
      <section className="dream-hero">
        <div className="dream-copy">
          <p className="eyebrow">
            <Palette size={16} aria-hidden="true" />
            Design your dream bathroom
          </p>
          <h1>Dial in the mood before we talk measurements.</h1>
          <p>
            Explore a quick concept studio for the look, scope, and finish direction. Then send a
            cleaner project brief into the estimate form before we talk measurements.
          </p>
          <div className="hero-actions">
            <button className="primary-action button-link" type="button" onClick={addAiPlanToForm}>
              Add my direction to the estimate
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button className="secondary-action button-link" type="button" onClick={goHome}>
              <ArrowLeft size={18} aria-hidden="true" />
              Back to homepage
            </button>
          </div>
        </div>

        <div className="dream-lab">
          <div className="dream-showroom-frame">
            <Suspense fallback={<div className="three-showroom three-fallback" aria-hidden="true" />}>
              <ThreeBathroomShowroom />
            </Suspense>
            <div className="dream-frame-label">
              <span>Concept preview</span>
              <strong>{aiPlan.headline}</strong>
            </div>
          </div>
          <AdvisorPanel
            advisor={advisor}
            aiPlan={aiPlan}
            updateAdvisor={updateAdvisor}
            addAiPlanToForm={addAiPlanToForm}
          />
        </div>
      </section>

      <section className="dream-moodboard">
        <div>
          <p className="eyebrow">Finish direction</p>
          <h2>Keep the choices premium, calm, and buildable.</h2>
        </div>
        <div className="finish-grid">
          {dreamFinishes.map((finish) => (
            <article key={finish}>
              <CheckCircle2 size={18} aria-hidden="true" />
              <strong>{finish}</strong>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}

function App() {
  const [route, setRoute] = useState(currentRoute)
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
  })
  const [status, setStatus] = useState('')

  useEffect(() => {
    const syncRoute = () => setRoute(currentRoute())
    window.addEventListener('popstate', syncRoute)
    window.addEventListener('hashchange', syncRoute)
    return () => {
      window.removeEventListener('popstate', syncRoute)
      window.removeEventListener('hashchange', syncRoute)
    }
  }, [])

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

  const appBase = window.location.pathname.includes('/Flanagan-Construction') ? '/Flanagan-Construction' : ''

  const pushRoute = (nextRoute) => {
    const nextPath = nextRoute === 'dream' ? `${appBase}/design-your-dream-bathroom` : `${appBase}/`
    window.history.pushState({}, '', nextPath)
    setRoute(nextRoute)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goHome = () => pushRoute('home')
  const goDream = () => pushRoute('dream')

  const goSection = (id) => {
    if (route !== 'home') {
      window.history.pushState({}, '', `${appBase}/`)
      setRoute('home')
      setMenuOpen(false)
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 60)
      return
    }
    setMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const leads = JSON.parse(window.localStorage.getItem('flanagan-leads') || '[]')
    const lead = { ...form, createdAt: new Date().toISOString() }
    window.localStorage.setItem('flanagan-leads', JSON.stringify([lead, ...leads].slice(0, 50)))
    setStatus('Lead saved. Your email app is opening with the project details.')
    window.location.href = mailtoLink
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
    if (route !== 'home') {
      window.history.pushState({}, '', `${appBase}/`)
      setRoute('home')
    }
    window.setTimeout(() => {
      document.getElementById('estimate')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  return (
    <main>
      <SiteHeader
        menuOpen={menuOpen}
        route={route}
        goHome={goHome}
        goSection={goSection}
        goDream={goDream}
        setMenuOpen={setMenuOpen}
      />

      {route === 'dream' ? (
        <DreamBathroomPage
          advisor={advisor}
          aiPlan={aiPlan}
          updateAdvisor={updateAdvisor}
          addAiPlanToForm={addAiPlanToForm}
          goHome={goHome}
        />
      ) : (
        <HomePage
          advisor={advisor}
          aiPlan={aiPlan}
          form={form}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          status={status}
          updateAdvisor={updateAdvisor}
          addAiPlanToForm={addAiPlanToForm}
          goDream={goDream}
          reveal={reveal}
          setReveal={setReveal}
        />
      )}

      <footer>
        <strong>{business.name}</strong>
        <span>{business.serviceArea}</span>
        <a href={`mailto:${business.email}`}>{business.email}</a>
      </footer>
    </main>
  )
}

export default App
