# Flanagan Construction

A fast, mobile-first lead generation homepage for a Newark, Delaware construction and remodeling company.

## Highlights

- Hero section built for the homepage-first customer journey.
- Animated project imagery and motion accents.
- Lead form that saves a local browser backup and opens a prefilled email.
- Admin-friendly business content in `src/content.js`.
- Responsive service, process, and admin sections.

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
Railway logs), appends it to `leads.log`, and optionally forwards it to
`LEAD_WEBHOOK_URL`. If the API is unreachable (e.g. on static GitHub Pages), the
form falls back to opening the visitor's email app via `mailto:`.

## Admin Updates

Edit `src/content.js` to change the company phone, email, service area, services,
proof points, and admin notes.

## SEO

- Metadata, Open Graph/Twitter cards, geo tags, and `GeneralContractor`
  structured data live in `index.html`.
- `public/robots.txt` and `public/sitemap.xml` ship with the build.
- The canonical/share URLs use `https://flanaganconstructionde.com`. Update them
  (and the structured-data phone/address) to match your real domain and NAP.
