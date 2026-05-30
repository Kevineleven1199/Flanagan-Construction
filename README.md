# Flanagan Construction

A fast, mobile-first lead generation homepage for a Newark, Delaware construction and remodeling company.

## Highlights

- Conversion-focused single-page funnel: hero estimate form, AI remodel planner,
  stats band, reviews, guarantees, "how it works", FAQ, and CTA band.
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
- captures quote leads at `POST /api/lead`.

### Deploying to Railway

1. Create a project from this GitHub repo. Railway auto-detects `railway.json` / `nixpacks.toml`.
2. It runs `npm install` → `npm run build` → `node server.js`. No extra settings needed.
3. (Optional) set `LEAD_WEBHOOK_URL` to forward every lead as JSON to Zapier, Make,
   Slack, Discord, or a CRM. Without it, leads still appear in the deploy logs.
4. Add your custom domain in Railway and point DNS to it.

## Lead capture

The estimate form `POST`s to `/api/lead`. The server logs every lead (visible in
Railway logs), appends it to `leads.log`, and forwards it to `LEAD_WEBHOOK_URL`
if set. If the API is unreachable (e.g. on static GitHub Pages), the form falls
back to opening the visitor's email app via `mailto:`.

### Get leads delivered to you (60 seconds, no code)

Set a `LEAD_WEBHOOK_URL` variable on the Railway service. The server auto-formats
based on the URL:

- **Slack** — create an Incoming Webhook, paste its `https://hooks.slack.com/...`
  URL. You get a readable message per lead.
- **Discord** — Channel → Edit → Integrations → Webhooks → New, paste the
  `https://discord.com/api/webhooks/...` URL. Readable message per lead.
- **Email / SMS / spreadsheet** — make a Zapier or Make webhook trigger and paste
  its URL. The server sends raw lead JSON; map it to an email (or anything) there.

No webhook? Leads still appear in the Railway deploy logs and `leads.log`.

## Editing content

Everything customer-facing is in `src/content.js`:

- `business` — name, phone, email, location, service area.
- `services`, `proofPoints` — service cards and hero trust points.
- `stats` — the headline numbers band (verify the years/projects figures).
- `guarantees` — the "our promise" checklist.
- `testimonials` — **sample reviews; replace with real, verifiable ones.**
- `faqs` — FAQ accordion. Keep it in sync with the `FAQPage` JSON-LD in `index.html`.

## SEO

- Metadata, Open Graph/Twitter cards, geo tags, `GeneralContractor`, and
  `FAQPage` structured data live in `index.html`.
- `public/robots.txt`, `public/sitemap.xml`, and `public/site.webmanifest` ship
  with the build.
- Canonical/share URLs use `https://flanaganconstructionde.com`. Update them (and
  the structured-data phone/address) to match your real domain and NAP.

## Before you launch

1. Replace the **sample testimonials** in `src/content.js` with real reviews.
   Only add `Review`/`AggregateRating` structured data once reviews are genuine —
   fake review markup violates Google policy.
2. Confirm the **domain** and update the canonical/OG URLs if it differs.
3. Verify the **stats** (years in business, projects completed) are accurate.
4. (Optional) Set `LEAD_WEBHOOK_URL` so leads are delivered somewhere beyond logs,
   and install a tag manager — the site already pushes `generate_lead` and
   `phone_click` events to `window.dataLayer`.
