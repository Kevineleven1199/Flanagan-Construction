import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` defaults to '/' for Railway / custom-domain hosting so client-side
// deep links (e.g. /design-your-dream-bathroom) load their assets correctly on
// a direct visit or refresh. The GitHub Pages workflow sets
// VITE_BASE=/Flanagan-Construction/ for its project-subpath deploy.
// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  build: {
    chunkSizeWarningLimit: 700,
  },
  plugins: [react()],
})
