# Dormant features (kept for later)

Code here is intentionally **not** part of the live site or the build. Nothing in
the app imports it, so it adds zero weight to the production bundle.

## ThreeBathroomShowroom.jsx

An interactive 3D bathroom showroom (Three.js) that previously powered a
"Design your dream bathroom" page. Parked here to keep the public site focused on
lead capture and quoting. The `three` dependency is still in `package.json` so it
can be re-enabled later.

To bring it back: move the file into `src/`, re-add a lazy import in
`src/App.jsx`, and restore the route/section that renders it.
