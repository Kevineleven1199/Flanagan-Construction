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

## Admin Updates

Edit `src/content.js` to change the company phone, email, service area, services, proof points, and admin notes.

The lead form currently uses `mailto:` so the site works as a static GitHub project. For production, connect the form to Formspree, Netlify Forms, HubSpot, or another CRM endpoint.
