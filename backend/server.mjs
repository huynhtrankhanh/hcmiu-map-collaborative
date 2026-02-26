import crypto from "node:crypto";
import http from "node:http";
import express from "express";
import { WebSocketServer } from "ws";
import { Database } from "arangojs";
import { v4 as uuidv4 } from "uuid";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const randomSalt = () => crypto.randomBytes(16).toString("base64");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ArangoStore {
  constructor(url, databaseName, username, password) {
    this.url = url;
    this.db = new Database({ url });
    this.databaseName = databaseName;
    this.username = username;
    this.password = password;
  }
  async init() {
    const systemDb = new Database({ url: this.url });
    systemDb.useBasicAuth(this.username, this.password);
    const dbs = await systemDb.listDatabases();
    if (!dbs.includes(this.databaseName)) {
      await systemDb.createDatabase(this.databaseName);
    }
    this.db = systemDb.database(this.databaseName);

    const collections = ["users", "entities", "follows", "notifications", "trials"];
    for (const name of collections) {
      const collection = this.db.collection(name);
      if (!(await collection.exists())) await collection.create();
    }
    const referenceEdges = this.db.collection("entity_references");
    if (!(await referenceEdges.exists())) await referenceEdges.create({ type: 3 });
  }
  async syncEntityReferences(entityId, references = []) {
    const fromId = `entities/${entityId}`;
    await this.db.query(`FOR edge IN entity_references FILTER edge._from == @fromId REMOVE edge IN entity_references`, { fromId });
    if (!references.length) return;
    const uniqueReferences = [...new Set(references)];
    await this.db.query(`
      FOR targetKey IN @targets
        LET targetDoc = DOCUMENT(CONCAT("entities/", targetKey))
        FILTER targetDoc != null
        INSERT {
          _key: SHA256(CONCAT(@fromId, ":", targetKey)),
          _from: @fromId,
          _to: CONCAT("entities/", targetKey),
          createdAt: @createdAt
        } INTO entity_references OPTIONS { overwriteMode: "replace" }
    `, { targets: uniqueReferences, fromId, createdAt: new Date().toISOString() });
  }
  async getUserByUsername(username) {
    const cursor = await this.db.query(`FOR u IN users FILTER u.username == @username LIMIT 1 RETURN u`, { username });
    return (await cursor.next()) ?? null;
  }
  async createUser(user) {
    await this.db.collection("users").save({ _key: user.id, ...user });
  }
  async getUserById(id) {
    const cursor = await this.db.query(`FOR u IN users FILTER u.id == @id LIMIT 1 RETURN u`, { id });
    return (await cursor.next()) ?? null;
  }
  async createEntity(entity) {
    await this.db.collection("entities").save({ _key: entity.id, ...entity });
    await this.syncEntityReferences(entity.id, entity.references);
  }
  async updateEntity(entity) {
    await this.db.collection("entities").replace(entity.id, { _key: entity.id, ...entity });
    await this.syncEntityReferences(entity.id, entity.references);
  }
  async deleteEntity(id) {
    const docId = `entities/${id}`;
    await this.db.query(`FOR edge IN entity_references FILTER edge._from == @docId OR edge._to == @docId REMOVE edge IN entity_references`, { docId });
    await this.db.collection("entities").remove(id);
  }
  async getEntity(id) {
    const cursor = await this.db.query(`FOR e IN entities FILTER e.id == @id LIMIT 1 RETURN e`, { id });
    return (await cursor.next()) ?? null;
  }
  async listEntities(filter = {}) {
    const bind = { type: filter.type ?? null, parent: filter.parentEntityId ?? null };
    const cursor = await this.db.query(`
      FOR e IN entities
        FILTER (@type == null OR e.type == @type)
        FILTER (@parent == null OR e.parentEntityId == @parent)
        SORT e.createdAt DESC
        RETURN e
    `, bind);
    return await cursor.all();
  }
  async followEntity(userId, entityId) {
    const _key = sha256(`${entityId}:${userId}`);
    await this.db.collection("follows").save({ _key, userId, entityId, createdAt: new Date().toISOString() }, { overwriteMode: "ignore" });
  }
  async unfollowEntity(userId, entityId) {
    const _key = sha256(`${entityId}:${userId}`);
    const collection = this.db.collection("follows");
    if (await collection.documentExists(_key)) await collection.remove(_key);
  }
  async listFollowers(entityId) {
    const cursor = await this.db.query(`FOR f IN follows FILTER f.entityId == @entityId RETURN f`, { entityId });
    return await cursor.all();
  }
  async createNotification(notification) {
    await this.db.collection("notifications").save({ _key: notification.id, ...notification });
  }
  async listNotifications(userId) {
    const cursor = await this.db.query(`FOR n IN notifications FILTER n.userId == @userId SORT n.createdAt DESC RETURN n`, { userId });
    return await cursor.all();
  }
  async markNotificationRead(userId, notificationId) {
    const collection = this.db.collection("notifications");
    const doc = await collection.document(notificationId);
    if (doc.userId === userId) await collection.update(notificationId, { read: true });
  }
  async createTrial(trial) {
    await this.db.collection("trials").save({ _key: trial.id, ...trial });
  }
  async updateTrial(trial) {
    await this.db.collection("trials").replace(trial.id, { _key: trial.id, ...trial });
  }
  async getTrial(id) {
    const cursor = await this.db.query(`FOR t IN trials FILTER t.id == @id LIMIT 1 RETURN t`, { id });
    return (await cursor.next()) ?? null;
  }
  async listTrials() {
    const cursor = await this.db.query(`FOR t IN trials SORT t.createdAt DESC RETURN t`);
    return await cursor.all();
  }
  async listReferencingEntities(ids = []) {
    if (!ids.length) return [];
    const cursor = await this.db.query(`
      FOR edge IN entity_references
        FILTER PARSE_IDENTIFIER(edge._to).key IN @ids
        COLLECT from = edge._from
        LET entity = DOCUMENT(from)
        FILTER entity != null
        RETURN entity
    `, { ids });
    return await cursor.all();
  }
  async searchEntitiesByText(queryText) {
    const q = `${queryText ?? ""}`.trim().toLowerCase();
    const cursor = await this.db.query(`
      FOR e IN entities
        FILTER @q == "" OR CONTAINS(LOWER(CONCAT_SEPARATOR(" ", e.title, e.body)), @q)
        SORT e.createdAt DESC
        RETURN e
    `, { q });
    return await cursor.all();
  }
  async shortestReferencePath(from, to) {
    const cursor = await this.db.query(`
      LET start = DOCUMENT(CONCAT("entities/", @from))
      LET target = DOCUMENT(CONCAT("entities/", @to))
      FILTER start != null AND target != null
      FOR vertex IN ANY SHORTEST_PATH start TO target entity_references
        RETURN vertex
    `, { from, to });
    const vertices = await cursor.all();
    if (!vertices.length) return null;
    const path = vertices.map((vertex) => vertex.id);
    return { path, entities: vertices };
  }
}

const toEntityId = (prefix) => `${prefix}_${uuidv4().replace(/-/g, "")}`;

export async function createServer(options = {}) {
  const {
    port = Number(process.env.PORT ?? 3000),
    arangoUrl = process.env.ARANGO_URL ?? "http://arangodb:8529",
    arangoDatabase = process.env.ARANGO_DATABASE ?? "hcmiu_map",
    arangoUser = process.env.ARANGO_USER ?? "root",
    arangoPassword = process.env.ARANGO_PASSWORD ?? "changeme",
    allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  } = options;

  const store = new ArangoStore(arangoUrl, arangoDatabase, arangoUser, arangoPassword);
  let initialized = false;
  let lastError = null;
  for (let i = 0; i < 180; i++) {
    try {
      await store.init();
      initialized = true;
      break;
    } catch (error) {
      lastError = error;
      await sleep(1000);
    }
  }
  if (!initialized) throw lastError;

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  const sessions = new Map();
  const signupChallenges = new Map();
  const wsClients = new Map();

  const sendWs = (payload, userId) => {
    const msg = JSON.stringify(payload);
    if (userId) {
      for (const client of wsClients.get(userId) ?? []) {
        if (client.readyState === 1) client.send(msg);
      }
      return;
    }
    for (const clients of wsClients.values()) {
      for (const client of clients) if (client.readyState === 1) client.send(msg);
    }
  };

  const auth = async (req, res, next) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token || !sessions.has(token)) return res.status(401).json({ error: "Unauthorized" });
    const userId = sessions.get(token);
    const user = await store.getUserById(userId);
    if (!user) return res.status(401).json({ error: "Invalid session" });
    req.user = user;
    next();
  };

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.post("/api/auth/signup/start", async (req, res) => {
    const username = `${req.body.username ?? ""}`.trim();
    if (!username) return res.status(400).json({ error: "username required" });
    if (await store.getUserByUsername(username)) return res.status(409).json({ error: "username exists" });

    const challenge = { username, clientSalt: randomSalt(), serverSalt: randomSalt(), expiresAt: Date.now() + 5 * 60_000 };
    signupChallenges.set(username, challenge);
    res.json({ clientSalt: challenge.clientSalt, serverSalt: challenge.serverSalt });
  });

  app.post("/api/auth/signup/finish", async (req, res) => {
    const username = `${req.body.username ?? ""}`.trim();
    const clientHash = `${req.body.clientHash ?? ""}`;
    const challenge = signupChallenges.get(username);
    if (!challenge || challenge.expiresAt < Date.now()) return res.status(400).json({ error: "challenge expired" });
    if (challenge.clientSalt !== req.body.clientSalt || challenge.serverSalt !== req.body.serverSalt) return res.status(400).json({ error: "invalid salt pair" });

    const id = toEntityId("user");
    const user = {
      id,
      username,
      clientSalt: challenge.clientSalt,
      serverSalt: challenge.serverSalt,
      passwordHash: sha256(`${clientHash}:${challenge.serverSalt}`),
      createdAt: new Date().toISOString(),
    };
    await store.createUser(user);
    await store.createEntity({
      id: toEntityId("entity"),
      type: "user",
      title: username,
      body: `User profile for ${username}`,
      references: [],
      tags: [],
      createdBy: id,
      createdAt: user.createdAt,
    });

    signupChallenges.delete(username);
    const token = uuidv4();
    sessions.set(token, user.id);
    res.status(201).json({ token, user: { id: user.id, username: user.username } });
  });

  app.post("/api/auth/login/start", async (req, res) => {
    const username = `${req.body.username ?? ""}`.trim();
    const user = await store.getUserByUsername(username);
    if (!user) return res.status(404).json({ error: "user not found" });
    res.json({ clientSalt: user.clientSalt, serverSalt: user.serverSalt });
  });

  app.post("/api/auth/login/finish", async (req, res) => {
    const username = `${req.body.username ?? ""}`.trim();
    const clientHash = `${req.body.clientHash ?? ""}`;
    const user = await store.getUserByUsername(username);
    if (!user) return res.status(404).json({ error: "user not found" });
    if (sha256(`${clientHash}:${user.serverSalt}`) !== user.passwordHash) return res.status(401).json({ error: "invalid credentials" });
    const token = uuidv4();
    sessions.set(token, user.id);
    res.json({ token, user: { id: user.id, username: user.username } });
  });

  app.get("/api/auth/me", auth, (req, res) => {
    res.json({ user: { id: req.user.id, username: req.user.username } });
  });

  app.get("/api/entities", async (req, res) => {
    const entities = await store.listEntities({
      type: req.query.type ? String(req.query.type) : undefined,
      parentEntityId: req.query.parentEntityId ? String(req.query.parentEntityId) : undefined,
    });
    res.json({ entities });
  });

  app.get("/api/map/entity", async (req, res) => {
    const constructName = `${req.query.constructName ?? ""}`.trim();
    if (!constructName) return res.status(400).json({ error: "constructName required" });

    const floor = Number(req.query.floor ?? 1);
    const normalizedName = `Floor ${Number.isFinite(floor) && floor > 0 ? floor : 1}: ${constructName}`;
    const id = `entity_map_${sha256(normalizedName).slice(0, 24)}`;
    let entity = await store.getEntity(id);
    if (!entity) {
      entity = {
        id,
        type: "map_location",
        title: normalizedName,
        body: `Collaborative thread for ${normalizedName}`,
        parentEntityId: null,
        references: [],
        tags: ["map", "room-or-stairs"],
        createdBy: "system",
        createdAt: new Date().toISOString(),
      };
      await store.createEntity(entity);
    }

    const comments = await store.listEntities({ type: "comment", parentEntityId: id });
    const referencing = await store.listReferencingEntities([id]);
    res.json({ entity, comments, referencingCount: referencing.length });
  });

  app.post("/api/entities", auth, async (req, res) => {
    const references = new Set(Array.isArray(req.body.references) ? req.body.references.filter(Boolean) : []);
    const tags = Array.isArray(req.body.tags) ? req.body.tags.filter(Boolean) : [];
    if ((req.body.type ?? "post") === "comment") {
      const userEntities = await store.listEntities({ type: "user" });
      const creatorUserEntity = userEntities.find((x) => x.createdBy === req.user.id);
      if (creatorUserEntity) references.add(creatorUserEntity.id);
    }
    const entity = {
      id: toEntityId("entity"),
      type: req.body.type ?? "post",
      title: `${req.body.title ?? ""}`.trim(),
      body: `${req.body.body ?? ""}`.trim(),
      parentEntityId: req.body.parentEntityId ? String(req.body.parentEntityId) : null,
      references: [...references],
      tags,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
    };
    if (!entity.title && !entity.body) return res.status(400).json({ error: "content required" });

    await store.createEntity(entity);
    sendWs({ type: "entity.created", entity });

    if (entity.parentEntityId) {
      const followers = await store.listFollowers(entity.parentEntityId);
      for (const follower of followers) {
        if (follower.userId === req.user.id) continue;
        const notification = {
          id: toEntityId("notif"),
          userId: follower.userId,
          entityId: entity.parentEntityId,
          message: `${req.user.username} commented on an entity you follow`,
          read: false,
          createdAt: new Date().toISOString(),
        };
        await store.createNotification(notification);
        sendWs({ type: "notification.created", notification }, follower.userId);
      }
    }

    res.status(201).json({ entity });
  });

  app.post("/api/entities/:id/follow", auth, async (req, res) => {
    const entity = await store.getEntity(req.params.id);
    if (!entity) return res.status(404).json({ error: "entity not found" });
    await store.followEntity(req.user.id, entity.id);
    res.status(204).end();
  });

  app.post("/api/entities/:id/unfollow", auth, async (req, res) => {
    const entity = await store.getEntity(req.params.id);
    if (!entity) return res.status(404).json({ error: "entity not found" });
    await store.unfollowEntity(req.user.id, entity.id);
    res.status(204).end();
  });

  app.patch("/api/entities/:id", auth, async (req, res) => {
    const entity = await store.getEntity(req.params.id);
    if (!entity) return res.status(404).json({ error: "entity not found" });
    if (entity.createdBy !== req.user.id) return res.status(403).json({ error: "only creator can edit entity" });

    entity.title = req.body.title !== undefined ? `${req.body.title}`.trim() : entity.title;
    entity.body = req.body.body !== undefined ? `${req.body.body}`.trim() : entity.body;
    if (Array.isArray(req.body.references)) entity.references = req.body.references.filter(Boolean);
    if (Array.isArray(req.body.tags)) entity.tags = req.body.tags.filter(Boolean);
    await store.updateEntity(entity);
    sendWs({ type: "entity.updated", entity });
    res.json({ entity });
  });

  app.delete("/api/entities/:id", auth, async (req, res) => {
    const entity = await store.getEntity(req.params.id);
    if (!entity) return res.status(404).json({ error: "entity not found" });
    if (entity.createdBy !== req.user.id) return res.status(403).json({ error: "only creator can delete entity" });
    await store.deleteEntity(entity.id);
    sendWs({ type: "entity.deleted", id: entity.id });
    res.status(204).end();
  });

  app.get("/api/notifications", auth, async (req, res) => {
    const notifications = await store.listNotifications(req.user.id);
    res.json({ notifications });
  });

  app.post("/api/notifications/:id/read", auth, async (req, res) => {
    await store.markNotificationRead(req.user.id, req.params.id);
    res.status(204).end();
  });

  const calculateOutcome = (trial) => {
    if (!trial.agreedJudges.length) return null;
    if (Object.keys(trial.votes).length < trial.agreedJudges.length) return null;
    const count = { plaintiff: 0, defendant: 0, no_winner: 0 };
    for (const vote of Object.values(trial.votes)) count[vote]++;
    if (count.plaintiff > count.defendant && count.plaintiff > count.no_winner) return "plaintiff";
    if (count.defendant > count.plaintiff && count.defendant > count.no_winner) return "defendant";
    return "no_winner";
  };

  app.get("/api/trials", async (_req, res) => {
    res.json({ trials: await store.listTrials() });
  });

  app.post("/api/trials", auth, async (req, res) => {
    const defendant = await store.getUserByUsername(`${req.body.defendantUsername ?? ""}`.trim());
    if (!defendant) return res.status(404).json({ error: "defendant not found" });

    const trialEntity = {
      id: toEntityId("entity"),
      type: "trial",
      title: `${req.body.title ?? ""}`.trim(),
      body: `${req.body.description ?? ""}`.trim(),
      references: [],
      tags: ["trial"],
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
    };
    await store.createEntity(trialEntity);

    const trial = {
      id: toEntityId("trial"),
      entityId: trialEntity.id,
      plaintiffUserId: req.user.id,
      defendantUserId: defendant.id,
      plaintiffProposedJudges: [],
      defendantProposedJudges: [],
      agreedJudges: [],
      votes: {},
      status: "pending_agreement",
      outcome: null,
      createdAt: trialEntity.createdAt,
      lastProposedJudges: [],
      lastProposedBy: null,
      judgeNegotiationHistory: [],
    };
    await store.createTrial(trial);
    sendWs({ type: "trial.created", trial });
    res.status(201).json({ trial, trialEntity });
  });

  app.get("/api/trials/:id", async (req, res) => {
    const trial = await store.getTrial(req.params.id);
    if (!trial) return res.status(404).json({ error: "trial not found" });
    res.json({ trial });
  });

  app.post("/api/trials/:id/propose-judges", auth, async (req, res) => {
    const trial = await store.getTrial(req.params.id);
    if (!trial) return res.status(404).json({ error: "trial not found" });
    if (trial.status !== "pending_agreement") return res.status(400).json({ error: "trial is not in pending_agreement status" });

    const isPlaintiff = req.user.id === trial.plaintiffUserId;
    const isDefendant = req.user.id === trial.defendantUserId;
    if (!isPlaintiff && !isDefendant) return res.status(403).json({ error: "only plaintiff/defendant can propose judges" });

    if (trial.lastProposedBy) {
      const lastWasPlaintiff = trial.lastProposedBy === trial.plaintiffUserId;
      if ((isPlaintiff && lastWasPlaintiff) || (isDefendant && !lastWasPlaintiff)) {
        return res.status(400).json({ error: "it is the other party's turn to respond" });
      }
    }

    const judges = (Array.isArray(req.body.judges) ? req.body.judges : []).map((j) => `${j}`.trim()).filter(Boolean);
    const judgeUsers = [];
    for (const username of judges) {
      const user = await store.getUserByUsername(username);
      if (!user) return res.status(404).json({ error: `judge not found: ${username}` });
      judgeUsers.push(user.id);
    }

    if (!trial.judgeNegotiationHistory) trial.judgeNegotiationHistory = [];
    trial.judgeNegotiationHistory.push({
      proposedBy: req.user.id,
      judges: judgeUsers,
      timestamp: new Date().toISOString(),
    });

    if (isPlaintiff) trial.plaintiffProposedJudges = judgeUsers;
    else trial.defendantProposedJudges = judgeUsers;
    trial.lastProposedJudges = judgeUsers;
    trial.lastProposedBy = req.user.id;

    await store.updateTrial(trial);
    sendWs({ type: "trial.updated", trial });
    res.json({ trial });
  });

  app.post("/api/trials/:id/accept-judges", auth, async (req, res) => {
    const trial = await store.getTrial(req.params.id);
    if (!trial) return res.status(404).json({ error: "trial not found" });
    if (trial.status !== "pending_agreement") return res.status(400).json({ error: "trial is not in pending_agreement status" });
    if (!trial.lastProposedBy || !trial.lastProposedJudges?.length) return res.status(400).json({ error: "no proposal to accept" });

    const isPlaintiff = req.user.id === trial.plaintiffUserId;
    const isDefendant = req.user.id === trial.defendantUserId;
    if (!isPlaintiff && !isDefendant) return res.status(403).json({ error: "only plaintiff/defendant can accept judges" });

    if (trial.lastProposedBy === req.user.id) return res.status(400).json({ error: "cannot accept your own proposal" });

    trial.agreedJudges = [...trial.lastProposedJudges];
    trial.plaintiffProposedJudges = [...trial.lastProposedJudges];
    trial.defendantProposedJudges = [...trial.lastProposedJudges];
    trial.status = "active";

    if (!trial.judgeNegotiationHistory) trial.judgeNegotiationHistory = [];
    trial.judgeNegotiationHistory.push({
      acceptedBy: req.user.id,
      judges: trial.agreedJudges,
      timestamp: new Date().toISOString(),
    });

    await store.updateTrial(trial);
    sendWs({ type: "trial.updated", trial });
    res.json({ trial });
  });

  app.post("/api/trials/:id/vote", auth, async (req, res) => {
    const trial = await store.getTrial(req.params.id);
    if (!trial) return res.status(404).json({ error: "trial not found" });
    if (trial.status !== "active") return res.status(400).json({ error: "trial not active" });
    if (!trial.agreedJudges.includes(req.user.id)) return res.status(403).json({ error: "only agreed judges can vote" });

    const vote = req.body.vote;
    if (!["plaintiff", "defendant", "no_winner"].includes(vote)) return res.status(400).json({ error: "invalid vote" });
    trial.votes[req.user.id] = vote;
    trial.outcome = calculateOutcome(trial);
    if (trial.outcome) trial.status = "resolved";
    await store.updateTrial(trial);
    sendWs({ type: "trial.updated", trial });
    res.json({ trial });
  });

  app.get("/api/research/references", async (req, res) => {
    const ids = `${req.query.ids ?? ""}`.split(",").map((x) => x.trim()).filter(Boolean);
    res.json({ entities: await store.listReferencingEntities(ids) });
  });

  app.get("/api/research/fulltext", async (req, res) => {
    const q = `${req.query.q ?? ""}`;
    res.json({ entities: await store.searchEntitiesByText(q) });
  });

  app.get("/api/research/degree", async (req, res) => {
    const from = `${req.query.from ?? ""}`;
    const to = `${req.query.to ?? ""}`;
    if (!from || !to) return res.status(400).json({ error: "from and to required" });
    const source = await store.getEntity(from);
    const destination = await store.getEntity(to);
    if (!source || !destination) return res.status(404).json({ error: "entity not found" });
    const result = await store.shortestReferencePath(from, to);
    if (!result) return res.status(404).json({ error: "no path" });
    res.json(result);
  });

  app.get("/api/activity", async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const [recentEntities, recentTrials] = await Promise.all([
      store.listEntities({}),
      store.listTrials(),
    ]);
    const items = [];
    for (const entity of recentEntities) {
      items.push({
        type: entity.type === "comment" ? "comment" : entity.type === "trial" ? "trial_entity" : entity.type,
        id: entity.id,
        title: entity.title,
        body: entity.body,
        createdBy: entity.createdBy,
        parentEntityId: entity.parentEntityId || null,
        createdAt: entity.createdAt,
      });
    }
    for (const trial of recentTrials) {
      items.push({
        type: "trial_update",
        id: trial.id,
        title: `Trial ${trial.id}`,
        body: `Status: ${trial.status}${trial.outcome ? `, Outcome: ${trial.outcome}` : ""}`,
        createdBy: trial.plaintiffUserId,
        createdAt: trial.createdAt,
      });
    }
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ items: items.slice(0, limit) });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", async (socket, req) => {
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token");
    const userId = token ? sessions.get(token) : null;
    if (!userId) {
      socket.send(JSON.stringify({ type: "hello", authenticated: false }));
      socket.close();
      return;
    }
    if (!wsClients.has(userId)) wsClients.set(userId, new Set());
    wsClients.get(userId).add(socket);
    socket.send(JSON.stringify({ type: "hello", authenticated: true }));
    socket.on("close", () => wsClients.get(userId)?.delete(socket));
  });

  await new Promise((resolve) => server.listen(port, resolve));

  return {
    port,
    app,
    server,
    wss,
    close: () => new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve())),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = await createServer();
  console.log(`Backend listening on ${server.port}`);
}
