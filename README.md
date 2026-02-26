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

### Serious vs. satirical value

- **Serious utility (why it matters):** The navigation, entity graph, and discussion model are genuinely useful for campus wayfinding, knowledge capture, and transparent governance experiments. Research APIs and WebSocket-driven updates demonstrate real-time collaboration patterns that mirror modern platforms (follows, notifications, graph queries, and shortest-path calculations).
- **Playful and satirical edges (why it is also exploratory):** Features like “court trials” with judges and votes intentionally lean into a tongue-in-cheek framing of campus politics and moderation. They are not a legal system; they are a sandbox to think about decision-making, incentives, and accountability with low stakes and humor.
- **Practical adoption guidance:** If you deploy this beyond a demo, publish norms for civility, accuracy, and moderation; document who curates data; and set expectations for response times. Make it clear to users where satire ends and operational guidance begins to avoid confusion.
- **Safety and accuracy caveats:** The project ships without SLAs, GPS-grade positioning, or hazard-aware routing. Do not rely on it for emergency egress, safety-critical directions, or official record-keeping. Encourage users to verify directions on-site and to flag stale data.
- **Examples of serious use:** Orientation teams can preload vetted room descriptions and annotate accessibility paths; clubs can pin event logistics to rooms; researchers can analyze cross-entity references to understand collaboration patterns.
- **Examples of satirical/experimental use:** Student groups can run mock “trials” to debate cafeteria playlist choices or lab etiquette, using votes and comments to illustrate governance concepts without real-world consequences.
- **Contribution expectations:** Treat contributions as collaborative research and learning. Submit improvements that enhance clarity, resilience, and inclusivity. If you add playful features, label them clearly; if you add operational ones, document maintenance and reliability assumptions.

## Getting started

```bash
npm install
docker compose up -d arangodb
npm run build
npm run dev:backend
```

app (frontend + backend): `http://localhost:3000`

### Docker Compose

```bash
docker compose up --build
```

### Mobile builds

The Capacitor/Android build pipeline has been removed so the backend can serve the built frontend directly without origin whitelisting. Use the web deployment instead.

### Tests

```bash
npm run test:api
npm run test:e2e
```

`npm run test:e2e` runs against the full Docker Compose deployment to validate production-like behavior.
