import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Bath,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Hammer,
  Home,
  Mail,
  MapPin,
  Menu,
  Paintbrush,
  Phone,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { adminNotes, business, proofPoints, services } from './content'
import './App.css'

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

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
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
          <a href="#admin" onClick={() => setMenuOpen(false)}>
            Admin
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
