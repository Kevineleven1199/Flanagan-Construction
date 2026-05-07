import { lazy, Suspense, useMemo, useState } from 'react'
import {
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
  MousePointer2,
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
  })
  const [status, setStatus] = useState('')

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
        `AI showroom plan: ${aiPlan.headline}.`,
        `Style direction: ${aiPlan.bullets[0]}.`,
        `Priority: ${aiPlan.bullets[1]}.`,
        'Please call me to walk through measurements, photos, and next steps.',
      ].join('\n'),
    }))
    setStatus('AI plan added to the estimate form.')
    document.getElementById('estimate')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Flanagan Construction home">
          <span className="brand-mark">
            <Hammer size={20} aria-hidden="true" />
          </span>
          <span>
            <strong>{business.name}</strong>
            <small>{business.location}</small>
          </span>
        </a>

        <nav className={menuOpen ? 'nav open' : 'nav'} aria-label="Primary navigation">
          <a href="#services" onClick={() => setMenuOpen(false)}>
            Services
          </a>
          <a href="#work" onClick={() => setMenuOpen(false)}>
            Work
          </a>
          <a href="#ai" onClick={() => setMenuOpen(false)}>
            AI Plan
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

      <section id="top" className="hero-section">
        <Suspense fallback={<div className="three-showroom three-fallback" aria-hidden="true" />}>
          <ThreeBathroomShowroom />
        </Suspense>
        <div className="hero-media" aria-hidden="true">
          <div className="photo photo-one"></div>
          <div className="photo photo-two"></div>
          <div className="photo photo-three"></div>
          <div className="measure-line line-one"></div>
          <div className="measure-line line-two"></div>
        </div>

        <div className="hero-copy">
          <p className="eyebrow">
            <MapPin size={16} aria-hidden="true" />
            Newark bathroom remodeling
          </p>
          <h1>Bathrooms that make people stop scrolling.</h1>
          <p className="hero-lede">
            Flanagan Construction turns tired bathrooms into sharp, high-value spaces with clean
            tile, glass showers, waterproof details, and a quote path that takes less than a minute.
          </p>

          <div className="hero-tech-strip" aria-label="Interactive site features">
            <span>
              <Layers3 size={16} aria-hidden="true" />
              Live 3D showroom
            </span>
            <span>
              <BrainCircuit size={16} aria-hidden="true" />
              AI remodel plan
            </span>
            <span>
              <MousePointer2 size={16} aria-hidden="true" />
              Motion-led quote path
            </span>
          </div>

          <div className="hero-actions">
            <a className="primary-action" href="#estimate">
              Get a fast estimate
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className="secondary-action" href={`tel:${business.phone.replace(/\D/g, '')}`}>
              <Phone size={18} aria-hidden="true" />
              {business.phone}
            </a>
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
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
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
          <h2>Big bathroom energy, handled by a crew that respects the house.</h2>
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
            Customers hit the homepage first, so the page now leads with premium bathroom visuals,
            stronger conversion copy, and a quote form that is always close.
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
          <h2>A 24/7 remodel concierge baked into the homepage.</h2>
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
          {['Show the dream', 'Capture the lead', 'Scope the remodel', 'Build the upgrade'].map(
            (step, index) => (
              <div className="process-step" key={step}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{step}</strong>
              </div>
            ),
          )}
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

      <footer>
        <strong>{business.name}</strong>
        <span>{business.serviceArea}</span>
        <a href={`mailto:${business.email}`}>{business.email}</a>
      </footer>
    </main>
  )
}

export default App
