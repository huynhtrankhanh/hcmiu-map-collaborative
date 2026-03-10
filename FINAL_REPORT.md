# FINAL REPORT — HCMIU Map Collaborative

**Course Name:** Advanced Database Management Systems  
**Project Topic Title:** HCMIU Map with multiple contributors and live updates  
**Instructor:** Nguyễn Thị Thúy Loan  
**Master's Student:** Huỳnh Trần Khanh  
**Student ID:** MITIU25210  
**Repository:** https://github.com/huynhtrankhanh/hcmiu-map-collaborative

## Abstract

HCMIU Map Collaborative is a web-based campus navigation and collaboration system built for Ho Chi Minh City International University. The project extends a conventional campus map into a graph-oriented information platform where rooms, stairs, users, comments, and trials are all modeled as entities that can reference one another. The system combines classic navigation features such as shortest-path finding and traveling-salesman optimization with collaborative capabilities including authentication, threaded discussions, entity following, notifications, a trial workflow, and research APIs for graph exploration.  

From an advanced database perspective, the most important design choice is the use of **ArangoDB**, a DBMS that DB-Engines classifies across document, graph, key-value, and search categories, while the official ArangoDB project describes it as combining native graphs, JSON documents, and a single query language [1][3]. This choice matches the project domain because the application stores heterogeneous JSON-like records while also needing explicit relationships, reverse reference lookup, and shortest-path traversal across linked entities. The implementation uses a React/Vite frontend, an Express/Node.js backend, WebSockets for live updates, and ArangoDB for persistence and graph queries.  

This report documents the project in the format requested by the course guideline: introduction, timeline and contribution, methodology, implementation discussion, conclusion, and references. It also evaluates how well the repository demonstrates advanced DBMS usage through multi-model storage, graph traversal, reverse reference queries, and full-text-like search.

---

## CHAPTER 1  
## Introduction

### 1.1 System overview

HCMIU Map Collaborative is an interactive campus system that serves two connected purposes:

1. **Navigation and planning**: users can browse a seven-floor map, compute shortest paths, and solve a multi-stop route optimization problem.
2. **Collaborative knowledge sharing**: users can attach discussion, references, and notifications directly to campus locations and other entities.

The repository README describes the platform as a community-powered map of HCMIU that supports room discovery, shortest-route planning, real-time awareness, transparent discussion, and structured dispute resolution (`README.md`). The tutorial and API documentation further show that the system is organized around a central idea: **everything is an entity**, including map locations, users, comments, and trials (`docs/tutorial.md`, `docs/collaborative-api.md`).

This makes the application especially suitable for a graph-capable database. Instead of treating content as isolated records, the system models knowledge as a connected network: comments reference entities, trials are entities, users are entities, and map locations are pre-provisioned as entities (`backend/server.mjs`). That design aligns well with ArangoDB’s published positioning as a native-graph, JSON-document, single-query-language platform [3]. It also fits the broader literature on indoor navigation systems, where environment representation, path planning, user interaction, and deployment practicality are recurring design concerns [7][9].

### 1.2 Project objectives

Based on the repository and the project-topic guideline, the project objectives can be stated as follows:

- Build a working demo application around a non-traditional DBMS selected from DB-Engines.
- Retain the original HCMIU map features while adding collaborative and research capabilities.
- Demonstrate both **basic operations** (create, update, delete, follow, notify) and **advanced database operations** (graph references, reverse lookup, shortest-path traversal, and text search).
- Provide a user interface and API layer that expose the selected DBMS in a meaningful application domain.
- Validate correctness through automated testing.

### 1.3 Techniques and tools used

The implementation stack is summarized below.

| Layer | Technology | Role |
|---|---|---|
| Frontend | TypeScript, Vite, React, Hyperscript, Tailwind CSS | User interface, map browsing, collaboration pages |
| Backend | Node.js, Express, `ws` | REST API, static hosting, WebSocket updates |
| Database | ArangoDB 3.11 via `arangojs` | Multi-model persistence, graph edges, AQL queries |
| Security | `libsodium-wrappers-sumo`, SHA-256 | Two-stage password hashing |
| Testing | Node test runner, Puppeteer, Docker Compose | API validation and end-to-end verification |
| Deployment | Docker Compose | Orchestrates ArangoDB, backend, and frontend/services |

The repository implements a single backend service in `backend/server.mjs`, a frontend rooted in `src/`, and container orchestration in `docker-compose.yml`.

### 1.4 Scope and limitations

#### Scope

The implemented scope is substantial for a demo project:

- campus map browsing across seven floors,
- shortest-path navigation,
- multi-stop route optimization,
- account creation and login,
- collaborative posting and commenting,
- entity following and in-app notifications,
- trial creation and judge-voting workflow,
- graph-based research APIs,
- live WebSocket updates,
- API and end-to-end tests.

#### Limitations

The repository also has clear technical boundaries:

- The system is a **demo/proof-of-concept**, not a production navigation system (`README.md`).
- The search implementation uses substring-style filtering in AQL rather than a dedicated ArangoSearch view.
- There is no explicit transactional workflow spanning multiple collections, even though ArangoDB supports transactions.
- The map pathfinding appears to use BFS and lift-based heuristics rather than weighted campus routing with accessibility, congestion, or time-aware constraints.
- The project depends on preconfigured Docker and local environment support for the full test stack.

### 1.5 Report structure

- **Chapter 1** introduces the system, objectives, tools, and scope.
- **Chapter 2** presents a project timeline and the individual-work framing required by the assignment.
- **Chapter 3** explains the methodology, including DBMS selection, logical data design, data population, query model, architecture, and UI design.
- **Chapter 4** discusses implementation details, results, challenges, and evaluation.
- **Chapter 5** concludes the report and proposes future work.

---

## CHAPTER 2  
## Project Timeline & Contribution

### 2.1 Project timeline

The repository does not contain a dated weekly diary, so the timeline below reconstructs a reasonable project progression from the current codebase structure, documentation, and tests.

| Week / Dates | Phase | Main tasks | Expected outcomes |
|---|---|---|---|
| Week 1 (Feb 16 - Feb 22) | Design & orchestration | set up Docker Compose for ArangoDB, backend, and frontend; define document and edge collections | runnable development stack and initial schema |
| Week 2 (Feb 23 - Mar 1) | Backend API implementation | connect Express to ArangoDB via `arangojs`; implement authentication, REST APIs, and WebSocket event distribution | working backend, proposal report submission |
| Week 3 (Mar 2 - Mar 8) | Collaboration & frontend integration | implement entity references, full-text-like search, trial workflow, and frontend integration | complete collaborative UI connected to backend |
| Week 4 (Mar 9 - Mar 13) | Testing & reporting | execute Node API tests and Puppeteer validation; finalize docs and final report | tested repository and completed final report |

### 2.2 Work breakdown by project phase

For a course submission following the provided guideline, the student is expected to complete all phases individually:

- topic selection,
- DBMS selection and justification,
- data modeling,
- implementation,
- experimentation and testing,
- documentation,
- final report writing.

This repository is consistent with that expectation because the implementation, tests, documentation, and proposal materials are tightly aligned around one coherent application and one chosen DBMS.

### 2.3 Phase-based work description

The proposal PDF explicitly identifies this work as an individual master's project by **Huỳnh Trần Khanh (MITIU25210)**. In the context of the course submission, the full design, implementation, experimentation, and reporting workflow is presented as the student's own work, consistent with the course requirement for an individual project.

---

## CHAPTER 3  
## Methodology

### 3.1 Selected Database Management System

The selected DBMS is **ArangoDB**.

This choice matches the assignment constraints because the project guideline requires a DBMS selected from DB-Engines and disallows commonly used systems such as MySQL, PostgreSQL, MongoDB, and SQLite. ArangoDB appears on DB-Engines as a supported and ranked system; at the time of writing, DB-Engines lists it as **#79 overall** and **#4 among graph DBMSs**, while also classifying it as document, graph, key-value, and search capable [1][2].

#### Why ArangoDB is appropriate for this project

HCMIU Map Collaborative benefits from ArangoDB for four reasons:

1. **Graph-friendly entity relationships**  
   The project needs explicit references between entities. Comments can reference posts, users, or rooms; trials are also entities; reverse reference lookup and degree-of-separation queries are core features. These are natural graph problems. This aligns with the graph-database literature, which emphasizes that graph models are especially suitable for highly connected data and relationship-centric querying [5].

2. **Document-style records**  
   The application stores flexible JSON-like records such as entities, notifications, and trials. A document-oriented model reduces schema friction for these heterogeneous objects.

3. **Single-query-language access**  
   ArangoDB exposes graph and document operations through AQL, which simplifies backend development compared with combining separate document and graph engines [3].

4. **Advanced DBMS alignment with course objectives**  
   The project is stronger academically when the database is not used only for CRUD. ArangoDB enables graph traversals, edge-based modeling, and reverse reference analysis, all of which are visible in the code. Comparative work that includes ArangoDB also shows that it belongs in the set of graph-oriented systems relevant to such workloads [6].

#### Evidence from external technical sources

- DB-Engines lists ArangoDB as a ranked DBMS and identifies it as a multi-model system spanning document, graph, key-value, and search categories [1][2].
- The official ArangoDB project README describes native graphs, JSON documents, integrated search, transactions, and a single query language as core strengths [3].
- A major survey of graph database models provides academic support for choosing a graph-oriented representation when relationships are central to the application domain [5].
- Comparative research that explicitly evaluates ArangoDB among graph databases further supports its relevance as a legitimate graph-capable DBMS choice rather than a purely vendor-driven selection [6].

### 3.2 Database design

Because the runtime implementation is based on ArangoDB, the project uses a **multi-model logical design** rather than a purely relational one. This is consistent with external descriptions of ArangoDB as a system that can combine graph and document workloads in one engine [1][3]. To match the report guideline, this section presents:

1. a conceptual entity-relationship view,
2. a relational interpretation for analysis,
3. the actual ArangoDB collection design.

#### 3.2.1 Conceptual ER design

At the conceptual level, the major entities are:

- **User**
- **Entity**
- **Trial**
- **Notification**
- **Follow**
- **EntityReference** (edge relationship)

The most important abstraction is **Entity**, which represents:

- map locations,
- user profiles,
- posts,
- comments,
- trial entities.

This is a polymorphic design that supports cross-linking and reuse.

#### 3.2.2 Relational-model interpretation

Although the running system does not use SQL storage, the same design can be interpreted as the following logical relations:

- `Users(user_id, username, client_salt, server_salt, password_hash, created_at)`
- `Entities(entity_id, type, title, body, parent_entity_id, created_by, created_at)`
- `EntityTags(entity_id, tag)`
- `EntityReferences(from_entity_id, to_entity_id, created_at)`
- `Follows(user_id, entity_id, created_at)`
- `Notifications(notification_id, user_id, entity_id, message, read, created_at)`
- `Trials(trial_id, entity_id, plaintiff_user_id, defendant_user_id, status, outcome, created_at)`
- `TrialVotes(trial_id, judge_user_id, vote)`
- `TrialJudgeHistory(trial_id, proposed_by, judges_serialized, timestamp)`

This relational interpretation is useful for academic explanation even though the production implementation uses ArangoDB collections and an edge collection.

#### 3.2.3 Actual ArangoDB design

The code in `backend/server.mjs` initializes the following collections:

- `users`
- `entities`
- `follows`
- `notifications`
- `trials`
- `entity_references` (edge collection)

The edge collection is the most important database-specific design decision. Instead of storing all relationships only as arrays inside documents, the backend synchronizes references into `entity_references`, allowing graph operations such as reverse reference lookup and shortest-path traversal. This is exactly the kind of workload ArangoDB’s graph-oriented design is meant to support [3].

#### 3.2.4 Normalization discussion

If viewed relationally, the design is broadly compatible with Third Normal Form in the following sense:

- user credentials are stored separately from general entity records,
- follow records are isolated as an associative structure,
- notifications are separate from entity content,
- reference relationships are separated into their own edge relation,
- trial status and votes are logically distinct from generic entities.

The main intentional denormalization is the broad `entities` abstraction, which stores different subtypes in one collection. In a classic relational system, this could be modeled using subtype tables or inheritance strategies. In ArangoDB, the unified collection is reasonable because flexible JSON documents and graph semantics are core strengths.

### 3.3 Data collection and population

The project uses a mix of **static**, **generated**, and **user-created** data.

#### 3.3.1 Static data

Campus map constructs such as room names and lift names are loaded from frontend source files. On server startup, the backend reads map-related source data and pre-provisions map entities for all floors (`backend/server.mjs`).

#### 3.3.2 Generated data

Map location entity IDs are generated deterministically from the normalized floor/name string using SHA-256 and truncation. This ensures stable identity for rooms and stairs across restarts.

#### 3.3.3 User-created data

Users create:

- accounts,
- posts,
- comments,
- follow relationships,
- trials,
- judge proposals,
- votes.

#### 3.3.4 Data insertion procedure

The insertion pattern is:

1. validate request payload,
2. write the main document to its target collection,
3. synchronize or derive related data,
4. emit live updates/notifications where needed.

For entities specifically, references are deduplicated and mirrored into the `entity_references` edge collection after the entity document is saved.

### 3.4 Database queries and operations

This section includes conceptual relational algebra and implementation-oriented AQL, because ArangoDB uses AQL rather than SQL.

#### 3.4.1 Basic operations

Basic operations implemented by the system include:

- create user,
- create entity,
- update entity,
- delete entity,
- follow/unfollow entity,
- create trial,
- vote on trial,
- list notifications,
- list activity.

#### 3.4.2 Advanced operations

Advanced operations implemented by the system include:

- reverse reference lookup,
- graph shortest-path traversal across entity references,
- text-based entity search,
- live update propagation after writes.

#### 3.4.3 Relational algebra interpretations

**A. List all entities of a given type**

\[
\sigma_{type = t}(Entities)
\]

**B. Find all entities referencing a target entity**

\[
\pi_{from\_entity\_id}( \sigma_{to\_entity\_id \in S}(EntityReferences) )
\]

joined with `Entities` to obtain the full source records.

**C. Find followers of an entity**

\[
\sigma_{entity\_id = e}(Follows)
\]

**D. Full-text-style search (conceptual)**

\[
\sigma_{contains(title \lor body \lor entity\_id, q)}(Entities)
\]

**E. Degree of separation**

This operation is not naturally represented in classic relational algebra because it is fundamentally a graph traversal problem. That is exactly why a graph-capable DBMS is justified.

#### 3.4.4 AQL examples used by the implementation

**Reverse reference lookup**

```aql
FOR edge IN entity_references
  FILTER PARSE_IDENTIFIER(edge._to).key IN @ids
  COLLECT from = edge._from
  LET entity = DOCUMENT(from)
  FILTER entity != null
  RETURN entity
```

**Text search**

```aql
FOR e IN entities
  FILTER @q == "" OR CONTAINS(LOWER(CONCAT_SEPARATOR(" ", e.id, e.title, e.body)), @q)
  SORT e.createdAt DESC
  RETURN e
```

**Shortest-path traversal**

```aql
LET start = DOCUMENT(CONCAT("entities/", @from))
LET target = DOCUMENT(CONCAT("entities/", @to))
FILTER start != null AND target != null
FOR vertex IN ANY SHORTEST_PATH start TO target entity_references
  RETURN vertex
```

These queries are visible directly in `backend/server.mjs`.

#### 3.4.5 Conceptual SQL equivalents

ArangoDB does not execute SQL natively; DB-Engines instead lists AQL, HTTP APIs, GraphQL-related access, and graph APIs as its main access methods [1]. However, the closest conceptual SQL-style equivalents for academic comparison are:

```sql
CREATE TABLE Users (
  user_id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  client_salt TEXT NOT NULL,
  server_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE Entities (
  entity_id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(32) NOT NULL,
  title TEXT,
  body TEXT,
  parent_entity_id VARCHAR(64),
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL
);

CREATE TABLE EntityReferences (
  from_entity_id VARCHAR(64) NOT NULL,
  to_entity_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  PRIMARY KEY (from_entity_id, to_entity_id)
);
```

Example conceptual query:

```sql
SELECT DISTINCT e.*
FROM EntityReferences r
JOIN Entities e ON e.entity_id = r.from_entity_id
WHERE r.to_entity_id IN (?, ?, ?);
```

This comparison clarifies that the implemented ArangoDB solution is graph-native, while the relational form is mainly analytical.

### 3.5 Application / system architecture

The repository follows a three-layer architecture.

#### 3.5.1 Frontend

The frontend provides:

- landing page,
- map view,
- shortest-path UI,
- traveling-salesman UI,
- collaborative hub,
- authentication page,
- entities page,
- trials page,
- research page,
- notifications page,
- activity page,
- tutorial page.

The collaborative page is especially important because it exposes database-backed features directly to end users.

#### 3.5.2 Backend

The Express backend performs:

- API routing,
- authentication challenge/response logic,
- persistence through `ArangoStore`,
- static-file serving,
- WebSocket session handling,
- map entity provisioning on startup.

#### 3.5.3 Database connectivity

Database access is centralized in the `ArangoStore` class, which:

- initializes the database and collections,
- encapsulates all AQL operations,
- manages entity references,
- implements search, notifications, and trial persistence.

This separation is a good design practice because it keeps storage concerns isolated from HTTP controller logic.

#### 3.5.4 Transaction handling

The backend performs sequential document and edge writes, but it does not define explicit multi-document transactions. For a demo application this is acceptable, but future improvements could use ArangoDB transaction support for stronger consistency around compound operations such as entity creation plus notification fan-out; transaction capability is explicitly highlighted in the official ArangoDB project materials [3].

### 3.6 User interface design

The user interface is organized around task-specific pages rather than one overloaded dashboard. This is a sensible choice for a campus-oriented navigation system because prior survey work on indoor human navigation emphasizes the importance of user interaction, environment representation, and path-planning support [7].

#### Main UI principles

- clear separation between map features and collaborative features,
- focused pages for each collaborative workflow,
- direct linkage from map locations to collaborative entities,
- responsive design for mobile-friendly use,
- explicit buttons for create/follow/comment/trial actions.

#### Main functionalities exposed through the UI

- select rooms and stairs visually,
- compute shortest paths,
- compute multi-stop visit order,
- sign up and log in,
- create and edit posts,
- comment on entities,
- follow entities and view notifications,
- create trials and negotiate judges,
- run research queries.

This chapter shows that the UI is not ornamental; it is the practical demonstration layer required by the course.

---

## CHAPTER 4  
## Discussion & Implementation

### 4.1 Implementation process

The implementation can be understood as four major integration steps.

#### Step 1: preserve the original map functions

The repository retains the original map-oriented functionality: floor browsing, room selection, shortest path computation, and traveling-salesman-style route optimization.

#### Step 2: introduce a unified entity model

The most important architectural decision was to represent rooms, users, comments, posts, and trials under one broad entity abstraction. This is what makes the collaborative and research features possible without fragmented data silos.

#### Step 3: materialize references as graph edges

The backend stores references in the entity document and synchronizes them into `entity_references`. That step elevates the system from simple CRUD to a graph-enabled application.

#### Step 4: add live interaction and governance features

The backend adds:

- follow relationships,
- notifications,
- trial negotiation and voting,
- WebSocket pushes,
- activity feed,
- research endpoints.

Together, these transform the project from a campus map into a connected campus knowledge graph.

### 4.2 Results and analysis

#### 4.2.1 Advanced DBMS value demonstrated

The project successfully demonstrates why ArangoDB is more suitable than a plain relational or plain document-only solution for this use case, in line with the external characterization of ArangoDB as a multi-model graph/document platform [1][3]:

- **entity references** are explicit and queryable,
- **reverse reference lookup** is easy to implement,
- **degree-of-separation** is naturally expressed through graph traversal,
- **heterogeneous records** fit comfortably in a document-oriented store.

This is a meaningful use of an advanced DBMS, not just a branding choice.

#### 4.2.2 Implemented graph features

The implementation uses AQL for:

- graph edge synchronization,
- reverse lookup through the edge collection,
- shortest-path traversal through `ANY SHORTEST_PATH`,
- search over concatenated text fields.

The strongest database-specific feature is the shortest-path query between entities, because it directly uses graph semantics rather than emulating them in application code. That is the clearest point where the project benefits from choosing an advanced graph-capable DBMS rather than using a traditional relational database alone [2][3][5].

#### 4.2.3 Map algorithms

Outside the database layer, the repository also includes two notable algorithms:

- **BFS shortest path** for campus pathfinding (`src/getShortestPath.ts`)
- **dynamic-programming traveling salesman solver** using bitmasks (`src/solveTravelingSalesman.ts`)

These algorithms complement the database design by giving the application computational depth on both the client/navigation side and the data/query side.

#### 4.2.4 Functional verification

The repository contains strong evidence of correctness:

- `npm run build` succeeds.
- `npm run test:api` passes after dependency installation.
- `backend/tests/api.test.mjs` exercises signup, entity creation, follows, notifications, trials, research endpoints, activity feed, and deletion.
- The README and package scripts also define Puppeteer-based end-to-end and demo tests for broader validation.

This matters because a final report should not describe only intended design; it should describe features that are demonstrably implemented.

### 4.3 Challenges and solutions

#### Challenge 1: heterogeneous data model

The project must store rooms, users, comments, and trials in one coherent system. A rigid table-per-concept relational design would require more joins and more schema ceremony. The chosen solution is a unified `entities` collection with typed documents plus graph edges for references.

#### Challenge 2: live updates

Collaborative systems feel broken if users must refresh the page after every change. The solution is WebSocket-based event delivery, consistent with the browser-to-server bidirectional communication model standardized by RFC 6455 [4]. This also matches prior work on Node.js/WebSocket real-time web applications, which argues that such architectures are appropriate when the server must push constant state changes to clients efficiently [8].

#### Challenge 3: balancing CRUD with advanced features

A major course risk is building an application that only performs CRUD. This repository addresses that risk by implementing graph traversal, reverse reference analytics, and research endpoints as first-class features.

#### Challenge 4: aligning a graph DBMS with report requirements written in relational language

The guideline asks for ERD, relational model, normalization, relational algebra, and SQL. Since the repository uses ArangoDB, the practical solution is to:

- describe the actual multi-model implementation faithfully,
- map it conceptually into relational terms where helpful,
- explain which tasks become graph-native and go beyond classic relational algebra.

That approach preserves academic rigor without misrepresenting the implementation.

### 4.4 Critical evaluation

The project is strong in the following areas:

- good alignment between the application domain and the DBMS choice,
- clear demonstration of graph-aware functionality,
- usable documentation in `/docs`,
- automated tests,
- integration between map UI and collaboration UI.

The project is weaker in the following areas:

- text search is basic and does not yet use ArangoSearch views or analyzers,
- no explicit benchmark or performance measurement is included,
- transaction handling is limited,
- no formal ER diagram image is stored in the repository,
- the report must reconstruct some planning details because they are not versioned separately.

Even with those limitations, the system still meets the core academic goal of showing a meaningful application of an advanced non-traditional DBMS.

---

## CHAPTER 5  
## Conclusion & Future Work

### 5.1 Summary of key findings

HCMIU Map Collaborative is a strong fit for an advanced database course because it demonstrates:

- a non-traditional DBMS selected from DB-Engines,
- a real application domain,
- multi-model persistence,
- graph-based queries,
- a working demo application,
- automated verification.

The repository is more than a map and more than a forum. It is a connected campus information graph where navigation, discussion, accountability, and research queries coexist in one system.

### 5.2 Reflection on objectives

The project objectives are substantially achieved:

- the selected DBMS is appropriate and justified,
- the system uses the DBMS for both ordinary and advanced operations,
- the application functionality is broad and user-facing,
- tests provide evidence that the features work.

The project therefore satisfies the central intent of the assignment better than a simple CRUD web app would.

### 5.3 Implications from an advanced database viewpoint

From an advanced DBMS viewpoint, the main implication is that **data relationships are part of the product, not an afterthought**. By using ArangoDB, the system can treat references, followers, trials, and linked campus knowledge as first-class structures. This makes the application more expressive and helps justify the database choice academically, especially given ArangoDB’s externally documented positioning around native graphs plus documents under one query model [1][3].

### 5.4 Future work

The most valuable next steps are:

1. **Adopt ArangoSearch views** for more scalable and relevant full-text search.
2. **Introduce explicit transactions** for multi-step workflows such as notification fan-out and trial updates.
3. **Add indexes and performance evaluation** to measure query cost at larger scale.
4. **Support richer graph analytics** such as centrality, entity recommendation, or community detection.
5. **Improve routing realism** by incorporating weighted edges for accessibility, congestion, and time estimates.
6. **Add moderation and governance controls** if the collaborative layer is used beyond a demo context.
7. **Produce formal ER and architecture diagrams** for inclusion in the final PDF submission.

In summary, HCMIU Map Collaborative already provides a convincing advanced-database case study, and with a few focused improvements it could become an even stronger academic demonstration of graph-driven campus software.

---

## References

### Internal repository sources

These sources are used to document what the repository actually implements.

1. `Project Proposal Report_ ArangoDB.pdf`, proposal cover-page metadata, timeline, and DBMS rationale.  
2. `README.md`, repository overview and usage instructions.  
3. `MANIFESTO.md`, project tenets and feature requirements.  
4. `docs/collaborative-api.md`, backend API and WebSocket documentation.  
5. `docs/tutorial.md`, end-user workflow documentation.  
6. `backend/server.mjs`, backend implementation and ArangoDB query logic.  
7. `src/getShortestPath.ts`, shortest-path implementation.  
8. `src/solveTravelingSalesman.ts`, traveling-salesman implementation.  
9. `backend/tests/api.test.mjs`, end-to-end API behavior validation.

### External technical sources

These sources are the primary justification for DBMS selection, graph/multi-model claims, and protocol-level statements used throughout the report.

[1] DB-Engines. “ArangoDB.” https://db-engines.com/en/system/ArangoDB (accessed 2026-03-10).  
[2] DB-Engines. “DB-Engines Ranking of Graph DBMS.” https://db-engines.com/en/ranking/graph+dbms (accessed 2026-03-10).  
[3] ArangoDB. “ArangoDB README / Key Features.” https://raw.githubusercontent.com/arangodb/arangodb/devel/README.md (accessed 2026-03-10).  
[4] Fette, I. and Melnikov, A. “The WebSocket Protocol.” RFC 6455, IETF, 2011. https://www.rfc-editor.org/rfc/rfc6455.txt (accessed 2026-03-10).  
[5] Angles, R. and Gutiérrez, C. “Survey of graph database models.” *ACM Computing Surveys*, 40(1), 2008. https://doi.org/10.1145/1322432.1322433  
[6] Fernandes, D. L. and Bernardino, J. “Graph Databases Comparison: AllegroGraph, ArangoDB, InfiniteGraph, Neo4J, and OrientDB.” *DATA 2018*, 2018. https://doi.org/10.5220/0006910203730380  
[7] Fallah, N., Apostolopoulos, I., Bekris, K., and Folmer, E. “Indoor Human Navigation Systems: A Survey.” *Interacting with Computers*, 2013. https://doi.org/10.1093/iwc/iws010  
[8] Zhao, S. M., Xia, X. L., and Le, J. J. “A Real-Time Web Application Solution Based on Node.js and WebSocket.” *Advanced Materials Research*, 2013. https://doi.org/10.4028/www.scientific.net/amr.816-817.1111  
[9] Han, D., Jung, S.-H., Lee, M., and Yoon, G. “Building a Practical Wi-Fi-Based Indoor Navigation System.” *IEEE Pervasive Computing*, 13(2), 2014. https://doi.org/10.1109/MPRV.2014.24  
