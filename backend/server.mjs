import crypto from "node:crypto";
import http from "node:http";
import express from "express";
import { WebSocketServer } from "ws";
import { Database } from "arangojs";
import { v4 as uuidv4 } from "uuid";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const randomSalt = () => crypto.randomBytes(16).toString("base64");

class InMemoryStore {
  constructor() {
    this.users = new Map();
    this.entities = new Map();
    this.follows = new Map();
    this.notifications = new Map();
    this.trials = new Map();
  }
  async init() {}
  async getUserByUsername(username) {
    for (const user of this.users.values()) if (user.username === username) return user;
    return null;
  }
  async createUser(user) {
    this.users.set(user.id, user);
  }
  async getUserById(id) {
    return this.users.get(id) ?? null;
  }
  async createEntity(entity) {
    this.entities.set(entity.id, entity);
  }
  async getEntity(id) {
    return this.entities.get(id) ?? null;
  }
  async listEntities(filter = {}) {
    return [...this.entities.values()].filter((entity) => {
      if (filter.type && entity.type !== filter.type) return false;
      if (filter.parentEntityId && entity.parentEntityId !== filter.parentEntityId) return false;
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async followEntity(userId, entityId) {
    const key = `${entityId}:${userId}`;
    this.follows.set(key, { userId, entityId, createdAt: new Date().toISOString() });
  }
  async listFollowers(entityId) {
    return [...this.follows.values()].filter((f) => f.entityId === entityId);
  }
  async createNotification(notification) {
    if (!this.notifications.has(notification.userId)) this.notifications.set(notification.userId, []);
    this.notifications.get(notification.userId).push(notification);
  }
  async listNotifications(userId) {
    return (this.notifications.get(userId) ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async markNotificationRead(userId, notificationId) {
    const items = this.notifications.get(userId) ?? [];
    const target = items.find((x) => x.id === notificationId);
    if (target) target.read = true;
  }
  async createTrial(trial) {
    this.trials.set(trial.id, trial);
  }
  async updateTrial(trial) {
    this.trials.set(trial.id, trial);
  }
  async getTrial(id) {
    return this.trials.get(id) ?? null;
  }
  async listTrials() {
    return [...this.trials.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

class ArangoStore extends InMemoryStore {
  constructor(url, databaseName, username, password) {
    super();
    this.db = new Database({ url });
    this.databaseName = databaseName;
    this.username = username;
    this.password = password;
  }
  async init() {
    this.db.useBasicAuth(this.username, this.password);
    const dbs = await this.db.listDatabases();
    if (!dbs.includes(this.databaseName)) {
      await this.db.createDatabase(this.databaseName);
    }
    this.db.useDatabase(this.databaseName);

    const collections = ["users", "entities", "follows", "notifications", "trials"];
    for (const name of collections) {
      const collection = this.db.collection(name);
      if (!(await collection.exists())) await collection.create();
    }
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
}

const toEntityId = (prefix) => `${prefix}_${uuidv4().replace(/-/g, "")}`;

export async function createServer(options = {}) {
  const {
    port = Number(process.env.PORT ?? 3000),
    useInMemory = process.env.USE_IN_MEMORY_DB === "1",
    arangoUrl = process.env.ARANGO_URL ?? "http://arangodb:8529",
    arangoDatabase = process.env.ARANGO_DATABASE ?? "hcmiu_map",
    arangoUser = process.env.ARANGO_USER ?? "root",
    arangoPassword = process.env.ARANGO_PASSWORD ?? "changeme",
    allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  } = options;

  const store = useInMemory
    ? new InMemoryStore()
    : new ArangoStore(arangoUrl, arangoDatabase, arangoUser, arangoPassword);
  await store.init();

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
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

  app.post("/api/entities", auth, async (req, res) => {
    const references = Array.isArray(req.body.references) ? req.body.references.filter(Boolean) : [];
    const tags = Array.isArray(req.body.tags) ? req.body.tags.filter(Boolean) : [];
    const entity = {
      id: toEntityId("entity"),
      type: req.body.type ?? "post",
      title: `${req.body.title ?? ""}`.trim(),
      body: `${req.body.body ?? ""}`.trim(),
      parentEntityId: req.body.parentEntityId ? String(req.body.parentEntityId) : null,
      references,
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

    const judges = (Array.isArray(req.body.judges) ? req.body.judges : []).map((j) => `${j}`.trim()).filter(Boolean);
    const judgeUsers = [];
    for (const username of judges) {
      const user = await store.getUserByUsername(username);
      if (!user) return res.status(404).json({ error: `judge not found: ${username}` });
      judgeUsers.push(user.id);
    }

    if (req.user.id === trial.plaintiffUserId) trial.plaintiffProposedJudges = judgeUsers;
    else if (req.user.id === trial.defendantUserId) trial.defendantProposedJudges = judgeUsers;
    else return res.status(403).json({ error: "only plaintiff/defendant can propose judges" });

    const sortedPlaintiff = [...trial.plaintiffProposedJudges].sort().join(",");
    const sortedDefendant = [...trial.defendantProposedJudges].sort().join(",");
    if (sortedPlaintiff && sortedPlaintiff === sortedDefendant) {
      trial.agreedJudges = [...trial.plaintiffProposedJudges];
      trial.status = "active";
    } else {
      trial.status = "pending_agreement";
      trial.agreedJudges = [];
      trial.votes = {};
      trial.outcome = null;
    }

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
    const entities = await store.listEntities();
    const result = entities.filter((entity) => entity.references?.some((ref) => ids.includes(ref)));
    res.json({ entities: result });
  });

  app.get("/api/research/fulltext", async (req, res) => {
    const q = `${req.query.q ?? ""}`.trim().toLowerCase();
    const entities = await store.listEntities();
    const result = !q ? entities : entities.filter((entity) => `${entity.title} ${entity.body}`.toLowerCase().includes(q));
    res.json({ entities: result });
  });

  app.get("/api/research/degree", async (req, res) => {
    const from = `${req.query.from ?? ""}`;
    const to = `${req.query.to ?? ""}`;
    const entities = await store.listEntities();
    const byId = new Map(entities.map((e) => [e.id, e]));
    if (!byId.has(from) || !byId.has(to)) return res.status(404).json({ error: "entity not found" });

    const queue = [[from]];
    const seen = new Set([from]);
    let path = null;
    while (queue.length) {
      const currentPath = queue.shift();
      const last = currentPath[currentPath.length - 1];
      if (last === to) {
        path = currentPath;
        break;
      }
      const nextRefs = byId.get(last)?.references ?? [];
      for (const ref of nextRefs) {
        if (!seen.has(ref) && byId.has(ref)) {
          seen.add(ref);
          queue.push([...currentPath, ref]);
        }
      }
    }

    if (!path) return res.status(404).json({ error: "no path" });
    res.json({ path, entities: path.map((id) => byId.get(id)) });
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
