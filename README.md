# hcmiu-map
project for data structures and algorithms course. interactive map of HCMIU, pathfinding, time estimation

demo: **https://hcmiumap.huynhtrankhanh.com/**

- **map:** view what HCMIU has to offer. labs, cafeterias, classrooms, gates, parking lots
- **path finding:** find shortest path from one point to another
- **traveling salesman:** find shortest path to visit all places you specify

**disclaimer:**
- this is just a proof of concept of what is possible. the project won't be updated to reflect changes that might occur after the course is over
- there won't be any GPS. we are just normal civilians, having no access to ultra precise GPS hardware

**news!** we just made a map. check it out here https://docs.google.com/spreadsheets/d/1galtBxOVU2whRP9Qnm_-ibh5kDBov_ERUtFRs-rzguY/edit?usp=drivesdk

## collaborative platform

- frontend map features are retained
- new collaborative module includes authentication, entity discussions, follows + in-app notifications, court trials, and deep research APIs
- collaborative API docs: `/docs/collaborative-api.md`

### local development

```bash
npm install
docker compose up -d arangodb
npm run dev:backend
npm run dev
```

frontend: `http://localhost:5173`  
backend: `http://localhost:3000`

### docker compose

```bash
docker compose up --build
```

### tests

```bash
npm run test:api
npm run test:e2e
```

`npm run test:e2e` runs against the full Docker Compose deployment to validate production-like behavior.
