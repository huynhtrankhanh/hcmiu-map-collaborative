import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import sodium from "libsodium-wrappers-sumo";
import { createServer } from "../server.mjs";

const root = "/home/runner/work/hcmiu-map-collaborative/hcmiu-map-collaborative";

const runCommand = (args) => {
  const result = spawnSync("docker", args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`docker ${args.join(" ")} failed with status ${result.status}`);
  }
};

const waitFor = async (url, timeoutMs = 180_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {}
    await delay(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const fetchJson = async (base, path, options = {}, token) => {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = response.status === 204 ? null : await response.json();
  return { status: response.status, ok: response.ok, body };
};

const fetchJsonOk = async (base, path, options = {}, token) => {
  const { status, ok, body } = await fetchJson(base, path, options, token);
  if (!ok) throw new Error(body?.error || `HTTP ${status}`);
  return body;
};

const pwhash = async (password, saltBase64) => {
  await sodium.ready;
  const salt = sodium.from_base64(saltBase64, sodium.base64_variants.ORIGINAL);
  const derived = sodium.crypto_pwhash(
    32,
    password,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_DEFAULT,
    "uint8array"
  );
  return sodium.to_base64(derived, sodium.base64_variants.ORIGINAL);
};

test("comprehensive collaborative flow", async () => {
  const port = 3900 + Math.floor(Math.random() * 200);
  runCommand(["compose", "up", "-d", "arangodb"]);
  await waitFor("http://127.0.0.1:8529/_api/version");
  let server;
  const base = `http://127.0.0.1:${port}`;

  try {
    server = await createServer({
      port,
      allowedOrigin: "*",
      arangoUrl: "http://127.0.0.1:8529",
      arangoDatabase: `hcmiu_map_test_${Date.now()}`,
      arangoUser: "root",
      arangoPassword: "changeme",
    });

    const signup = async (username, password) => {
      const start = await fetchJsonOk(base, "/api/auth/signup/start", { method: "POST", body: JSON.stringify({ username }) });
      const clientHash = await pwhash(password, start.clientSalt);
      const finish = await fetchJsonOk(base, "/api/auth/signup/finish", {
        method: "POST",
        body: JSON.stringify({ username, clientHash, clientSalt: start.clientSalt, serverSalt: start.serverSalt }),
      });
      return finish;
    };

    const plaintiff = await signup("plaintiff", "pw1");
    const defendant = await signup("defendant", "pw2");
    const judge = await signup("judge", "pw3");

    const post = await fetchJsonOk(base, "/api/entities", {
      method: "POST",
      body: JSON.stringify({ type: "post", title: "A", body: "Entity A", references: [] }),
    }, plaintiff.token);

    const mapEntityResult = await fetchJsonOk(base, "/api/map/entity?constructName=A1.109&floor=1");
    assert.equal(mapEntityResult.entity.type, "map_location");
    assert.equal(mapEntityResult.comments.length, 0);

    await fetchJsonOk(base, `/api/entities/${post.entity.id}/follow`, { method: "POST" }, defendant.token);
    await fetchJsonOk(base, `/api/entities/${post.entity.id}/unfollow`, { method: "POST" }, defendant.token);
    await fetchJsonOk(base, `/api/entities/${post.entity.id}/follow`, { method: "POST" }, defendant.token);

    const comment = await fetchJsonOk(base, "/api/entities", {
      method: "POST",
      body: JSON.stringify({ type: "comment", title: "", body: "I comment", parentEntityId: post.entity.id, references: [post.entity.id] }),
    }, plaintiff.token);
    assert.ok(comment.entity.id);
    const allEntities = await fetchJsonOk(base, "/api/entities");
    const plaintiffUserEntity = allEntities.entities.find((x) => x.type === "user" && x.createdBy === plaintiff.user.id);
    assert.ok(plaintiffUserEntity?.id);
    assert.ok(comment.entity.references.includes(plaintiffUserEntity.id));

    const edited = await fetchJsonOk(base, `/api/entities/${post.entity.id}`, {
      method: "PATCH",
      body: JSON.stringify({ body: "Entity A edited" }),
    }, plaintiff.token);
    assert.equal(edited.entity.body, "Entity A edited");

    const notifications = await fetchJsonOk(base, "/api/notifications", {}, defendant.token);
    assert.equal(notifications.notifications.length, 1);

    // Trial creation
    const trial = await fetchJsonOk(base, "/api/trials", {
      method: "POST",
      body: JSON.stringify({ title: "Case", description: "Case body", defendantUsername: "defendant" }),
    }, plaintiff.token);
    assert.equal(trial.trial.status, "pending_agreement");
    assert.deepEqual(trial.trial.lastProposedJudges, []);
    assert.equal(trial.trial.lastProposedBy, null);

    // Interactive judge agreement dialogue
    // Step 1: Plaintiff proposes judges
    const proposed1 = await fetchJsonOk(base, `/api/trials/${trial.trial.id}/propose-judges`, {
      method: "POST",
      body: JSON.stringify({ judges: ["judge"] }),
    }, plaintiff.token);
    assert.equal(proposed1.trial.status, "pending_agreement");
    assert.equal(proposed1.trial.lastProposedBy, plaintiff.user.id);
    assert.ok(proposed1.trial.judgeNegotiationHistory.length >= 1);

    // Step 2: Plaintiff cannot propose again (it's defendant's turn)
    const doublePropose = await fetchJson(base, `/api/trials/${trial.trial.id}/propose-judges`, {
      method: "POST",
      body: JSON.stringify({ judges: ["judge"] }),
    }, plaintiff.token);
    assert.equal(doublePropose.status, 400);

    // Step 3: Defendant accepts the proposal
    const accepted = await fetchJsonOk(base, `/api/trials/${trial.trial.id}/accept-judges`, {
      method: "POST",
    }, defendant.token);
    assert.equal(accepted.trial.status, "active");
    assert.ok(accepted.trial.agreedJudges.length > 0);

    // Step 4: Judge votes
    const voted = await fetchJsonOk(base, `/api/trials/${trial.trial.id}/vote`, {
      method: "POST",
      body: JSON.stringify({ vote: "plaintiff" }),
    }, judge.token);
    assert.equal(voted.trial.status, "resolved");

    // Test counter-propose flow with a second trial
    const trial2 = await fetchJsonOk(base, "/api/trials", {
      method: "POST",
      body: JSON.stringify({ title: "Case 2", description: "Counter-propose test", defendantUsername: "defendant" }),
    }, plaintiff.token);

    // Plaintiff proposes judge
    await fetchJsonOk(base, `/api/trials/${trial2.trial.id}/propose-judges`, {
      method: "POST",
      body: JSON.stringify({ judges: ["judge"] }),
    }, plaintiff.token);

    // Defendant counter-proposes (different judge list - but using same judge for simplicity)
    const counterProposed = await fetchJsonOk(base, `/api/trials/${trial2.trial.id}/propose-judges`, {
      method: "POST",
      body: JSON.stringify({ judges: ["plaintiff"] }),
    }, defendant.token);
    assert.equal(counterProposed.trial.status, "pending_agreement");
    assert.equal(counterProposed.trial.lastProposedBy, defendant.user.id);

    // Plaintiff accepts defendant's counter-proposal
    const accepted2 = await fetchJsonOk(base, `/api/trials/${trial2.trial.id}/accept-judges`, {
      method: "POST",
    }, plaintiff.token);
    assert.equal(accepted2.trial.status, "active");

    // Test cannot accept own proposal
    const trial3 = await fetchJsonOk(base, "/api/trials", {
      method: "POST",
      body: JSON.stringify({ title: "Case 3", description: "Self-accept test", defendantUsername: "defendant" }),
    }, plaintiff.token);
    await fetchJsonOk(base, `/api/trials/${trial3.trial.id}/propose-judges`, {
      method: "POST",
      body: JSON.stringify({ judges: ["judge"] }),
    }, plaintiff.token);
    const selfAccept = await fetchJson(base, `/api/trials/${trial3.trial.id}/accept-judges`, {
      method: "POST",
    }, plaintiff.token);
    assert.equal(selfAccept.status, 400);

    // Research tests
    const refs = await fetchJsonOk(base, `/api/research/references?ids=${post.entity.id}`);
    assert.ok(refs.entities.length >= 1);

    const fulltext = await fetchJsonOk(base, "/api/research/fulltext?q=Entity%20A");
    assert.ok(fulltext.entities.some((x) => x.id === post.entity.id));

    const degree = await fetchJsonOk(base, `/api/research/degree?from=${comment.entity.id}&to=${post.entity.id}`);
    assert.deepEqual(degree.path, [comment.entity.id, post.entity.id]);
    const reverseDegree = await fetchJsonOk(base, `/api/research/degree?from=${post.entity.id}&to=${comment.entity.id}`);
    assert.deepEqual(reverseDegree.path, [post.entity.id, comment.entity.id]);

    // Activity feed test
    const activity = await fetchJsonOk(base, "/api/activity?limit=10");
    assert.ok(activity.items.length > 0);
    assert.ok(activity.items[0].createdAt);
    assert.ok(activity.items[0].type);

    await fetchJsonOk(base, `/api/entities/${comment.entity.id}`, { method: "DELETE" }, plaintiff.token);
    const afterDelete = await fetchJsonOk(base, `/api/entities?parentEntityId=${post.entity.id}`);
    assert.equal(afterDelete.entities.length, 0);
  } finally {
    await server?.close();
    runCommand(["compose", "down", "-v"]);
  }
});
