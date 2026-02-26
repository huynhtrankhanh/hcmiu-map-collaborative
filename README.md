# hcmiu-map Collaborative

An interactive, community-powered map of the Ho Chi Minh City International University campus. It combines classic pathfinding features with a collaborative layer so students, staff, and visitors can share knowledge about every room, facility, and service on campus.

demo: **https://hcmiumap.huynhtrankhanh.com/**

## Purpose and core scenarios

- Help newcomers and visitors orient quickly, plan routes between classes, and chain multiple errands efficiently.
- Preserve campus knowledge (room functions, lab etiquette, cafeteria hours, accessibility notes) by attaching conversations directly to locations.
- Provide transparent, structured dialogue and dispute resolution so community decisions and history remain visible.
- Offer an open model other campuses can replicate to improve safety, accessibility, and participation in shared spaces.

## What the platform does

- **Campus map & navigation:** Browse labs, classrooms, cafeterias, gates, parking lots, and find the shortest route between any two points. A traveling-salesman-style planner helps you order multiple stops efficiently, and time estimates make planning predictable.
- **Collaborative knowledge base:** Every room, user, and comment is an entity that can be discussed, referenced, and followed. Threads stay attached to the places and people they describe, building durable context (e.g., which lab is free-friendly, which lecture hall has A/V quirks).
- **Real-time awareness:** Follow entities to receive in-app notifications when discussions change. WebSockets keep updates live so changes appear immediately during events, outages, or room changes.
- **Accountability workflows:** A built-in “court trial” flow lets communities resolve disputes with assigned judges, votes, and persistent discussion threads, reducing opaque back-channel decisions.
- **Deep research APIs:** Programmatic endpoints (see `/docs/collaborative-api.md`) power full-text search, degree-of-separation queries across entities, and reference graph exploration so researchers or integrators can analyze campus relationships.

## Why it matters for people

- **Wayfinding for everyone:** New students, visitors, and guests can quickly orient themselves, saving time and reducing stress in unfamiliar buildings; accessibility notes can highlight elevators, ramps, and quiet spaces.
- **Shared institutional memory:** Notes, discussions, and references travel with each room or service, making tacit knowledge discoverable (e.g., where to find spare adapters) and preserving context over time.
- **Transparent collaboration:** Notifications and structured discussions (including trials) help communities resolve issues openly instead of in private chats, creating a healthier governance pattern.
- **Open and adaptable:** The open-source stack and documented APIs let other campuses or organizations reuse the model to improve accessibility, safety, and participation in their own spaces, enabling a broader civic-mapping ecosystem.

## Is this a serious project?

It began as a data structures and algorithms course project and remains open-source. The codebase is actively extended as a collaborative demo platform through community-driven improvements and small maintenance updates, with no guaranteed release cadence. It is not operated as a production-grade navigation service (for example, no GPS hardware integration is planned). Treat it as a proof-of-concept you can run, study, and build upon. Contributions are welcome to make it more robust.

## Getting started

```bash
npm install
docker compose up -d arangodb
npm run dev:backend
npm run dev
```

frontend: `http://localhost:5173`  
backend: `http://localhost:3000`

### Docker Compose

```bash
docker compose up --build
```

### Tests

```bash
npm run test:api
npm run test:e2e
```

`npm run test:e2e` runs against the full Docker Compose deployment to validate production-like behavior.
