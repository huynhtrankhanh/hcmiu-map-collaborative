# Proposal Report

---

## Cover Page

| | |
|---|---|
| **Course Name** | IT089IU — Advanced Database Management Systems |
| **Project Topic Title** | HCMIU Map Collaborative: A Multi-Model Graph-Database-Powered Interactive Campus Map and Collaborative Knowledge Platform |
| **Instructor** | Dr. Tran Thanh Tung |
| **Student Name** | Huynh Tran Khanh |
| **Student ID** | ITITIU21100 |
| **Semester** | Spring 2026 |
| **Submission Date** | March 2026 |
| **Institution** | International University — Vietnam National University, Ho Chi Minh City (HCMIU) |

---

## Table of Contents

1. [Abstract](#abstract)
2. [Introduction](#1-introduction)
   - 1.1 [Background and Motivation](#11-background-and-motivation)
   - 1.2 [Problem Statement](#12-problem-statement)
   - 1.3 [Project Objectives](#13-project-objectives)
   - 1.4 [Scope and Limitations](#14-scope-and-limitations)
3. [Selected Database Management System](#2-selected-database-management-system)
   - 2.1 [Overview of ArangoDB](#21-overview-of-arangodb)
   - 2.2 [Justification for Selecting ArangoDB](#22-justification-for-selecting-arangodb)
   - 2.3 [Key Features of ArangoDB Relevant to This Project](#23-key-features-of-arangodb-relevant-to-this-project)
   - 2.4 [Comparison with Alternative Systems](#24-comparison-with-alternative-systems)
   - 2.5 [ArangoDB DB-Engines Ranking Context](#25-arangodb-db-engines-ranking-context)
4. [System Architecture and Design](#3-system-architecture-and-design)
   - 3.1 [High-Level Architecture](#31-high-level-architecture)
   - 3.2 [Data Model Design](#32-data-model-design)
   - 3.3 [Entity-Relationship Model](#33-entity-relationship-model)
   - 3.4 [API Design](#34-api-design)
   - 3.5 [Real-Time Communication](#35-real-time-communication)
5. [Project Plan and Timeline](#4-project-plan-and-timeline)
   - 4.1 [Project Phases Overview](#41-project-phases-overview)
   - 4.2 [Detailed Weekly Timeline](#42-detailed-weekly-timeline)
   - 4.3 [Milestones and Deliverables](#43-milestones-and-deliverables)
   - 4.4 [Risk Assessment and Mitigation](#44-risk-assessment-and-mitigation)
6. [Tools and Programming Languages](#5-tools-and-programming-languages)
   - 5.1 [Database Management System](#51-database-management-system)
   - 5.2 [Programming Languages](#52-programming-languages)
   - 5.3 [Frameworks and Libraries](#53-frameworks-and-libraries)
   - 5.4 [Development and DevOps Tools](#54-development-and-devops-tools)
   - 5.5 [Testing Frameworks](#55-testing-frameworks)
   - 5.6 [Development Environment](#56-development-environment)
7. [Expected Outcomes](#6-expected-outcomes)
8. [References](#7-references)

---

## Abstract

This proposal presents the design and implementation plan for **HCMIU Map Collaborative**, a full-stack interactive campus map and collaborative knowledge platform for the Ho Chi Minh City International University (HCMIU). The platform addresses the challenge of campus wayfinding, institutional knowledge preservation, and community governance by combining real-time navigation features with a rich collaborative layer powered by a graph-oriented database.

The selected database management system is **ArangoDB**, a multi-model NoSQL database listed on the DB-Engines Ranking. ArangoDB was chosen for its native graph traversal capabilities, its flexible document storage model, and its powerful AQL (ArangoDB Query Language) that unifies document, key-value, and graph queries within a single query language. These features are essential to the project because the application domain—campus mapping with entity-based discussions, cross-referencing, and degree-of-separation analysis—is inherently a graph problem. Every room, user, comment, and court trial in the system is modeled as an entity that can reference other entities, forming a richly interconnected knowledge graph.

The application domain spans three primary areas: **(1)** campus navigation and wayfinding, including shortest-path routing and traveling-salesman-style multi-stop planning across a seven-floor campus building; **(2)** a collaborative knowledge base where every map location, user profile, discussion comment, and court trial is a first-class entity that can be commented on, tagged, followed, and searched; and **(3)** an experimental transparent governance system (the "Court of Justice") that enables structured dispute resolution with judge negotiation, voting, and public discussion threads.

The main objectives of this project are: to demonstrate how a multi-model graph database can efficiently power a complex, real-time collaborative platform; to build a production-quality campus map that serves the HCMIU community; to implement advanced graph-based research capabilities including entity reference traversal, full-text search, and shortest-path-based degree-of-separation analysis; and to document the entire system as an open-source reference architecture for similar community-driven campus platforms.

---

## 1. Introduction

### 1.1 Background and Motivation

University campuses are complex environments with dozens of buildings, hundreds of rooms, multiple floors, and a constantly evolving set of services. For students—especially newcomers—navigating a campus can be stressful and time-consuming. Traditional static campus maps (printed flyers, PDF downloads) quickly become outdated and cannot capture the rich, informal knowledge that long-term students accumulate: which lab has the best equipment, which lecture hall has air-conditioning issues, where to find a quiet study corner, or which cafeteria has the shortest queue at noon.

At the International University (HCMIU), this problem is compounded by the diversity of the student body—including international exchange students, transfer students, and visitors—who may lack the social network to acquire this tacit knowledge organically. Furthermore, the campus is a multi-story building with seven distinct floors, each hosting classrooms, laboratories, administrative offices, cafeterias, and common areas. Navigating between these floors via stairs and elevators adds a vertical dimension to the wayfinding challenge.

Beyond physical navigation, university communities also face governance challenges. Decisions about shared spaces, event scheduling, and community norms are often made through informal channels—private group chats, word-of-mouth, or opaque administrative processes. This lack of transparency can breed frustration and disenfranchise community members who are not "in the loop."

This project was motivated by the desire to address all three of these challenges—wayfinding, knowledge preservation, and transparent governance—within a single, integrated platform. By attaching collaborative discussion threads directly to physical map locations and linking them through a graph-based entity system, the platform creates a living, community-maintained knowledge base that grows richer over time.

### 1.2 Problem Statement

The core problems this project aims to solve are:

1. **Fragmented campus navigation:** Existing campus maps at HCMIU are static and do not support route planning, multi-stop optimization, or cross-floor navigation. Students must rely on trial-and-error or ask others for directions, which is inefficient and excludes those who are too shy or lack language fluency to ask.

2. **Loss of institutional knowledge:** Valuable information about campus facilities—opening hours, equipment availability, room-specific quirks, accessibility features—exists only in the memories of individuals. When students graduate or staff rotate, this knowledge is lost. There is no durable, searchable repository where this information is captured and maintained.

3. **Opaque community governance:** Disputes and decisions about shared campus resources are resolved through informal, often invisible processes. There is no structured mechanism for community members to raise issues, propose solutions, invite impartial arbiters, and arrive at documented resolutions that the broader community can review.

4. **Lack of entity interconnection and discoverability:** In existing systems, information about rooms, people, events, and policies is siloed. There is no way to discover that a particular room is frequently mentioned in discussions about a particular event, or that two seemingly unrelated topics are connected through a chain of references.

### 1.3 Project Objectives

The objectives of this project are structured into primary and secondary goals:

**Primary Objectives:**
- Design and implement a full-stack web application with an interactive multi-floor campus map that supports shortest-path routing and multi-stop traveling-salesman optimization.
- Build a collaborative knowledge base where every map location, user, comment, and court trial is represented as a first-class entity in ArangoDB, forming an interconnected knowledge graph.
- Implement real-time updates via WebSockets so that changes to entities, comments, and trials are reflected immediately in all connected clients.
- Develop three "deep research" capabilities leveraging ArangoDB's graph and query features: entity reference traversal, full-text search, and degree-of-separation analysis.
- Create a "Court of Justice" module that enables structured, transparent dispute resolution with interactive judge negotiation, voting, and discussion.

**Secondary Objectives:**
- Demonstrate the practical advantages of a multi-model database (ArangoDB) over single-model alternatives for a complex, interconnected application domain.
- Produce comprehensive API documentation and a user-facing tutorial so the platform is accessible to both human users and machine integrators.
- Containerize the entire stack using Docker Compose for reproducible, one-command deployment.
- Write automated test suites (API tests and end-to-end Puppeteer tests) to validate functionality and prevent regressions.
- Release the platform as open-source under the 0BSD license to enable replication and adaptation by other campuses and communities.

### 1.4 Scope and Limitations

**In Scope:**
- Interactive web-based campus map with seven-floor support for the HCMIU main building.
- Shortest-path routing between any two points on the map, including inter-floor traversal via lifts and staircases.
- Traveling-salesman-style multi-stop planner with time estimates.
- Entity-based collaborative system with comments, references, tags, follows, and notifications.
- Court of Justice module with trial creation, interactive judge negotiation, voting, and discussion.
- Deep research APIs: reference graph exploration, full-text search, degree-of-separation queries.
- Real-time WebSocket-based updates for all entity and trial events.
- Authentication with multi-layer password hashing (client-side libsodium + server-side SHA-256).
- Docker Compose orchestration for single-command deployment.
- Automated API and end-to-end testing.

**Out of Scope:**
- GPS hardware integration or real-time indoor positioning.
- Native mobile applications (the platform is web-only; a Capacitor/Android build pipeline was previously explored and removed).
- Production-grade SLAs, uptime guarantees, or safety-critical routing.
- Integration with university administrative systems (e.g., class scheduling, student records).
- Moderation tooling beyond the Court of Justice (e.g., content filtering, automated spam detection).

---

## 2. Selected Database Management System

### 2.1 Overview of ArangoDB

**ArangoDB** is an open-source, multi-model NoSQL database management system developed by ArangoDB GmbH. It is listed on the [DB-Engines Ranking](https://db-engines.com/en/ranking) and is recognized as one of the leading multi-model databases in the industry. ArangoDB uniquely combines three data models—**document**, **key-value**, and **graph**—within a single database engine, accessible through a unified query language called **AQL (ArangoDB Query Language)**.

Key characteristics of ArangoDB include:

- **Multi-model architecture:** Unlike databases that specialize in a single data model, ArangoDB natively supports documents (JSON objects), key-value pairs, and graphs (vertices and edges) within the same database instance. This eliminates the need to maintain separate database systems for different data modeling needs.
- **ArangoDB Query Language (AQL):** AQL is a declarative query language similar in spirit to SQL but designed for multi-model data. It supports document queries (filtering, aggregation, joins), graph traversals (shortest path, pattern matching, variable-depth traversal), and full-text operations within a single, composable syntax.
- **Native graph engine:** ArangoDB provides a built-in graph engine that stores edges as first-class citizens in edge collections. Graph traversals—including shortest-path algorithms, breadth-first and depth-first searches, and pattern matching—are executed natively within the database engine, avoiding the overhead of application-level graph processing.
- **ACID transactions:** ArangoDB supports multi-document, multi-collection ACID transactions, ensuring data consistency even in complex operations that span multiple collections.
- **Horizontal scalability:** ArangoDB supports cluster deployments with automatic sharding, replication, and failover, making it suitable for applications that may need to scale beyond a single server.
- **RESTful HTTP API:** All database operations are accessible via a comprehensive REST API, simplifying integration with web applications and microservices.
- **Web-based administration interface:** ArangoDB includes ArangoDB Web UI, a browser-based tool for database administration, query execution, graph visualization, and performance monitoring.

ArangoDB is released under the Apache License 2.0 (Community Edition) and is available as a managed cloud service (ArangoDB Oasis) or as a self-hosted installation via Docker images, native packages, or source compilation.

### 2.2 Justification for Selecting ArangoDB

The selection of ArangoDB as the database management system for this project is justified by the following technical and architectural considerations:

#### 2.2.1 The Application Domain Is Inherently a Graph Problem

The core data model of HCMIU Map Collaborative revolves around **entities** and **references**. Every room, user, comment, and trial in the system is an entity, and entities can reference other entities. This creates a densely interconnected graph where:
- Comments reference the entities they discuss.
- Comments automatically reference the user entity of their author.
- Entities can reference arbitrary other entities via tagging.
- Trials reference plaintiffs, defendants, and judges.
- The "degree of separation" research feature requires finding shortest paths between any two entities in the reference graph.

A traditional relational database would require complex JOIN operations and recursive CTEs (Common Table Expressions) to traverse this reference graph, with performance degrading significantly as the graph grows. A document database without native graph support would require application-level graph traversal, adding complexity and latency. ArangoDB's native graph engine allows these operations to be expressed concisely in AQL and executed efficiently at the database level.

#### 2.2.2 Multi-Model Flexibility Reduces Architectural Complexity

The project requires multiple data modeling paradigms simultaneously:
- **Document model** for storing rich, schema-flexible entities (rooms have different attributes than users, which differ from comments and trials).
- **Key-value model** for fast lookups (session tokens, entity IDs, follow relationships).
- **Graph model** for entity references, shortest-path queries, and reference graph traversal.

Without ArangoDB's multi-model capability, the project would need to deploy and maintain multiple database systems (e.g., a document store for entities + a graph database for references + a key-value store for sessions), significantly increasing operational complexity, data synchronization challenges, and deployment overhead.

#### 2.2.3 AQL Unifies Complex Queries

The deep research capabilities of the platform require queries that combine document filtering with graph traversal. For example, the "degree of separation" feature must:
1. Verify that both the source and destination entities exist (document lookup).
2. Traverse the reference graph bidirectionally to find the shortest path (graph traversal).
3. Return the full entity documents along the path (document retrieval).

In ArangoDB, this entire operation is expressed as a single AQL query:
```aql
LET start = DOCUMENT(CONCAT("entities/", @from))
LET target = DOCUMENT(CONCAT("entities/", @to))
FILTER start != null AND target != null
FOR vertex IN ANY SHORTEST_PATH start TO target entity_references
  RETURN vertex
```

Achieving the same result in a system that separates document and graph concerns would require multiple round trips, intermediate result caching, and application-level orchestration.

#### 2.2.4 Schema Flexibility for Evolving Requirements

The entity model in HCMIU Map Collaborative is intentionally expansive—"every room is an entity, every user is an entity, every comment is an entity, every trial is an entity." Each entity type has different attributes (a room has a floor number and construct name; a trial has plaintiff, defendant, and judge information; a comment has a parent entity ID). ArangoDB's document model stores entities as JSON objects without requiring a fixed schema, allowing new entity types and attributes to be introduced without database migrations.

#### 2.2.5 Docker-First Deployment Model

ArangoDB provides official Docker images (`arangodb:3.11`) that integrate seamlessly with Docker Compose, aligning with the project's requirement for single-command, reproducible deployment. The Docker image includes the database engine, web UI, and all necessary tooling, simplifying both development and production environments.

#### 2.2.6 Active Community and Comprehensive Documentation

ArangoDB has an active open-source community, comprehensive official documentation, and a growing ecosystem of drivers and integrations. The `arangojs` JavaScript/TypeScript driver used in this project is officially maintained and provides a modern, Promise-based API that integrates cleanly with the Node.js/Express backend.

### 2.3 Key Features of ArangoDB Relevant to This Project

The following ArangoDB features are directly utilized in the implementation of HCMIU Map Collaborative:

| Feature | Usage in This Project |
|---|---|
| **Document Collections** | Store entities (`entities` collection), users (`users`), follows (`follows`), notifications (`notifications`), and trials (`trials`) as JSON documents with flexible schemas. |
| **Edge Collections** | The `entity_references` edge collection stores directed references between entities, enabling graph-based queries and traversals. |
| **AQL SHORTEST_PATH** | The `ANY SHORTEST_PATH` traversal in AQL powers the "degree of separation" research feature, finding the shortest reference-distance path between any two entities. |
| **AQL Document Functions** | `DOCUMENT()` function enables O(1) entity lookups by key within AQL queries, used extensively for entity retrieval and validation. |
| **AQL Aggregation** | `COLLECT` and aggregation functions are used to group referencing entities and compute statistics (e.g., reference counts for map entities). |
| **AQL Text Filtering** | `CONTAINS()` and `LOWER()` functions in AQL power the full-text search research feature, filtering entities by title and body text. |
| **Overwrite Modes** | The `overwriteMode: "replace"` and `overwriteMode: "ignore"` options in insert operations are used for idempotent entity reference synchronization and follow/unfollow operations. |
| **Multi-Collection Transactions** | Atomic operations spanning multiple collections (e.g., creating an entity and its references in a single logical operation) leverage ArangoDB's ACID transaction support. |
| **Database Auto-Provisioning** | The backend uses the ArangoDB system database API to automatically create the application database and collections on first startup, enabling zero-configuration deployment. |
| **REST API** | The `arangojs` driver communicates with ArangoDB via its HTTP REST API, providing a clean separation between the application backend and the database layer. |

### 2.4 Comparison with Alternative Systems

To further justify the selection of ArangoDB, the following table compares it with alternative database systems that were considered:

| Criteria | ArangoDB (Selected) | Neo4j | CouchDB | Cassandra |
|---|---|---|---|---|
| **Data Model** | Multi-model (document + graph + key-value) | Graph only | Document only | Wide-column |
| **Query Language** | AQL (unified) | Cypher (graph only) | Mango/MapReduce | CQL |
| **Graph Traversal** | Native, integrated with document queries | Native, best-in-class for pure graph | Not supported | Not supported |
| **Document Flexibility** | Full JSON document support with flexible schema | Limited property model on nodes/edges | Full JSON document support | Rigid column families |
| **Shortest Path** | Built-in `SHORTEST_PATH` in AQL | Built-in `shortestPath()` in Cypher | Not available | Not available |
| **Edge Collections** | First-class edge collections with metadata | Relationships are first-class citizens | Not applicable | Not applicable |
| **Docker Support** | Official Docker images, Compose-friendly | Official Docker images | Official Docker images | Official Docker images |
| **JavaScript Driver** | `arangojs` (officially maintained) | `neo4j-driver` (officially maintained) | `nano` (community) | `cassandra-driver` (DataStax) |
| **License** | Apache 2.0 (Community) | GPL v3 (Community) | Apache 2.0 | Apache 2.0 |
| **Multi-Model Advantage** | Single system for documents + graphs + key-value | Would need separate document store | Would need separate graph database | Would need separate graph + document stores |

**Why not Neo4j?** While Neo4j is arguably the most popular graph database, its Community Edition is licensed under GPL v3, which imposes restrictions on derivative works. More importantly, Neo4j is a pure graph database—it excels at graph queries but does not natively support the rich document model needed for storing diverse entity types with varying attributes. Using Neo4j would require either flattening entities into node properties (losing schema flexibility) or maintaining a separate document store alongside Neo4j (increasing architectural complexity). ArangoDB provides comparable graph query capabilities while also serving as the document store, eliminating this trade-off.

**Why not CouchDB?** CouchDB is an excellent document database with built-in replication, but it lacks native graph traversal capabilities. Implementing shortest-path queries, reference graph exploration, and degree-of-separation analysis would require application-level graph processing or integration with a separate graph engine, negating the simplicity benefits of a single-database architecture.

**Why not Cassandra?** Apache Cassandra is designed for high-throughput, write-heavy workloads at massive scale, which is not the primary requirement for a campus-level collaborative platform. Cassandra's wide-column data model and CQL query language are optimized for time-series and partitioned data access patterns, not for the interconnected entity graph and flexible document model that HCMIU Map Collaborative requires.

### 2.5 ArangoDB DB-Engines Ranking Context

ArangoDB is listed on the DB-Engines Ranking website (https://db-engines.com/en/ranking) under multiple categories:

- **Multi-model DBMS:** ArangoDB is consistently ranked among the top multi-model databases, recognized for its unique combination of document, graph, and key-value capabilities within a single engine.
- **Graph DBMS:** ArangoDB appears in the graph database ranking alongside Neo4j, Amazon Neptune, and JanusGraph, reflecting its strong native graph capabilities.
- **Document Stores:** ArangoDB also appears in the document store ranking, demonstrating its multi-model versatility.

The DB-Engines ranking scores ArangoDB based on criteria including search engine mentions, job postings, technical discussion frequency, and social media interest. ArangoDB's consistent presence across multiple ranking categories confirms its viability as a production-grade DBMS that bridges the gap between document stores and graph databases—precisely the capability profile required by this project.

ArangoDB is **not** among the commonly used database systems excluded by the course requirements (Microsoft SQL Server, MySQL, Oracle Database, PostgreSQL, SQLite, MongoDB, IBM Db2). It represents a more specialized and technically interesting choice that allows this project to explore multi-model database capabilities in depth.

---

## 3. System Architecture and Design

### 3.1 High-Level Architecture

The HCMIU Map Collaborative platform follows a three-tier architecture consisting of a frontend presentation layer, a backend application layer, and a database persistence layer. All three tiers are containerized and orchestrated using Docker Compose.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                         │
│  ┌───────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Map View     │  │  Collaborative   │  │  Court of        │  │
│  │  (Canvas +    │  │  Hub (Entities,  │  │  Justice         │  │
│  │   Pathfinding)│  │  Comments, Feed) │  │  (Trials, Votes) │  │
│  └───────┬───────┘  └────────┬─────────┘  └────────┬─────────┘  │
│          │                   │                      │            │
│          └───────────┬───────┴──────────────────────┘            │
│                      │                                           │
│              ┌───────▼────────┐                                  │
│              │  React 18 +    │                                  │
│              │  TypeScript    │                                  │
│              │  (Vite Build)  │                                  │
│              └───────┬────────┘                                  │
└──────────────────────┼──────────────────────────────────────────┘
                       │  HTTP REST + WebSocket
                       │
┌──────────────────────┼──────────────────────────────────────────┐
│                      │        Backend (Node.js + Express 5)     │
│              ┌───────▼────────┐                                  │
│              │  Express Router│                                  │
│              │  /api/*        │                                  │
│              └───────┬────────┘                                  │
│                      │                                           │
│  ┌───────────────────┼─────────────────────────────┐             │
│  │                   │                              │            │
│  ▼                   ▼                              ▼            │
│ Auth             Entity CRUD              Research APIs          │
│ (Signup/Login    (Create/Read/            (References,           │
│  Sessions)       Update/Delete            Full-text,             │
│                  Follow/Notify)           Degree-of-Sep)         │
│                      │                              │            │
│              ┌───────▼────────┐                     │            │
│              │  WebSocket     │◄────────────────────┘            │
│              │  Server (/ws)  │                                  │
│              └───────┬────────┘                                  │
│                      │                                           │
│              ┌───────▼────────┐                                  │
│              │  ArangoStore   │                                  │
│              │  (Data Access) │                                  │
│              └───────┬────────┘                                  │
└──────────────────────┼──────────────────────────────────────────┘
                       │  arangojs (HTTP)
                       │
┌──────────────────────┼──────────────────────────────────────────┐
│              ┌───────▼────────┐         ArangoDB 3.11           │
│              │  hcmiu_map DB  │                                  │
│              │  ┌───────────┐ │                                  │
│              │  │  users    │ │  Document Collections            │
│              │  │  entities │ │                                  │
│              │  │  follows  │ │                                  │
│              │  │  notifs   │ │                                  │
│              │  │  trials   │ │                                  │
│              │  ├───────────┤ │                                  │
│              │  │  entity_  │ │  Edge Collection                 │
│              │  │  references│ │  (Graph Edges)                  │
│              │  └───────────┘ │                                  │
│              └────────────────┘                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Docker Compose Services:**

| Service | Image/Build | Port | Purpose |
|---|---|---|---|
| `arangodb` | `arangodb:3.11` | 8529 | Database engine with Web UI |
| `backend` | Custom Dockerfile (Node.js 20) | 3000 | Express API server + WebSocket server + static file serving for built frontend |

### 3.2 Data Model Design

The data model is centered on the concept of **entities**—a universal abstraction that represents every addressable object in the system. This design was inspired by the observation that rooms, users, comments, posts, and trials all share common behaviors: they can be referenced, commented on, followed, and searched. Rather than creating separate tables for each type, the system uses a single `entities` collection with a `type` discriminator field.

**Collections:**

| Collection | Type | Description |
|---|---|---|
| `users` | Document | User accounts with authentication credentials (username, hashed password, salts). |
| `entities` | Document | Universal entity store. Each entity has a `type` field (`post`, `comment`, `user`, `map_location`, `trial`) and type-specific attributes. |
| `follows` | Document | Tracks which users follow which entities. Key is derived from a SHA-256 hash of the entity-user pair for idempotent operations. |
| `notifications` | Document | In-app notifications generated when followed entities receive new comments. |
| `trials` | Document | Court of Justice trial records with plaintiff, defendant, judges, votes, negotiation history, and status. |
| `entity_references` | Edge | Directed edges from one entity to another, representing references (tags, mentions). Enables graph traversal queries. |

**Entity Document Structure:**

```json
{
  "_key": "entity_abc123",
  "id": "entity_abc123",
  "type": "comment",
  "title": "",
  "body": "This room has great acoustics for presentations.",
  "parentEntityId": "entity_map_7f3a...",
  "references": ["entity_def456", "entity_ghi789"],
  "tags": [],
  "createdBy": "user_xyz987",
  "createdAt": "2026-02-15T10:30:00.000Z"
}
```

**Edge Document Structure (entity_references):**

```json
{
  "_key": "sha256(entities/entity_abc123:entity_def456)",
  "_from": "entities/entity_abc123",
  "_to": "entities/entity_def456",
  "createdAt": "2026-02-15T10:30:00.000Z"
}
```

### 3.3 Entity-Relationship Model

The following describes the logical relationships between the major data entities:

- **User** → creates → **Entity** (one-to-many): A user can create multiple entities (posts, comments). Each entity records its `createdBy` user ID.
- **Entity** → references → **Entity** (many-to-many via edge collection): Entities can reference other entities through the `entity_references` edge collection. This forms the core knowledge graph.
- **Entity** → has parent → **Entity** (many-to-one): Comments have a `parentEntityId` linking them to the entity they discuss.
- **User** → follows → **Entity** (many-to-many): Users can follow entities to receive notifications. Tracked in the `follows` collection.
- **User** → receives → **Notification** (one-to-many): Notifications are generated for followers when followed entities receive new comments.
- **Trial** → associated with → **Entity** (one-to-one): Each trial has a corresponding trial entity in the `entities` collection for discussion purposes.
- **Trial** → involves → **User** (many-to-many): Trials involve a plaintiff, defendant, and multiple judges, all referenced by user ID.

### 3.4 API Design

The backend exposes a RESTful API organized into the following endpoint groups:

| Endpoint Group | Base Path | Authentication | Description |
|---|---|---|---|
| Health | `GET /api/health` | None | System health check |
| Auth | `/api/auth/*` | Varies | User registration and login with multi-step challenge-response |
| Entities | `/api/entities/*` | Required for writes | CRUD operations on entities, follow/unfollow |
| Map | `GET /api/map/entity` | None | Map-specific entity lookup by construct name and floor |
| Notifications | `/api/notifications/*` | Required | List and mark-read notifications |
| Trials | `/api/trials/*` | Required for writes | Trial CRUD, judge negotiation, voting |
| Research | `/api/research/*` | None | Reference graph, full-text search, degree-of-separation |
| Activity | `GET /api/activity` | None | Chronological activity feed |

**Authentication Flow:**

The authentication system uses a multi-step challenge-response protocol with two layers of password hashing:

1. **Client-side hashing:** The client uses `libsodium.crypto_pwhash` with a server-provided `clientSalt` to hash the user's password. This ensures the raw password never leaves the browser.
2. **Server-side hashing:** The backend further hashes the client-provided hash with a `serverSalt` using SHA-256. This ensures that even if the client-side hash is intercepted, it cannot be used to authenticate directly.
3. **Session management:** Successful authentication returns a UUID bearer token that is stored in-memory on the server and included in subsequent API requests via the `Authorization` header.

### 3.5 Real-Time Communication

The platform uses WebSockets for real-time communication between the server and connected clients. The WebSocket server is mounted at the `/ws` path on the same HTTP server as the Express API.

**Connection flow:**
1. Client connects to `ws://hostname:3000/ws?token=<bearer-token>`.
2. Server validates the token against the session store.
3. If valid, the server sends a `{ type: "hello", authenticated: true }` message and registers the socket for the user.
4. If invalid, the server sends `{ type: "hello", authenticated: false }` and closes the connection.

**Event types broadcast via WebSocket:**
- `entity.created` — When a new entity (post, comment) is created.
- `entity.updated` — When an entity is edited.
- `entity.deleted` — When an entity is deleted.
- `trial.created` — When a new trial is filed.
- `trial.updated` — When a trial's status, judges, or votes change.
- `notification.created` — Targeted to specific users when they receive a notification.

---

## 4. Project Plan and Timeline

### 4.1 Project Phases Overview

The project is divided into six major phases spanning 14 weeks. Since this is an individual project, the timeline reflects a single developer's workload with realistic estimates for each task.

| Phase | Duration | Description |
|---|---|---|
| **Phase 1: Research & Planning** | Weeks 1–2 | Requirements analysis, DBMS evaluation, architecture design, proposal writing |
| **Phase 2: Core Infrastructure** | Weeks 3–4 | Database setup, Docker orchestration, backend skeleton, authentication system |
| **Phase 3: Map & Navigation** | Weeks 5–6 | Interactive map rendering, floor data, shortest-path algorithm, traveling salesman solver |
| **Phase 4: Collaborative Features** | Weeks 7–9 | Entity system, comments, references, follows, notifications, WebSocket real-time updates |
| **Phase 5: Advanced Features** | Weeks 10–11 | Court of Justice module, deep research APIs, activity feed |
| **Phase 6: Testing, Polish & Reporting** | Weeks 12–14 | Comprehensive testing, UI polish, documentation, final report writing |

### 4.2 Detailed Weekly Timeline

| Week | Phase | Tasks | Expected Outcomes |
|---|---|---|---|
| **Week 1** | Research & Planning | • Review course requirements and rubric.<br>• Survey existing campus map solutions and collaborative platforms.<br>• Evaluate candidate DBMSs (ArangoDB, Neo4j, CouchDB, Cassandra) against project requirements.<br>• Select ArangoDB and document justification. | • Completed DBMS comparison matrix.<br>• Initial project requirements document.<br>• Technology stack decision finalized. |
| **Week 2** | Research & Planning | • Design high-level system architecture (three-tier, Docker Compose).<br>• Design data model (entities, users, references, trials).<br>• Design API endpoint structure.<br>• Write and submit proposal report. | • Architecture diagram.<br>• Data model documentation.<br>• API specification draft.<br>• **Deliverable: Proposal Report submitted.** |
| **Week 3** | Core Infrastructure | • Initialize project repository with Vite + TypeScript + React.<br>• Create Docker Compose configuration with ArangoDB 3.11 service.<br>• Implement `ArangoStore` class with database and collection auto-provisioning.<br>• Implement basic Express server skeleton with health check endpoint. | • Running Docker Compose stack (ArangoDB + backend).<br>• Database auto-provisioning on first startup.<br>• `GET /api/health` returns `{ ok: true }`. |
| **Week 4** | Core Infrastructure | • Implement multi-step signup flow (challenge generation, client-side hashing, server-side hashing).<br>• Implement multi-step login flow with bearer token sessions.<br>• Implement authentication middleware.<br>• Write API tests for all auth endpoints. | • Working signup and login flows.<br>• Bearer token authentication middleware.<br>• Passing auth API tests. |
| **Week 5** | Map & Navigation | • Parse campus floor data from TypeScript source files (room names, lift positions).<br>• Implement interactive map rendering with seven floors using canvas/SVG overlay.<br>• Implement floor switching UI. | • Interactive campus map displaying all seven floors.<br>• Clickable rooms and constructs.<br>• Floor navigation UI. |
| **Week 6** | Map & Navigation | • Implement Dijkstra-based shortest-path algorithm for single-floor routing.<br>• Implement inter-floor pathfinding with lift and staircase optimization.<br>• Implement traveling-salesman multi-stop planner.<br>• Implement time estimation for routes.<br>• Build map navigation UI forms. | • Shortest-path routing between any two points.<br>• Multi-stop route optimization.<br>• Time estimates displayed in the UI. |
| **Week 7** | Collaborative Features | • Implement entity CRUD endpoints (create, read, update, delete).<br>• Implement map entity auto-provisioning at server startup (creating entity for each room/floor combination).<br>• Implement map entity lookup endpoint (`GET /api/map/entity`).<br>• Build entity listing and creation UI. | • Working entity CRUD API.<br>• Map locations linked to collaborative entities.<br>• Entity listing and creation in the UI. |
| **Week 8** | Collaborative Features | • Implement comment system (comments as child entities with `parentEntityId`).<br>• Implement entity references (tagging) with automatic author user entity reference injection.<br>• Implement `entity_references` edge collection synchronization.<br>• Build comment and reference UI with search-based reference selection. | • Working comment system with threaded discussions.<br>• Entity cross-referencing with visual tags.<br>• Reference edges stored in ArangoDB edge collection. |
| **Week 9** | Collaborative Features | • Implement follow/unfollow endpoints with idempotent key-based storage.<br>• Implement notification generation for followers on new comments.<br>• Implement WebSocket server with authentication and event broadcasting.<br>• Build notification UI and real-time update handling. | • Follow/unfollow functionality.<br>• Automated notification generation.<br>• Real-time WebSocket updates across all connected clients.<br>• Notification UI with read/unread state. |
| **Week 10** | Advanced Features | • Implement Court of Justice: trial creation, interactive judge negotiation (propose/counter-propose/accept), judge agreement tracking.<br>• Implement voting system with outcome calculation.<br>• Link trials to trial entities for discussion.<br>• Build trial UI with judge negotiation dialogue. | • Working trial creation and judge negotiation flow.<br>• Voting with automated outcome calculation.<br>• Trial discussion threads.<br>• Trial UI with role indicators (plaintiff, defendant, judge, spectator). |
| **Week 11** | Advanced Features | • Implement deep research API: entity reference traversal (`GET /api/research/references`).<br>• Implement full-text search (`GET /api/research/fulltext`) using AQL text filtering.<br>• Implement degree-of-separation analysis (`GET /api/research/degree`) using AQL `ANY SHORTEST_PATH`.<br>• Implement activity feed endpoint.<br>• Build research UI and activity feed UI. | • Three working deep research APIs.<br>• Activity feed with chronological entity and trial events.<br>• Research tools UI in the collaborative interface. |
| **Week 12** | Testing & Polish | • Write comprehensive API tests covering all endpoints, edge cases, and error conditions.<br>• Write end-to-end Puppeteer tests covering critical user journeys (signup, create entity, comment, navigate map, file trial).<br>• Fix bugs discovered during testing.<br>• Optimize AQL queries for performance. | • Passing API test suite.<br>• Passing E2E test suite.<br>• Bug fixes and performance improvements. |
| **Week 13** | Testing & Polish | • Conduct UI/UX review and polish (responsive design, loading states, error messages).<br>• Implement Tailwind CSS styling refinements.<br>• Add animation enhancements with Anime.js.<br>• Write user-facing tutorial documentation.<br>• Write comprehensive API documentation. | • Polished, mobile-friendly UI.<br>• Complete API documentation (`/docs/collaborative-api.md`).<br>• User tutorial (`/docs/tutorial.md`). |
| **Week 14** | Reporting | • Write final project report with evaluation, benchmarks, and reflections.<br>• Prepare project demonstration materials.<br>• Record demo video (if required).<br>• Final code cleanup, README update, and repository organization.<br>• Submit all deliverables. | • **Deliverable: Final Report submitted.**<br>• **Deliverable: Project demonstration ready.**<br>• Clean, documented, open-source repository. |

### 4.3 Milestones and Deliverables

| Milestone | Target Week | Deliverable |
|---|---|---|
| M1: Proposal Submitted | Week 2 | Proposal Report (this document) |
| M2: Infrastructure Running | Week 4 | Docker Compose stack with working auth system |
| M3: Map Navigation Complete | Week 6 | Interactive map with pathfinding and multi-stop planning |
| M4: Collaborative Core Complete | Week 9 | Entity system, comments, references, follows, notifications, WebSocket |
| M5: All Features Complete | Week 11 | Court of Justice, deep research APIs, activity feed |
| M6: Testing Complete | Week 12 | Passing API and E2E test suites |
| M7: Final Submission | Week 14 | Final report, documentation, demonstration |

### 4.4 Risk Assessment and Mitigation

| Risk | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|
| ArangoDB learning curve delays development | Medium | Medium | Allocate extra time in Weeks 3–4 for ArangoDB documentation study and AQL experimentation. Use ArangoDB Web UI for interactive query testing. |
| Graph traversal queries underperform on large datasets | Low | High | Implement indexing on `entity_references` edge collection. Profile queries during Week 12 and optimize AQL. Consider pagination for large result sets. |
| WebSocket connection management complexity | Medium | Medium | Use simple in-memory maps for session-to-socket mapping. Implement graceful degradation—if WebSocket fails, UI falls back to polling. |
| Scope creep from feature additions | High | Medium | Strictly adhere to the defined scope. Track features against the checklist. Defer nice-to-have features to post-project improvements. |
| Single developer bottleneck | High | High | Prioritize core features (map, entities, auth) over advanced features (trials, research). Build incrementally and test continuously to avoid late-stage integration problems. |
| Docker environment inconsistencies | Low | Low | Use pinned image versions (`arangodb:3.11`, Node.js 20). Document all environment variables. Test deployment on a clean machine before submission. |
| Data loss during development | Low | High | Use Docker volumes for ArangoDB data persistence. Maintain Git version control with frequent commits. Implement database auto-provisioning for easy fresh starts. |

---

## 5. Tools and Programming Languages

### 5.1 Database Management System

| Component | Details |
|---|---|
| **DBMS** | ArangoDB |
| **Version** | 3.11 (via Docker image `arangodb:3.11`) |
| **Data Models Used** | Document store, key-value store, graph database |
| **Query Language** | AQL (ArangoDB Query Language) |
| **Driver** | `arangojs` v10.2.2 (official JavaScript/TypeScript driver) |
| **Deployment** | Docker container orchestrated via Docker Compose |
| **Administration** | ArangoDB Web UI (accessible at port 8529) |
| **Collections** | `users`, `entities`, `follows`, `notifications`, `trials` (document); `entity_references` (edge) |

### 5.2 Programming Languages

| Language | Usage | Justification |
|---|---|---|
| **TypeScript** | Frontend application code (React components, map rendering, pathfinding algorithms, traveling salesman solver) | TypeScript adds static type checking to JavaScript, catching errors at compile time and improving code maintainability. Essential for a complex frontend with multiple interacting modules. |
| **JavaScript (ES Modules)** | Backend server code (`server.mjs`), API tests, E2E tests | Node.js with ES Modules provides a modern, performant runtime for the Express backend. Using JavaScript (rather than TypeScript) on the backend reduces build complexity while maintaining compatibility with the `arangojs` driver. |
| **AssemblyScript** | WebAssembly compilation target for performance-critical algorithms | AssemblyScript compiles TypeScript-like code to WebAssembly, enabling near-native performance for computationally intensive operations such as pathfinding and traveling salesman optimization. |
| **HTML5 / CSS3** | Page structure and styling | Standard web technologies for rendering the user interface. |
| **AQL** | Database queries embedded in backend code | ArangoDB Query Language for all database operations—document CRUD, graph traversals, text search, and aggregation. |

### 5.3 Frameworks and Libraries

#### Frontend Frameworks and Libraries

| Library | Version | Purpose |
|---|---|---|
| **React** | 18.2.0 | Component-based UI framework for building the interactive frontend. React's declarative rendering model simplifies state management for the complex, real-time collaborative interface. |
| **React DOM** | 18.2.0 | React renderer for the browser DOM. |
| **Hyperscript** | 2.0.2 | Lightweight DOM element creation utility used alongside React for certain UI components. Provides a concise `h()` API for programmatic element construction. |
| **Tailwind CSS** | 3.3.6 | Utility-first CSS framework for rapid UI styling. Enables consistent, responsive design without writing custom CSS for every component. |
| **Anime.js** | 3.2.2 | JavaScript animation library used for smooth UI transitions, map animations, and visual feedback (e.g., route highlighting, notification popups). |
| **libsodium-wrappers** | 0.8.2 | JavaScript wrapper for the libsodium cryptographic library. Used for client-side password hashing (`crypto_pwhash`) as part of the multi-step authentication protocol. |
| **libsodium-wrappers-sumo** | 0.8.2 | Extended build of libsodium-wrappers that includes the full `crypto_pwhash` implementation required for Argon2-based password hashing. |

#### Backend Frameworks and Libraries

| Library | Version | Purpose |
|---|---|---|
| **Express** | 5.2.1 | Minimal, flexible Node.js web application framework. Provides routing, middleware, and static file serving for the backend API. Version 5 includes async error handling improvements. |
| **ws** | 8.19.0 | High-performance WebSocket library for Node.js. Used to implement the real-time WebSocket server that broadcasts entity and trial events to connected clients. |
| **arangojs** | 10.2.2 | Official ArangoDB JavaScript driver. Provides a Promise-based API for database operations, collection management, and AQL query execution. |
| **uuid** | 13.0.0 | RFC-compliant UUID generator. Used to generate unique identifiers for entities, users, trials, notifications, and session tokens. |

### 5.4 Development and DevOps Tools

| Tool | Version/Details | Purpose |
|---|---|---|
| **Vite** | 5.0.8 | Next-generation frontend build tool. Provides fast Hot Module Replacement (HMR) during development and optimized production builds via Rollup. Significantly faster than Webpack for TypeScript/React projects. |
| **PostCSS** | 8.4.32 | CSS transformation tool used as a pipeline for Tailwind CSS processing. Integrates with Vite's build pipeline. |
| **Autoprefixer** | 10.4.16 | PostCSS plugin that automatically adds vendor prefixes to CSS rules, ensuring cross-browser compatibility. |
| **Docker** | Latest | Container runtime for isolating and packaging application services. Each service (ArangoDB, backend) runs in its own container. |
| **Docker Compose** | Latest (V2) | Multi-container orchestration tool. The `docker-compose.yml` defines the complete stack (ArangoDB + backend) with networking, volumes, and environment variables for single-command deployment. |
| **Node.js** | 20.x (LTS) | JavaScript runtime for the backend server. Version 20 provides stable ES Module support, built-in test runner, and performance improvements. |
| **npm** | Bundled with Node.js | Package manager for JavaScript dependencies. Manages both frontend and backend dependencies through a single `package.json`. |
| **Git** | Latest | Version control system. The project is hosted on GitHub as an open-source repository under the 0BSD license. |
| **Concurrently** | 9.0.1 | Development utility for running multiple npm scripts simultaneously (e.g., frontend dev server + backend server). |

### 5.5 Testing Frameworks

| Tool | Usage | Details |
|---|---|---|
| **Node.js Built-in Test Runner** | API integration tests | Uses `node --test` to run backend API tests (`backend/tests/api.test.mjs`). Tests cover all API endpoints including authentication, entity CRUD, trials, research, and edge cases. |
| **Puppeteer** | End-to-end browser tests | Headless Chrome automation for E2E testing (`backend/tests/e2e.test.mjs`). Tests run against the full Docker Compose deployment to validate production-like behavior, including UI interactions, navigation, entity creation, and real-time updates. |

### 5.6 Development Environment

| Component | Details |
|---|---|
| **Operating System** | Linux (Ubuntu/Debian for Docker host; any OS with Docker Desktop for local development) |
| **IDE/Editor** | Visual Studio Code (recommended) with TypeScript, Tailwind CSS IntelliSense, and Docker extensions |
| **Browser** | Google Chrome (for development, debugging, and Puppeteer E2E tests) |
| **ArangoDB Web UI** | Browser-based database administration at `http://localhost:8529` for interactive query testing and data inspection |
| **API Testing** | `curl`, Postman, or VS Code REST Client for manual API exploration during development |

---

## 6. Expected Outcomes

Upon completion, the project is expected to deliver the following outcomes:

1. **A fully functional, deployed web application** that serves as an interactive campus map and collaborative knowledge platform for HCMIU. The application will be accessible via a web browser and will be mobile-friendly through responsive design.

2. **Demonstration of multi-model database capabilities** through the use of ArangoDB as the sole database system, leveraging its document, graph, and key-value models within a single application. This will serve as a practical case study for using multi-model databases in complex, interconnected application domains.

3. **Advanced graph-based research features** including:
   - Entity reference graph traversal, allowing users to discover all entities that reference a given set of entities.
   - Full-text search across all entity titles and bodies, powered by AQL text filtering.
   - Degree-of-separation analysis using ArangoDB's native `ANY SHORTEST_PATH` graph traversal, revealing the reference distance between any two entities in the system.

4. **A real-time collaborative experience** where changes to entities, comments, and trials are reflected immediately in all connected clients via WebSocket-based event broadcasting. This demonstrates modern real-time web application patterns powered by a graph database backend.

5. **An open-source reference architecture** released under the 0BSD license, complete with:
   - Comprehensive API documentation.
   - User-facing tutorial.
   - Docker Compose deployment configuration.
   - Automated API and E2E test suites.
   - Clean, well-organized codebase suitable for study and extension by other developers and campuses.

6. **A transparent governance experiment** through the Court of Justice module, demonstrating how structured, database-backed dispute resolution workflows can be implemented and how graph-based entity relationships can provide context and accountability for community governance decisions.

7. **Quantitative performance insights** into ArangoDB's behavior under the project's workload patterns, including graph traversal latency for degree-of-separation queries, entity CRUD throughput, and WebSocket event broadcasting performance. These insights will be documented in the final report.

---

## 7. References

1. ArangoDB GmbH. (2024). *ArangoDB Documentation*. Retrieved from https://docs.arangodb.com/
2. ArangoDB GmbH. (2024). *AQL — ArangoDB Query Language*. Retrieved from https://docs.arangodb.com/stable/aql/
3. ArangoDB GmbH. (2024). *ArangoDB Graph Course*. Retrieved from https://university.arangodb.com/
4. DB-Engines. (2026). *DB-Engines Ranking*. Retrieved from https://db-engines.com/en/ranking
5. DB-Engines. (2026). *ArangoDB System Properties*. Retrieved from https://db-engines.com/en/system/ArangoDB
6. Meta Open Source. (2024). *React Documentation*. Retrieved from https://react.dev/
7. Evan You et al. (2024). *Vite Documentation*. Retrieved from https://vitejs.dev/
8. Express.js Contributors. (2024). *Express.js Documentation*. Retrieved from https://expressjs.com/
9. Frank Denis. (2024). *libsodium Documentation*. Retrieved from https://doc.libsodium.org/
10. Docker, Inc. (2024). *Docker Compose Documentation*. Retrieved from https://docs.docker.com/compose/
11. Tailwind Labs. (2024). *Tailwind CSS Documentation*. Retrieved from https://tailwindcss.com/docs
12. AssemblyScript Contributors. (2024). *AssemblyScript Documentation*. Retrieved from https://www.assemblyscript.org/
13. Google Chrome Team. (2024). *Puppeteer Documentation*. Retrieved from https://pptr.dev/
14. Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2022). *Introduction to Algorithms* (4th ed.). MIT Press. — Reference for shortest-path algorithms (Dijkstra's) and traveling salesman problem heuristics used in the map navigation module.
15. Robinson, I., Webber, J., & Eifrem, E. (2015). *Graph Databases: New Opportunities for Connected Data* (2nd ed.). O'Reilly Media. — Background reference for graph data modeling principles applied in the entity reference system.

---

*This proposal report was prepared for the IT089IU — Advanced Database Management Systems course at the International University, Vietnam National University, Ho Chi Minh City. The project is open-source and available at https://github.com/huynhtrankhanh/hcmiu-map-collaborative under the 0BSD license.*
