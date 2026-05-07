import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Bath,
  Building2,
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

const projectTypes = ['Kitchen', 'Bathroom', 'Basement', 'Addition', 'Repair', 'Whole-home refresh']
const budgetRanges = ['$2k-$10k', '$10k-$25k', '$25k-$50k', '$50k+', 'Not sure yet']
const timelines = ['ASAP', 'This month', '1-3 months', 'Planning ahead']

const icons = [Home, Bath, Building2, Hammer]

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
            Newark remodels, repairs, and additions
          </p>
          <h1>Turn the house you have into the home you actually want.</h1>
          <p className="hero-lede">
            Flanagan Construction helps Delaware homeowners plan smart, build clean, and move
            from idea to finished space without the usual runaround.
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
                placeholder="Example: replace tub with walk-in shower, update tile, and repair drywall."
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
          Free estimate workflow
        </span>
        <span>
          <ShieldCheck size={18} aria-hidden="true" />
          Clean jobsite standards
        </span>
        <span>
          <ClipboardCheck size={18} aria-hidden="true" />
          Written scope before work begins
        </span>
      </section>

      <section className="section" id="services">
        <div className="section-heading">
          <p className="eyebrow">What homeowners ask for most</p>
          <h2>High-impact remodeling with a simple customer path.</h2>
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

      <section className="work-section" id="work">
        <div className="work-copy">
          <p className="eyebrow">Designed for skimming</p>
          <h2>Customers get confidence fast. Admin gets fewer messy calls.</h2>
          <p>
            The homepage puts the quote form, phone number, proof points, services, and service
            area within one scroll. Visitors can act immediately, while the business can update
            the important details from one content file.
          </p>
        </div>
        <div className="process-list">
          {['Tell us the project', 'Get a clear follow-up', 'Approve the scope', 'Build with less stress'].map(
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
