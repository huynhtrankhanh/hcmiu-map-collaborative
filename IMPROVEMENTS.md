## What changed

- Added a workspace chrome across pages with quick navigation, clear subtitles, and a visible handoff badge when jumping from the map to collaboration.
- Refreshed the landing page with operational guidance cards (Docker Compose, headless friendliness, collaboration hand-off) and clearer launch actions.
- Enhanced the map view sidebar with usage guidance, engagement badges (comment/reference counts), and a one-click shareable focus link.
- Restyled the entire experience with a glassy dark-gradient theme, softer cards, and button treatments that keep controls legible without the previous monochrome overrides.
- Tuned the end-to-end test to align with the backend-served frontend (port 3000) and prevent oversized screenshots.

## Validation

- `npm run build`
- `npm run test:api`
- `npm run test:e2e`
- `docker compose up --build -d` (manual run to exercise the stack)
- Headless walkthrough via Playwright: navigated landing → map view (room selection + collaboration CTA) → collaborative hub.
