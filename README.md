# Flanagan Construction

A fast, mobile-first lead generation homepage for a New Castle County, Delaware construction and remodeling company.

## Highlights

- Conversion-focused single-page funnel: grounded hero, contact-first project
  path, multi-select service needs, referral ask, stats band, reviews,
  guarantees, "how it works", FAQ, and CTA band.
- Server-side lead capture (`POST /api/lead`) with spam honeypot, rate limiting,
  success state, and a `mailto:` fallback.
- SEO: rich meta, Open Graph/Twitter, `GeneralContractor` + `FAQPage` structured
  data, sitemap, robots, and a web manifest.
- Accessible (skip link, visible focus, reduced-motion, native FAQ accordion) and
  hardened (gzip, CSP, HSTS, branded 404).
- All business content lives in `src/content.js`.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Run in production (Railway, Render, Docker, any Node host)

```bash
npm run build   # creates dist/
npm run start   # serves dist/ on $PORT (default 8080) via server.js
```

`server.js` is a zero-dependency Node server that:

- binds to `0.0.0.0:$PORT` (required by Railway),
- serves the built `dist/` folder with long-term caching for hashed assets,
- falls back to `index.html` for unknown routes (single-page app),
- exposes `GET /health` for Railway's healthcheck,
- captures final quote leads at `POST /api/lead` and started-but-unfinished
  funnel leads at `POST /api/lead-draft`.

### Deploying to Railway

1. Create a project from this GitHub repo. Railway auto-detects `railway.json` / `nixpacks.toml`.
2. It runs `npm install` > `npm run build` > `node server.js`. No extra settings needed.
3. (Optional) set `LEAD_WEBHOOK_URL` to forward every lead as JSON to Zapier, Make,
   Slack, Discord, or a CRM. Without it, leads still appear in the deploy logs.
4. (Optional) set `VITE_GOOGLE_MAPS_API_KEY` to enable Google Places address
   autocomplete on the estimate form. Restrict the key to your domain in Google
   Cloud and enable Maps JavaScript API plus Places API.
5. Add your custom domain in Railway and point DNS to it.

## Lead capture

The funnel saves started requests early. Once a visitor enters phone or email,
the browser debounces and `POST`s a draft lead to `/api/lead-draft`; final
submissions go to `/api/lead` with the same lead id so the CRM shows one
deduped record. The server logs every lead (visible in Railway logs), appends it
to `leads.log`, and forwards final leads to `LEAD_WEBHOOK_URL` if set. If the
API is unreachable (e.g. on static GitHub Pages), the form falls back to opening
the visitor's email app via `mailto:`.

## Admin dashboard

Visit `/admin` to manage leads and edit site content. From the public site,
press `g` then `a` to jump straight to the admin login. The dashboard supports
named super-admin email/password login. Two default super admins are configured
by hashed credentials in the server:

- `nickflanagan73@gmail.com`
- `kevin@ndabox.com`

For production rotation, set `ADMIN_USERS_JSON` with replacement password
hashes and `ADMIN_SESSION_SECRET` for stable signed sessions. `ADMIN_PASSWORD`
still works as a legacy bearer token fallback for emergency scripts.

- CRM pipeline: search leads, update status/priority, add next steps and notes,
  track estimate/payment/follow-up fields, prepare stage-based email drafts,
  call/email a lead, see selected funnel needs, and export CSV.
- Money & reports: track internal labor/material/subcontractor costs, markup,
  customer quote price, received revenue, expenses, gross profit, Joist estimate
  and invoice references, payment links, CPA CSV exports, and CPA email summary
  drafts.
- Site editor: update business info, hero/CTA copy, service text, gallery
  photos, before/after photos, reviews, FAQs, process copy, optional HTML
  blocks, New Castle County service locations, and drag/drop asset swaps.

Saved content is written to `site-content.json`, while lead status/notes are
written to `lead-crm.json`. During local Vite development, the dashboard falls
back to browser storage if the Node API is not running.

### Outbound email prep

The CRM is ready for Nick's Gmail SMTP settings. Add these Railway variables
when you are ready to move from mailto drafts to server-sent email:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_USER=nickflanagan73@gmail.com`
- `SMTP_SECRET_KEY=<Gmail app password>`
- `SMTP_FROM=Nick Flanagan <nickflanagan73@gmail.com>`

### Joist and Square transition

See [docs/joist-square-transition.md](docs/joist-square-transition.md) for the
Joist bridge workflow, Square payment-link path, CPA reporting routine, and
future `info@yourdomain.com` email sender plan.

### Get leads delivered to you (60 seconds, no code)

Set a `LEAD_WEBHOOK_URL` variable on the Railway service. The server auto-formats
based on the URL:

- **Slack** - create an Incoming Webhook, paste its `https://hooks.slack.com/...`
  URL. You get a readable message per lead.
- **Discord** - Channel > Edit > Integrations > Webhooks > New, paste the
  `https://discord.com/api/webhooks/...` URL. Readable message per lead.
- **Email / SMS / spreadsheet** - make a Zapier or Make webhook trigger and paste
  its URL. The server sends raw lead JSON; map it to an email (or anything) there.

No webhook? Leads still appear in the Railway deploy logs and `leads.log`.

## Editing content

Everything customer-facing is in `src/content.js`:

- `business` - name, phone, email, location, service area.
- `services`, `proofPoints` - service cards and hero trust points.
- `stats` - the headline numbers band (verify the years/projects figures).
- `guarantees` - the "our promise" checklist.
- `testimonials` - **sample reviews; replace with real, verifiable ones.**
- `faqs` - FAQ accordion. Keep it in sync with the `FAQPage` JSON-LD in `index.html`.

## SEO

- Metadata, Open Graph/Twitter cards, geo tags, `GeneralContractor`, and
  `FAQPage` structured data live in `index.html`.
- `public/robots.txt`, `public/sitemap.xml`, and `public/site.webmanifest` ship
  with the build.
- Canonical/share URLs use `https://flanaganconstructionde.com`. Update them (and
  the structured-data phone/address) to match your real domain and NAP.

## Before you launch

1. Replace the **sample testimonials** in `src/content.js` with real reviews.
   Only add `Review`/`AggregateRating` structured data once reviews are genuine -
   fake review markup violates Google policy.
2. Confirm the **domain** and update the canonical/OG URLs if it differs.
3. Verify the **stats** (years in business, projects completed) are accurate.
4. (Optional) Set `LEAD_WEBHOOK_URL` so leads are delivered somewhere beyond logs,
   and install a tag manager - the site already pushes `generate_lead` and
   `phone_click` events to `window.dataLayer`.
