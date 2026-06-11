import { useEffect, useMemo, useRef, useState } from 'react'
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

const projectTypes = ['Kitchen', 'Bathroom', 'Deck', 'Addition', 'Interior work', 'Exterior work', 'Concrete', 'Commercial', 'Referral']
const budgetRanges = ['Small repair', 'Medium project', 'Large project', 'Not sure yet']
const timelines = ['ASAP', 'This month', '1-3 months', 'Planning ahead']
const icons = [Bath, Sparkles, Home, Hammer]

const heroCredibilityIcons = [ShieldCheck, ClipboardCheck, Clock3]
const quickBandIcons = [Clock3, ShieldCheck, ClipboardCheck]
const aiMetricIcons = [ScanLine, Ruler, Palette]

const processSteps = [
  { title: 'Free consultation', copy: 'We visit, listen, and measure, with no pressure and no obligation.' },
  { title: 'Clear written estimate', copy: 'A detailed scope and price before any demolition begins.' },
  { title: 'Clean, careful build', copy: 'Tidy crews, daily jobsite care, and proper waterproofing.' },
  { title: 'Final walkthrough', copy: 'We review every detail together and handle the punch list.' },
]

const advisorStyles = ['Kitchen', 'Bathroom', 'Deck/porch', 'Concrete']
const advisorScopes = ['Remodel', 'Repair', 'Build new', 'Fix bad work']
const advisorPriorities = ['Quality', 'Speed', 'Budget control', 'Resale value']

const styleNotes = {
  Kitchen: 'layout, cabinets, counters, flooring, lighting, and trade coordination',
  Bathroom: 'tile, ventilation, plumbing coordination, waterproofing, and finish work',
  'Deck/porch': 'framing, decking, railings, stairs, screens, and exterior details',
  Concrete: 'sidewalks, driveways, pavers, patios, walls, and site work',
}

const scopeBudgets = {
  Remodel: 'Medium project',
  Repair: 'Small repair',
  'Build new': 'Large project',
  'Fix bad work': 'Not sure yet',
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
  selectedGroupId,
  setSelectedGroupId,
  selectedNeeds,
  toggleNeed,
  draftSaving,
  lastSavedAt,
}) {
  const activeGroup = leadFunnel.groups.find((group) => group.id === selectedGroupId) || leadFunnel.groups[0]

  if (submitted) {
    const firstName = form.name ? form.name.trim().split(' ')[0] : ''
    return (
      <aside className="lead-panel lead-success" id="estimate" aria-label="Request received">
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
    <aside className="lead-panel" id="estimate" aria-label="Request an estimate">
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

        <div className="funnel-save-note" aria-live="polite">
          <CheckCircle2 size={16} aria-hidden="true" />
          {draftSaving
            ? 'Saving your started request...'
            : lastSavedAt
              ? `Started request saved at ${lastSavedAt}`
              : leadFunnel.contactNudge}
        </div>

        <div className="funnel-roadmap" aria-label="Project category">
          {leadFunnel.groups.map((group) => (
            <button
              className={group.id === activeGroup.id ? 'funnel-road active' : 'funnel-road'}
              key={group.id}
              type="button"
              aria-pressed={group.id === activeGroup.id}
              onClick={() => setSelectedGroupId(group.id)}
            >
              <strong>{group.label}</strong>
              <span>{group.summary}</span>
            </button>
          ))}
        </div>

        <fieldset className="funnel-needs">
          <legend>{activeGroup.label} needs</legend>
          <div className="need-chip-grid">
            {activeGroup.needs.map((need) => {
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

        <div className="selected-needs-box">
          <strong>Selected work</strong>
          {selectedNeeds.length ? (
            <div>
              {selectedNeeds.map((need) => (
                <button key={need} type="button" onClick={() => toggleNeed(need)}>
                  {need}
                  <X size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <p>Tap anything that fits. You can choose more than one.</p>
          )}
        </div>

        <div className="field-grid">
          <label>
            Job size
            <select name="budget" value={form.budget} onChange={handleChange}>
              {budgetRanges.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Timeline
            <select name="timeline" value={form.timeline} onChange={handleChange}>
              {timelines.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Anything else we should know?
          <textarea
            name="message"
            value={form.message}
            onChange={handleChange}
            rows="4"
            placeholder="Example: kitchen and bathroom work, a cheaper bid that went wrong, concrete driveway, siding, or a subcontractor introduction."
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
          <p>Job size: {aiPlan.budget}</p>
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

function StatsBand({ stats }) {
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

function ReviewsSection({ reviews, testimonials }) {
  return (
    <section className="reviews-section" id="reviews" aria-label="Customer reviews">
      <div className="section-heading">
        <p className="eyebrow">{reviews.eyebrow}</p>
        <h2>{reviews.title}</h2>
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

function GuaranteesSection({ guaranteesIntro, guarantees }) {
  return (
    <section className="guarantees-section" aria-label="Our promise">
      <div className="guarantees-copy">
        <p className="eyebrow">
          <Award size={16} aria-hidden="true" />
          {guaranteesIntro.eyebrow}
        </p>
        <h2>{guaranteesIntro.title}</h2>
        <p>{guaranteesIntro.copy}</p>
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

function FaqSection({ faqIntro, faqs }) {
  return (
    <section className="faq-section" id="faq" aria-label="Frequently asked questions">
      <div className="section-heading">
        <p className="eyebrow">
          <HelpCircle size={16} aria-hidden="true" />
          {faqIntro.eyebrow}
        </p>
        <h2>{faqIntro.title}</h2>
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

function ReferralSection({ referralSpeech }) {
  return (
    <section className="referral-section" aria-label="BNI referral speech">
      <div className="referral-copy">
        <p className="eyebrow">{referralSpeech.eyebrow}</p>
        <h2>{referralSpeech.title}</h2>
        <p>{referralSpeech.copy}</p>
      </div>
      <div className="referral-lists">
        <article>
          <h3>{referralSpeech.referralIntro}</h3>
          <ul>
            {referralSpeech.referralPartners.map((item) => (
              <li key={item}>
                <CheckCircle2 size={17} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </article>
        <article>
          <h3>{referralSpeech.workIntro}</h3>
          <ul>
            {referralSpeech.targetWork.map((item) => (
              <li key={item}>
                <CheckCircle2 size={17} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}

function HomePage({
  content,
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
  selectedGroupId,
  setSelectedGroupId,
  selectedNeeds,
  toggleNeed,
  draftSaving,
  lastSavedAt,
}) {
  const {
    aiPlanner,
    business,
    compare,
    cta,
    estimate,
    faqIntro,
    faqs,
    gallery,
    guarantees,
    guaranteesIntro,
    hero,
    heroCredibility,
    images,
    leadFunnel,
    processSteps: contentProcessSteps,
    proofPoints,
    quickBand,
    referralSpeech,
    reviews,
    services,
    servicesIntro,
    stats,
    testimonials,
    work,
  } = content
  const phoneHref = phoneHrefFor(business.phone)
  const activeProcessSteps = contentProcessSteps?.length ? contentProcessSteps : processSteps

  return (
    <>
      <section id="top" className="hero-section grounded-hero" style={{ '--hero-photo': cssUrl(images.hero) }}>
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
          <div className="hero-tech-strip" aria-label="Why homeowners choose us">
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
      </section>

      <section id="estimate" className="estimate-section" aria-label="Request an estimate">
        <div className="estimate-copy">
          <p className="eyebrow">{estimate.eyebrow}</p>
          <h2>{estimate.title}</h2>
          <p>{estimate.copy}</p>
          <ul className="estimate-points">
            {proofPoints.map((point) => (
              <li key={point}>
                <CheckCircle2 size={18} aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
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
          selectedGroupId={selectedGroupId}
          setSelectedGroupId={setSelectedGroupId}
          selectedNeeds={selectedNeeds}
          toggleNeed={toggleNeed}
          draftSaving={draftSaving}
          lastSavedAt={lastSavedAt}
        />
      </section>

      <section className="quick-band" aria-label="Service area and availability">
        {quickBand.map((item, index) => {
          const Icon = quickBandIcons[index] || CheckCircle2
          return (
            <span key={item}>
              <Icon size={18} aria-hidden="true" />
              {item}
            </span>
          )
        })}
      </section>

      <StatsBand stats={stats} />

      <section className="section" id="services">
        <div className="section-heading">
          <p className="eyebrow">{servicesIntro.eyebrow}</p>
          <h2>{servicesIntro.title}</h2>
        </div>
        <div className="service-grid">
          {services.map((service, index) => {
            const Icon = icons[index] || Paintbrush
            return (
              <article className={index < 3 ? 'service-card priority-service-card' : 'service-card'} key={service.title}>
                {index < 3 ? <span className="priority-rank">Top {index + 1}</span> : null}
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
          <p className="eyebrow">{gallery.eyebrow}</p>
          <h2>{gallery.title}</h2>
          <p>{gallery.copy}</p>
        </div>
        <div className="bathroom-gallery">
          {gallery.items.map((item, index) => (
            <article
              className={`bathroom-card bathroom-card-${index + 1}`}
              key={item.title}
              style={{ backgroundImage: cssUrl(item.image) }}
            >
              <div>
                <span>0{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <ReferralSection referralSpeech={referralSpeech} />

      <ReviewsSection reviews={reviews} testimonials={testimonials} />

      <section className="ai-section" id="ai" style={{ '--ai-photo': cssUrl(images.aiBackground) }}>
        <div className="ai-copy">
          <p className="eyebrow">
            <BrainCircuit size={16} aria-hidden="true" />
            {aiPlanner.eyebrow}
          </p>
          <h2>{aiPlanner.title}</h2>
          <p>{aiPlanner.copy}</p>
          <div className="ai-metrics" aria-label="Planner features">
            {aiPlanner.metrics.map((metric, index) => {
              const Icon = aiMetricIcons[index] || Sparkles
              return (
                <span key={metric}>
                  <Icon size={18} aria-hidden="true" />
                  {metric}
                </span>
              )
            })}
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
            {compare.eyebrow}
          </p>
          <h2>{compare.title}</h2>
          <p>{compare.copy}</p>
        </div>
        <div className="compare-wrap">
          <div className="compare-stage" style={{ '--reveal': `${reveal}%` }}>
            <div className="compare-image compare-before" style={{ backgroundImage: cssUrl(compare.beforeImage) }}></div>
            <div className="compare-image compare-after" style={{ backgroundImage: cssUrl(compare.afterImage) }}></div>
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

      <GuaranteesSection guaranteesIntro={guaranteesIntro} guarantees={guarantees} />

      <section className="work-section" id="work" style={{ '--work-photo': cssUrl(images.workBackground) }}>
        <div className="work-copy">
          <p className="eyebrow">{work.eyebrow}</p>
          <h2>{work.title}</h2>
          <p>{work.copy}</p>
        </div>
        <div className="process-list">
          {activeProcessSteps.map((step, index) => (
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

      <FaqSection faqIntro={faqIntro} faqs={faqs} />

      <section className="cta-band" aria-label="Request your estimate">
        <div>
          <h2>{cta.title}</h2>
          <p>{cta.copy}</p>
        </div>
        <div className="cta-band-actions">
          <a className="primary-action" href="#estimate" onClick={() => goSection('estimate')}>
            {cta.primaryCta}
            <ArrowRight size={18} aria-hidden="true" />
          </a>
          <a className="secondary-action" href={phoneHref}>
            <Phone size={18} aria-hidden="true" />
            {business.phone}
          </a>
        </div>
      </section>
    </>
  )
}

function SiteFooter({ business, services, goSection }) {
  const year = new Date().getFullYear()
  const phoneHref = phoneHrefFor(business.phone)
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
        <span>Construction, remodeling, repairs, and referrals</span>
      </div>
    </footer>
  )
}

function App() {
  const [siteContent, setSiteContent] = useState(() => mergeSiteContent(defaultSiteContent, loadStoredContent()))
  const [routePath, setRoutePath] = useState(() => window.location.pathname)
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
    const handleRoute = () => setRoutePath(window.location.pathname)
    window.addEventListener('popstate', handleRoute)
    return () => window.removeEventListener('popstate', handleRoute)
  }, [])

  const aiPlan = useMemo(() => {
    const score =
      78 +
      advisorStyles.indexOf(advisor.style) * 3 +
      advisorScopes.indexOf(advisor.scope) * 2 +
      advisorPriorities.indexOf(advisor.priority)
    const priorityLine = {
      Quality: 'price the real scope and line up the right trades before work starts',
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
        `Project type: ${selectedNeeds.length ? selectedNeeds.join(', ') : 'Not selected yet'}`,
        `Budget: ${form.budget}`,
        `Timeline: ${form.timeline}`,
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

  const toggleNeed = (need) => {
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
      `Job size: ${form.budget}`,
      `Timeline: ${form.timeline}`,
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
      projectType: aiPlan.headline,
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

  if (routePath.startsWith('/admin')) {
    return <AdminDashboard content={siteContent} setContent={setSiteContent} goHome={goHome} />
  }

  return (
    <main>
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
        selectedGroupId={selectedGroupId}
        setSelectedGroupId={setSelectedGroupId}
        selectedNeeds={selectedNeeds}
        toggleNeed={toggleNeed}
        draftSaving={draftSaving}
        lastSavedAt={lastSavedAt}
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
