# HCMIU Collaborative API

Base URL: `http://localhost:3000`

## Deployment
Use Docker Compose to orchestrate the full stack:

```bash
docker compose up --build
```

Services:
- `arangodb` on port `8529`
- `backend` on port `3000`
- `frontend` on port `5173`

## Authentication (public content still readable)

Login is required for content creation APIs.

### Signup start
`POST /api/auth/signup/start`
```json
{ "username": "alice" }
```
Response:
```json
{ "clientSalt": "...", "serverSalt": "..." }
```

### Client-side password hashing
Use `sodium.crypto_pwhash` with `clientSalt` supplied by server.

### Signup finish
`POST /api/auth/signup/finish`
```json
{
  "username": "alice",
  "clientHash": "base64-hash-from-sodium",
  "clientSalt": "...",
  "serverSalt": "..."
}
```

Server stores:
- `clientSalt`
- `serverSalt`
- `SHA256(clientHash + ":" + serverSalt)`

### Login
1. `POST /api/auth/login/start` with username
2. hash password client-side with returned `clientSalt`
3. `POST /api/auth/login/finish` with username + clientHash

Returns bearer token.

## Entities and comments

### List entities
`GET /api/entities`

Optional query params:
- `type`
- `parentEntityId`

### Map integration entity lookup
`GET /api/map/entity?constructName=A1.109&floor=1`

Returns (and lazily provisions if needed) the collaborative entity for a map location (room/stairs), plus comments and referencing count for deep integration with map view.

### Create entity (auth required)
`POST /api/entities`
```json
{
  "type": "post",
  "title": "Room A1",
  "body": "A useful room",
  "references": ["entity_x"]
}
```

Comments are also entities:
```json
{
  "type": "comment",
  "body": "I agree",
  "parentEntityId": "entity_x",
  "references": ["entity_y"]
}
```
When a comment is created, the backend automatically adds a reference to the comment author's user entity.

### Follow entity
`POST /api/entities/:id/follow` (auth required)

Followers receive in-app notifications when new comments are added to followed entities.

## Notifications
- `GET /api/notifications` (auth)
- `POST /api/notifications/:id/read` (auth)

## Court of justice

### Create trial
`POST /api/trials` (auth)
```json
{
  "title": "Case title",
  "description": "Case details",
  "defendantUsername": "bob"
}
```

Each trial is also represented by a `trial` entity (`entityId` in trial object).

### Propose judges
`POST /api/trials/:id/propose-judges` (auth)
```json
{ "judges": ["judge1", "judge2"] }
```

Both plaintiff and defendant must propose the same judge set before trial becomes active.

### Vote
`POST /api/trials/:id/vote` (auth)
```json
{ "vote": "plaintiff" }
```
Allowed values: `plaintiff`, `defendant`, `no_winner`.

Outcome is calculated by judge votes. Discussion can continue via comments on the trial entity.

## Deep research capabilities

### Capability 1: Referencing entities
`GET /api/research/references?ids=entity_a,entity_b`

### Capability 2: Full-text search
`GET /api/research/fulltext?q=keyword`

### Capability 3: Degree of separation
`GET /api/research/degree?from=entity_x&to=entity_y`

Returns shortest reference-distance path and entities on that path.  
Reference relationships are treated as bidirectional (undirected graph).

## Real-time updates (WebSocket)
Connect to:
`ws://localhost:3000/ws?token=<bearer-token>`

Event types include:
- `entity.created`
- `trial.created`
- `trial.updated`
- `notification.created`

## Tests
- API: `npm run test:api`
- Puppeteer E2E (production-like): `npm run test:e2e`  
  This test spins up the full Docker Compose stack (`arangodb`, `backend`, `frontend`) before running browser automation.
