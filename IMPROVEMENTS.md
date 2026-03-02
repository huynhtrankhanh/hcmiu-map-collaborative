# Improvements Overview

## Highlights
- Refreshed visual language (Space Grotesk, glassy panels, teal/amber gradients) for all pages while keeping map primitives legible.
- Map Explorer now includes instant room/lift search, selection centering, zoom presets, refreshed legend, and richer collaboration sidebar with live stats/errors.
- Shortest Path and Traveling Salesman pages surface hop counts, floor coverage, walking time estimates, and ready-made preset routes for quick demos.
- Collaborative workspace gains a status halo (entities/trials/notifications/mode/map focus) and scrollable lists to keep screenshots and navigation responsive.
- Backend now serves permissive CORS headers and the frontend auto-points dev sessions on port 5173 to the backend on 3000.

## How to Run
- Install deps: `npm install`
- Start ArangoDB/Backend via Docker Compose: `docker compose up --build`
- Dev frontend with backend: `VITE_API_BASE_URL=http://localhost:3000 npm run dev -- --host --port 5173`
- Full stack validation: `npm run test:e2e` (launches Docker Compose and headless browser)

## Validation
- `npm run build`
- `npm run test:api`
- `npm run test:e2e`
